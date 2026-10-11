import { randomBytes } from "crypto";
import type { AngularRelease } from "../models/angularRelease";
import type { AngularSupportInfo } from "../models/angularSupportInfo";
import { angularSupportPolicyUrl, getSupportIndicator } from "../services/angularSupportPolicyService";
import { requestPerformanceService } from "../services/requestPerformanceService";
import { parseVersion, compareReleaseVersions, getMajorVersion } from "../utils/version";
import { escapeHtml } from "../utils/html";

export function renderReleaseList(releases: AngularRelease[], supportInfo?: Map<number, AngularSupportInfo>): string {
	const supportedMajors = [...new Set(
		releases
			.filter((release) => !release.prerelease)
			.map((release) => getMajorVersion(release))
			.filter((major): major is number => major !== undefined)
	)].sort((left, right) => right - left).slice(0, 3);

	const content = supportedMajors.map((major) => {
		const majorReleases = releases.filter((release) => getMajorVersion(release) === major);
		const minorGroups = new Map<number, AngularRelease[]>();

		for (const release of majorReleases) {
			const version = parseVersion(release.tag_name);
			if (!version) { continue; }

			const items = minorGroups.get(version.minor) ?? [];
			items.push(release);
			minorGroups.set(version.minor, items);
		}

		const rows = [...minorGroups.entries()]
			.sort(([left], [right]) => right - left)
			.map(([minor, minorReleases]) => {
				const latest = minorReleases.reduce((best, current) => compareReleaseVersions(current, best) > 0 ? current : best);
				const latestVersion = parseVersion(latest.tag_name);
				const date = new Date(latest.published_at ?? latest.created_at).toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric"
				});
				const notesLink = latest.body
					? `<a class="notes-link" href="${escapeHtml(latest.html_url)}" target="_blank" rel="noreferrer">Release notes</a>`
					: "";
				const label = latest.tag_name.startsWith("v") ? latest.tag_name : `v${latest.tag_name}`;
				const minorLabel = latestVersion ? `v${latestVersion.major}.${latestVersion.minor}` : `v${minor}`;
				return `<li class="tree-item"><span class="tree-node" aria-hidden="true"></span><div class="release-branch"><div class="release-header"><span class="minor-label">${escapeHtml(minorLabel)}</span><time class="release-date">${escapeHtml(date)}</time></div><div class="release"><a href="${escapeHtml(latest.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></div>${notesLink ? `<div class="notes-link-row">${notesLink}</div>` : ""}</div></li>`;
			})
			.join("");

		const indicator = getSupportIndicator(major, supportInfo);
		return `<details class="major"><summary class="major-summary"><span class="support-indicator support-indicator-${indicator.level}" role="img" aria-label="${escapeHtml(indicator.label)}" title="${escapeHtml(indicator.label)}"></span><span class="major-title">Angular ${major} - ${minorGroups.size} minors</span></summary><div class="major-body"><section>${renderSupportInfo(major, supportInfo, indicator)}<ul class="tree-list">${rows}</ul></section></div></details>`;
	}).join("");

	return content || '<p class="status">No stable releases found.</p>';
}

function renderSupportInfo(major: number, supportInfo?: Map<number, AngularSupportInfo>, indicator?: { level: string; label: string }): string {
	const info = supportInfo?.get(major);
	let content: string;
	if (!supportInfo) {
		content = `<p class="status">Could not load support information. <a href="${angularSupportPolicyUrl}" target="_blank" rel="noreferrer">View Angular support policy</a></p>`;
	} else if (!info) {
		content = `<p class="status">Not listed as currently supported. <a href="${angularSupportPolicyUrl}" target="_blank" rel="noreferrer">View Angular support policy</a></p>`;
	} else {
		content = `<div class="support-grid"><div><span class="support-label">Official support</span><strong>${escapeHtml(info.status)}</strong></div><div><span class="support-label">Released</span><strong>${escapeHtml(info.released)}</strong></div><div><span class="support-label">Active support ends</span><strong>${escapeHtml(info.activeEnds)}</strong></div><div><span class="support-label">LTS support ends</span><strong>${escapeHtml(info.ltsEnds)}</strong></div></div>`;
	}
	if (indicator) {
		const dotClass = `support-dot-${indicator.level}`;
		const statusRow = `<div class="support-meta"><span class="support-dot ${dotClass}" aria-hidden="true"></span><p class="support-summary"><strong>Status:</strong> ${escapeHtml(indicator.label)}</p></div>`;
		content = `${statusRow}${content}`;
	}
	return `<div class="support-info">${content}</div>`;
}

