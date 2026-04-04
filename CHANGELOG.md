# Changelog

All notable changes to Dev-Lens are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
