# ADR 0002: Sidebar plugins as sandboxed webviews

## Status

Accepted

## Context

Phase 3 called for an extension-like system without full Chrome extension compatibility. Plugins need storage and limited access to app state (e.g. active tab URL).

## Decision

- Plugins ship as folders with **`manifest.json`** (`PluginManifestV1`).
- Each enabled plugin renders in a **separate `<webview>`** with partition `persist:dev-lens-plugin-<id>` and **`plugin-guest-preload.js`**.
- Permissions are declared in the manifest; main process checks them before honoring guest IPC (`storage`, `activeTab`, `tabs`, `blocker`).

## Consequences

- Plugins cannot access Node or the host Angular bundle directly.
- New permissions require manifest + main-process enforcement + preload surface.
- Discovery is filesystem-based (bundled dir + `userData/plugins`).
