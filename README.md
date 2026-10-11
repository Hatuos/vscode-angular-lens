<p align="center">
	<img src="https://raw.githubusercontent.com/Hatuos/vscode-angular-radar/main/media/wzang-256.png" width="220" alt="A wizard holding an Angular Radar emblem">
</p>

<h1 align="center">Angular Radar</h1>

<p align="center">
	Browse Angular releases and support timelines from the VS Code Activity Bar.
</p>

---

<details open>
	<summary><strong>Table of Contents</strong></summary>

- [About](#about)
- [Features](#features)
- [Getting Started](#getting-started)
- [Development](#development)
- [Data Sources](#data-sources)
</details>

---

## About

Angular Radar is a lightweight VS Code extension for checking stable Angular releases without leaving your editor. It groups versions by supported major and minor release, and links each version to its official GitHub release page.

<p align="center">
	<img src="https://raw.githubusercontent.com/Hatuos/vscode-angular-radar/main/media/pluginPreview.png" alt="Angular Radar release list">
</p>

## Features

- Browse stable releases across supported Angular major versions.
- See the latest patch for each minor version, grouped by major.
- Check each major's official support status, release date, and active and LTS support end dates.
- Get a simple indicator of how much LTS support remains.
- Open release pages and changelogs directly from the release list.

## Getting Started

Angular Radar requires VS Code 1.90 or later and an internet connection to retrieve Angular release and support information.

1. Open **Angular Radar** from the Activity Bar.
2. In the **Releases** view, select **Load stable releases**.
3. Expand a major version to browse its minor releases and support information.

You can also run **Angular Radar: Open Releases** from the Command Palette to open the release list in an editor tab.

## Development

You need [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm compile
```

Open the project folder in VS Code and press **F5** to launch the Extension Development Host.

## Data Sources

- Release versions and publish dates: [npm registry](https://registry.npmjs.org/@angular%2fcore)
- Supported versions and support dates: [Angular release policy](https://angular.dev/reference/releases#actively-supported-versions)
- Release details and notes: [Angular releases on GitHub](https://github.com/angular/angular/releases)

Angular Radar fetches publicly available release and support information from these sources and presents it for convenience; it does not redistribute Angular's source code. Angular Radar is an independent project and is not affiliated with, endorsed by, or sponsored by Google or the Angular team. Angular is a trademark of Google LLC; all trademarks and source materials remain with their respective owners.

---

See [LICENSE](LICENSE) for license information.
