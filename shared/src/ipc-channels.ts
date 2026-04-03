/**
 * IPC invoke channel names — keep in sync with `electron/preload.ts` (inlined).
 */
export const IPC_CHANNELS = {
  PING: 'dev-lens:ping',

  WEBVIEW_CREATE: 'dev-lens:webview:create',
  WEBVIEW_DESTROY: 'dev-lens:webview:destroy',
  WEBVIEW_NAVIGATE: 'dev-lens:webview:navigate',
  WEBVIEW_SET_BOUNDS: 'dev-lens:webview:set-bounds',
  WEBVIEW_GO_BACK: 'dev-lens:webview:go-back',
  WEBVIEW_GO_FORWARD: 'dev-lens:webview:go-forward',
  WEBVIEW_RELOAD: 'dev-lens:webview:reload',
  WEBVIEW_SET_ACTIVE: 'dev-lens:webview:set-active',
  WEBVIEW_GET_STATE: 'dev-lens:webview:get-state',
  WEBVIEW_TOGGLE_DEVTOOLS: 'dev-lens:webview:toggle-devtools',

  STORE_GET: 'dev-lens:store:get',
  STORE_PATCH: 'dev-lens:store:patch',

  BLOCKER_GET_STATS: 'dev-lens:blocker:get-stats',
  BLOCKER_SET_ENABLED: 'dev-lens:blocker:set-enabled',
  /** Fetch remote block list and merge into the main-process blocker (returns { ok, count }). */
  BLOCKER_REFRESH_LIST: 'dev-lens:blocker:refresh-list',

  SHELL_OPEN_EXTERNAL: 'dev-lens:shell:open-external',

  /** Tell main to attach the request blocker to a webview partition's session. */
  SESSION_INIT: 'dev-lens:session:init',
  /** Append a navigation entry to the persistent history store. */
  HISTORY_APPEND: 'dev-lens:history:append',

  /** Renderer finished auto-save before quit; main may destroy the window. */
  APP_CLOSE_READY: 'dev-lens:app:close-ready',

  /** Report active browser tab URL/title so plugin sandbox can expose `activeTab` (optional). */
  TABS_REPORT_ACTIVE: 'dev-lens:tabs:report-active',

  /** Discover installed plugins (bundled + userData/plugins). */
  PLUGIN_DISCOVER: 'dev-lens:plugin:discover',
  PLUGIN_SET_ENABLED: 'dev-lens:plugin:set-enabled',
  PLUGIN_STORAGE_GET: 'dev-lens:plugin:storage-get',
  PLUGIN_STORAGE_SET: 'dev-lens:plugin:storage-set',
  /** Guest plugin preload → main (active tab snapshot). */
  PLUGIN_GUEST_ACTIVE_TAB: 'dev-lens:plugin:active-tab',
  PLUGIN_GUEST_OPEN_TAB: 'dev-lens:plugin:guest-open-tab',
  PLUGIN_GUEST_BLOCKER_STATS: 'dev-lens:plugin:guest-blocker-stats',

  /** Main process memory / process metrics for Performance widget. */
  APP_GET_METRICS: 'dev-lens:app:get-metrics',

  /** List all Chrome extensions installed on disk. Returns InstalledExtensionInfo[]. */
  EXT_LIST: 'dev-lens:ext:list',
  /** Remove an installed Chrome extension from disk. Payload: { extensionId: string }. */
  EXT_REMOVE: 'dev-lens:ext:remove',

  /**
   * Embed the Chromium DevTools for a guest webview via a BrowserView overlay.
   * Payload: `{ guestWcId: number; bounds: { x, y, width, height } }`.
   * Main creates a fresh BrowserView, calls setDevToolsWebContents + openDevTools,
   * adds it to the main window at the supplied bounds.
   */
  DEVTOOLS_ATTACH: 'dev-lens:devtools:attach',
  /**
   * Detach / close the Chromium DevTools BrowserView overlay.
   * Payload: `{ guestWcId?: number }`.
   */
  DEVTOOLS_DETACH: 'dev-lens:devtools:detach',
  /**
   * Reposition the DevTools BrowserView overlay without re-attaching.
   * Payload: `{ bounds: { x, y, width, height } }`.
   */
  DEVTOOLS_SET_BOUNDS: 'dev-lens:devtools:set-bounds',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Main → renderer; whitelist in preload `on()`. */
export const IPC_EVENTS = {
  BLOCKER_STATS: 'dev-lens:blocker-stats',
  /** Main detected OS clipboard change (`systemClipboardWatch`). Payload: `{ text: string }`. */
  CLIPBOARD_FROM_MAIN: 'dev-lens:clipboard-from-main',
  /** Window close was intercepted for auto-save; renderer should persist then invoke `APP_CLOSE_READY`. */
  APP_WILL_CLOSE: 'dev-lens:app-will-close',
  /** Completed HTTP request observed on a webview session (`SessionManager`). */
  NETWORK_LOG: 'dev-lens:network-log',
  /** Plugin asked to open a URL in a new browser tab. */
  PLUGIN_OPEN_URL: 'dev-lens:plugin:open-url',
} as const;

export type IpcEventChannel = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];
