# Dev-Lens Browser – Implementation Checklist

> Tracks every feature and task across all three phases of the project.
> Status legend: `[ ]` pending · `[~]` in progress / partial · `[x]` done
>
> Mockup reference: `mockups/dev-lens-mockup-{1-9}.png`

---

## Phase 0 – Project Bootstrap

### 0.1 Repository & Tooling

- [x] Initialize Git repository
- [x] Add `.gitignore` (Node, Electron, Angular, dist)
- [x] Set up monorepo structure (`/app`, `/electron`, `/shared`)
- [x] Configure ESLint + Prettier with TypeScript rules
- [x] Configure Husky pre-commit hooks (lint + type-check)
- [x] Set up path aliases (`@core`, `@shared`, `@features`, `@ui`)

### 0.2 Electron + Angular Scaffold

- [x] Bootstrap Electron shell (`electron/main.ts`)
- [x] Create Angular app inside `/app` with Angular CLI
- [x] Wire Angular dev server to Electron BrowserWindow in dev mode
- [x] Set up production build pipeline (Angular build → Electron package)
- [x] Configure `electron-builder` for Windows / macOS / Linux targets
- [x] Verify hot-reload works end-to-end in development

### 0.3 Chromium / Webview Integration

- [x] Decide and document engine approach: **`<webview>` tag** (migrated from BrowserView; see below)
- [x] `BrowserTabViewComponent` manages `<webview>` lifecycle (create, destroy, navigate)
- [x] Implement `preload.ts` script for renderer ↔ main IPC bridge
- [x] Expose safe IPC channels via `contextBridge`
- [x] Validate CSP and sandbox flags are set correctly

> **Architecture note (Phase 1 → Phase 2 migration):** Originally used `BrowserView` (native layer
> that always paints above Angular HTML, so CSS z-index had no effect on omnibox dropdowns, tooltips, etc.).
> Migrated to `<webview>` tags rendered inside the Angular DOM. This means every overlay (omnibox dropdown,
> Spotlight, context menus) can now paint above web content using `z-index`. The main process is now a lean
> `SessionManager` that only attaches the blocker to partition sessions; navigation and state are driven
> entirely from Angular via the webview DOM API.

---

## Phase 1 – MVP

> **MVP landed:** shell, tabs, workspaces, omnibox, spotlight, notes, settings, new-tab, host-list blocker, `electron-store`. Unchecked items are follow-ups.

### 1.1 Shell Layout

- [x] Define global CSS custom-property token set (colors, spacing, radius, motion)
- [x] Implement top-bar component (`TopBarComponent`)
  - [x] Back / Forward / Reload buttons wired to active webview
  - [x] Omnibox (address bar) component — center-aligned with pill container
  - [x] Blocker badge (green dot + count) inside omnibox bar — _mockup 1_
  - [x] HTTPS lock icon inside omnibox bar — _mockup 1_
  - [x] Copy URL button in omnibox bar — _mockup 1_
  - [x] Inspect / DevTools shortcut button in omnibox bar (`⌘`) — _mockup 1_
  - [x] `>_` Console quick-open button in top-bar right cluster — _mockup 1/5; clicking opens Console widget in right sidebar_
  - [x] `+` New Tab button in top-bar right cluster — _mockup 1_
  - [x] `★` Bookmark toggle in top-bar right cluster — filled/yellow when current page is bookmarked — _mockup 1_
  - [x] `⊡` Panels / right-sidebar toggle button — _mockup 1_
- [x] Implement collapsible left sidebar (`LeftSidebarComponent`)
  - [x] Expand state: full sidebar with workspace selector, search, tabs, groups, bottom bar
  - [x] Collapsed state (≈40 px rail): icon-only tab pills — _mockup 9_
    - [x] Tab type icons in collapsed state: `⌂` new-tab, `⚙` settings, globe favicon for browser tabs — _mockup 9_
    - [x] Active tab highlighted in collapsed state — _mockup 9_
    - [x] `+` Add Tab button at the bottom of the collapsed rail — _mockup 9_
  - [x] `◂ WORKSPACES` header with collapse/expand chevron — _mockup 1_
  - [x] Bottom 5-icon shortcut bar: Bookmarks · AI · Console · Clipboard · Settings — _mockup 1_
