# Dev-Lens — Feature Overview

Dev-Lens is a desktop browser built with **Electron** and **Angular**, aimed at developers and power users who want workspaces, fast in-app search, privacy controls, and optional deep dev tooling without constant context switching.

This document lists **planned and in-progress capabilities** from the implementation roadmap (`PLAN.md`) and **product vision** from UI mockups in `mockups/`. Items that appear only in mockups are called out so they are not mistaken for committed scope in `PLAN.md`.

---

## Shell & layout

- **Top bar** — Back, forward, reload; center-aligned **omnibox** (address bar).
- **Collapsible left sidebar** — Vertical tab list, workspace switcher, smooth expand/collapse.
- **Main content** — Web content via **`<webview>`** (navigation and tab state driven from the Angular shell; overlays such as the omnibox dropdown and Spotlight use normal DOM stacking).
- **Right sidebar** — Optional panel area for widgets (e.g. notes, bookmarks); off by default.
- **Responsive layout** — Adapts to window resize.
- **Right-side profile / tools cluster** (follow-up) — Bookmark, copy link, inspect, and related actions.

---

## Omnibox (address bar)

- **URL vs search** — Parse and validate input; open URLs or run queries through a **configurable default search engine** (e.g. Google, DuckDuckGo).
- **Suggestion dropdown** — History, bookmarks, open tabs; **live search-query suggestions** (planned).
- **Inline actions** — Bookmark toggle, share, open devtools / inspect.
- **Keyboard navigation** — Arrow keys, Enter, Escape within suggestions.
- **Security indicators** — HTTPS lock and mixed-content awareness.
- **Privacy badge** — Shows tracker / request blocking activity (see Privacy).

---

## Tabs

- **Vertical tab list** — Create, close, switch, reorder; drag-and-drop reorder; active state; **tab search / filter** in the sidebar.
- **Favicon + title** — Full favicon support and **hover preview** (follow-ups).
- **Context menu** — Duplicate, pin/unpin, move to workspace; broader close actions (e.g. close others) TBD.
- **Tab groups** — Colored groups, rename, collapse/expand; persisted.
- **Keyboard shortcuts** — e.g. new tab, close tab, cycle tabs (`Ctrl+T` / `Ctrl+W` / `Ctrl+Tab`, etc.).
- **Auto-suspend inactive tabs** — Configurable memory-saving suspension (planned).

---

## Workspaces

- **Named workspaces** — Create, switch, and delete; optional **color / icon**.
- **Isolated tab sets** — Each workspace keeps its own tabs.
- **Optional session isolation** — Per-workspace **Electron partitions** for separate cookies/sessions.
- **Persistence** — Stored on disk (e.g. `electron-store`).
- **Default workspace** — e.g. “Personal” on first launch.

---

## Spotlight (quick launcher)

- **Global shortcut** — Open/close with **Ctrl+K** (and close from the overlay).
- **Unified search** — Open tabs, bookmarks, history, commands/actions, and notes.
- **Instant filtering** — Substring search; optional fuzzy matching / debouncing.
- **Keyboard-first** — Navigate results and activate with Enter.
- **Empty state** — Recent or frequent items when the query is empty.
- **Rich categories** — Icons/visual categories for result types (refinement planned).

---

## Privacy & blocking

- **Built-in blocker** — Host-list based blocking at the **Electron `webRequest`** layer (curated default list; fuller lists like EasyList TBD).
- **Omnibox shield** — Indication of blocked requests / blocking state.
- **Global toggle** — Enable/disable blocking in Settings; **per-site allow-list** (planned).
- **Updates** — Periodic block-list refresh (planned).

_Mockups also describe “script-level permission control” and strong per-site sandboxing as product goals; align detailed behavior with `PLAN.md` and security ADRs as they land._

---

## Notes

- **Sidebar notes panel** — CRUD notes tied to **workspace context**.
- **Persistence** — Saved locally.
- **Discovery** — Create from sidebar or Spotlight; **search/filter** within notes.
- **Editor** — Rich text or Markdown (currently plain text area in MVP path).

---

