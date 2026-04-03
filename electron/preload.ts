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
  DEVTOOLS_ATTACH: 'dev-lens:devtools:attach',
  DEVTOOLS_DETACH: 'dev-lens:devtools:detach',
  DEVTOOLS_SET_BOUNDS: 'dev-lens:devtools:set-bounds',
} as const;

const IPC_EVENTS = {
  BLOCKER_STATS: 'dev-lens:blocker-stats',
  CLIPBOARD_FROM_MAIN: 'dev-lens:clipboard-from-main',
  APP_WILL_CLOSE: 'dev-lens:app-will-close',
  NETWORK_LOG: 'dev-lens:network-log',
  PLUGIN_OPEN_URL: 'dev-lens:plugin:open-url',
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
  IPC_CHANNELS.DEVTOOLS_ATTACH,
  IPC_CHANNELS.DEVTOOLS_DETACH,
  IPC_CHANNELS.DEVTOOLS_SET_BOUNDS,
];

const ALLOWED_EVENTS: readonly IpcEventChannel[] = [
  IPC_EVENTS.BLOCKER_STATS,
  IPC_EVENTS.CLIPBOARD_FROM_MAIN,
  IPC_EVENTS.APP_WILL_CLOSE,
  IPC_EVENTS.NETWORK_LOG,
  IPC_EVENTS.PLUGIN_OPEN_URL,
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