- [x] Workspace dropdown (custom, not native `<select>`)
  - [x] Colored dot + workspace name + chevron — _mockup 1_
  - [x] Dropdown overlay lists all workspaces — _mockup 2_
  - [x] Per-workspace tab count badge in dropdown list — _mockup 2_
  - [x] `+ New Workspace` entry at bottom of dropdown — _mockup 2_
- [x] Tab list in sidebar
  - [x] Group section labels with colour-coded left border — _mockup 1_
  - [x] Group collapse/expand toggle chevron on group label row — _mockup 1_
  - [x] Tab rows: favicon img (Google s2 service) with emoji fallback — _mockup 1_
  - [x] Active tab: blue left-border accent + tinted background — _mockup 1_
  - [x] Close button visible on row hover — _mockup 1_
  - [x] Drag-and-drop tab reorder (CDK DragDrop)
- [x] Implement main content area with `<webview>` + internal `router-outlet`
- [x] Add right sidebar shell (`RightSidebarComponent`, toggled off by default)
- [x] Ensure layout is fully responsive to window resize

### 1.2 Omnibox (Address Bar)

- [x] URL parse + validate input (distinguish URL from search query)
- [x] Default search engine configuration (Google, DuckDuckGo, etc.)
- [x] Dropdown suggestions panel
  - [x] History suggestions
  - [x] Bookmark suggestions
  - [x] Open-tab suggestions
  - [x] Search query suggestions (live search API — DuckDuckGo autocomplete, debounced)
- [x] Keyboard navigation within suggestions (↑↓ Enter Esc)
- [x] HTTPS lock icon (green = secure, grey = plain HTTP) — _mockup 1_
- [x] Bookmark toggle reflects saved state (filled star when bookmarked) — _mockup 1_

### 1.3 Tab Management System

- [x] `TabsService` — create, close, switch, reorder tabs (state management)
- [x] Vertical tab list in `LeftSidebarComponent`
  - [x] Favicon + title display (Google s2 favicon service; emoji fallback) — _mockup 1_
  - [x] Active tab highlight with left-border accent
  - [x] Hover preview tooltip (tab row `title` attribute)
  - [x] Drag-and-drop reorder (CDK DragDrop)
- [x] Tab context menu (right-click)
  - [x] Duplicate tab (`TabsService` API exists)
  - [x] Pin / unpin tab (`TabsService` API exists)
  - [x] Move to workspace (`TabsService` API exists)
  - [x] Close tab / Close other tabs
- [x] Tab grouping (persisted `tabGroups`; `addTabGroup` / assign APIs)
  - [x] Create group with colour label
  - [x] Rename group
  - [x] Collapse / expand group — _mockup 1 shows chevron on group row_
  - [x] Group collapse/expand toggle UI on group label row
- [x] Tab search (sidebar filter; substring match)
- [x] Auto-suspend inactive tabs (configurable timeout; unloads background webviews to `about:blank`)
- [x] Keyboard shortcuts: `Ctrl+T` new tab, `Ctrl+W` close, `Ctrl+Tab` cycle

### 1.4 Workspace System

- [x] `WorkspaceService` — CRUD for named workspaces
- [x] Workspace switcher (custom dropdown with dot, name, chevron) — _mockup 1_
- [x] Per-workspace tab count shown in dropdown — _mockup 2_
- [x] Create workspace: name + colour — _mockup 2 (+ New Workspace)_
- [x] Per-workspace tab isolation (separate tab sets)
- [x] Optional per-workspace session/cookie isolation via Electron `partition`
- [x] Persist workspaces to disk (`electron-store`)
- [x] Default "Personal" workspace on first launch

### 1.5 Spotlight Search (Ctrl+K)

- [x] Global keyboard listener to open / close Spotlight overlay
- [x] Centered modal overlay component (`SpotlightComponent`)
- [x] Unified search across: open tabs, bookmarks, browsing history, commands, notes
- [x] Instant substring search
- [x] Result categories with icons (emoji glyph per category)
- [x] Keyboard navigation + Enter to select
- [x] Recent / frequent items shown when input is empty

