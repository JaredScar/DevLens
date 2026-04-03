import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserView,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  session,
  shell,
  webContents,
} from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  defaultStoreSnapshot,
  type DevLensStoreSnapshot,
} from '@dev-lens/shared';
import { replaceRemoteBlockHosts, setTrackerAllowlist, setUserBlockHosts } from './blocker';
import { DEFAULT_BLOCKLIST_URL, fetchRemoteBlocklist } from './blocklist-fetch';
import type { NetworkLogPayload } from './network-spy';
import { SessionManager, sanitizePartition, attachWebStoreChromeBranding } from './session-manager';
import { createUserStore, patchUserStore, type UserStore } from './user-data-store';
import { discoverAllPlugins, type DiscoveredPlugin } from './plugin-loader';
import { initCrashLogger } from './crash-logger';
import {
  BlockerSetEnabledSchema,
  HistoryAppendSchema,
  SessionInitSchema,
  ShellOpenExternalSchema,
  StorePatchSchema,
  TabsReportActiveSchema,
} from './ipc-zod';
import { registerPluginIpc } from './plugin-ipc';
import { startTelemetryHeartbeat } from './telemetry';
import { installChromeExtension, loadAllInstalledExtensions } from './extension-manager';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let store: UserStore;
let sessionManager: SessionManager;

let forceQuitAfterSave = false;
let lastSystemClipboard = '';

/** Last focused browser tab (for plugin `activeTab` API). */
let activeTabSnapshot: { url: string; title: string } | null = null;
let cachedDiscoveredPlugins: DiscoveredPlugin[] = [];

function getBundledPluginsDir(): string {
  return isDev
    ? path.join(__dirname, '..', 'electron', 'bundled-plugins')
    : path.join(__dirname, '..', 'bundled-plugins');
}

function refreshDiscoveredPlugins(): DiscoveredPlugin[] {
  const userDir = path.join(app.getPath('userData'), 'plugins');
  cachedDiscoveredPlugins = discoverAllPlugins(getBundledPluginsDir(), userDir);
  return cachedDiscoveredPlugins;
}

function getPluginGuestPreloadPath(): string {
  return path.join(__dirname, 'plugin-guest-preload.js');
}

function mergeMissingStoreKeys(): void {
  const def = defaultStoreSnapshot();
  const ps = store.get('pluginStates');
  if (ps == null || typeof ps !== 'object') store.set('pluginStates', def.pluginStates);
  const pst = store.get('pluginStorage');
  if (pst == null || typeof pst !== 'object') store.set('pluginStorage', def.pluginStorage);
  if (!Array.isArray(store.get('readLater'))) store.set('readLater', def.readLater);
}

const BLOCKLIST_REFRESH_MS = 24 * 60 * 60 * 1000;

function mergeSettingsDefaults(): void {
  const def = defaultStoreSnapshot().settings;
  store.set('settings', { ...def, ...store.get('settings') });
}

function applyBlockerFromStore(): void {
  const s = store.get('settings');
  setTrackerAllowlist(s.trackerAllowlistHosts ?? []);
  setUserBlockHosts(s.userBlockedHosts ?? []);
}

async function refreshRemoteBlockListFromStore(): Promise<number> {
  const s = store.get('settings');
  const url = s.blockListSourceUrl?.trim() || DEFAULT_BLOCKLIST_URL;
  const hosts = await fetchRemoteBlocklist(url);
  replaceRemoteBlockHosts(hosts);
  return hosts.length;
}

function randomId(): string {
  return crypto.randomUUID();
}

function appendHistory(url: string, title: string): void {
  const h = store.get('history');
  const filtered = h.filter((e) => e.url !== url);
  const entry = { id: randomId(), url, title: title || url, at: Date.now() };
  store.set('history', [entry, ...filtered].slice(0, 500));
}

function emitBlockerStats(): void {
  mainWindow?.webContents.send(IPC_EVENTS.BLOCKER_STATS, {
    blockedSession: sessionManager.getBlockedSessionCount(),
  });
}

