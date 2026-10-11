import type { AngularRelease } from "../models/angularRelease";
import type { AngularSupportInfo } from "../models/angularSupportInfo";
import { requestPerformanceService } from "./requestPerformanceService";
import { fetchAngularCorePackage } from "./npmRegistryService";
import { compareReleaseVersions, parseVersion } from "../utils/version";

/**
 * Builds a list of stable Angular releases belonging to currently supported major versions.
 *
 * It reads the published `@angular/core` versions from npm, retains the highest patch
 * release for each major/minor pair, creates corresponding GitHub release metadata,
 * and returns the releases sorted from newest to oldest.
 *
 * @param supportInfo - Support metadata keyed by Angular major version; its keys determine
 * which major versions are included.
 * @returns The supported stable releases, ordered by descending version.
 * @throws Error if npm provides no stable versions for the supported major versions.
 */
export async function fetchSupportedAngularReleases(supportInfo: Map<number, AngularSupportInfo>): Promise<AngularRelease[]> {
	// TEMPORARY PERFORMANCE TESTING: replace with `await fetchAngularCorePackage()` when removing metrics.
	//const npmPackage = await requestPerformanceService.measureRequest("npm @angular/core", fetchAngularCorePackage);
	const npmPackage = await fetchAngularCorePackage();
	const validMajors = new Set([...supportInfo.keys()]);
	const supportedMajorPrefixes = [...validMajors].flatMap((major) => [`${major}.`, `v${major}.`]);
	const highestPatchByMajorMinor = new Map<number, Map<number, AngularRelease>>();

	for (const versionKey of Object.keys(npmPackage.versions ?? {})) {
		if (!supportedMajorPrefixes.some((prefix) => versionKey.startsWith(prefix))) { continue; }

		const parsedVersion = parseVersion(versionKey);
		if (!parsedVersion) { continue; }

		const releaseTag = versionKey.startsWith("v") ? versionKey : `v${versionKey}`;
		const githubTag = parsedVersion.major < 20 || (parsedVersion.major === 20 && parsedVersion.minor < 3)
			? releaseTag.slice(1)
			: releaseTag;
		const release: AngularRelease = {
			tag_name: releaseTag,
			name: versionKey,
			html_url: `https://github.com/angular/angular/releases/tag/${githubTag}`,
			published_at: npmPackage.time?.[versionKey] ?? null,
			created_at: npmPackage.time?.[versionKey] ?? new Date(0).toISOString(),
			body: null,
			prerelease: false
		};

		const majorMap = highestPatchByMajorMinor.get(parsedVersion.major) ?? new Map<number, AngularRelease>();
		const current = majorMap.get(parsedVersion.minor);
		if (!current || compareReleaseVersions(release, current) > 0) {
			majorMap.set(parsedVersion.minor, release);
			highestPatchByMajorMinor.set(parsedVersion.major, majorMap);
		}
	}

	if (highestPatchByMajorMinor.size === 0) {
		throw new Error("npm registry returned no stable versions for currently supported Angular major versions");
	}

	const releases: AngularRelease[] = [];
	for (const major of [...validMajors].sort((left, right) => right - left)) {
		const majorMap = highestPatchByMajorMinor.get(major);
		if (!majorMap) { continue; }
		releases.push(...[...majorMap.values()].sort((left, right) => compareReleaseVersions(right, left)));
	}

	return releases.sort((left, right) => compareReleaseVersions(right, left));
}