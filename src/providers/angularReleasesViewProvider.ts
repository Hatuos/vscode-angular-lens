import * as vscode from "vscode";

export class AngularReleasesViewProvider implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;

	constructor(private readonly onRefresh: () => void, private readonly getPage: () => string) {}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.html = this.getPage();
		view.webview.onDidReceiveMessage((message: unknown) => {
			if (isRefreshMessage(message)) { this.onRefresh(); }
		});
		view.onDidDispose(() => {
			if (this.view === view) { this.view = undefined; }
		});
	}

	update(page: string): void {
		if (this.view) { this.view.webview.html = page; }
	}
}

export function isRefreshMessage(message: unknown): boolean {
	return typeof message === "object" && message !== null && "type" in message && message.type === "refresh";
}