function emitNetworkLog(payload: NetworkLogPayload): void {
  mainWindow?.webContents.send(IPC_EVENTS.NETWORK_LOG, payload);
}

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function getWebviewGuestPreloadPath(): string {
  return path.join(__dirname, 'webview-console-preload.js');
}

function getProductionIndexUrl(): string {
  const indexHtml = path.join(__dirname, '..', 'angular', 'index.html');
  return pathToFileURL(indexHtml).href;
}

function attachWindowCloseHandler(win: BrowserWindow): void {
  win.on('close', (e) => {
    if (forceQuitAfterSave) return;
    if (!store.get('settings').autoSaveSessionOnClose) return;
    e.preventDefault();
    win.webContents.send(IPC_EVENTS.APP_WILL_CLOSE);
  });
  win.on('closed', () => {
    forceQuitAfterSave = false;
    if (mainWindow === win) mainWindow = null;
  });
}

function startSystemClipboardPolling(): void {
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const s = store.get('settings');
    if (!s.systemClipboardWatch || s.clipboardMonitoringPaused) return;
    try {
      const text = clipboard.readText();
      if (!text || text === lastSystemClipboard) return;
      lastSystemClipboard = text;
      mainWindow.webContents.send(IPC_EVENTS.CLIPBOARD_FROM_MAIN, { text });
    } catch {
      /* ignore */
    }
  }, 2000);
}

