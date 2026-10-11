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

type LoadStage = "support-policy" | "npm-registry";

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
	if (isLoading) { return; }
	isLoading = true;
	let loadStage: LoadStage = "support-policy";
	try {
		if (cachedSupportInfo && cachedReleases) {
			updatePage(renderPage(renderReleaseList(cachedReleases, cachedSupportInfo), undefined, false, false));
			return;
		}

		updatePage(renderPage('<p class="status">Loading stable releases...</p>', "Loading...", true));
		// TEMPORARY PERFORMANCE TESTING: replace with `await fetchAngularSupportInfo()` when removing metrics.
		//const supportInfo = await requestPerformanceService.measureRequest("Angular support policy", fetchAngularSupportInfo);
		const supportInfo = await fetchAngularSupportInfo();
		loadStage = "npm-registry";
		const releases = await fetchSupportedAngularReleases(supportInfo);
		cachedSupportInfo = supportInfo;
		cachedReleases = releases;
		updatePage(renderPage(renderReleaseList(releases, supportInfo), undefined, false, false));
	} catch (error: unknown) {
		const failure = describeLoadFailure(error, loadStage);
		const diagnostic = failure.diagnostic
			? `<details class="error-diagnostic"><summary>Technical details</summary><code>${escapeHtml(failure.diagnostic)}</code></details>`
			: "";
		const errorContent = `<section class="error-panel" role="alert"><h2 class="error-title">Angular release data is unavailable</h2><p class="error-cause">${escapeHtml(failure.cause)}</p><p class="error-support-link">For current support dates, consult the <a href="${angularSupportPolicyUrl}" target="_blank" rel="noreferrer">official Angular support policy</a>.</p>${diagnostic}</section>`;
		updatePage(renderPage(errorContent, "Try again"));
	} finally {
		isLoading = false;
	}
}

function describeLoadFailure(error: unknown, stage: LoadStage): { cause: string; diagnostic?: string } {
	const message = error instanceof Error ? error.message : typeof error === "string" ? error : "An unknown non-Error value was thrown";
	const errorCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
		? error.code
		: undefined;
	const networkErrorCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EHOSTUNREACH", "EHOSTDOWN", "ENETUNREACH", "EPIPE"]);
	const source = stage === "support-policy" ? "Angular's support policy" : "the npm registry";

	if (errorCode === "RESPONSE_TOO_LARGE") {
		return { cause: `The response from ${source} exceeded the allowed size limit. Try again later; if the problem persists, check the source directly.` };
	}
	if (errorCode === "RESPONSE_INTERRUPTED") {
		return { cause: `The download from ${source} ended before it was complete. Check your network connection and try again.` };
	}
	if (/timed out/i.test(message) || errorCode === "ETIMEDOUT" || errorCode === "REQUEST_TIMEOUT") {
		return { cause: `The request to ${source} timed out. Check your network connection or proxy settings, then try again.` };
	}
	if (errorCode && networkErrorCodes.has(errorCode)) {
		return { cause: `Could not connect to ${source} (${errorCode}). Check your network connection or proxy settings, then try again.` };
	}
	if (errorCode?.startsWith("ERR_TLS") || /CERT_(?:HAS_EXPIRED|REVOKED)|SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE/.test(errorCode ?? "")) {
		return { cause: `A secure connection to ${source} could not be established. Check your system certificates or proxy settings, then try again.` };
	}

	const httpStatus = message.match(/returned HTTP (\d+|unknown)/i)?.[1];
	if (httpStatus) {
		if (httpStatus === "429") {
			return { cause: `${source} is receiving too many requests. Wait briefly, then try again.` };
		}
		const statusCode = Number(httpStatus);
		if (statusCode >= 500) {
			return { cause: `${source} returned HTTP ${httpStatus}. The service may be temporarily unavailable; try again shortly.` };
		}
		return { cause: `${source} rejected the request with HTTP ${httpStatus}. The service endpoint or access policy may have changed.` };
	}

	if (stage === "support-policy" && /support table|table format/i.test(message)) {
		return { cause: "Angular's published support information could not be read because its document structure was not recognized. Check the official policy below for the latest information." };
	}
	if (stage === "npm-registry" && /unexpected response format|could not parse/i.test(message)) {
		return { cause: "The npm registry response was incomplete or had an unexpected format. Try again shortly." };
	}
	if (stage === "npm-registry" && /no stable versions for currently supported/i.test(message)) {
		return { cause: "The npm registry responded, but did not list stable releases for Angular versions marked as supported. The package data may be temporarily incomplete or out of sync." };
	}

	return {
		cause: `An unexpected error occurred while reading ${source}. You can still check Angular's official support policy below.`,
		diagnostic: message
	};
}

function updatePage(page: string): void {
	pageHtml = page;
	releasesViewProvider?.update(page);
	if (releasesPanel) {
		releasesPanel.webview.html = page;
	}
}

export function deactivate(): void {}