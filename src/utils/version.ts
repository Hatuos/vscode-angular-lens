import type { AngularRelease } from "../models/angularRelease";

/**
 * Takes a version string and extract the major, minor, and patch numbers
 * 
 * If the string does not match the expected format, it returns undefined.
 * 
 * @param tgName Angular version string
 * @returns Object like: { major: X, minor: Y, patch: Z }
 */
export function parseVersion(tagName: string): { major: number; minor: number; patch: number } | undefined {
	const match = tagName.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
	if (!match) { return undefined;}
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Compares two Angular release tags using parseVersion
 * 
 * @param left First angular release tag
 * @param right Second angular release tag
 * @returns Negative if left is older / Zero if they are equal / Positive if left is newer
 */
export function compareReleaseVersions(left: AngularRelease, right: AngularRelease): number {
	const leftVersion = parseVersion(left.tag_name);
	const rightVersion = parseVersion(right.tag_name);

	if (!leftVersion || !rightVersion) { return 0;}
	if (leftVersion.major !== rightVersion.major) { return leftVersion.major - rightVersion.major; }
	if (leftVersion.minor !== rightVersion.minor) { return leftVersion.minor - rightVersion.minor; }

	return leftVersion.patch - rightVersion.patch;
}

/**
 * Parses the Angular version tag and returns only the major version
 * 
 * If the release is a prerelease, it returns undefined.
 * 
 * @param release Angular release
 * @returns Angular tag major version
 */
export function getMajorVersion(release: AngularRelease): number | undefined {
	if (release.prerelease) { return undefined; }
	const version = parseVersion(release.tag_name);
	return version ? version.major : undefined;
}