function createMainWindow(): BrowserWindow {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'electron', 'assets', 'icon.png')
    : path.join(__dirname, '..', 'assets', 'icon.png');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.on('preload-error', (_event, p, error) => {
    console.error('[preload-error]', p, error);
  });

  /**
   * Security: validate webview before attach.
   * Enforce partition and disable node integration in all webviews.
   */
  win.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete (webPreferences as { preloadURL?: string }).preloadURL;
    const part = params.partition ?? '';
    if (part.startsWith('persist:dev-lens-plugin-')) {
      (webPreferences as { preload?: string }).preload = getPluginGuestPreloadPath();
    } else {
      (webPreferences as { preload?: string }).preload = getWebviewGuestPreloadPath();
      if (params.partition && !params.partition.startsWith('persist:dev-lens-ws-')) {
        params.partition = '';
      }
    }
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
  });

  if (isDev) {
    void win.loadURL('http://127.0.0.1:4200/');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadURL(getProductionIndexUrl());
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  attachWindowCloseHandler(win);
  return win;
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PING, () => ({ ok: true as const, t: Date.now() }));

  // ── Session / Blocker ──────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SESSION_INIT, (_e, payload: unknown) => {
    const r = SessionInitSchema.safeParse(payload);
    if (!r.success) return { ok: false as const, error: 'Invalid session init' };
    sessionManager.initSession(r.data.partition);
    // Load any previously installed extensions into this new session.
    void loadAllInstalledExtensions(sessionManager.getInitializedSessions());
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_APPEND, (_e, payload: unknown) => {
    const r = HistoryAppendSchema.safeParse(payload);
    if (!r.success) return { ok: false as const, error: 'Invalid history payload' };
    appendHistory(r.data.url, r.data.title);
    return { ok: true as const };
  });

  // ── Store ──────────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC_CHANNELS.STORE_GET,
    (): DevLensStoreSnapshot => ({
      settings: store.get('settings'),
      workspaces: store.get('workspaces'),
      activeWorkspaceId: store.get('activeWorkspaceId'),
      tabGroups: store.get('tabGroups'),
      openTabs: store.get('openTabs'),
      bookmarks: store.get('bookmarks'),
      history: store.get('history'),
      notes: store.get('notes'),
      savedSessions: store.get('savedSessions'),
      clipboardHistory: store.get('clipboardHistory'),
      automationRules: store.get('automationRules') ?? [],
      pluginStates: store.get('pluginStates') ?? {},
      pluginStorage: store.get('pluginStorage') ?? {},
      readLater: store.get('readLater') ?? [],
    }),
  );

  ipcMain.handle(IPC_CHANNELS.STORE_PATCH, (_e, partial: unknown) => {
    const r = StorePatchSchema.safeParse(partial);
    if (!r.success) {
      console.warn('[ipc] STORE_PATCH rejected:', r.error.flatten());
      return { ok: false as const, error: 'Invalid store patch' };
    }
    patchUserStore(store, r.data as Partial<DevLensStoreSnapshot>);
    const p = r.data as Partial<DevLensStoreSnapshot>;
    if (p.settings?.blockerEnabled !== undefined) {
      sessionManager.resetBlockerStats();
    }
    if (p.settings !== undefined) {
      applyBlockerFromStore();
    }
    return { ok: true as const };
  });

  // ── Blocker ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.BLOCKER_GET_STATS, () => ({
    blockedSession: sessionManager.getBlockedSessionCount(),
  }));

  ipcMain.handle(IPC_CHANNELS.BLOCKER_SET_ENABLED, (_e, payload: unknown) => {
    const r = BlockerSetEnabledSchema.safeParse(payload);
    if (!r.success) return { ok: false as const, error: 'Invalid payload' };
    patchUserStore(store, {
      settings: { ...store.get('settings'), blockerEnabled: r.data.enabled },
    });
    sessionManager.resetBlockerStats();
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.BLOCKER_REFRESH_LIST, async () => {
    try {
      const count = await refreshRemoteBlockListFromStore();
      return { ok: true as const, count };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: message };
    }
  });

  // ── Shell ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_e, payload: unknown) => {
    const r = ShellOpenExternalSchema.safeParse(payload);
    if (!r.success) return { ok: false as const, error: 'Invalid URL' };
    void shell.openExternal(r.data.url);
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.APP_CLOSE_READY, () => {
    forceQuitAfterSave = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.TABS_REPORT_ACTIVE, (_e, payload: unknown) => {
    const r = TabsReportActiveSchema.safeParse(payload);
    if (!r.success) return { ok: false as const, error: 'Invalid tab report' };
    const p = r.data;
    if (!p.url.trim()) activeTabSnapshot = null;
    else activeTabSnapshot = { url: p.url, title: p.title || p.url };
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_METRICS, () => {
    const m = process.memoryUsage();
    return {
      rss: m.rss,
      heapUsed: m.heapUsed,
      heapTotal: m.heapTotal,
      external: m.external,
    };
  });

  // ── Embedded DevTools via BrowserView overlay ──────────────────────────────
  //
  // We create a BrowserView in the main process whose WebContents has NEVER
  // navigated. That is the only reliable way to satisfy Electron's
  // setDevToolsWebContents() requirement. The BrowserView is positioned over
  // the right-sidebar's DevTools area so it appears embedded in the UI.

  let devToolsView: BrowserView | null = null;
  let devToolsGuestWcId: number | null = null;

  function destroyDevToolsView(): void {
    if (!devToolsView) return;
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.removeBrowserView(devToolsView);
      }
    } catch {
      /* window may already be gone */
    }
    try {
      devToolsView.webContents.close();
    } catch {
      /* ignore */
    }
    devToolsView = null;
  }

  function closeGuestDevTools(wcId: number | null): void {
    if (wcId === null) return;
    const wc = webContents.fromId(wcId);
    if (wc && !wc.isDestroyed()) {
      try {
        wc.closeDevTools();
      } catch {
        /* ignore */
      }
    }
  }

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_ATTACH, (_e, payload: unknown) => {
    const p = payload as {
      guestWcId?: number;
      bounds?: { x: number; y: number; width: number; height: number };
    };
    if (typeof p.guestWcId !== 'number') {
      return { ok: false as const, error: 'Missing guestWcId' };
    }

    const guestWc = webContents.fromId(p.guestWcId);
    if (!guestWc || guestWc.isDestroyed()) {
      return { ok: false as const, error: 'Guest WebContents not found' };
    }

    // Tear down any previous DevTools view first.
    closeGuestDevTools(devToolsGuestWcId);
    destroyDevToolsView();
    devToolsGuestWcId = null;

    try {
      // BrowserView starts with a completely unnavigated WebContents — exactly
      // what setDevToolsWebContents() requires.
      const view = new BrowserView({
        webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true },
      });

      guestWc.setDevToolsWebContents(view.webContents);
      guestWc.openDevTools();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.addBrowserView(view);
        if (p.bounds) {
          const { x, y, width, height } = p.bounds;
          view.setBounds({
            x: Math.round(x),
            y: Math.round(y),
            width: Math.max(1, Math.round(width)),
            height: Math.max(1, Math.round(height)),
          });
        }
      }

      devToolsView = view;
      devToolsGuestWcId = p.guestWcId;
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_SET_BOUNDS, (_e, payload: unknown) => {
    const p = payload as { bounds?: { x: number; y: number; width: number; height: number } };
    if (!p.bounds || !devToolsView) return { ok: false as const };
    try {
      const { x, y, width, height } = p.bounds;
      devToolsView.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      });
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DEVTOOLS_DETACH, (_e, payload: unknown) => {
    const p = payload as { guestWcId?: number };
    const wcId = typeof p.guestWcId === 'number' ? p.guestWcId : devToolsGuestWcId;
    closeGuestDevTools(wcId);
    destroyDevToolsView();
    devToolsGuestWcId = null;
    return { ok: true as const };
  });

  registerPluginIpc({
    store,
    sessionManager,
    getMainWindow: () => mainWindow,
    getDiscovered: () => cachedDiscoveredPlugins,
    getActiveTab: () => activeTabSnapshot,
  });

  // ── Chrome extension install (triggered by the chrome.webstore shim) ────────
  //
  // The shim is injected into Chrome Web Store pages via app.on('web-contents-created')
  // below.  When the user clicks "Add to Chrome", the shim calls
  // window.__devlensExt.requestInstall(extId) which sends this IPC from the
  // webview's preload directly to the main process.
  ipcMain.on('devlens-ext-install', (_e, payload: unknown) => {
    const { extensionId } = (payload ?? {}) as { extensionId?: string };
    if (!extensionId || !/^[a-z]{32}$/.test(extensionId)) {
      console.warn('[ext] invalid extension ID:', extensionId);
      return;
    }

    const win = mainWindow;
    void (async () => {
      try {
        const { response } = await dialog.showMessageBox(win ?? new BrowserWindow(), {
          type: 'question',
          title: 'Add extension — Dev-Lens',
          message: `Install Chrome extension?`,
          detail: `Extension ID: ${extensionId}\n\nDev-Lens will download and load this extension.`,
          buttons: ['Add Extension', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        });

        if (response !== 0) return;

        const sessions = [session.defaultSession, ...sessionManager.getInitializedSessions()];
        const name = await installChromeExtension(extensionId, sessions);

        await dialog.showMessageBox(win ?? new BrowserWindow(), {
          type: 'info',
          title: 'Extension added — Dev-Lens',
          message: `"${name}" has been added.`,
          buttons: ['OK'],
        });
      } catch (e) {
        console.error('[ext] install failed:', e);
        dialog.showErrorBox('Extension install failed', e instanceof Error ? e.message : String(e));
      }
    })();
  });

  // Deprecated: guest browsing uses `<webview>` in the renderer; these channels are unused but
  // registered so any stray legacy invoke() does not reject (returns `{ ok: true }`).
  const noop = (): { ok: true } => ({ ok: true });
  [
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
  ].forEach((ch) => ipcMain.handle(ch, noop));
}