## New tab page

- **Quick-access bookmarks** — Grid of favorites.
- **Recent history** — Tiles or list of recent sites.
- **Workspace context** — Shows current workspace.
- **Clock / date** — Optional widget.

---

## Settings

- **General** — Startup behavior, default search engine, language.
- **Privacy** — Tracker blocking and related options (cookies/telemetry copy may expand).
- **Appearance** — Font size; theme and sidebar position (follow-ups).
- **Shortcuts** — Listed shortcuts; **remap UI** (follow-up).
- **Advanced** — Reset local data.
- **Reactive updates** — Settings propagate to services (e.g. blocker respects `blockerEnabled`).

---

## Split view

- **Two-pane browsing** — Side-by-side pages with **independent webviews** (layout/service groundwork may exist; full UX TBD).
- **Resize divider** — Adjust primary/secondary ratio.
- **Interactions** — Drag tab to edge to split; keyboard shortcut to toggle; close one pane without losing the other.

---

## Smart sidebar (widgets)

- **Widget host** — Rail + panel pattern; register widgets at runtime.
- **Built-in / planned widgets** — Notes, bookmarks; **AI assistant**; **developer tools** panel.
- **Customization** — Resizable cards; per-widget visibility toggles.

---

## Developer tools & API workflow _(roadmap + mockups)_

`PLAN.md` explicitly targets:

- **DevTools integration** — Toggle via **F12** / **Ctrl+Shift+I**; enhanced overlay behavior.
- **API request inspector** — Log requests (`webRequest`), filter by type, view method/URL/status/headers/body/timing, **export HAR**.
- **JSON formatter** — Detect JSON in the page/context, pretty-print, collapsible tree, copy path/value.
- **Console history** — Persist console across navigations; export logs.
- **Quick DOM workflows** — Highlight element from UI, per-site custom CSS, keyboard “inspect element”.

Mockups in `mockups/browser-features-2.png`–`8.png` extend the **stated product vision** with additional ideas (not all are broken out as separate checklist lines in `PLAN.md`), including:

- **Postman/Insomnia-style API client** — Collections, environments, chained requests, variable interpolation, import/export collections, optional TypeScript type generation from responses.
- **Request mocking** — Rule-based intercepts, mock JSON/files, artificial delays, conditional responses, session record/replay for debugging.
- **Environment management** — Dev/staging/prod profiles, secrets, URL-based auto-switching, team-shared configs (vision).
- **Response diff** — Side-by-side/inline diffs, ignore fields, trends, exportable reports (vision).
- **Security scanner panel** — XSS/injection signals, CSP monitoring, TLS/cert inspection, CORS alerts (vision).
- **“Made for developers” list** — e.g. **code snippets** (save/run JS in-browser), **quick actions** for DevTools (vision).
- **Advanced dev tools grid** — e.g. Git-aware workflows, database/storage viewers (IndexedDB, storage, cookies), error aggregation, network throttling, performance profiling, regex tester, CSS inspector enhancements, source maps, Web Vitals, framework component inspector, accessibility auditing (vision).

Use `PLAN.md` for **delivery order**; use mockups for **directional UX** where the two differ.

---

## Focus mode

- Distraction-free mode: hide sidebars and extra chrome.
- Optional **site whitelist** (block everything else).
- **Session timer** and break reminders.
- Dedicated shortcut to enter/exit.

---

## Clipboard history

- Track recent clipboard entries (memory and optional disk).
- Sidebar or shortcut access; paste from history; clear all or per item.
- **Privacy pause** — Stop monitoring when needed.

---

## Session replay & history timeline

- Periodic capture of tab + navigation state.
- **Visual timeline** of browsing history / sessions.
- **Restore session** in one action; **named snapshots**; **diff** between snapshots.

---

## Automation

- **Rule engine** — Triggers (URL, time, workspace change) and actions (open panel, command, workspace switch, block site).
- **Templates** — Preset automations (e.g. “open GitHub → show DevTools”).
- **Persistence** — Rules stored on disk; per-rule enable/disable.

---

## AI features

