import { fetchHttpsText } from "./httpsTextService";

export interface NpmRegistryCorePackage {
	time?: Record<string, string>;
	versions?: Record<string, { version: string }>;
}

/**
 * Fetches the metadata for the published `@angular/core` package from the npm registry.
 *
 * The request retrieves the JSON payload for the package, verifies the HTTP status,
 * and validates that the response contains a `versions` object before returning it.
 *
 * @returns The parsed npm registry metadata for `@angular/core`.
 * @throws Error when the registry request fails, the response is not HTTP 200,
 * the payload is invalid JSON, or the response does not match the expected shape.
 */
export async function fetchAngularCorePackage(): Promise<NpmRegistryCorePackage> {
	const response = await fetchHttpsText("https://registry.npmjs.org/@angular%2fcore", {
		headers: {
			Accept: "application/json",
			"Accept-Encoding": "gzip",
			"User-Agent": "AngularRadar-VSCode-Extension"
		},
		maxResponseBytes: 8 * 1024 * 1024,
		decompressGzip: true
	});
	if (response.statusCode !== 200) {
		throw new Error(`npm registry returned HTTP ${response.statusCode ?? "unknown"}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(response.body);
	} catch {
		throw new Error("Could not parse the npm registry response");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("versions" in parsed)) {
		throw new Error("npm registry returned an unexpected response format");
	}
	const versions = (parsed as { versions?: unknown }).versions;
	if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
		throw new Error("npm registry returned an unexpected response format");
	}
	return parsed as NpmRegistryCorePackage;
}