// ── Chrome Web Store "Add to Chrome" shim ──────────────────────────────────
//
// Injected into every Chrome Web Store page via executeJavaScript (runs in the
// page's main world).  It defines window.chrome.webstore if absent so the
// Web Store renders the "Add to Chrome" button.  When the user clicks it, the
// shim calls window.__devlensExt.requestInstall() (exposed by
// webview-console-preload via contextBridge) which sends the IPC handled above.

const WEBSTORE_SHIM = `(function() {
  if (window.chrome && window.chrome.webstore) return;
  window.chrome = window.chrome || {};
  window.chrome.webstore = {
    install: function(url, successCb, failureCb) {
      var m = window.location.pathname.match(/\\/([a-z]{32})(?:\\/|$|\\?)/);
      var extId = m ? m[1] : null;
      if (!extId && url) { var um = url.match(/([a-z]{32})/); extId = um ? um[1] : null; }
      if (extId && window.__devlensExt) {
        window.__devlensExt.requestInstall(extId);
        if (successCb) successCb();
      } else if (failureCb) {
        failureCb('Dev-Lens: could not detect extension ID');
      }
    },
    onInstallStageChanged: { addListener: function(){}, removeListener: function(){} },
    onDownloadProgress:    { addListener: function(){}, removeListener: function(){} }
  };
})();`;

