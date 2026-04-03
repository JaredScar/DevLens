# ADR 0001: Webview as the browsing engine

## Status

Accepted

## Context

Dev-Lens needs to render arbitrary web content inside an Electron shell while keeping the host Angular UI isolated from guest pages. Alternatives included `BrowserView`, `iframe`, and `<webview>`.

## Decision

Use Electron’s **`<webview>` tag** with:

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- A dedicated **guest preload** for console forwarding and optional JSON pretty-print
- Per-workspace `partition` strings for cookie isolation

## Consequences

- Guest and host are strongly separated; IPC crosses the preload bridge only.
- Layout and z-order are managed in the Angular layer (stacked webviews).
- Some Chromium APIs differ from a standard browser tab; we accept that tradeoff for embedding control.
