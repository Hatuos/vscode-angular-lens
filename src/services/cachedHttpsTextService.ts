import type { Memento } from "vscode";
import { RemoteResponseError, fetchHttpsText, type HttpsTextOptions, type HttpsTextResponse } from "./httpsTextService";

const cacheMaxAgeMs = 12 * 60 * 60 * 1000;
const cacheMaxStaleAgeMs = 16 * 60 * 60 * 1000;

const transientNetworkErrorCodes = new Set([
	"ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED",
	"ETIMEDOUT", "EHOSTUNREACH", "EHOSTDOWN", "ENETUNREACH", "EPIPE"
]);

interface CachedResponse {
	value: unknown;
	fetchedAt: number;
	etag?: string;
	lastModified?: string;
}

export interface CachedValue<T> {
	value: T;
	isStale: boolean;
	cacheWarning: boolean;
}

/**
 * Loads and parses a cached HTTPS response, refreshing it when its 12-hour cache
 * lifetime has expired. When available, ETag and Last-Modified validators are
 * sent so an unchanged response can be confirmed without downloading its body.
 *
 * A cached value is considered fresh for 12 hours and may be used after a
 * transient refresh failure while it is no more than 16 hours old. Storage
 * failures are reported separately from fetch failures so successfully fetched
 * data can still be returned.
 *
 * @param storage - VS Code persistent storage used to retain the response across restarts.
 * @param cacheKey - Storage key associated with this response.
 * @param url - HTTPS resource to fetch.
 * @param options - Request headers, response size limits, and timeout settings.
 * @param parse - Converts and validates the response body.
 * @param serialize - Converts the parsed value to a storage-safe representation.
 * @param deserialize - Validates and restores a value read from storage.
 * @returns The parsed value, whether stale data is used, and whether storage failed.
 * @throws Error when no valid cached value is available and the request or parsing fails.
 */
export async function fetchCachedHttpsValue<T>(
	storage: Memento,
	cacheKey: string,
	url: string,
	options: HttpsTextOptions,
	parse: (body: string) => T,
	serialize: (value: T) => unknown,
	deserialize: (value: unknown) => T
): Promise<CachedValue<T>> {
	let cacheWarning = false;
	let cachedResponse: CachedResponse | undefined;
	let cachedValue: T | undefined;
	try {
		const storedValue: unknown = storage.get<unknown>(cacheKey);
		if (isCachedResponse(storedValue)) {
			cachedResponse = storedValue;
			try {
				cachedValue = deserialize(storedValue.value);
			} catch {
				cachedResponse = undefined;
				try {
					await storage.update(cacheKey, undefined);
				} catch {
					cacheWarning = true;
				}
			}
		} else if (storedValue !== undefined) {
			try {
				await storage.update(cacheKey, undefined);
			} catch {
				cacheWarning = true;
			}
		}
	} catch {
		cacheWarning = true;
	}

	const now = Date.now();
	const cacheAgeMs = cachedResponse ? now - cachedResponse.fetchedAt : undefined;
	if (cachedValue !== undefined && cacheAgeMs !== undefined && cacheAgeMs < cacheMaxAgeMs) {
		return { value: cachedValue, isStale: false, cacheWarning };
	}

	const headers = { ...options.headers };
	if (cachedResponse?.etag) { headers["If-None-Match"] = cachedResponse.etag; }
	if (cachedResponse?.lastModified) { headers["If-Modified-Since"] = cachedResponse.lastModified; }

	//let response: HttpsTextResponse;
	let response;
	try {
		response = await fetchHttpsText(url, { ...options, headers });
		//const networkError = Object.assign(new Error("Test error: simulated network failure"), { code: "ECONNRESET" });
		//response = await Promise.reject<HttpsTextResponse>(networkError);
	} catch (error: unknown) {
		if (canUseCachedValue(cachedValue, cacheAgeMs) && isTransientNetworkFailure(error)) {
			return { value: cachedValue, isStale: true, cacheWarning };
		}
		throw error;
	}

	if (response.statusCode === 304) {
		if (cachedValue === undefined || !cachedResponse) {
			throw new Error("Remote source returned HTTP 304 without a valid cached response");
		}
		const refreshedCache: CachedResponse = {
			...cachedResponse,
			fetchedAt: Date.now(),
			etag: response.etag ?? cachedResponse.etag,
			lastModified: response.lastModified ?? cachedResponse.lastModified
		};
		try {
			await storage.update(cacheKey, refreshedCache);
		} catch {
			cacheWarning = true;
		}
		return { value: cachedValue, isStale: false, cacheWarning };
	}
	if (response.statusCode !== 200) {
		if (canUseCachedValue(cachedValue, cacheAgeMs) && isTransientHttpStatus(response.statusCode)) {
			return { value: cachedValue, isStale: true, cacheWarning };
		}
		throw new Error(`Remote source returned HTTP ${response.statusCode ?? "unknown"}`);
	}

	const value = parse(response.body);
	const refreshedCache: CachedResponse = {
		value: serialize(value),
		fetchedAt: Date.now(),
		etag: response.etag,
		lastModified: response.lastModified
	};
	try {
		await storage.update(cacheKey, refreshedCache);
	} catch {
		cacheWarning = true;
	}
	return { value, isStale: false, cacheWarning };
}

/**
 * Determines whether a cached value is recent enough to use after a transient
 * refresh failure. Its age is measured from its last validation.
 */
function canUseCachedValue<T>(value: T | undefined, ageMs: number | undefined): value is T {
	return value !== undefined && ageMs !== undefined && ageMs >= 0 && ageMs <= cacheMaxStaleAgeMs;
}

/**
 * Identifies network failures and temporary HTTP statuses for which using a
 * recent cached value is preferable to failing the data load.
 */
function isTransientNetworkFailure(error: unknown): boolean {
	if (error instanceof RemoteResponseError) {
		return error.code === "REQUEST_TIMEOUT" || error.code === "RESPONSE_INTERRUPTED";
	}
	return typeof error === "object"
		&& error !== null
		&& "code" in error
		&& typeof error.code === "string"
		&& transientNetworkErrorCodes.has(error.code);
}

/**
 * Checks whether an HTTP status represents a temporary server or rate-limit failure.
 */
function isTransientHttpStatus(statusCode: number | undefined): boolean {
	return statusCode === 408 || statusCode === 425 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500);
}

/**
 * Checks that a value read from extension storage has the shape expected for
 * a cached response before its value or HTTP validators are used.
 *
 * @param value - The untrusted value retrieved from persistent storage.
 * @returns Whether the value is a valid cached response.
 */
function isCachedResponse(value: unknown): value is CachedResponse {
	return typeof value === "object"
		&& value !== null
		&& "value" in value
		&& "fetchedAt" in value && typeof value.fetchedAt === "number" && Number.isFinite(value.fetchedAt) && value.fetchedAt <= Date.now()
		&& (!("etag" in value) || typeof value.etag === "string")
		&& (!("lastModified" in value) || typeof value.lastModified === "string");
}
