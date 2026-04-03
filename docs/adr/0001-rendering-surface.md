# ADR 0001: Web content rendering surface

## Status

Accepted

## Context

Dev-Lens needs to show both the Angular shell (tabs, omnibox, sidebars) and arbitrary web pages. Electron offers several embedding options:

| Option                            | Pros                                                                                 | Cons                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **`<webview>` tag**               | Declarative in HTML; per-element control                                             | Must enable `webviewTag`; separate process per tag; layout sync with Angular is manual |
| **`BrowserView`**                 | Main-process control; stacks above window content; good for multiple “tabs” as views | Bounds must be updated on resize; not in DOM tree                                      |
| **`WebContentsView` (newer API)** | Modern replacement direction for `BrowserView`                                       | Availability depends on Electron version; migration path TBD                           |

## Decision

Phase 0 uses **`BrowserView`** in the main process for the primary embedded page:

- `WebviewService` (renderer) calls whitelisted IPC (`WEBVIEW_*` channels).
- Main creates / destroys `BrowserView` instances and applies bounds with a fixed top offset (`TOP_CHROME_PX`) so the Angular chrome remains visible and aligned with the shell.

The `<webview>` tag remains **enabled** (`webviewTag: true`) for future experiments or hybrid layouts, but the canonical Phase 0 path is **BrowserView + IPC**.

## Consequences

- Tab strip and omnibox height must stay in sync with `TOP_CHROME_PX` in `electron/main.ts` (later: single shared constant or IPC from renderer).
- Production CSP for the Angular shell should be tightened in Phase 1+; development uses the Angular dev server (HMR needs relaxed `connect-src` / `ws:`).

## Sandbox & isolation

- Shell window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `preload` for a minimal `contextBridge` API.
- **Preload + sandbox:** Sandboxed preload scripts must not `require()` app/workspace packages (e.g. `@dev-lens/shared`); that fails before `contextBridge` runs, so `window.devLens` never appears. Channel names are inlined in `electron/preload.ts` and kept in sync with `shared/src/ipc-channels.ts`.
- Embedded `BrowserView`: same security defaults without `preload` unless a feature requires it.

## Packaging (electron-builder)

- `build.directories.app` is set to `.` so the packaged entry uses the workspace root `package.json` (`main`: `dist-electron/main.js`), not `app/package.json` (which would default to `index.js`).
- On Windows, `win.signAndEditExecutable: false` avoids pulling `winCodeSign` tooling that extracts archives containing symlinks (fails without Developer Mode / elevation). Re-enable signing when release certificates are available.
- `CSC_IDENTITY_AUTO_DISCOVERY=false` is set on `pack` / `dist` scripts so local builds do not require an Apple/Developer signing identity.
