import type { AngularSupportInfo } from "../models/angularSupportInfo";
import { addCalendarMonths, parseSupportEndDate } from "../utils/date";
import type { Memento } from "vscode";
import { fetchCachedHttpsValue } from "./cachedHttpsTextService";

const angularSupportSourceUrl = "https://raw.githubusercontent.com/angular/angular/main/adev/src/content/reference/releases.md";
export const angularSupportPolicyUrl = "https://angular.dev/reference/releases#actively-supported-versions";

export async function fetchAngularSupportInfo(storage: Memento): Promise<{ supportInfo: Map<number, AngularSupportInfo>; isStale: boolean; cacheWarning: boolean }> {
	const result = await fetchCachedHttpsValue(storage, "angularLens.supportPolicy", angularSupportSourceUrl, {
		headers: { "User-Agent": "AngularLens-VSCode-Extension" },
		maxResponseBytes: 160 * 1024
	}, parseAngularSupportInfo, (supportInfo) => Object.fromEntries(supportInfo), deserializeSupportInfo);
	return { supportInfo: result.value, isStale: result.isStale, cacheWarning: result.cacheWarning };
}

function deserializeSupportInfo(value: unknown): Map<number, AngularSupportInfo> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Cached Angular support information has an unexpected format");
	}
	const supportInfo = new Map<number, AngularSupportInfo>();
	for (const [majorText, info] of Object.entries(value)) {
		const major = Number(majorText);
		if (!Number.isInteger(major) || major <= 0 || !isAngularSupportInfo(info)) {
			throw new Error("Cached Angular support information has an unexpected format");
		}
		supportInfo.set(major, info);
	}
	if (supportInfo.size === 0) {
		throw new Error("Cached Angular support information is empty");
	}
	return supportInfo;
}

function isAngularSupportInfo(value: unknown): value is AngularSupportInfo {
	return typeof value === "object"
		&& value !== null
		&& "status" in value && typeof value.status === "string"
		&& "released" in value && typeof value.released === "string"
		&& "activeEnds" in value && typeof value.activeEnds === "string"
		&& "ltsEnds" in value && typeof value.ltsEnds === "string";
}

/**
 * Parses the Angular support policy table from the upstream markdown source and
 * extracts each major version's support status and end dates.
 *
 * The input is expected to contain the "### Actively supported versions" section.
 * The function scans the table rows, keeps only entries matching the supported
 * version pattern (for example `^v18.0.0`), and returns a map keyed by major version.
 *
 * @param markdown - The raw markdown content from Angular's releases page.
 * @returns A map of major version numbers to their support metadata.
 * @throws Error when the target section or the expected table format cannot be found.
 */
export function parseAngularSupportInfo(markdown: string): Map<number, AngularSupportInfo> {
	const heading = "### Actively supported versions";
	const sectionStart = markdown.indexOf(heading);
	if (sectionStart === -1) { throw new Error("Angular support table was not found"); }

	const nextSection = markdown.indexOf("\n### ", sectionStart + heading.length);
	const section = markdown.slice(sectionStart, nextSection === -1 ? undefined : nextSection);
	const supportInfo = new Map<number, AngularSupportInfo>();

	for (const line of section.split(/\r?\n/)) {
		if (!line.trim().startsWith("|")) { continue; }

		const columns = line.split("|").slice(1, -1).map((column) => column.trim());
		const versionMatch = columns[0]?.match(/^\^v?(\d+)\.0\.0$/);
		if (!versionMatch || columns.length < 5 || !/^(Active|LTS)$/.test(columns[1])) {
			continue;
		}

		supportInfo.set(Number(versionMatch[1]), {
			status: columns[1],
			released: columns[2],
			activeEnds: columns[3],
			ltsEnds: columns[4]
		});
	}

	if (supportInfo.size === 0) {
		throw new Error("Angular support table format was not recognized");
	}
	return supportInfo;
}

/**
 * Evaluates how much support remains for a given Angular major version.
 *
 * It checks the parsed support metadata for the requested major version and returns
 * a status label with a severity level. The result is based on the remaining time
 * until the support end date and uses thresholds of one month and six months.
 *
 * @param major - The Angular major version to evaluate.
 * @param supportInfo - The parsed support metadata map, if available.
 * @returns An object containing the support level and a human-readable label.
 */
export function getSupportIndicator(major: number, supportInfo?: Map<number, AngularSupportInfo>): { level: string; label: string } {
	if (!supportInfo) {
		return { level: "unknown", label: "Support information unavailable" };
	}
	const info = supportInfo.get(major);
	if (!info) {
		return { level: "red", label: "Not listed as currently supported" };
	}
	const supportEnd = parseSupportEndDate(info.ltsEnds);
	if (!supportEnd) {
		return { level: "unknown", label: "Could not read support end date" };
	}

	const now = new Date();
	if (supportEnd <= addCalendarMonths(now, 1)) {
		return { level: "red", label: "One month or less of support remains" };
	}
	if (supportEnd <= addCalendarMonths(now, 6)) {
		return { level: "yellow", label: "One to six months of support remain" };
	}
	return { level: "green", label: "More than six months of support remain" };
}