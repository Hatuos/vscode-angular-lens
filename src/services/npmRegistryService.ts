import { createGunzip } from "zlib";
import * as https from "https";

export interface NpmRegistryCorePackage {
	time?: Record<string, string>;
	versions?: Record<string, { version: string }>;
}

export function fetchAngularCorePackage(): Promise<NpmRegistryCorePackage> {
	return new Promise((resolve, reject) => {
		const request = https.get("https://registry.npmjs.org/@angular%2fcore", {
			headers: {
				Accept: "application/json",
				"Accept-Encoding": "gzip",
				"User-Agent": "AngularLens-VSCode-Extension"
			}
		}, (response) => {
			const isGzipEncoded = response.headers["content-encoding"]?.toLowerCase() === "gzip";
			const bodyStream = isGzipEncoded ? response.pipe(createGunzip()) : response;
			let body = "";
			bodyStream.setEncoding("utf8");
			bodyStream.on("data", (chunk: string) => { body += chunk; });
			bodyStream.on("end", () => {
				if (response.statusCode !== 200) {
					reject(new Error(`npm registry returned HTTP ${response.statusCode ?? "unknown"}`));
					return;
				}

				try {
					const parsed: unknown = JSON.parse(body);
					if (!parsed || typeof parsed !== "object" || !("versions" in parsed) || typeof (parsed as { versions?: unknown }).versions !== "object") {
						reject(new Error("npm registry returned an unexpected response format"));
						return;
					}
					resolve(parsed as NpmRegistryCorePackage);
				} catch {
					reject(new Error("Could not parse the npm registry response"));
				}
			});
			bodyStream.on("error", reject);
			if (isGzipEncoded) {
				response.on("error", reject);
			}
		});

		request.setTimeout(15000, () => request.destroy(new Error("Timed out while contacting npm")));
		request.on("error", reject);
	});
}