# Dev-Lens Polish Plan

Everything here is a concrete, actionable fix needed to make the application feel complete and functional. Issues are grouped by area and prioritised **Critical → High → Medium → Low**.

---

## Legend

| Priority    | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| 🔴 Critical | Feature is completely broken / crashes / blocks user workflows       |
| 🟠 High     | Feature appears to work but silently fails or produces wrong results |
| 🟡 Medium   | Feature is incomplete or has a visible UX gap                        |
| 🟢 Low      | Polish, cleanup, developer experience                                |

---

## 1. `window.prompt` / `window.alert` / `window.confirm` — All silently no-op in Electron

These native browser dialogs are blocked in sandboxed Electron renderers. They return `null`/`false`/`undefined` immediately without showing any UI, breaking any feature that depends on them.

### 1.1 — Sessions widget: "Save Session" completely broken 🔴

- **File:** `app/src/app/features/sidebar-widgets/sessions-widget.component.ts:43`
- `window.prompt('Session name?', ...)` always returns `null` → clicking "Save Current Session" does nothing.
- **Fix:** Add a `saveDialog` signal (same pattern as `LeftSidebarComponent.dialog`): show an inline text input + "Save" / "Cancel" row in the widget template.

### 1.2 — Sessions widget: Share button shows no feedback 🟠

- **File:** `sessions-widget.component.ts:93-97`
- After writing to clipboard, `window.alert('...copied to clipboard')` is suppressed. The fallback `window.prompt(...)` is also suppressed. The user sees nothing happen.
- **Fix:** Replace with a transient in-widget toast / "Copied!" indicator (a signal that auto-clears after 2 s).

### 1.3 — Settings: Encrypted backup export/import completely broken 🔴

- **File:** `app/src/app/features/settings/settings.component.ts:457, 459, 502`
- `window.prompt('Passphrase...')` returns `null` → backup export and import are impossible.
- **Fix:** Replace all three `window.prompt` calls with an inline modal dialog component (passphrase field, confirm, show/hide toggle). Same for the `window.confirm` before destructive import.

### 1.4 — Settings: All other `window.alert` / `window.confirm` silently suppressed 🟠

- **File:** `settings.component.ts` — 8+ additional locations:
  - `resetData()` → `window.confirm(...)` returns `false` → data never resets
  - `updateShortcutBinding()` → `window.alert(...)` for conflict messages swallowed
  - `resetAllShortcuts()` → `window.confirm(...)` returns `false` → never runs
  - `onImportShortcutProfilePick()` → 3× `window.alert(...)` errors swallowed
  - `onImportThemePick()` → 2× `window.alert(...)` errors swallowed
  - `exportEncryptedBackup()` error catch → `window.alert(...)` swallowed
- **Fix:** Centralise a lightweight `ToastService` that renders a small top-right notification strip, or inline error/confirm UI inside the Settings page itself.

### 1.5 — Left sidebar: "Explain selection" fallback uses `window.alert` 🟡

- **File:** `left-sidebar.component.ts:133`
- `window.alert('Select some text in the page first...')` is suppressed.
- **Fix:** Emit a brief in-widget toast, or display a transient message in the AI panel instead of alerting.

---

## 2. Top Bar / Navigation

### 2.1 — Reload icon is visually incomplete / cropped 🟠

- **File:** `top-bar.component.html:15-20`
- Current SVG path: `<path d="M13 8A5 5 0 113.5 4.5"/>` + `<path d="M3 2v3h3"/>` — the arc is open and the arrowhead is a simple right-angle, making it look like an unfinished fragment rather than a standard circular refresh icon.
- **Fix:** Replace the reload SVG with a clean circular-arrow icon:
  ```html
  <path d="M12.5 8a4.5 4.5 0 11-1.3-3.18" /> <polyline points="11 2 14 2 14 5" />
  ```
  Or use a full standard ↺ icon path.

### 2.2 — "More options" button has no click handler 🟠

