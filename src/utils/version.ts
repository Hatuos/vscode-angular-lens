import type { AngularRelease } from "../models/angularRelease";

export function parseVersion(tagName: string): { major: number; minor: number; patch: number } | undefined {
	const match = tagName.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
	if (!match) { return undefined;}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3])
	};
}

export function compareReleaseVersions(left: AngularRelease, right: AngularRelease): number {
	const leftVersion = parseVersion(left.tag_name);
	const rightVersion = parseVersion(right.tag_name);

	if (!leftVersion || !rightVersion) { return 0;}
	if (leftVersion.major !== rightVersion.major) { return leftVersion.major - rightVersion.major; }
	if (leftVersion.minor !== rightVersion.minor) { return leftVersion.minor - rightVersion.minor; }

	return leftVersion.patch - rightVersion.patch;
}

export function getMajorVersion(release: AngularRelease): number | undefined {
	if (release.prerelease) { return undefined; }
	const version = parseVersion(release.tag_name);
	return version ? version.major : undefined;
}