### 1.6 Basic Privacy Blocker

- [x] Integrate tracker/ad blocking at the Electron `webRequest` layer
- [x] Bundle default block-list (curated hosts)
- [x] Block-list update mechanism (periodic fetch + manual refresh; hosts-format URL, default Peter Lowe list)
- [x] Per-site allow-list (whitelist support; persisted `trackerAllowlistHosts`)
- [x] Privacy shield badge in omnibox showing blocked count (green badge) — _mockup 1_
- [x] Settings page toggle to enable/disable globally

### 1.7 Notes Sidebar Widget

- [x] `NotesService` — CRUD notes, persist to disk
- [x] Notes widget in right sidebar — _mockup 3_
  - [x] "Write a note…" textarea placeholder — _mockup 3_
  - [x] "Add Note" button (teal/accent, full-width) — _mockup 3_
  - [x] Note card: title + body preview + date + edit + delete actions — _mockup 3_
  - [x] Note URL field — note cards display an associated URL as a clickable link beneath the title — _mockup 3_
  - [x] Markdown preview on cards (bold, inline code, links); compose remains plain textarea
- [x] Per-workspace note context
- [x] Quick note creation from sidebar or Spotlight
- [x] Search / filter notes

### 1.8 Settings Panel

- [x] Settings route with categorized navigation
  - [x] **General**: startup behavior, default search engine, language, tab auto-suspend
  - [x] **Privacy**: tracker blocking, allowlist, remote list URL, auto-update + refresh-now, clipboard pause + OS clipboard watch
  - [x] **AI**: OpenAI-compatible provider, API key, model, base URL
  - [x] **Appearance**: font size, right panel width (slider + persisted px)
  - [x] **Shortcuts**: listed (remap UI follow-up)
  - [x] **Advanced**: auto-save session on close (Electron), reset local data
- [x] Persist all settings with `electron-store`
- [x] Settings accessible as a tab from the sidebar — _mockup 1 shows "Settings" tab entries_

### 1.9 New Tab Page

- [x] Custom new-tab page component
- [x] Quick-access bookmarks grid
- [x] Recent history tiles
- [x] Workspace indicator
- [x] Clock / date widget

---

## Phase 2 – Power Features

### 2.1 Split-View Tabs

- [x] `SplitViewService` (`enabled` / `primaryRatio` / `secondaryTabId`; reconcile with tab changes)
- [x] Drag tab to screen edge to trigger split — _drop on right ≈12% of window width_
- [x] Two-pane side-by-side rendering with independent webviews
- [x] Resize divider (drag to adjust proportions)
- [x] Keyboard shortcut to toggle split view (`Ctrl+Shift+Backslash`) + top-bar split button
- [x] Close one pane without losing the other (toggle split off or close non-focused tab)

### 2.2 Smart Sidebar – Widget System

- [x] Modular widget host: horizontal icon rail at top + panel below — _mockup 3–8_
- [x] `WidgetRegistryService` — register / deregister widgets at runtime
- [x] 6-widget icon rail with SVG icons + × close button — _mockup 3_
- [x] Bottom left-sidebar 5-icon shortcut bar opens right sidebar to specific widget — _mockup 1_
- [x] Resizable sidebar panel width (drag handle on panel left edge + Settings slider)

#### Implemented widgets (Phase 2)

- [x] **Notes** — textarea compose + card list with URL link, date, edit/delete — _mockup 3_
- [x] **AI Assistant** — chat bubble UI, bot greeting, "Ask anything…" input, send button — _mockup 4_
  - [x] Uses `executeJavaScript` to extract page context for responses
  - [x] Real AI provider integration (OpenAI-compatible API: Settings → AI; key, model, base URL)
- [x] **Console** — REPL executing JS in active webview; tabbed header — _mockup 5_
  - [x] CONSOLE tab with log list (info/warn/error colour-coded) and `>` command input — _mockup 5_
  - [x] NETWORK tab (placeholder)
  - [x] ELEMENTS tab (placeholder)
  - [x] SOURCES tab (placeholder copy; use DevTools)
  - [x] PERFORMANCE tab (placeholder copy; use DevTools)
  - [x] Real console log capture from webview (guest preload forwards `console.*` via `ipc-message` → `GuestLogService`)
  - [x] Network request log via `webRequest` (`onCompleted`) per session partition, shown in NETWORK tab
