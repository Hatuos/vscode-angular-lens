import * as vscode from "vscode";
import { AngularReleasesViewProvider, isRefreshMessage } from "./providers/angularReleasesViewProvider";
import { angularSupportPolicyUrl, fetchAngularSupportInfo } from "./services/angularSupportPolicyService";
import { fetchSupportedAngularReleases } from "./services/angularReleasesService";
import { requestPerformanceService } from "./services/requestPerformanceService";
import type { AngularRelease } from "./models/angularRelease";
import type { AngularSupportInfo } from "./models/angularSupportInfo";
import { renderPage, renderReleaseList } from "./webview/releasePage";
import { escapeHtml } from "./utils/html";

let pageHtml = renderPage('<p class="status">Press to load stable Angular releases.</p>');
let releasesViewProvider: AngularReleasesViewProvider | undefined;
let releasesPanel: vscode.WebviewPanel | undefined;
let isLoading = false;
let cachedSupportInfo: Map<number, AngularSupportInfo> | undefined;
let cachedReleases: AngularRelease[] | undefined;

export function activate(context: vscode.ExtensionContext): void {
	releasesViewProvider = new AngularReleasesViewProvider(
		() => { void refreshReleases(); },
		() => pageHtml
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("angularLens.releases", releasesViewProvider),
		vscode.commands.registerCommand("angularLens.openReleases", openReleasesTab)
	);
}

function openReleasesTab(): void {
	if (releasesPanel) {
		releasesPanel.reveal(vscode.ViewColumn.One);
		return;
	}

	const panel = vscode.window.createWebviewPanel(
		"angularLens.releasesEditor",
		"Angular Lens: Releases",
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);
	releasesPanel = panel;
	panel.webview.html = pageHtml;
	panel.webview.onDidReceiveMessage((message: unknown) => {
		if (isRefreshMessage(message)) { void refreshReleases(); }
	});
	panel.onDidDispose(() => {
		if (releasesPanel === panel) { releasesPanel = undefined; }
	});
}

async function refreshReleases(): Promise<void> {
	if (isLoading) { return;}

	if (cachedSupportInfo && cachedReleases) {
		updatePage(renderPage(renderReleaseList(cachedReleases, cachedSupportInfo), undefined, false, false));
		return;
	}

	isLoading = true;
	updatePage(renderPage('<p class="status">Loading stable releases...</p>', "Loading...", true));
	try {
		// TEMPORARY PERFORMANCE TESTING: replace with `await fetchAngularSupportInfo()` when removing metrics.
		//const supportInfo = await requestPerformanceService.measureRequest("Angular support policy", fetchAngularSupportInfo);
		const supportInfo = await fetchAngularSupportInfo();
		const releases = await fetchSupportedAngularReleases(supportInfo);
		cachedSupportInfo = supportInfo;
		cachedReleases = releases;
		updatePage(renderPage(renderReleaseList(releases, supportInfo), undefined, false, false));
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown error";
		const supportLink = `<a href="${angularSupportPolicyUrl}" target="_blank" rel="noreferrer">Angular support policy</a>`;
		updatePage(renderPage(`<p class="error">Could not load Angular release information. Please try again later. ${supportLink}<br/>Details: ${escapeHtml(message)}</p>`, "Try again"));
	} finally {
		isLoading = false;
	}
}

function updatePage(page: string): void {
	pageHtml = page;
	releasesViewProvider?.update(page);
	if (releasesPanel) {
		releasesPanel.webview.html = page;
	}
}

export function deactivate(): void {}