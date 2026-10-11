import type { ClientRequest, IncomingMessage } from "http";
import * as https from "https";
import type { Readable } from "stream";
import { createGunzip } from "zlib";

export type RemoteResponseErrorCode = "RESPONSE_TOO_LARGE" | "RESPONSE_INTERRUPTED" | "REQUEST_TIMEOUT";

export class RemoteResponseError extends Error {
	constructor(message: string, readonly code: RemoteResponseErrorCode) {
		super(message);
		this.name = "RemoteResponseError";
	}
}

export interface HttpsTextResponse {
	statusCode?: number;
	body: string;
}

export interface HttpsTextOptions {
	headers: Record<string, string>;
	maxResponseBytes: number;
	decompressGzip?: boolean;
	inactivityTimeoutMs?: number;
	totalTimeoutMs?: number;
}

/**
 * Fetches a remote HTTPS response body as UTF-8 text while enforcing safety limits.
 *
 * The request is rejected if the connection fails, the response is interrupted,
 * the body exceeds the configured size limit, or the request exceeds the configured
 * inactivity or total timeout windows.
 *
 * @param url - The HTTPS URL to request.
 * @param options - Request headers and timeout/size constraints.
 * @returns A promise resolving to the HTTP status code and response text body.
 */
export function fetchHttpsText(url: string, options: HttpsTextOptions): Promise<HttpsTextResponse> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let response: IncomingMessage | undefined;
		let responseStream: Readable | undefined;
		let totalTimeout: NodeJS.Timeout | undefined;
		let request: ClientRequest | undefined;

		const clearTotalTimeout = () => {
			if (totalTimeout) {
				clearTimeout(totalTimeout);
				totalTimeout = undefined;
			}
		};

		const fail = (error: Error) => {
			if (settled) { return; }
			settled = true;
			clearTotalTimeout();
			if (responseStream && responseStream !== response) { responseStream.destroy(); }
			response?.destroy();
			request?.destroy();
			reject(error);
		};

		const complete = (result: HttpsTextResponse) => {
			if (settled) { return; }
			settled = true;
			clearTotalTimeout();
			resolve(result);
		};

		request = https.get(url, { headers: options.headers }, (incomingResponse) => {
			response = incomingResponse;
			response.on("error", fail);
			response.on("aborted", () => {
				fail(new RemoteResponseError("Remote response was interrupted", "RESPONSE_INTERRUPTED"));
			});

			if (response.statusCode !== 200) {
				const statusCode = response.statusCode;
				complete({ statusCode, body: "" });
				response.destroy();
				return;
			}

			const isGzipEncoded = options.decompressGzip && response.headers["content-encoding"]?.toLowerCase() === "gzip";
			responseStream = isGzipEncoded ? response.pipe(createGunzip()) : response;
			if (responseStream !== response) { responseStream.on("error", fail); }

			let body = "";
			let receivedBytes = 0;
			responseStream.setEncoding("utf8");
			responseStream.on("data", (chunk: string) => {
				receivedBytes += Buffer.byteLength(chunk, "utf8");
				if (receivedBytes > options.maxResponseBytes) {
					fail(new RemoteResponseError("Remote response exceeded the maximum allowed size", "RESPONSE_TOO_LARGE"));
					return;
				}
				body += chunk;
			});
			responseStream.on("end", () => {
				if (!response?.complete) {
					fail(new RemoteResponseError("Remote response ended before the download was complete", "RESPONSE_INTERRUPTED"));
					return;
				}
				complete({ statusCode: response.statusCode, body });
			});
		});

		request.on("error", fail);
		request.setTimeout(options.inactivityTimeoutMs ?? 5000, () => {
			fail(new RemoteResponseError("Remote request timed out while waiting for data", "REQUEST_TIMEOUT"));
		});
		totalTimeout = setTimeout(() => {
			fail(new RemoteResponseError("Remote request exceeded its total time limit", "REQUEST_TIMEOUT"));
		}, options.totalTimeoutMs ?? 7000);
	});
}