- **File:** `top-bar.component.html:175`
- The `⋯` button has no `(click)` binding whatsoever.
- **Fix:** Wire up a dropdown menu (open in new window, print, zoom controls, download page, etc.) or remove the button until implemented.

### 2.3 — Omnibox: Enter key ignores the highlighted suggestion 🟡

- **File:** `top-bar.component.ts` `keydownOmnibox()` + `top-bar.component.html:53`
- When the user arrows down to a suggestion and presses Enter, `submitNavigation()` fires using `inputUrl()` (what was typed), not the highlighted suggestion's URL.
- **Fix:** In `keydownOmnibox()`, handle `ev.key === 'Enter'`:
  ```ts
  if (ev.key === 'Enter' && this.suggestionsOpen() && this.suggestionRowsList().length) {
    ev.preventDefault();
    const row = this.suggestionRowsList()[this.selectedSuggestion()];
    if (row) {
      this.pickSuggestion(row.url);
      return;
    }
  }
  ```

### 2.4 — Omnibox suggestion dropdown `z-index: 1` clips behind autofill menu 🟡

- **File:** `top-bar.component.scss:137`
- Suggestion list `z-index: 1`, autofill menu `z-index: 300`. Suggestion list will render behind autofill pop-up and potentially behind sidebar overlays.
- **Fix:** Change `.omnibox__suggest { z-index: 200; }` (above topbar content, below spotlight overlay).

### 2.5 — `selectedSuggestion` never resets when the dropdown opens fresh 🟢

- **File:** `top-bar.component.ts`
- On `onFocusInput()`, the signal is never reset to `0`.
- **Fix:** Call `this.selectedSuggestion.set(0)` inside `onFocusInput()` and after `onOmniboxInput()` clears suggestions.

---

## 3. Notes Widget

### 3.1 — "Edit" creates a duplicate instead of updating 🔴

- **File:** `notes-widget.component.ts:28-29`, `notes-widget.component.html:49`
- Clicking "Edit" populates the draft form but `saveNote()` always assigns `id: crypto.randomUUID()`. Saving creates a second copy; the original note remains unchanged.
- **Fix:** Add an `editingId = signal<string | null>(null)`. When Edit is clicked, set `editingId`. In `saveNote()`:
  ```ts
  const id = this.editingId() ?? crypto.randomUUID();
  await this.notes.upsert({ id, title, body, url });
  this.editingId.set(null);
  ```
  Change the button label to "Update Note" / "Add Note" based on `editingId()`.

### 3.2 — Notes filter input is missing from the template 🟡

- **File:** `notes-widget.component.ts:22` — `filter` signal exists; `notes-widget.component.html` — no `<input>` to set it.
- **Fix:** Add a search input above the list:
  ```html
  <input placeholder="Search notes…" [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
  ```

---

## 4. Spotlight

### 4.1 — Picking a Note result in Spotlight does nothing useful 🟠

- **File:** `spotlight.component.ts:108-113`
- The `run` handler for Note results only calls `this.spotlight.hide()`. The note is not opened, highlighted, or focused anywhere.
- **Fix:** The run handler should open the Notes widget in the right sidebar and scroll to / highlight the selected note. At minimum, open the right sidebar and switch to the Notes widget:
  ```ts
  run: () => {
    this.spotlight.hide();
    this.layout.openRightSidebar();
    this.widgets.select('notes');
    // optionally: notesWidgetState.setHighlighted(n.id)
  };
  ```

---

## 5. Sessions Widget

### 5.1 — Save session dialog (see §1.1 above) 🔴

### 5.2 — Restoring a session opens all URLs in new tabs but doesn't close existing tabs 🟡

- **File:** `sessions-widget.component.ts:60`
- `restoreSession()` calls `addBrowserTab` for each URL in the session, but does not close or switch away from the current tabs. Users end up with their existing tabs plus all session tabs.
- **Fix:** Add a confirmation step (inline, not `window.confirm`) offering "Restore in current workspace (keep existing tabs)" vs "Replace current tabs".

---

## 6. New Tab Page

