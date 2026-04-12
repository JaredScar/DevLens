import { contextBridge, ipcRenderer } from 'electron';

/**
 * Must match `shared/src/ipc-channels.ts` exactly (invoke + event names).
 * Sandboxed preloads cannot `require()` workspace packages.
 */
const IPC_CHANNELS = {
  PING: 'dev-lens:ping',

  // Legacy BrowserView channels kept for any in-flight callers (no-op on main now)
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
  BLOCKER_REFRESH_LIST: 'dev-lens:blocker:refresh-list',
  SHELL_OPEN_EXTERNAL: 'dev-lens:shell:open-external',

  SESSION_INIT: 'dev-lens:session:init',
  HISTORY_APPEND: 'dev-lens:history:append',
  APP_CLOSE_READY: 'dev-lens:app:close-ready',

  TABS_REPORT_ACTIVE: 'dev-lens:tabs:report-active',
  PLUGIN_DISCOVER: 'dev-lens:plugin:discover',
  PLUGIN_SET_ENABLED: 'dev-lens:plugin:set-enabled',
  APP_GET_METRICS: 'dev-lens:app:get-metrics',
  EXT_LIST: 'dev-lens:ext:list',
  EXT_REMOVE: 'dev-lens:ext:remove',
  EXT_IS_INSTALLED: 'dev-lens:ext:is-installed',
  EXT_OPEN_POPUP: 'dev-lens:ext:open-popup',
  DEVTOOLS_ATTACH: 'dev-lens:devtools:attach',
  DEVTOOLS_DETACH: 'dev-lens:devtools:detach',
  DEVTOOLS_SET_BOUNDS: 'dev-lens:devtools:set-bounds',

  // Phase 3.3 & 3.4: Collaboration
  PAIRING_GENERATE: 'dev-lens:pairing:generate',
  PAIRING_COMPLETE: 'dev-lens:pairing:complete',
  PAIRING_LIST_DEVICES: 'dev-lens:pairing:list-devices',
  PAIRING_REMOVE_DEVICE: 'dev-lens:pairing:remove-device',
  NOTIFICATION_SHOW: 'dev-lens:notification:show',
  ANNOTATION_SAVE: 'dev-lens:annotation:save',
  ANNOTATION_GET_FOR_URL: 'dev-lens:annotation:get-for-url',
  ANNOTATION_DELETE: 'dev-lens:annotation:delete',
  ANNOTATION_SET_SHARED: 'dev-lens:annotation:set-shared',
} as const;

const IPC_EVENTS = {
  BLOCKER_STATS: 'dev-lens:blocker-stats',
  CLIPBOARD_FROM_MAIN: 'dev-lens:clipboard-from-main',
  APP_WILL_CLOSE: 'dev-lens:app-will-close',
  NETWORK_LOG: 'dev-lens:network-log',
  PLUGIN_OPEN_URL: 'dev-lens:plugin:open-url',
  PAIRING_DEVICE_CONNECTED: 'dev-lens:pairing:device-connected',
  PUSH_NOTIFICATION_RECEIVED: 'dev-lens:push-notification-received',
  REMOTE_OPEN_TAB: 'dev-lens:remote-open-tab',
  ANNOTATIONS_UPDATED: 'dev-lens:annotations-updated',
} as const;

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
type IpcEventChannel = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

const ALLOWED_INVOKE: readonly IpcChannel[] = [
  IPC_CHANNELS.PING,
  IPC_CHANNELS.WEBVIEW_CREATE,
  IPC_CHANNELS.WEBVIEW_DESTROY,
  IPC_CHANNELS.WEBVIEW_NAVIGATE,
  IPC_CHANNELS.WEBVIEW_SET_BOUNDS,
  IPC_CHANNELS.WEBVIEW_GO_BACK,
  IPC_CHANNELS.WEBVIEW_GO_FORWARD,
  IPC_CHANNELS.WEBVIEW_RELOAD,
  IPC_CHANNELS.WEBVIEW_SET_ACTIVE,
  IPC_CHANNELS.WEBVIEW_GET_STATE,
  IPC_CHANNELS.WEBVIEW_TOGGLE_DEVTOOLS,
  IPC_CHANNELS.STORE_GET,
  IPC_CHANNELS.STORE_PATCH,
  IPC_CHANNELS.BLOCKER_GET_STATS,
  IPC_CHANNELS.BLOCKER_SET_ENABLED,
  IPC_CHANNELS.BLOCKER_REFRESH_LIST,
  IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
  IPC_CHANNELS.SESSION_INIT,
  IPC_CHANNELS.HISTORY_APPEND,
  IPC_CHANNELS.APP_CLOSE_READY,
  IPC_CHANNELS.TABS_REPORT_ACTIVE,
  IPC_CHANNELS.PLUGIN_DISCOVER,
  IPC_CHANNELS.PLUGIN_SET_ENABLED,
  IPC_CHANNELS.APP_GET_METRICS,
  IPC_CHANNELS.EXT_LIST,
  IPC_CHANNELS.EXT_REMOVE,
  IPC_CHANNELS.EXT_IS_INSTALLED,
  IPC_CHANNELS.EXT_OPEN_POPUP,
  IPC_CHANNELS.DEVTOOLS_ATTACH,
  IPC_CHANNELS.DEVTOOLS_DETACH,
  IPC_CHANNELS.DEVTOOLS_SET_BOUNDS,
  // Phase 3.3 & 3.4: Collaboration
  IPC_CHANNELS.PAIRING_GENERATE,
  IPC_CHANNELS.PAIRING_COMPLETE,
  IPC_CHANNELS.PAIRING_LIST_DEVICES,
  IPC_CHANNELS.PAIRING_REMOVE_DEVICE,
  IPC_CHANNELS.NOTIFICATION_SHOW,
  IPC_CHANNELS.ANNOTATION_SAVE,
  IPC_CHANNELS.ANNOTATION_GET_FOR_URL,
  IPC_CHANNELS.ANNOTATION_DELETE,
  IPC_CHANNELS.ANNOTATION_SET_SHARED,
];

const ALLOWED_EVENTS: readonly IpcEventChannel[] = [
  IPC_EVENTS.BLOCKER_STATS,
  IPC_EVENTS.CLIPBOARD_FROM_MAIN,
  IPC_EVENTS.APP_WILL_CLOSE,
  IPC_EVENTS.NETWORK_LOG,
  IPC_EVENTS.PLUGIN_OPEN_URL,
  IPC_EVENTS.PAIRING_DEVICE_CONNECTED,
  IPC_EVENTS.PUSH_NOTIFICATION_RECEIVED,
  IPC_EVENTS.REMOTE_OPEN_TAB,
  IPC_EVENTS.ANNOTATIONS_UPDATED,
];

function assertChannel(channel: string): asserts channel is IpcChannel {
  if (!ALLOWED_INVOKE.includes(channel as IpcChannel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
}

function assertEventChannel(channel: string): asserts channel is IpcEventChannel {
  if (!ALLOWED_EVENTS.includes(channel as IpcEventChannel)) {
    throw new Error(`Blocked IPC event: ${channel}`);
  }
}

export type DevLensApi = {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, callback: (data: unknown) => void): () => void;
};

const api: DevLensApi = {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    assertChannel(channel);
    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },
  on(channel: string, callback: (data: unknown) => void): () => void {
    assertEventChannel(channel);
    const listener = (_event: Electron.IpcRendererEvent, data: unknown): void => {
      callback(data);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld('devLens', api);
