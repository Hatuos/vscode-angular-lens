import * as https from "https";
import type { AngularSupportInfo } from "../models/angularSupportInfo";
import { addCalendarMonths, parseSupportEndDate } from "../utils/date";

const angularSupportSourceUrl = "https://raw.githubusercontent.com/angular/angular/main/adev/src/content/reference/releases.md";
export const angularSupportPolicyUrl = "https://angular.dev/reference/releases#actively-supported-versions";

export function fetchAngularSupportInfo(): Promise<Map<number, AngularSupportInfo>> {
	return new Promise((resolve, reject) => {
		const request = https.get(angularSupportSourceUrl, {
			headers: { "User-Agent": "AngularLens-VSCode-Extension" }
		}, (response) => {
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => { body += chunk; });
			response.on("end", () => {
				if (response.statusCode !== 200) {
					reject(new Error(`Angular returned HTTP ${response.statusCode ?? "unknown"}`));
					return;
				}

				try {
					resolve(parseAngularSupportInfo(body));
				} catch (error: unknown) {
					reject(error);
				}
			});
		});

		request.setTimeout(15000, () => request.destroy(new Error("Timed out while contacting Angular")));
		request.on("error", reject);
	});
}

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