### 6.1 — Clock is frozen 🟡

- **File:** `new-tab.component.ts:18` — `now = new Date()` is set once at construction.
- **Fix:**
  ```ts
  now = signal(new Date());
  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
  ```
  Update the template to use `now()`.

---

## 7. History Widget

### 7.1 — No way to delete entries or clear history 🟡

- **File:** `history-widget.component.html` — only renders entries with a "reopen" click; no delete button.
- **Fix:** Add a delete `×` button per row (calls `persisted.patch({ history: snap.history.filter(...) })`). Add a "Clear all" button in the widget header.

---

## 8. AI Widget

### 8.1 — Mock mode is invisible to the user 🟡

- **File:** `ai-widget.component.ts:21-34`
- When `aiProvider === 'mock'`, the widget silently returns canned responses regardless of the question. Users don't know they're in demo mode.
- **Fix:** Show a visible banner: _"Running in demo mode. Configure an AI provider in Settings → AI to enable real responses."_ with a link/button to the Settings page.

---

## 9. Bookmarks Widget

### 9.1 — No way to edit a bookmark 🟢

- **File:** `bookmarks-widget.component.html`
- Only open and delete actions exist. Renaming or changing the URL requires delete + re-bookmark.
- **Fix:** Add an edit button per row that opens an inline edit form (title, URL fields).

---

## 10. Left Sidebar — Tab Context Menu

### 10.1 — Context menu positioned incorrectly when sidebar is scrolled 🟡

