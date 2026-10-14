<h1 align="center">Angular Lens</h1>

<p align="center">
	<strong>Explore Angular releases and support timelines without leaving VS Code.</strong>
</p>

<p align="center">
	<img src="https://raw.githubusercontent.com/Hatuos/vscode-angular-lens/main/media/wzmkplogo-768.png" width="768" alt="Angular Lens">
</p>

---

<details open>
	<summary><strong>Contents</strong></summary>

- [Overview](#overview)
- [Features](#features)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Data and caching](#data-and-caching)
- [Privacy and security](#privacy-and-security)
- [Data sources](#data-sources)
- [Development](#development)
- [License](#license)
</details>

---

## Overview

Angular Lens brings Angular's release history and support policy into VS Code. It lists stable releases for the currently supported Angular major versions, grouped by major and minor, and highlights the latest patch in each minor line. Expand a major version to see its official support status, release date, active-support and LTS end dates, plus an indicator of how much LTS time remains. Open the linked GitHub release page directly for more details.

<p align="center">
	<img src="https://raw.githubusercontent.com/Hatuos/vscode-angular-lens/main/media/pluginPreview.png" alt="Angular Lens showing Angular release versions and support information">
</p>

## Features

- **Release overview** — browse stable releases for Angular's currently supported major versions.
- **Latest patch by minor** — see the newest patch release for each minor version.
- **Support timelines** — review official status, release date, and active and LTS support end dates.
- **At-a-glance status** — see how much LTS support remains for each major version.
- **Release links** — open Angular release pages and release notes.

## Getting started

**Requirements:** VS Code 1.90 or later. An internet connection is required to retrieve or refresh data.

1. Install [Angular Lens from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Hatuos.angular-lens).
2. Open **Angular Lens** from the Activity Bar.
3. In the **Releases** view, select **Load stable releases**.
4. Expand a major version to see its support information and minor releases.

You can also run **Angular Lens: Open Releases** from the Command Palette to open the release list in an editor tab.

## Commands

| Command | Description |
| --- | --- |
| **Angular Lens: Open Releases** | Open the releases view in an editor tab. |

The initial data load is started from the **Releases** view. A retry or refresh action is shown when an earlier load failed or data had to be served from a saved copy.

## Data and caching

Angular Lens retrieves release metadata from the npm registry and support policy information from Angular's published release policy. It does not call the GitHub API; release links point to Angular's public GitHub pages.

To reduce network traffic, the extension stores the latest valid data in VS Code's global extension storage:

- Cached data is considered fresh for **12 hours**.
- After that, the extension revalidates the response with `ETag` or `Last-Modified` when the source provides one. A `304 Not Modified` response refreshes the cache without downloading the response body again.
- If a temporary network or server error prevents refresh, saved data can be used as a fallback for up to **16 hours from its last validation**.
- Permanent HTTP errors are shown rather than hidden by serving old data.

The cache is limited to the current npm release metadata and Angular support information. New successful responses replace previous entries.

## Privacy and security

- Angular Lens does not read project source files or send workspace content anywhere.
- The extension makes direct HTTPS requests to the public npm registry and Angular's support-policy source when data is requested or due for revalidation.
- The extension does not implement telemetry or analytics.
- Cached data stays in VS Code's global extension storage on the user's machine.

The source providers necessarily process normal connection metadata for these requests, such as the connecting IP address and request headers. See the providers' privacy policies for their data-handling details.

## Data sources

- **Release versions and publish dates:** [npm registry — `@angular/core`](https://registry.npmjs.org/@angular%2fcore)
- **Supported versions and support dates:** [Angular release policy](https://angular.dev/reference/releases#actively-supported-versions)
- **Release details and notes:** [Angular releases on GitHub](https://github.com/angular/angular/releases)

Angular Lens is an independent project and is not affiliated with, endorsed by, or sponsored by Google or the Angular team. Angular is a trademark of Google LLC. The extension presents publicly available information for convenience; all trademarks and source materials remain with their respective owners.

## Development

You need [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm compile
```

Open the project folder in VS Code and start the **Run Angular Lens** configuration from **Run and Debug** (or press **F5**) to launch an Extension Development Host.

## License

See [LICENSE](LICENSE) for the terms that apply to this project.
