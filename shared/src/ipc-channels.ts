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
  /** Check if a Chrome extension is already installed. Payload: { extensionId: string }. Returns boolean. */
  EXT_IS_INSTALLED: 'dev-lens:ext:is-installed',
  /** Open an extension's popup in a small floating BrowserWindow. Payload: { extensionId, popupPath, x, y }. */
  EXT_OPEN_POPUP: 'dev-lens:ext:open-popup',

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

  /** QR-code device pairing: generate pairing code and QR data URL. Returns { pairingCode: string, qrDataUrl: string }. */
  PAIRING_GENERATE: 'dev-lens:pairing:generate',
  /** Complete pairing with a code. Payload: { pairingCode: string, deviceName: string }. Returns { success: boolean, deviceId: string }. */
  PAIRING_COMPLETE: 'dev-lens:pairing:complete',
  /** List paired devices. Returns Array<{ id, name, pairedAt, lastSeen }>. */
  PAIRING_LIST_DEVICES: 'dev-lens:pairing:list-devices',
  /** Remove a paired device. Payload: { deviceId: string }. */
  PAIRING_REMOVE_DEVICE: 'dev-lens:pairing:remove-device',

  /** Push notification bridge: show local notification. Payload: { title, body, data? }. */
  NOTIFICATION_SHOW: 'dev-lens:notification:show',
  /** Register notification handler. Payload: { handlerId: string }. */
  NOTIFICATION_REGISTER: 'dev-lens:notification:register',

  /** Save page annotation. Payload: { url: string, selector: string, text: string, note: string, x?: number, y?: number }. Returns { id: string }. */
  ANNOTATION_SAVE: 'dev-lens:annotation:save',
  /** Get annotations for a URL. Payload: { url: string }. Returns AnnotationDTO[]. */
  ANNOTATION_GET_FOR_URL: 'dev-lens:annotation:get-for-url',
  /** Delete an annotation. Payload: { id: string }. */
  ANNOTATION_DELETE: 'dev-lens:annotation:delete',
  /** Update annotation visibility (team sharing). Payload: { id: string, shared: boolean }. */
  ANNOTATION_SET_SHARED: 'dev-lens:annotation:set-shared',
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
  /** A new device completed pairing. Payload: { deviceId, deviceName }. */
  PAIRING_DEVICE_CONNECTED: 'dev-lens:pairing:device-connected',
  /** Push notification received (from main). Payload: { title, body, data }. */
  PUSH_NOTIFICATION_RECEIVED: 'dev-lens:push-notification-received',
  /** New tab request from paired device. Payload: { url, title?, deviceId }. */
  REMOTE_OPEN_TAB: 'dev-lens:remote-open-tab',
  /** Annotations updated for current URL. Payload: { url, annotations }. */
  ANNOTATIONS_UPDATED: 'dev-lens:annotations-updated',
} as const;

export type IpcEventChannel = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];