- **Provider setup** — API keys, model selection.
- **Page summarization** — Extract text from the page, summarize in sidebar / quick action.
- **Chat with page** — Contextual Q&A over page content (RAG-lite style).
- **Smart autofill suggestions** — Context-aware forms (planned).
- **Code explanation** — e.g. “explain this code” on selected blocks (planned).

---

## Themes

- **JSON-defined themes** and **CSS custom properties** (no heavy runtime injection).
- **Built-in presets** — Light, dark, midnight, solarized, high-contrast.
- **Live preview**, import/export of theme files.

---

## Keyboard shortcuts

- **Global registry**, conflict detection, **rebind UI** in Settings, import/export profiles, reset to defaults.

---

## Extensions / plugins _(platform phase)_

- **Manifest**, sandboxed renderer, documented API (tabs, sidebar, omnibox, storage).
- **Loader** — Local path or URL; settings for enable/disable and permissions.
- **Built-in style blocker** — uBlock-origin-class experience as a first-party plugin (goal).
- **Theme marketplace groundwork** — Static registry JSON.

---

## Cloud sync & devices

- **Auth** — OAuth2 (e.g. GitHub, Google).
- **Encrypt-then-sync** — Client-side encryption for synced payloads.
- **Sync targets** — Bookmarks, workspaces, settings, shortcuts, notes.
- **Conflict handling** — e.g. LWW vs manual merge; **sync status** in UI; **offline-first** use.

_Mockup pricing (`browser-payment-model.png`) frames **cloud sync**, **workspace backups**, **automation**, and **premium themes** as paid-tier differentiators; implementation details are not specified in `PLAN.md`._

---

## Cross-device & collaboration _(vision-heavy in mockups)_

- **Companion data format** — Portable JSON for non–Dev-Lens consumers (goal).
- **Pairing & push** — e.g. QR pairing, “open tab from phone”, read-later queue (roadmap items in `PLAN.md`).
- **Team features** — Shared workspaces, shared bookmark collections, shared session state, on-page team annotations (`PLAN.md` + Team tier in mockups).
- **Enterprise-oriented ideas in mockups** — Admin dashboard, usage analytics, SSO, custom branding, dedicated support (product positioning, not fully specified in `PLAN.md`).

---

## Performance & quality of life

- **Performance dashboard** — Memory/CPU/network visibility; optional per-tab memory hints.
- **Telemetry** — Opt-in, transparent anonymous usage stats.
- **Crash reporting** — e.g. Sentry or self-hosted.
- **CI performance checks** — Guard against regressions.

---

## Cross-cutting: accessibility, i18n, security, testing

- **Accessibility** — Full keyboard reachability, ARIA, visible focus, screen reader testing, contrast in all themes (WCAG AA target).
- **i18n** — Extracted strings, RTL, locale-aware dates.
- **Testing** — Unit, component, and E2E (e.g. tab flow, Spotlight, workspaces, blocker); CI lint + tests.
- **Security** — `nodeIntegration: false`, `contextIsolation: true`, validated IPC (e.g. Zod), optional HTTPS-only mode, `npm audit`, CSP on internal pages.

---

## Implementation status

For **checkbox-level progress** (done vs pending), see **`PLAN.md`**. This file is the **feature catalog**; it does not replace the checklist.

---

## Mockup index

| File                                     | What it illustrates                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mockups/browser-features-1.png`         | Workspaces, Spotlight, split view, privacy, notes, tab suspension, session replay, customization, AI                                                      |
| `mockups/browser-features-2.png`         | DevTools, JSON formatter, snippets, API inspector, console history, quick actions                                                                         |
| `mockups/browser-features-3.png`         | Advanced dev tools grid (Git, storage, errors, throttling, profiler, interceptor, regex, CSS, source maps, Web Vitals, component inspector, a11y auditor) |
| `mockups/browser-features-4.png`–`8.png` | Developer workflow suite: API testing, mocking, environments, response diff, security scanner                                                             |
| `mockups/browser-payment-model.png`      | Free / Pro / Team feature bundles (positioning)                                                                                                           |
