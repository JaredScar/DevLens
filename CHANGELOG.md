# Changelog

All notable changes to Dev-Lens are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.2] — 2026-04-05

### Added

- **Settings → Features:** Per-feature toggles for optional productivity behavior—Spotlight, split view, focus mode, DevTools/Inspect, right sidebar and each built-in widget, toolbar actions (AI summarize, Fill menu, bookmark button, Chrome extension strip), browsing history recording, and automation rules. Core browsing (tabs, omnibox, workspaces) stays available.

### Changed

- **Licensing:** Project uses the MIT License (`LICENSE`); `package.json` declares `"license": "MIT"` and the README documents it.

## [0.2.1] — 2026-04-04

### Changed

- **Branding:** Consistent **DevLens** naming (no hyphen) in the shell top bar, new tab page, macOS application menu, focus-mode notifications, Chrome extension install dialogs, and the Chrome Web Store injected install bar.
- **Logo:** The top bar no longer uses the gradient diamond placeholder. It shows the real app icon (`electron/assets/icon.png`), copied into the Angular build. The in-app favicon uses the same asset.
- **Chrome Web Store bar:** The floating install bar shows the app icon next to **DevLens** instead of the blue-diamond emoji, with matching **DevLens** / **Add to DevLens** copy.

## [0.1.0] — 2026-04-04

### Added

- **GitHub Actions release workflow** (`.github/workflows/release.yml`): pushing a semver tag `v*.*.*` builds on Windows and macOS and uploads portable + NSIS `.exe`, `.dmg`, and `.zip` to that GitHub Release.
- Electron + Angular shell: tabs, workspaces, Spotlight, privacy blocker, notes, sessions, API tester, automation, themes, keyboard shortcuts, plugins (manifest + sandboxed sidebar webviews), read-later queue, performance panel, companion/encrypted backup exports.
- GitHub Actions CI: install, lint, build, Karma unit tests, Playwright, npm audit.
- Angular `tsconfig.spec.json` extends `tsconfig.app.json` so path aliases and `Window.devLens` typings apply under Karma.
- IPC payload validation (Zod) for high-risk main-process handlers.
- Optional crash log append (`userData/crash-log.txt`) for uncaught errors in main.
- Playwright smoke test against production Angular build.
- Documentation: README, ADRs under `docs/adr/`.

### Security

- Context isolation and sandboxed preload; webview guest preloads; optional HTTPS-only navigation preference.