function renderRequestPerformanceInfo(): string {
	if (requestPerformanceService.size === 0) {
		return "";
	}

	const rows = [...requestPerformanceService.entries()].map(([name, stats]) => {
		const averageDurationMs = stats.totalDurationMs / stats.calls;
		return `<div class="request-performance-row"><strong>${escapeHtml(name)}</strong><span>${stats.calls} calls, last ${stats.lastDurationMs} ms, average ${averageDurationMs.toFixed(1)} ms</span></div>`;
	}).join("");
	return `<div class="request-performance"><span class="request-performance-title">Request performance (temporary)</span>${rows}</div>`;
}

export function renderPage(content: string, buttonLabel?: string, disabled = false, showRefreshButton = true): string {
	const nonce = randomBytes(16).toString("hex");
	const refreshButtonHtml = showRefreshButton
		? `<button id="refresh" type="button"${disabled ? " disabled" : ""}>${buttonLabel ? escapeHtml(buttonLabel) : "Load stable releases"}</button>`
		: "";
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<style>
		:root {
			color-scheme: light;
		}
		body.vscode-dark,
		body.vscode-high-contrast {
			color-scheme: dark;
		}
		body.vscode-light,
		body.vscode-high-contrast-light {
			color-scheme: light;
		}
		body {
			margin: 0;
			padding: 0;
			background: var(--vscode-sideBar-background, #1f1f1f);
			color: var(--vscode-foreground, #cccccc);
			font: var(--vscode-font-size, 13px) var(--vscode-font-family, sans-serif);
		}
		.panel {
			padding: 12px;
		}
		.toolbar {
			display: flex;
			justify-content: flex-start;
			align-items: center;
			padding: 0 0 10px;
			margin-bottom: 8px;
		}
		button {
			padding: 6px 12px;
			border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.12));
			border-radius: 4px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			font: inherit;
			font-weight: 600;
			cursor: pointer;
			transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
		}
		button:hover {
			background: var(--vscode-button-hoverBackground);
			border-color: var(--vscode-focusBorder, var(--vscode-button-border, transparent));
			box-shadow: 0 2px 8px rgba(0,0,0,0.18);
		}
		button:active:not(:disabled) {
			transform: translateY(1px);
			box-shadow: none;
		}
		button:focus-visible {
			outline: 2px solid var(--vscode-focusBorder, #3794ff);
			outline-offset: 2px;
		}
		button:disabled {
			cursor: default;
			opacity: 0.7;
			box-shadow: none;
		}
		.major {
			margin: 8px 0;
			position: relative;
			padding: 0 0 8px;
		}
		.major > summary {
			cursor: pointer;
			font-weight: 600;
			list-style: none;
			position: relative;
		}
		.major > summary::-webkit-details-marker {
			display: none;
		}
		.major > summary::after {
			content: "";
			position: absolute;
			right: 3px;
			top: 4px;
			width: 7px;
			height: 7px;
			border-right: 1.5px solid currentColor;
			border-bottom: 1.5px solid currentColor;
			opacity: 0.7;
			transform: rotate(45deg);
			transition: transform 200ms ease;
		}
		.major[open] > summary::after {
			transform: rotate(225deg);
		}
		.major-title {
			display: inline-flex;
			align-items: center;
			gap: 8px;
		}
		.major-body {
			position: relative;
			margin-top: 0;
			padding-left: 12px;
			border-left: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
			overflow: hidden;
			height: 0;
			opacity: 0;
			transform: translateY(-4px);
		}
		.major:not([open]) > .major-body {
			display: block;
		}
		.major[open] > .major-body {
			margin-top: 10px;
			opacity: 1;
			transform: translateY(0);
		}
		.major-body > section {
			min-height: 0;
			overflow: hidden;
		}
		.major-body::before {
			content: "";
			position: absolute;
			left: -1px;
			top: 0;
			bottom: 0;
			width: 1px;
			background: transparent;
		}
		.support-indicator {
			display: inline-block;
			width: 9px;
			height: 9px;
			margin-right: 8px;
			border-radius: 50%;
			vertical-align: middle;
			box-shadow: 0 0 4px 1px var(--indicator-glow);
		}
		.support-indicator-green {
			--indicator-glow: rgba(63,185,80,0.4);
			background: #3fb950;
		}
		.support-indicator-yellow {
			--indicator-glow: rgba(210,153,34,0.4);
			background: #d29922;
		}
		.support-indicator-red {
			--indicator-glow: rgba(248,81,73,0.4);
			background: #f85149;
		}
		.support-indicator-unknown {
			--indicator-glow: rgba(139,148,158,0.35);
			background: var(--vscode-descriptionForeground, #8b949e);
		}
		.support-info {
			margin-top: 8px;
			margin-bottom: 10px;
			border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
			padding-top: 6px;
		}
		.support-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			margin: 0 0 6px;
			color: var(--vscode-foreground, #cccccc);
			font-size: 0.9em;
		}
		.support-summary {
			margin: 0;
			color: var(--vscode-foreground, #cccccc);
		}
		.support-dot {
			display: inline-block;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex-shrink: 0;
			box-shadow: 0 0 4px 1px var(--indicator-glow);
		}
		.support-dot-green {
			--indicator-glow: rgba(63,185,80,0.4);
			background: #3fb950;
		}
		.support-dot-yellow {
			--indicator-glow: rgba(210,153,34,0.4);
			background: #d29922;
		}
		.support-dot-red {
			--indicator-glow: rgba(248,81,73,0.4);
			background: #f85149;
		}
		.support-dot-unknown {
			--indicator-glow: rgba(139,148,158,0.35);
			background: var(--vscode-descriptionForeground, #8b949e);
		}
		.support-grid {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px 12px;
			margin-top: 2px;
		}
		.support-grid div {
			display: flex;
			flex-direction: column;
			gap: 2px;
			min-width: 0;
		}
		.support-label {
			display: block;
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.72em;
			line-height: 1.2;
			text-transform: none;
		}
		.support-grid strong {
			font-size: 0.95em;
			line-height: 1.3;
		}
		/* TEMPORARY PERFORMANCE TESTING START */
		.request-performance {
			margin: 0 0 10px;
			padding: 0 0 8px;
			border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.82em;
		}
		.request-performance-title {
			display: block;
			margin-bottom: 4px;
			font-weight: 600;
		}
		.request-performance-row {
			display: flex;
			justify-content: space-between;
			gap: 8px;
			padding: 2px 0;
		}
		.request-performance-row strong {
			color: var(--vscode-foreground, #cccccc);
			font-weight: 500;
		}
		/* TEMPORARY PERFORMANCE TESTING END */
		section {
			padding-left: 12px;
		}
		.tree-list {
			position: relative;
			list-style: none;
			margin: 12px 0 0;
			padding: 0 0 0 20px;
		}
		.tree-list::before {
			content: "";
			position: absolute;
			left: 3px;
			top: 0;
			bottom: 0;
			width: 1px;
			background: var(--vscode-panel-border, rgba(255,255,255,0.12));
		}
		.tree-item {
			position: relative;
			padding: 8px 0 8px 18px;
			margin-left: 0;
		}
		.tree-item::before {
			content: "";
			position: absolute;
			left: 0;
			top: 18px;
			width: 14px;
			height: 1px;
			background: var(--vscode-panel-border, rgba(255,255,255,0.12));
		}
		.tree-node {
			position: absolute;
			left: -1px;
			top: 14px;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--vscode-activityBar-activeBadgeBackground, #3794ff);
			border: 2px solid var(--vscode-sideBar-background, #1f1f1f);
			box-shadow: 0 0 0 1px var(--vscode-panel-border, rgba(255,255,255,0.12));
		}
		h3 {
			margin: 10px 0 4px;
			font-size: 1em;
		}
		h3 span {
			color: var(--vscode-descriptionForeground, #8b949e);
			font-weight: 400;
		}
		ul {
			list-style: none;
			padding: 0;
			margin: 0;
		}
		li {
			padding: 0;
		}
		.release-branch {
			padding: 8px 0;
			border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
			border-radius: 6px;
			background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background, #1f1f1f));
			padding-left: 10px;
			padding-right: 10px;
		}
		.release-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
		}
		.minor-label {
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.8em;
			font-weight: 600;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
		.release {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			padding-bottom: 0;
		}
		a {
			color: var(--vscode-textLink-foreground, #3794ff);
			text-decoration: none;
			overflow-wrap: anywhere;
			font-weight: 600;
		}
		time {
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.9em;
		}
		.release-date {
			white-space: nowrap;
			padding: 2px 8px;
			border-radius: 999px;
			background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background, #1f1f1f));
			border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
		}
		.notes-link-row {
			margin-top: 2px;
		}
		.notes-link {
			display: inline-block;
			color: var(--vscode-textLink-foreground, #3794ff);
			text-decoration: none;
			font-size: 0.9em;
			font-weight: 500;
		}
		.notes-link:hover {
			text-decoration: underline;
		}
		.error-panel {
			margin: 12px 0;
			padding: 12px;
			border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
			border-left: 3px solid var(--vscode-errorForeground, #f85149);
			border-radius: 4px;
		}
		.error-title {
			margin: 0 0 8px;
			color: var(--vscode-errorForeground, #f85149);
			font-size: 1em;
		}
		.error-cause,
		.error-support-link {
			margin: 6px 0 0;
			line-height: 1.45;
		}
		.error-diagnostic {
			margin-top: 10px;
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.9em;
		}
		.error-diagnostic summary {
			cursor: pointer;
		}
		.error-diagnostic code {
			display: block;
			margin-top: 6px;
			overflow-wrap: anywhere;
		}
		.resource-links {
			margin-top: 16px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.12));
		}
		.resource-links h2 {
			margin: 0 0 8px;
			font-size: 0.95em;
		}
		.resource-links table {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed;
		}
		.resource-links th,
		.resource-links td {
			padding: 9px 8px 9px 0;
			text-align: left;
			vertical-align: top;
			font-weight: 400;
			border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
		}
		.resource-links th {
			width: 44%;
		}
		.resource-links tr:last-child th,
		.resource-links tr:last-child td {
			border-bottom: 0;
		}
		.resource-links a {
			display: block;
			font-weight: 600;
			font-size: 0.95em;
			line-height: 1.35;
		}
		.resource-links a:hover {
			text-decoration: underline;
		}
		.resource-links a:focus-visible {
			outline: 2px solid var(--vscode-focusBorder, #3794ff);
			outline-offset: 2px;
		}
		.resource-links td {
			color: var(--vscode-descriptionForeground, #8b949e);
			font-size: 0.9em;
			line-height: 1.4;
		}
		.status {
			color: var(--vscode-descriptionForeground, #8b949e);
		}
		@media (prefers-reduced-motion: reduce) {
			.major > summary::after,
			.major-body,
			button {
				transition: none;
			}
		}
	</style>
</head>
<body>
	<div class="panel">
		<div class="toolbar">${refreshButtonHtml}</div>
		${content}
		<footer class="resource-links" aria-label="Angular resources">
			<h2>Angular resources</h2>
			<table>
				<tbody>
					<tr><th scope="row"><a href="https://angular.dev/" target="_blank" rel="noreferrer">Official Angular website</a></th><td>Documentation, tutorials, and Angular resources</td></tr>
					<tr><th scope="row"><a href="https://angular.dev/reference/releases" target="_blank" rel="noreferrer">Versioning and support guide</a></th><td>Release schedule and support policy</td></tr>
					<tr><th scope="row"><a href="https://angular.dev/reference/versions" target="_blank" rel="noreferrer">Angular compatibility guide</a></th><td>Compatibility with Node.js, TypeScript, and RxJS</td></tr>
					<tr><th scope="row"><a href="https://github.com/angular/angular" target="_blank" rel="noreferrer">Angular GitHub repository</a></th><td>Source code, issues, and contributions</td></tr>
				</tbody>
			</table>
		</footer>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const refreshButton = document.getElementById("refresh");
		if (refreshButton) {
			refreshButton.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
		}

		const panelAnimations = new WeakMap();
		const panelOpenStates = new WeakMap();
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		for (const panel of document.querySelectorAll(".major")) {
			panelOpenStates.set(panel, panel.open);
			const summary = panel.querySelector("summary");
			if (!summary) continue;
			summary.addEventListener("click", (event) => {
				event.preventDefault();
				const body = panel.querySelector(".major-body");
				if (!body) return;

				const opening = !panelOpenStates.get(panel);
				panelOpenStates.set(panel, opening);
				const currentStyles = window.getComputedStyle(body);
				const currentHeight = body.getBoundingClientRect().height;
				const currentOpacity = currentStyles.opacity;
				const currentTransform = currentStyles.transform;
				const currentMarginTop = currentStyles.marginTop;
				panelAnimations.get(body)?.cancel();
				body.style.height = currentHeight + "px";
				body.style.opacity = currentOpacity;
				body.style.transform = currentTransform;
				body.style.marginTop = currentMarginTop;
				if (opening) panel.open = true;

				if (reducedMotion.matches) {
					body.style.height = opening ? "auto" : "0px";
					body.style.opacity = "";
					body.style.transform = "";
					body.style.marginTop = "";
					panel.open = opening;
					return;
				}

				const targetHeight = opening ? body.scrollHeight : 0;
				const animation = body.animate(
					[
						{ height: currentHeight + "px", opacity: currentOpacity, transform: currentTransform, marginTop: currentMarginTop },
						{ height: targetHeight + "px", opacity: opening ? 1 : 0, transform: opening ? "translateY(0)" : "translateY(-4px)", marginTop: opening ? "10px" : "0px" }
					],
					{ duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" }
				);
				panelAnimations.set(body, animation);
				animation.onfinish = () => {
					if (panelAnimations.get(body) !== animation) return;
					body.style.height = opening ? "auto" : "0px";
					body.style.opacity = "";
					body.style.transform = "";
					body.style.marginTop = "";
					if (!opening) panel.open = false;
					panelAnimations.delete(body);
				};
			});
		}
	</script>
</body>
</html>`;
}