- [x] **Clipboard History** — polls `navigator.clipboard`, persists entries — _mockup 6_
  - [x] URL entries shown with globe icon; text entries with document icon — _mockup 6_
  - [x] Timestamps on each entry — _mockup 6_
  - [x] Click entry to copy; × to delete individual entry
  - [x] "Clear All" action — _mockup 6_
  - [x] Privacy mode: pause clipboard monitoring (Settings → Privacy)
- [x] **Sessions** — save/restore named tab snapshots — _mockup 7_
  - [x] "Save Current Session" button with download icon — _mockup 7_
  - [x] Session cards: name + tab count + saved timestamp — _mockup 7_
  - [x] Click card to restore (re-opens all tabs)
  - [x] Delete session
  - [x] Session diff view (compare two saved sessions by URL set)
- [x] **API Tester** — in-sidebar REST client — _mockup 8_
  - [x] Method dropdown (GET / POST / PUT / PATCH / DELETE / HEAD) — _mockup 8_
  - [x] URL input + Send button (teal) — _mockup 8_
  - [x] Request body editor (shown for non-GET methods)
  - [x] Response panel: status badge (200 OK, colour-coded) + elapsed ms — _mockup 8_
  - [x] JSON pretty-print in response body — _mockup 8_
  - [x] Request headers editor (textarea + optional Bearer apply)
  - [x] Response headers viewer
  - [x] Recent request history (in-memory, last 20)
- [x] **Bookmarks** widget — list saved bookmarks, open in new tab, delete
  - [x] Service + data model exist (`PersistedStateService`)
  - [x] Dedicated Bookmarks panel widget UI (`BookmarksWidgetComponent`)
- [x] **History** widget — timeline grouped by day; open URL in new tab
- [x] **JSON formatter** widget — paste / parse, pretty-print, collapsible tree (`JsonNodeComponent`)

### 2.3 Developer Tools Enhancements

- [x] Console REPL widget (sidebar, `executeJavaScript`) — _mockup 5_
- [x] Real webview console log forwarding
  - [x] Webview-specific preload script that overrides `console.*` and sends via `ipc-message`
  - [x] Host renderer listens on `webview.addEventListener('ipc-message', ...)` and routes to `GuestLogService` / Console widget
- [x] Network request inspector (basic)
  - [x] Intercept and log completed HTTP(S) requests via `webRequest` per session partition
  - [x] Display: method, URL, status (timing / headers / body in HAR are minimal)
  - [x] Filter by type (Chromium `resourceType`: xhr, mainFrame, script, webSocket, …)
  - [x] Export HAR file (minimal HAR JSON from logged fields; entries include `resourceType` comment)
- [x] Built-in JSON Formatter (sidebar widget)
  - [x] Auto-detect and pretty-print JSON responses inside the guest webview (guest preload replaces raw JSON document with pretty-printed view)
  - [x] Collapsible tree view (sidebar paste + parse)
- [x] Console log persistence across in-tab navigations (same tab id keeps `GuestLogService` lines until the tab closes)
- [x] "Inspect element" — `Ctrl+Shift+C` + tab context menu; uses last pointer position in guest + `webview.inspectElement`

### 2.4 Focus Mode

- [x] `FocusModeService` — toggle distraction-free state
- [x] Hide sidebar, tab bar, and top chrome in focus mode
- [x] Optional website whitelist (Settings → Appearance; keeps chrome visible on matching active tab hosts)
- [x] Session timer with optional break reminder (desktop `Notification` when interval elapses)
- [x] Keyboard shortcut to enter / exit focus mode (`Ctrl+Alt+F` toggle, Esc exits)

### 2.5 Clipboard History Manager

- [x] `ClipboardWidgetComponent` — polls `navigator.clipboard` every 2 s — _mockup 6_
- [x] Store entries in `clipboardHistory` (`electron-store` + `PersistedStateService`)
- [x] URL vs text type detection with distinct icons — _mockup 6_
- [x] Click to re-copy, × to remove individual entry — _mockup 6_
- [x] Clear all — _mockup 6_
- [x] System-level clipboard hook via Electron `clipboard` module (main process polling for cross-app copies)
- [x] Privacy mode: pause clipboard monitoring toggle

