import type { Memento } from "vscode";
import { fetchCachedHttpsValue } from "./cachedHttpsTextService";

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
export async function fetchAngularCorePackage(storage: Memento): Promise<{ package: NpmRegistryCorePackage; isStale: boolean; cacheWarning: boolean }> {
	const result = await fetchCachedHttpsValue(storage, "angularRadar.npmCore", "https://registry.npmjs.org/@angular%2fcore", {
		headers: {
			Accept: "application/json",
			"Accept-Encoding": "gzip",
			"User-Agent": "AngularRadar-VSCode-Extension"
		},
		maxResponseBytes: 8 * 1024 * 1024,
		decompressGzip: true
	}, parseNpmPackage, (npmPackage) => npmPackage, deserializeNpmPackage);
	return { package: result.value, isStale: result.isStale, cacheWarning: result.cacheWarning };
}

function parseNpmPackage(body: string): NpmRegistryCorePackage {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new Error("Could not parse the npm registry response");
	}
	if (!isNpmRegistryCorePackage(parsed)) {
		throw new Error("npm registry returned an unexpected response format");
	}
	const versions = Object.fromEntries(
		Object.entries(parsed.versions ?? {}).map(([version, metadata]) => [version, { version: metadata.version }])
	);
	const time: Record<string, string> = {};
	for (const version of Object.keys(versions)) {
		const publishedAt = parsed.time?.[version];
		if (typeof publishedAt === "string") { time[version] = publishedAt; }
	}
	return { versions, time };
}

function deserializeNpmPackage(value: unknown): NpmRegistryCorePackage {
	if (!isNpmRegistryCorePackage(value)) {
		throw new Error("Cached npm package has an unexpected format");
	}
	return value;
}

function isNpmRegistryCorePackage(value: unknown): value is NpmRegistryCorePackage {
	if (!value || typeof value !== "object" || Array.isArray(value) || !("versions" in value)) {
		return false;
	}
	const versions = value.versions;
	if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
		return false;
	}
	for (const [version, metadata] of Object.entries(versions)) {
		if (!version || !metadata || typeof metadata !== "object" || !("version" in metadata) || typeof metadata.version !== "string") {
			return false;
		}
	}
	if ("time" in value && value.time !== undefined) {
		if (!value.time || typeof value.time !== "object" || Array.isArray(value.time)) {
			return false;
		}
		if (Object.values(value.time).some((date) => typeof date !== "string")) {
			return false;
		}
	}
	return true;
}