- **File:** `left-sidebar.component.html:265-284`
- `[style.left.px]="ctx.x"` and `[style.top.px]="ctx.y"` use raw viewport coordinates (`ev.clientX / ev.clientY`), but the `<aside>` has `position: relative`. The menu will appear offset from the cursor by the sidebar's distance from the viewport origin.
- **Fix:** The context menu should use `position: fixed` (not `absolute`) so that viewport coordinates are correct, OR use `position: absolute` relative to the document body by portal-rendering the menu.
- **Simplest fix:** Change `.tabctx` CSS from `position: fixed` (it's already `fixed` ✓) to ensure `z-index` is high enough (`z-index: 500`) and confirm it isn't clipped by `overflow: hidden` on a parent. Verify the sidebar `overflow: hidden` is not clipping the menu.

---

## 11. Performance Widget vs Console Performance Tab

### 11.1 — Two overlapping "Performance" panels with no synchronisation 🟢

- `right-sidebar` has a dedicated **Performance** widget (auto-refreshes every 4 s)
- The **Console** right panel has a **PERF** tab with a manual refresh button
- Both show different metrics with no cross-referencing.
- **Fix:** Either consolidate them or make the Console → PERF tab clearly labelled "Page performance" (already done) and the sidebar widget clearly "Process memory". Add labels to make the distinction obvious.

---

## 12. Visual / Icon Polish

### 12.1 — Reload icon path is incomplete / looks broken 🟠

- **File:** `top-bar.component.html:17-18`
- The current arc + stub doesn't look like a standard reload icon.
- **Fix (drop-in SVG paths):**
  ```html
  <!-- Circular arrow, standard reload shape -->
  <svg
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    viewBox="0 0 16 16"
  >
    <path d="M13.5 8A5.5 5.5 0 114 3.8" />
    <polyline points="2.5 1.5 4 3.8 6.5 2.5" />
  </svg>
  ```

### 12.2 — Back / Forward buttons are always enabled regardless of can-go-back state 🟡

- **File:** `top-bar.component.html:5-14`
- The back/forward `nav-btn` buttons are never disabled. Clicking back when there's no history silently does nothing.
- **Fix:** Track `canGoBack` / `canGoForward` signals in `TabsService` or `BrowserTabViewComponent` (respond to webview `did-navigate` events), then bind `[disabled]="!tabs.canGoBack()"` on the button.

### 12.3 — No loading spinner while a page is loading 🟡

- When a webview is loading, there is no visual indicator in the top bar (e.g., the reload button spinning, or a progress bar under the top bar).
- **Fix:** Listen to webview `did-start-loading` / `did-stop-loading` events in `BrowserTabViewComponent`, expose a `loading` signal on `TabsService`, and show a spinner / swap the Reload SVG for a Stop (×) SVG in `top-bar.component.html` when `tabs.activeTabLoading()` is true.

---

## 13. Misc / Architecture

### 13.1 — `syncBrowserBounds()` is empty — dozens of dead calls 🟢 _(done)_

- **File:** `shell.component.ts` (removed)
- The `boundsSync` outputs, template emits, and empty `syncBrowserBounds()` handler were removed; guest layout no longer needed them.

### 13.2 — `IPC_EVENTS.TAB_UPDATED` is dead code 🟢

- **File:** `shared/src/ipc-channels.ts` — defined but not in preload whitelist, not emitted from main, not consumed in Angular.
- **Fix:** Remove or mark as reserved.

### 13.3 — All 10 `WEBVIEW_*` IPC channels are no-op stubs in main 🟢 _(documented)_

- **File:** `electron/main.ts`
- Stubs remain so stray legacy `invoke()` calls do not reject; comment clarifies they are deprecated (renderer uses `<webview>` instead).

### 13.4 — Workspace creation: hardcoded purple colour `#a371f7` 🟢

- **File:** `left-sidebar.component.ts:212`
- **Fix:** Add a small colour swatch row (6–8 preset colours) to the new workspace dialog.

---

## 14. Tab Grouping

### 14.1 — Group dialog prompts for a name before any tabs are selected 🟠

- **Current behaviour:** Clicking "GROUP" immediately shows a name input, but there is no mechanism to choose which tabs belong to the group — every open tab in the workspace is implicitly included.
- **Expected behaviour:** The user should first multi-select tabs (checkbox or Ctrl-click), then click "Group selection" to name the group. Only the checked tabs are moved into the new group.
- **Fix:**
  1. Add a `selectedTabIds = signal<Set<string>>(new Set())` to `LeftSidebarComponent`.
  2. Show checkboxes (or highlight) on each `tablist__row` while a "select mode" is active (toggle via a secondary toolbar button).
  3. The "Group" toolbar button is disabled unless `selectedTabIds().size > 1`.
  4. `confirmDialog()` passes `selectedTabIds()` to `tabs.addTabGroup(...)` and assigns those tab IDs to the new group, then clears the selection.
- **Files:** `left-sidebar.component.ts`, `left-sidebar.component.html`, `left-sidebar.component.scss`, `tabs.service.ts`.

---

## 15. New Tab / Home Page

### 15.1 — "Most visited" cards clip their text content 🟡

- **Current behaviour:** The title / URL text inside each recent-sites card overflows the card boundary — visible on most screen sizes and with any site whose title is longer than ~20 characters.
- **Fix:**
  - Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to the card title element.
  - Constrain card width so it cannot grow wider than its grid column (`max-width: 100%`).
  - For the URL subtitle, add the same truncation or clamp to 1 line with `line-clamp`.
- **File:** `new-tab.component.scss`.

### 15.2 — Home page is too sparse / basic 🟡

- **Current behaviour:** The page shows a clock and a grid of most-visited sites. There is no quick-access toolbar, no weather/greeting, no search bar, and the layout feels empty on larger viewports.
- **Suggested enhancements (pick any subset):**
  - Centre-aligned search bar wired to the omnibox engine (same as top bar).
  - Greeting line: `Good morning, [username from Settings]`.
  - Bookmarks shortcuts row below most-visited grid.
  - Background wallpaper support (user-uploadable image or solid colour from theme).
- **File:** `new-tab.component.ts/html/scss`.

---

## 16. DevTools — Network Tab

### 16.1 — Network tab shows no entries / does not capture traffic 🔴

- **Current behaviour:** The Network tab in the Console widget is present but always empty. Requests made by the active webview are not displayed.
- **Root cause:** Network events are captured in `electron/main.ts` via `SessionManager` and emitted over IPC (`dev-lens:network-log`), but the Angular `ConsoleWidgetComponent` may not be subscribing to that event on the correct IPC channel, or the event is not being re-emitted per-tab.
- **Fix:**
  1. Confirm `ElectronBridgeService.on(IPC_EVENTS.NETWORK_LOG, ...)` is called inside `ConsoleWidgetComponent` and that `IPC_EVENTS.NETWORK_LOG` is in the preload whitelist.
  2. Filter log entries by the active tab's partition/session so cross-workspace traffic is not mixed.
  3. Render each entry with: method badge, status code (colour-coded), URL (truncated), type, size, and duration.
  4. Add a clear button and a filter input (URL contains / type).
- **Files:** `console-widget.component.ts/html/scss`, `electron/preload.ts`, `electron/session-manager.ts`.

---

## 17. DevTools — Elements Tab

### 17.1 — Elements panel is read-only and non-interactive 🟠

- **Current behaviour:** The Elements tab renders a static HTML dump. Users cannot click nodes to inspect computed styles, hover to highlight on the page, or edit attributes inline — all core Chromium DevTools behaviours.
- **Architectural options:**

  **Option A — Toggle native Chromium DevTools (simplest, full fidelity)**
  - Call `webviewEl.openDevTools()` when the user opens the Console widget. Electron surfaces a full Chromium DevTools window docked or detached.
  - No custom Elements UI needed; Chromium provides it.
  - Trade-off: DevTools open in a separate OS window (unless `webContents.setDevToolsWebContents` is used to embed them — complex).

  **Option B — DevTools Protocol (CDP) bridge**
  - Use `webContents.debugger.attach('1.3')` in main and relay CDP commands over IPC.
  - Angular DevTools panel sends CDP `DOM.getDocument`, `DOM.highlightNode`, `CSS.getComputedStyleForNode`, etc. and renders results.
  - Full in-app integration, but significant implementation effort (~500 LOC minimum).

  **Option C — `webview.getWebContentsId()` + BrowserWindow DevTools embed**
  - Use Electron's `BrowserWindow.addTabbedWindow` or an `<iframe>` pointing to `devtools://devtools/bundled/devtools_app.html`.
  - Achieves embedded Chromium DevTools without building a custom panel.

- **Recommendation:** Start with **Option A** (native DevTools toggle) to unblock users immediately, then graduate to Option B for in-app integration if needed.
- **Files:** `console-widget.component.ts`, `tabs.service.ts`, `browser-tab-view.component.ts`.

---

## 18. Right Sidebar — Icon Rail Overflow

### 18.1 — Too many widget icons overflow the rail vertically, causing app-level horizontal scrollbar 🟡

- **Current behaviour:** The right-sidebar icon rail lists ~12 icons stacked vertically. On viewports shorter than ~780 px the rail overflows and the browser adds a horizontal scrollbar to the entire app window.
- **Fix:**
  1. Set `.rside__rail { overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }` so icons scroll within the rail, not the app.
  2. Alternatively, wrap overflow icons into a collapsible "more…" button at the bottom of the rail that reveals a small flyout grid.
  3. As a minimum safeguard, add `min-height: 0` to the flex column so the rail never expands its parent.
- **File:** `right-sidebar.component.scss`.

---

## 19. Left Sidebar — Bookmark Button

### 19.1 — Bookmark icon button in the left sidebar bottom bar does nothing 🔴

- **Current behaviour:** Clicking the bookmark icon in the sidebar footer has no `(click)` handler (or the handler exists but fails silently).
- **Expected behaviour:** Clicking should open the Bookmarks widget in the right sidebar (same as `openWidget('bookmarks')`).
- **Fix:** Verify the `(click)` binding in `left-sidebar.component.html` matches `openWidget('bookmarks')` and that `WidgetRegistryService` is injected. If the binding is missing, add it.
- **File:** `left-sidebar.component.html`, `left-sidebar.component.ts`.

---

## 20. Icon System — Replace Custom SVGs with Font Awesome

### 20.1 — Many hand-crafted SVG icons look broken or inconsistent 🟠

- **Current behaviour:** Inline SVG paths are written by hand throughout the template files. Several paths look visually broken (reload, back/forward) and the icon vocabulary is inconsistent in stroke-width and visual weight.
- **Fix:** Replace custom SVG icons with [Font Awesome Free](https://fontawesome.com) (MIT/free tier sufficient):
  1. Install: `npm install @fortawesome/fontawesome-free` (or the `@fortawesome/angular-fontawesome` package for proper Angular integration).
  2. Import the CSS (or use the Angular component approach with `FaIconComponent`).
  3. Systematically replace each hand-rolled `<svg>` with the corresponding FA icon:
     - Reload → `fa-rotate-right`
     - Back / Forward → `fa-arrow-left` / `fa-arrow-right`
     - Close tab → `fa-xmark`
     - Bookmark → `fa-bookmark` / `fa-bookmark` (regular for un-bookmarked)
     - Settings → `fa-gear`
     - New tab → `fa-plus`
     - History → `fa-clock-rotate-left`
     - Notes → `fa-note-sticky`
     - AI → `fa-wand-magic-sparkles`
  4. Use a single icon size token (`--icon-size: 16px`) in CSS for consistency.
- **Files:** `package.json`, `angular.json` (styles array), all component templates.

---

## 21. Automation — Rules UX

### 21.1 — "Add sample rules" button should be replaced with a Rule Marketplace 🟡

- **Current behaviour:** A button labelled "Add sample rules" inserts hardcoded demo rules into the user's automation list. This is a development shortcut with no user value in production.
- **Fix:** Replace the button with a **Marketplace** panel:
  - Curated list of rules authored and maintained by the Dev-Lens team (loaded from a hosted JSON endpoint, with a local fallback bundle).
  - Each marketplace rule card shows: name, description, author, rule type badge, and an "Install" button.
  - Installed rules are appended to `persisted.automationRules` with `source: 'marketplace'` so they can be identified and updated later.
  - Add a "Check for updates" action that diffs the installed marketplace rules against the latest endpoint payload.
- **Files:** `settings.component.ts/html/scss`, new `AutomationMarketplaceService`.

### 21.2 — Rule inputs are free-text, allowing malformed rules 🟡

- **Current behaviour:** Trigger and action fields are plain `<input type="text">` boxes. Users can type anything, producing rules that silently never match.
- **Fix:** Replace free-text inputs with structured controls:
  - **Trigger type** → `<select>` (URL matches, Tab title contains, Domain equals, Time of day, etc.).
  - **Trigger value** → context-sensitive input: regex tester for URL patterns, time picker for time-based triggers.
  - **Action type** → `<select>` (Block domain, Redirect to, Open in sidebar, Apply theme, Run script snippet, etc.).
  - **Action value** → context-sensitive: URL input with validation, theme dropdown, code textarea.
  - Add inline validation with a preview: "This rule would match: example.com/path".
- **Files:** `settings.component.ts/html/scss`, consider extracting `AutomationRuleEditorComponent`.

---

## 22. Plugin System / Chrome Extension Compatibility

### 22.1 — Plugins do not support Chrome Web Store extensions 🔴

- **Current behaviour:** Dev-Lens has a custom plugin system (bundled JS + JSON manifest). Chrome extensions (`.crx` / unpacked format with `manifest.json` v2 or v3) are not supported.
- **Electron compatibility note:** Electron's `session.loadExtension(path)` API supports a subset of Chrome Extension APIs (Manifest V2, partial MV3). This does **not** require switching to a different browser engine — Electron already uses Chromium.
- **Options:**

  **Option A — `session.loadExtension()` (recommended starting point)**
  - Accept unpacked Chrome extension directories from the user (no CRX unpacking needed initially).
  - Call `session.loadExtension(extPath, { allowFileAccess: true })` in main for each enabled extension.
  - Surface a UI in Settings → Plugins to browse for and enable unpacked extensions.
  - Supported APIs: `chrome.storage`, `chrome.tabs`, `chrome.runtime`, `chrome.webRequest`, `chrome.contextMenus`. Content scripts and popup pages work; background service workers have partial support.
  - Trade-off: MV3 service workers are not fully supported in current Electron; MV2 extensions work best.

  **Option B — Full Chromium browser switch**
  - Replace Electron with a Chromium-embedded framework (e.g., [electron-chrome-extensions](https://github.com/nicholasstephan/electron-chrome-extensions) helper library, or migrate to CEF/Tauri with Chromium).
  - Enables near-complete Chrome extension compatibility but is a major architectural rewrite.

- **Recommendation:** Implement **Option A** first using `session.loadExtension()`. This unblocks most popular extensions (uBlock Origin, Bitwarden, 1Password, etc.) without rewriting the app. Document MV3 limitations clearly in the UI.
- **Files:** `electron/main.ts`, `settings.component.ts/html/scss`, new `ExtensionManagerService`.

---

## 23. Split View — Resize Performance

### 23.1 — Split view divider drag is slow and laggy 🟠

- **Current behaviour:** Dragging the `.shell__split-grabber` bar calls `splitView.setRatio(ratio)` on every `mousemove` event, which triggers Angular change detection and re-lays out the webview grid on each pixel of movement.
- **Root cause:** `setRatio()` likely writes to a signal that the template is bound to via `[style.grid-template-columns]`, causing a full style recalculation on every frame.
- **Fix:**
  1. **Throttle with `requestAnimationFrame`:** Set a `rafPending` flag; only call `setRatio` inside an `rAF` callback, dropping intermediate mouse positions.
  2. **Apply style directly during drag, persist on mouseup:** During the drag, set `element.style.gridTemplateColumns` directly on the DOM node (bypassing Angular). Only call `splitView.setRatio()` on `mouseup` so the signal/store update happens once.
  3. Ensure the split grabber has `will-change: transform` and `pointer-events: none` on webviews during drag (prevents webview from stealing mouse events and causing flicker).
- **Files:** `shell.component.ts` (`onSplitGrabMove`), `shell.component.scss`.

---

## 24. Console Widget — Embed Real Chromium DevTools

### 24.1 — Console widget shows a custom log panel instead of actual Chromium DevTools 🔴

- **Current behaviour:** The right-sidebar Console widget renders a custom Angular UI (console log, DOM snapshot, network list, etc.). In Electron, these panels are limited approximations of the real Chromium DevTools that is already present in the guest renderer process.
- **Expected behaviour:** The Console widget panel should embed the full, live Chromium DevTools — the exact same panel visible in the screenshot — inside the sidebar. Users get real console, network waterfall, elements inspector, sources, performance profiler, and memory tab without leaving the sidebar.
- **How (Electron-specific):** Electron exposes `WebContents.prototype.setDevToolsWebContents(devToolsWc)` which tells Chromium to render the DevTools UI into any given WebContents (including a `<webview>` element in the renderer). The flow:
  1. Add a `<webview id="dt">` (initially `src="about:blank"`) to the Console widget template.
  2. When the widget opens (or the active tab changes), get the guest webview's `webContentsId` (via `webviewEl.getWebContentsId()`) and the DevTools webview's `webContentsId`.
  3. Call a new IPC handler `DEVTOOLS_ATTACH { guestWcId, dtWcId }` → main process calls `guestWc.setDevToolsWebContents(dtWc); guestWc.openDevTools()`.
  4. When the widget closes or the active tab changes away, call `DEVTOOLS_DETACH { guestWcId }` → main calls `guestWc.closeDevTools()`.
- **Fallback:** When running in a plain browser (non-Electron), keep the existing custom panels.
- **Files:**
  - `shared/src/ipc-channels.ts` — add `DEVTOOLS_ATTACH`, `DEVTOOLS_DETACH`
  - `electron/preload.ts` — whitelist both channels
  - `electron/main.ts` — handle both via `webContents.fromId()`
  - `app/src/app/core/electron-ipc-channels.ts` — add to `RENDERER_INVOKE`
  - `app/src/app/core/services/tabs.service.ts` — add `getWebContentsId(): number | undefined` to `WebviewHandler`; expose `getActiveGuestWcId()`
  - `app/src/app/features/shell/browser-tab-view.component.ts` — implement `getWebContentsId` in handler
  - `app/src/app/features/sidebar-widgets/console-widget.component.ts/html/scss` — embed DevTools webview, attach/detach lifecycle

---

## Priority Checklist

### 🔴 Critical — Fix first (core workflows broken)

- [x] §1.1 Sessions "Save Session" dialog (replace `window.prompt`)
- [x] §1.3 Settings encrypted backup export/import (replace `window.prompt` passphrase)
- [x] §3.1 Notes "Edit" creates duplicate instead of updating
- [x] §16.1 Network tab: URL filter added; improved empty state; `openNativeDevTools` wired
- [x] §19.1 Bookmark button in left sidebar — handler confirmed wired (`openWidget('bookmarks')`)
- [x] §22.1 Chrome extension support — backend `session.loadExtension()` via `extension-manager.ts` complete; Settings UI shows installed extensions with remove functionality
- [x] §24.1 Console widget embeds real Chromium DevTools via `setDevToolsWebContents` IPC in Electron; custom panels kept as non-Electron fallback

### 🟠 High — Fix before showing to anyone

- [x] §1.2 Sessions share button — no feedback
- [x] §1.4 All other `window.alert` / `window.confirm` in Settings
- [x] §1.5 Left sidebar "Explain selection" fallback
- [x] §2.1 Reload icon SVG looks broken/incomplete
- [x] §2.2 "More options" button has no handler
- [x] §4.1 Spotlight notes result does nothing
- [x] §8.1 AI mock mode invisible to user
- [x] §14.1 Tab grouping: multi-select mode with checkboxes before naming
- [x] §17.1 Elements panel: "Open DevTools" button wired to `tabs.toggleDevtools()`
- [x] §20.1 Font Awesome installed; back/fwd/reload/stop icons replaced in top bar
- [x] §23.1 Split view resize: rAF throttle + direct DOM style + pointer-events on webviews

### 🟡 Medium — Noticeable UX gaps

- [x] §2.3 Omnibox Enter key ignores highlighted suggestion
- [x] §2.4 Omnibox suggestion `z-index: 1` can clip behind other layers
- [x] §3.2 Notes filter input missing
- [x] §5.2 Session restore doesn't handle existing tabs
- [x] §6.1 New Tab page clock is frozen
- [x] §7.1 History widget: no delete / clear
- [x] §10.1 Context menu positioning (sidebar overflow clipping)
- [x] §12.2 Back / Forward buttons always enabled (no disabled state)
- [x] §12.3 No page loading indicator (spinner / stop button)
- [x] §15.1 New Tab cards: `text-overflow: ellipsis` on title; card overflow hidden
- [x] §15.2 New Tab home page: search bar, greeting, workspace label, section icons
- [x] §18.1 Right sidebar icon rail: `flex-wrap: wrap` + `overflow: hidden` prevents horizontal scroll
- [x] §21.1 Automation: "Add sample rules" replaced with curated Rule Marketplace grid
- [x] §21.2 Automation rules: structured selects for trigger/action; time picker; workspace picker; widget picker

### 🟢 Low — Polish

- [x] §2.5 `selectedSuggestion` not reset on dropdown open
- [x] §9.1 Bookmark edit capability
- [x] §11.1 Clarify Performance widget vs Console PERF tab labels
- [x] §13.1 Remove dead `boundsSync` output / emit calls
- [x] §13.2 Remove `IPC_EVENTS.TAB_UPDATED` dead code
- [x] §13.3 Clean up no-op `WEBVIEW_*` IPC stubs
- [x] §13.4 Workspace colour picker in new-workspace dialog