### 2.6 Session Management

- [x] `SessionsWidgetComponent` — save / restore named sessions — _mockup 7_
- [x] `SavedSessionDTO` persisted via `electron-store`
- [x] Session cards: name, tab count, timestamp — _mockup 7_
- [x] One-click restore (re-opens all tabs in session)
- [x] Auto-save session on window close (optional setting; `APP_WILL_CLOSE` / `APP_CLOSE_READY` IPC)
- [x] Session diff view (which tabs changed between snapshots)
- [x] Browse history timeline (sidebar **History** widget: grouped by day)

### 2.7 Event-Based Automation

- [x] `AutomationService` — evaluates enabled rules on URL navigation and workspace switch
- [x] Rule builder UI (Settings → Automation): trigger + action fields, enable toggle, delete
  - [x] Triggers: URL contains, workspace active
  - [x] Triggers: time of day (`time_window` local `HH:mm-HH:mm`, overnight supported)
  - [x] Actions: open sidebar widget, switch workspace
  - [x] Actions: run JavaScript in active tab, block hostname (Privacy extra blocked hosts)
- [x] Preset automation templates (Settings → Automation: “Add sample rules”)
- [x] Enable / disable individual rules
- [x] Persist rules to disk (`automationRules` in store)

### 2.8 AI Features

- [x] AI chat sidebar widget (mock responses with page context) — _mockup 4_
- [x] Real AI provider configuration (API key management, model selection) — _Settings → AI_
- [x] Page Summarization
  - [x] Extract page text via `executeJavaScript` — _partial, used in AI widget_
  - [x] Send to AI provider; display reply in sidebar — _when provider is OpenAI-compatible_
  - [x] "Summarize this page" quick action (top bar, opens AI panel via `PageAiIntentService`)
- [x] Chat with Webpage Content (multi-turn thread; page body sent as labeled chunks for RAG-lite context)
- [x] Smart Autofill Suggestions (saved label/value hints in Settings; top-bar **Fill** menu injects into focused inputs)
- [x] Code explanation — tab context **Explain selection (AI)** (uses `getSelection()` + AI panel)

### 2.9 Theme Engine

- [x] Theme token schema (`DevLensThemeFileV1`: `version`, `themePreset`, `variables`, `customThemeVariables`; import validates `version === 1`)
- [x] Built-in themes: Light, Dark, Midnight, Solarized, High-contrast (`data-theme` CSS variables)
- [x] Theme preview live-apply without restart (Settings → Appearance)
- [x] Import / export custom theme JSON (Settings → Appearance; merges into `customThemeVariables`)

### 2.10 Custom Keyboard Shortcuts

- [x] Global shortcut registry service (`ShortcutRegistryService` + shell `document:keydown`)
- [x] Shortcut conflict detection (merged bindings; warnings + block save on new conflicts)
- [x] Per-shortcut rebind UI (Settings → Shortcuts; empty = default)
- [x] Import / export shortcut profiles (`DevLensShortcutProfileFileV1` JSON)
- [x] Reset to defaults (per-field empty = default combo; **Reset all to defaults** button)

### 2.11 API Tester (Sidebar Widget)

- [x] In-sidebar REST client — `ApiTesterWidgetComponent` — _mockup 8_
- [x] GET / POST / PUT / PATCH / DELETE / HEAD methods — _mockup 8_
- [x] URL input, Send button, request body editor — _mockup 8_
- [x] Response: status code + colour badge + elapsed time — _mockup 8_
- [x] JSON pretty-print with monospace font — _mockup 8_
- [x] Request / response headers panels
- [x] Auth header helpers (Bearer + Basic quick-apply)
- [x] Saved requests history (recent chips; session-only)

---

## Phase 3 – Platform & Ecosystem

### 3.1 Extension / Plugin System