function isWebStorePage(url: string): boolean {
  return url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore');
}

void app
  .whenReady()
  .then(async () => {
    store = createUserStore();
    mergeMissingStoreKeys();
    mergeSettingsDefaults();
    applyBlockerFromStore();
    try {
      fs.mkdirSync(path.join(app.getPath('userData'), 'plugins'), { recursive: true });
    } catch {
      /* ignore */
    }
    refreshDiscoveredPlugins();
    initCrashLogger(app.getPath('userData'));

    // Strip "Electron/X.X.X" from the default session's user-agent so every
    // webview (including those using the default partition) appears as Chrome.
    const defaultCleanUA = session.defaultSession.getUserAgent().replace(/ Electron\/[\d.]+/, '');
    session.defaultSession.setUserAgent(defaultCleanUA);

    // Fix sec-ch-ua Client Hints for the default session so the Chrome Web Store
    // server-side render sees "Google Chrome" and shows the install button.
    attachWebStoreChromeBranding(session.defaultSession);

    sessionManager = new SessionManager(
      () => store.get('settings').blockerEnabled,
      emitBlockerStats,
      emitNetworkLog,
    );

    // Pre-attach blocker to sessions for workspaces already in the store.
    for (const ws of store.get('workspaces')) {
      sessionManager.initSession(`persist:dev-lens-ws-${sanitizePartition(ws.id)}`);
    }

    // Inject chrome.webstore shim into Chrome Web Store pages so "Add to
    // Chrome" button appears.  We hook ALL webContents so webviews are covered.
    app.on('web-contents-created', (_e, wc) => {
      wc.on('did-finish-load', () => {
        try {
          if (isWebStorePage(wc.getURL())) {
            void wc.executeJavaScript(WEBSTORE_SHIM);
          }
        } catch {
          /* ignore */
        }
      });
    });

    registerIpc();
    mainWindow = createMainWindow();

    // Load any extensions that were previously installed.
    const allSessions = [session.defaultSession, ...sessionManager.getInitializedSessions()];
    await loadAllInstalledExtensions(allSessions);
    startSystemClipboardPolling();
    startTelemetryHeartbeat(() => store);

    const s0 = store.get('settings');
    if (s0.blockListAutoUpdate !== false) {
      try {
        await refreshRemoteBlockListFromStore();
      } catch (e) {
        console.warn('[blocklist] initial fetch failed:', e);
      }
      setInterval(() => {
        if (!store.get('settings').blockListAutoUpdate) return;
        void refreshRemoteBlockListFromStore().catch((err) =>
          console.warn('[blocklist] periodic fetch failed:', err),
        );
      }, BLOCKLIST_REFRESH_MS);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  })
  .catch((err: unknown) => {
    console.error('Electron failed to start:', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