- [x] Define plugin manifest schema (`PluginManifestV1` in `@dev-lens/shared`; validate on load)
- [x] Plugin sandbox (sidebar `<webview>`: `sandbox`, `contextIsolation`, dedicated `plugin-guest-preload`)
- [x] Plugin API surface (`storage`, `activeTab`, `tabs`, `blocker` — IPC from guest preload to main)
- [x] Plugin loader — discover bundled `electron/bundled-plugins/*` + `userData/plugins/<id>/`
- [x] Plugin settings UI (Settings → Plugins: enable/disable, list permissions)
- [x] Built-in plugins: **Hello** (storage + active tab), **Network / blocker** (stats + open URL in new tab); full uBlock parity not in scope
- [x] Theme marketplace groundwork (`app/public/theme-registry.json` + Appearance catalog)

### 3.2 Cloud Sync

- [ ] Auth service (OAuth2 — GitHub / Google) — _requires app registration & token storage; not implemented_
- [x] Client-side encrypted backup (AES-GCM + PBKDF2; Settings → Sync & backup)
- [x] Sync targets (local): encrypted export/import includes bookmarks, notes, read-later, workspaces, settings, sessions, automation, tab groups, open tabs, history, clipboard history, plugin state/storage
- [x] Conflict handling for **local** backup import: **Replace** vs **Merge (LWW)** for list data; cloud multi-writer sync still out of scope
- [x] Sync status: offline-first messaging + last encrypted export timestamp in settings
- [x] Offline-first: full functionality without sync

### 3.3 Cross-Device Support

- [x] Companion data format (`CompanionSnapshotV1` + export JSON from Settings → Sync)
- [ ] QR-code pairing flow for mobile
- [ ] Push notification bridge (new tab from mobile)
- [x] Read-later queue (local sidebar widget; companion export includes read-later entries)

### 3.4 Team / Collaboration Features

- [ ] Shared workspaces (invite members)
- [ ] Shared bookmarks collections
- [x] Session handoff JSON (Sessions widget: copy **session share** payload for a teammate to import tabs manually)
- [ ] Annotation layer on pages (comments visible to team)

### 3.5 Performance & Telemetry

- [x] In-app performance panel (sidebar **Performance**: main process `memoryUsage`, tab/suspend counts)
- [x] Tab list memory hint (suspend badge ⏸; per-tab RSS still not exposed by `<webview>` host API)
- [x] Opt-in telemetry (Settings → Sync; console heartbeat in main when enabled; disclosed in UI)
- [x] Crash diagnostics: main-process uncaught errors append to `userData/crash-log.txt` (Sentry optional; see README env note)
- [x] Automated performance regression: CI runs **Playwright** smoke on static Angular build + `ng build` **budgets** (initial, component styles, main, polyfills, styles bundles)
- [~] Dedicated perf benchmark suite — not implemented
- [x] CI pipeline: GitHub Actions — `npm ci`, lint, full `build`, Karma unit tests (`test:unit`), Playwright, `npm audit --audit-level=critical` (`.github/workflows/ci.yml`)

---

## Cross-Cutting Concerns

### Accessibility

- [x] All interactive elements reachable via keyboard (sidebar + widget elements have role/tabindex/keydown)
- [x] ARIA: `role="main"` on shell content; `role="complementary"` on sidebar with aria-label
- [x] Focus ring for keyboard: global `:focus-visible` outline on interactive elements (`styles.scss`)
- [x] Enhanced ARIA labels on navigation buttons and sidebar elements
- [~] Screen reader tested (NVDA / VoiceOver) — manual testing recommended
- [x] Colour contrast ≥ WCAG AA in all themes (improved muted text and border colors)

### Internationalization (i18n)

- [x] i18n groundwork: `docs/I18N.md`, `document.lang` from Settings, RTL support
- [x] ngx-translate integration with HTTP loader in `app.config.ts`
- [x] English translation file created at `public/assets/i18n/en.json` with comprehensive key coverage
- [x] Translation keys applied to Spotlight and Top Bar components (demonstration)
- [x] Extract all user-facing strings to translation files — foundation laid, comprehensive key coverage, applied to Left Sidebar and Top Bar components
- [x] RTL layout toggle (Settings → Appearance; sets `dir` on `<html>`)
- [x] Locale-aware dates where updated (e.g. Sessions widget uses `Intl.DateTimeFormat`)

### Testing

- [x] Unit tests: Karma + `tsconfig.spec` aligned with app path aliases
  - [x] `AppComponent` basic rendering test
  - [x] `shortcut-registry.service` utility function tests
  - [x] `spotlight.service` state management tests
  - [x] `notes.service` CRUD operation tests
  - [x] `bookmarks-widget.component` CRUD and edit tests
  - [x] `workspace.service` workspace management tests
  - [x] `layout.service` sidebar state tests
  - [x] `split-view.service` split view toggle tests
  - [x] `npm run test:unit` passes in CI (59 tests)
- [x] Component tests with native Angular TestBed
  - [x] `bookmarks-widget.component.spec.ts` — edit, delete, save functionality
- [x] E2E: Playwright smoke tests for Angular shell
  - [x] Spotlight search (Ctrl+K, type query, close with Escape)
  - [x] Right sidebar widget switching
  - [x] Focus mode keyboard shortcuts
  - [x] Top bar navigation and omnibox
  - [x] Left sidebar expand/collapse and workspace dropdown
  - [~] Electron-specific flows (requires full Electron app in CI)
- [x] CI pipeline (GitHub Actions: lint + build + `test:unit` + Playwright + audit; see `.github/workflows/ci.yml`)

### Security

- [x] `nodeIntegration: false` in all renderer BrowserWindows
- [x] `contextIsolation: true` everywhere
- [x] Validate IPC payloads with **Zod** on main-process handlers (`STORE_PATCH` strict keys, session init, history, tabs, shell open, blocker, plugins)
- [x] HTTPS-only mode option (Settings → Privacy: prefer HTTPS; rewrites `http://` navigations)
- [x] Regular `npm audit` in CI (`--audit-level=critical`)
- [x] Content Security Policy headers on internal pages

### Documentation

- [x] `README.md` with setup, build, run, tests
- [x] Architecture Decision Records (`docs/adr/`)
- [x] Component storybook — `npm run storybook` to start
  - [x] Storybook configured for Angular with a11y, docs, onboarding addons
  - [x] Introduction MDX with project overview
  - [x] Component stories (Spotlight, Notes widget)
  - [x] Design System stories (Themes showcase, Design tokens)
- [x] `CHANGELOG.md` (Keep a Changelog–style)

---

## Milestone Summary

| Milestone      | Target   | Key Deliverable                                       |
| -------------- | -------- | ----------------------------------------------------- |
| M0 – Bootstrap | Week 1   | Electron + Angular shell running                      |
| M1 – MVP       | Week 6   | Tab system + Spotlight + Workspaces + Privacy + Notes |
| M2 – Power     | Week 14  | DevTools, AI, Split-view, Automation, Themes          |
| M3 – Platform  | Week 22+ | Sync, Plugins, Collaboration                          |

---

## Mockup Cross-Reference

| Mockup     | Screen                       | Key Features Shown                                                                        |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `mockup-1` | Main view (expanded sidebar) | Shell layout, workspace selector, tab groups, favicons, top bar buttons, bottom icon bar  |
| `mockup-2` | Workspace dropdown open      | Per-workspace tab counts, coloured dots, + New Workspace                                  |
| `mockup-3` | Notes widget                 | Compose textarea, Add Note button, note card with URL link + date + edit/delete           |
| `mockup-4` | AI Assistant widget          | Chat bubbles, bot greeting, "Ask anything…" input + send                                  |
| `mockup-5` | Console widget               | CONSOLE/NETWORK/ELEMENTS/SOURCES/PERFOR tabs, colour-coded log entries, `>` command input |
| `mockup-6` | Clipboard widget             | URL (globe) vs text (doc) icons, timestamps, Clear All                                    |
| `mockup-7` | Sessions widget              | Save Current Session button, session cards with name + tab count + datetime               |
| `mockup-8` | API Tester widget            | Method dropdown, URL input, Send button, 200 OK badge + ms, JSON body                     |
| `mockup-9` | Collapsed sidebar            | Icon-only rail, type-appropriate tab icons (⌂/⚙/🌐), active highlight, + add button       |
