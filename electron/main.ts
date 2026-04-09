import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Suppress noisy Node.js warnings emitted by Electron's extension loader for
// permissions it doesn't implement (contextMenus, webNavigation, etc.).
// process.on('warning') doesn't prevent the default stderr write, so we must
// monkey-patch process.emitWarning itself — the only reliable suppression path.
{
  const _emit = process.emitWarning.bind(process);
  // @ts-expect-error – intentional monkey-patch for log hygiene
  process.emitWarning = function devlensEmitWarning(
    warning: string | Error,
    ...rest: Parameters<typeof process.emitWarning> extends [unknown, ...infer R] ? R : never
  ): void {
    const opts = rest[0];
    const code =
      opts != null && typeof opts === 'object' && 'code' in opts
        ? (opts as { code?: string }).code
        : typeof opts === 'string'
          ? opts // older Node signature: emitWarning(msg, type, code)
          : undefined;
    if (code === 'ExtensionLoadWarning') return;
    const msg = typeof warning === 'string' ? warning : (warning?.message ?? '');
    if (/Permission '[^']+' is unknown/.test(msg)) return;
    return _emit(warning, ...rest);
  };
}
import {
  app,
  BrowserView,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  screen,
  session,
  shell,
  webContents,
  type MenuItemConstructorOptions,
} from 'electron';
import type { Session } from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  defaultStoreSnapshot,
  mergeFeatureFlags,
  workspaceBrowserPartition,
  type DevLensStoreSnapshot,
} from '@dev-lens/shared';
import { replaceRemoteBlockHosts, setTrackerAllowlist, setUserBlockHosts } from './blocker';
import { DEFAULT_BLOCKLIST_URL, fetchRemoteBlocklist } from './blocklist-fetch';
import type { NetworkLogPayload } from './network-spy';
import { SessionManager, attachWebStoreChromeBranding } from './session-manager';
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
import {
  ensureExtensionLoadedInSession,
  installChromeExtension,
  isExtensionInstalled,
  listInstalledExtensions,
  loadAllInstalledExtensions,
  removeInstalledExtension,
  sessionContainsExtension,
} from './extension-manager';

/** One floating popup window per extension ID (Chrome-style toolbar popup). */
const extensionPopupWindows = new Map<string, BrowserWindow>();

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let store: UserStore;
let sessionManager: SessionManager;

/**
 * Pick a session that can serve `chrome-extension://` for this id, loading from
 * disk into each candidate until one succeeds.
 */
async function resolveSessionForExtensionPopup(
  extensionId: string,
  preferredPartition?: string,
): Promise<Session | null> {
  const ordered: Session[] = [];
  if (preferredPartition?.startsWith('persist:')) {
    ordered.push(session.fromPartition(preferredPartition));
  }
  ordered.push(session.defaultSession);
  ordered.push(...sessionManager.getInitializedSessions());
  for (const ses of ordered) {
    await ensureExtensionLoadedInSession(ses, extensionId);
    if (sessionContainsExtension(ses, extensionId)) return ses;
  }
  return null;
}

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
  const cur = store.get('settings');
  const mergedFlags = mergeFeatureFlags(def.featureFlags, cur.featureFlags);
  store.set('settings', { ...def, ...cur, featureFlags: mergedFlags });
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
  const s = store.get('settings');
  if (s.featureFlags?.historyRecording === false) return;
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

/** Shown in the macOS menu bar; Windows/Linux use the in-app top bar only (no Electron default menu). */
const APP_DISPLAY_NAME = 'DevLens';

function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    const template: MenuItemConstructorOptions[] = [
      {
        label: APP_DISPLAY_NAME,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
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
    // Load installed extensions into ONLY the newly created session so we
    // don't re-load into sessions that already have the extensions.
    const newSes = session.fromPartition(r.data.partition);
    void loadAllInstalledExtensions([newSes]);
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
        if (isExtensionInstalled(extensionId)) {
          await dialog.showMessageBox(win ?? new BrowserWindow(), {
            type: 'info',
            title: 'Already installed — DevLens',
            message: 'This extension is already installed.',
            detail: `Extension ID: ${extensionId}\n\nYou can open it from the toolbar next to the address bar, or manage it in Settings → Extensions.`,
            buttons: ['OK'],
          });
          return;
        }

        const { response } = await dialog.showMessageBox(win ?? new BrowserWindow(), {
          type: 'question',
          title: 'Add extension — DevLens',
          message: `Install Chrome extension?`,
          detail: `Extension ID: ${extensionId}\n\nDevLens will download and load this extension.`,
          buttons: ['Add Extension', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        });

        if (response !== 0) return;

        const sessions = [session.defaultSession, ...sessionManager.getInitializedSessions()];
        const name = await installChromeExtension(extensionId, sessions);

        await dialog.showMessageBox(win ?? new BrowserWindow(), {
          type: 'info',
          title: 'Extension added — DevLens',
          message: `"${name}" has been added.`,
          buttons: ['OK'],
        });
      } catch (e) {
        console.error('[ext] install failed:', e);
        dialog.showErrorBox('Extension install failed', e instanceof Error ? e.message : String(e));
      }
    })();
  });

  // ── Installed extension list + removal ──────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.EXT_LIST, () => listInstalledExtensions());

  ipcMain.handle(IPC_CHANNELS.EXT_IS_INSTALLED, (_e, payload: unknown) => {
    const { extensionId } = (payload ?? {}) as { extensionId?: string };
    if (!extensionId || !/^[a-z]{32}$/.test(extensionId)) return false;
    return isExtensionInstalled(extensionId);
  });

  ipcMain.handle(IPC_CHANNELS.EXT_OPEN_POPUP, async (event, payload: unknown) => {
    const p = (payload ?? {}) as {
      extensionId?: string;
      popupPath?: string;
      /** Same string as the browser `<webview partition>` (e.g. persist:dev-lens-ws-…). */
      partition?: string;
      anchor?: { x: number; y: number; width: number; height: number };
    };
    const extensionId = p.extensionId;
    const popupPath = p.popupPath?.replace(/^\/+/, '') ?? '';
    if (!extensionId || !/^[a-z]{32}$/.test(extensionId) || !popupPath) {
      return { ok: false as const, error: 'Invalid extension or popup path' };
    }
    if (!isExtensionInstalled(extensionId)) {
      return { ok: false as const, error: 'Extension is not installed' };
    }

    const extSession = await resolveSessionForExtensionPopup(extensionId, p.partition);
    if (!extSession) {
      return {
        ok: false as const,
        error:
          'Could not load this extension into a browser session. Check Settings → Extensions or reinstall.',
      };
    }

    const registered =
      extSession.extensions.getExtension(extensionId) ??
      extSession.extensions
        .getAllExtensions()
        .find(
          (e) =>
            e.id === extensionId || path.basename(e.path.replace(/[/\\]+$/, '')) === extensionId,
        );
    const chromeExtId = registered?.id ?? extensionId;

    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    const existing = extensionPopupWindows.get(extensionId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { ok: true as const };
    }

    const POPUP_W = 380;
    const POPUP_H = 520;
    const popupWin = new BrowserWindow({
      parent: parent ?? undefined,
      width: POPUP_W,
      height: POPUP_H,
      minWidth: 200,
      minHeight: 200,
      show: false,
      frame: true,
      resizable: true,
      skipTaskbar: true,
      webPreferences: {
        session: extSession,
        // Sandboxed renderers cannot load chrome-extension:// pages (ERR_BLOCKED_BY_CLIENT).
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // No in-window menu strip on Windows/Linux (extension UIs are tiny; File/Edit is noise).
    if (process.platform !== 'darwin') {
      popupWin.setMenu(null);
    }

    extensionPopupWindows.set(extensionId, popupWin);
    popupWin.on('closed', () => {
      extensionPopupWindows.delete(extensionId);
    });

    if (parent && p.anchor) {
      const b = parent.getContentBounds();
      let x = Math.round(b.x + p.anchor.x);
      let y = Math.round(b.y + p.anchor.y + p.anchor.height + 4);
      const display = screen.getDisplayNearestPoint({ x, y });
      const db = display.workArea;
      if (x + POPUP_W > db.x + db.width) x = db.x + db.width - POPUP_W - 8;
      if (y + POPUP_H > db.y + db.height) y = db.y + db.height - POPUP_H - 8;
      if (x < db.x) x = db.x + 8;
      if (y < db.y) y = db.y + 8;
      popupWin.setPosition(x, y);
    } else if (parent) {
      const b = parent.getBounds();
      popupWin.setPosition(Math.round(b.x + (b.width - POPUP_W) / 2), Math.round(b.y + 80));
    }

    const url = `chrome-extension://${chromeExtId}/${popupPath}`;
    void popupWin
      .loadURL(url)
      .then(() => {
        popupWin.show();
      })
      .catch((e) => {
        console.error('[ext] popup load failed:', e);
        extensionPopupWindows.delete(extensionId);
        if (!popupWin.isDestroyed()) popupWin.destroy();
      });

    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.EXT_REMOVE, (_e, payload: unknown) => {
    const { extensionId } = (payload ?? {}) as { extensionId?: string };
    if (!extensionId) return { ok: false as const, error: 'Missing extensionId' };
    try {
      removeInstalledExtension(extensionId);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Remove failed' };
    }
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

// ── Chrome Web Store shim + Dev-Lens install bar ───────────────────────────
//
// Why spoofing Chrome alone is not enough (as of Electron 33 / Chromium 130):
//
//   Google's Web Store API rejects install requests from Chrome versions older
//   than ~3 major releases (Chrome 130 is from Oct 2024; the current minimum
//   accepted as of Apr 2026 is ~143). Our sec-ch-ua patches correctly identify
//   as "Google Chrome";v="130", but the backend returns "unavailable" anyway
//   because that version is past end-of-life. Upgrading to Electron 41
//   (Chromium 146) will fix this at the source.
//
// Immediate reliable approach:
//
//   Inject a floating "Add to Dev-Lens" bar on extension detail pages.
//   It extracts the ID from the URL and fires our existing CRX install IPC —
//   no browser-detection battle needed. The Chrome API stubs are kept so the
//   store renders its native button too; clicking either path works.

/**
 * Injected into Chrome Web Store pages via executeJavaScript.
 * Runs in the main world (CSP-bypassed). Fired on dom-ready (before React
 * hydrates) and again on did-finish-load for SPA navigations.
 */
function getAppIconPngPathForWebstoreInject(): string {
  return isDev
    ? path.join(__dirname, '..', 'electron', 'assets', 'icon.png')
    : path.join(__dirname, '..', 'assets', 'icon.png');
}

let webstoreShimCached: string | null = null;

function getWebstoreShim(): string {
  if (webstoreShimCached) return webstoreShimCached;
  let logoJs: string;
  try {
    const dataUrl =
      'data:image/png;base64,' +
      fs.readFileSync(getAppIconPngPathForWebstoreInject()).toString('base64');
    logoJs =
      "var logoWrap=document.createElement('span');" +
      "logoWrap.setAttribute('style','display:flex;align-items:center;gap:8px;color:#a5b4fc;letter-spacing:.02em');" +
      "var logoImg=document.createElement('img');" +
      'logoImg.src=' +
      JSON.stringify(dataUrl) +
      ';' +
      "logoImg.alt='';" +
      'logoImg.width=20;' +
      'logoImg.height=20;' +
      "logoImg.setAttribute('style','display:block;flex-shrink:0;border-radius:4px;object-fit:contain');" +
      "var logoText=document.createElement('span');" +
      "logoText.textContent='DevLens';" +
      'logoWrap.appendChild(logoImg);' +
      'logoWrap.appendChild(logoText);';
  } catch {
    logoJs =
      "var logoWrap=document.createElement('span');" +
      "logoWrap.setAttribute('style','color:#a5b4fc;letter-spacing:.02em');" +
      "logoWrap.textContent='DevLens';";
  }
  webstoreShimCached = WEBSTORE_SHIM_TEMPLATE.replace('__INJECT_WEBSTORE_LOGO__', logoJs);
  return webstoreShimCached;
}

const WEBSTORE_SHIM_TEMPLATE = `(function() {
  // ── 1. navigator.userAgentData — patch "Google Chrome" brand ──────────
  //
  // This is the ROOT CAUSE of the greyed-out "Add to Chrome" button.
  //
  // The HTTP sec-ch-ua header (fixed server-side by attachWebStoreChromeBranding)
  // controls what the Next.js SSR renders. But the Web Store's React app ALSO
  // calls navigator.userAgentData.brands *in JavaScript* after hydration.
  // Without "Google Chrome" in that list the store marks the extension as
  // unavailable and disables the install button client-side.
  //
  // We must patch this before any page script runs; executeJavaScript on
  // dom-ready (before React bundle evaluation) achieves that.
  (function patchUAData() {
    try {
      var uad = navigator.userAgentData;
      if (!uad) return;

      var brands = Array.prototype.slice.call(uad.brands || []);
      if (brands.some(function(b) { return b.brand === 'Google Chrome'; })) return;

      var chromiumBrand = brands.filter(function(b) { return b.brand === 'Chromium'; })[0];
      var majorVer = chromiumBrand ? chromiumBrand.version : '130';

      var newBrands = brands.concat([{ brand: 'Google Chrome', version: majorVer }]);
      var origGetHEV = uad.getHighEntropyValues.bind(uad);

      var patchedUAD = {
        brands: newBrands,
        mobile: uad.mobile,
        platform: uad.platform,
        toJSON: function() { return { brands: newBrands, mobile: uad.mobile, platform: uad.platform }; },
        getHighEntropyValues: function(hints) {
          return origGetHEV(hints).then(function(data) {
            var result = {};
            var keys = Object.keys(data);
            for (var i = 0; i < keys.length; i++) result[keys[i]] = data[keys[i]];

            // Patch brands array
            if (result.brands && !result.brands.some(function(b) { return b.brand === 'Google Chrome'; })) {
              result.brands = Array.prototype.slice.call(result.brands).concat([{ brand: 'Google Chrome', version: majorVer }]);
            }
            // Patch fullVersionList (uses full semver strings)
            if (result.fullVersionList && !result.fullVersionList.some(function(b) { return b.brand === 'Google Chrome'; })) {
              var cvb = result.fullVersionList.filter(function(b) { return b.brand === 'Chromium'; })[0];
              if (cvb) result.fullVersionList = Array.prototype.slice.call(result.fullVersionList).concat([{ brand: 'Google Chrome', version: cvb.version }]);
            }
            return result;
          });
        }
      };

      // Define on the navigator instance (shadows the prototype getter).
      Object.defineProperty(navigator, 'userAgentData', {
        get: function() { return patchedUAD; },
        configurable: true
      });
    } catch(e) { /* non-configurable or unavailable — fall through */ }
  })();

  // ── 2. Chrome API stubs ────────────────────────────────────────────────
  // The Web Store checks these before deciding to render the install button.
  window.chrome = window.chrome || {};

  if (!window.chrome.app) {
    window.chrome.app = {
      isInstalled: false,
      getDetails: function() { return null; },
      getIsInstalled: function() { return false; },
      installState: function(cb) { if (typeof cb === 'function') cb('not_installed'); },
      runningState: function() { return 'cannot_run'; }
    };
  }

  if (!window.chrome.runtime) {
    var noop = function() {};
    var evts = { addListener: noop, removeListener: noop, hasListeners: function(){ return false; } };
    window.chrome.runtime = {
      id: undefined, lastError: null,
      connect: function() {
        return { postMessage: noop, disconnect: noop, onMessage: evts, onDisconnect: evts };
      },
      sendMessage: noop,
      onMessage: evts, onConnect: evts
    };
  }

  // ── 3. Old-store shim: chrome.webstore.install() ───────────────────────
  // Still called by chrome.google.com/webstore. The new store does not call
  // it, but having the API present satisfies presence checks.
  if (!window.chrome.webstore) {
    window.chrome.webstore = {
      install: function(url, successCb, failureCb) {
        var m = window.location.pathname.match(/\\/([a-z]{32})(?:\\/|$|\\?)/);
        var extId = m ? m[1] : null;
        if (!extId && url) { var um = String(url).match(/([a-z]{32})/); extId = um ? um[1] : null; }
        if (extId && window.__devlensExt) {
          window.__devlensExt.requestInstall(extId);
          if (typeof successCb === 'function') successCb();
        } else if (typeof failureCb === 'function') {
          failureCb('Dev-Lens: extension ID not found');
        }
      },
      onInstallStageChanged: { addListener: function(){}, removeListener: function(){} },
      onDownloadProgress:    { addListener: function(){}, removeListener: function(){} }
    };
  }

  // ── 4. Old-store click intercept (chrome.google.com/webstore) ────────────
  // The old store calls chrome.webstore.install() — our stub above handles it.
  // But also attach a capture-phase click listener as belt-and-suspenders.
  (function attachOldStoreInterceptor() {
    if (location.hostname !== 'chrome.google.com') return;
    document.addEventListener('click', function(e) {
      var el = e.target;
      for (var i = 0; i < 6; i++) {
        if (!el || el === document.body) break;
        var tag = el.tagName;
        var role = el.getAttribute && el.getAttribute('role');
        var text = (el.textContent || '').trim().toLowerCase();
        if ((tag === 'BUTTON' || role === 'button') &&
            (text === 'add to chrome' || text === 'install')) {
          var m = location.pathname.match(/\\/([a-z]{32})(?:\\/|$|\\?|#)/);
          var extId = m ? m[1] : null;
          if (extId && window.__devlensExt) window.__devlensExt.requestInstall(extId);
          return;
        }
        el = el.parentElement;
      }
    }, true);
  })();

  // ── 5. Dev-Lens install bar (new store — reliable, version-agnostic) ───────
  //
  // The new chromewebstore.google.com rejects installs from old Chrome versions
  // server-side, so no amount of UA spoofing fixes the greyed button for
  // Electron 33 (Chromium 130). Instead, inject a branded overlay bar that
  // directly invokes our proven CRX download + session.loadExtension pipeline.
  // This works regardless of what the Web Store renders.
  (function injectDevLensBar() {
    if (location.hostname !== 'chromewebstore.google.com') return;

    function getExtId() {
      var m = location.pathname.match(/\\/([a-z]{32})(?:\\/|$|\\?|#)/);
      return m ? m[1] : null;
    }

    function removeBar() {
      var old = document.getElementById('__dl-bar');
      if (old) old.remove();
    }

    function renderBar(extId) {
      removeBar();
      var bar = document.createElement('div');
      bar.id = '__dl-bar';
      bar.setAttribute('style', [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
        'background:linear-gradient(90deg,#312E81 0%,#1e1b4b 100%)',
        'color:#e0e7ff', 'font:600 13px/1 system-ui,sans-serif',
        'padding:0 16px', 'height:44px', 'display:flex', 'align-items:center',
        'gap:12px', 'box-shadow:0 2px 12px rgba(0,0,0,.5)',
        'border-bottom:1px solid #4338ca'
      ].join(';'));

      __INJECT_WEBSTORE_LOGO__

      var sep = document.createElement('span');
      sep.textContent = '·';
      sep.setAttribute('style', 'color:#4338ca');

      var label = document.createElement('span');
      label.setAttribute('style', 'color:#c7d2fe;font-weight:400');

      var btn = document.createElement('button');
      btn.setAttribute('style', [
        'background:#6366f1', 'color:#fff', 'border:none', 'border-radius:6px',
        'padding:6px 16px', 'font:600 13px system-ui,sans-serif', 'cursor:pointer',
        'transition:background .15s', 'flex-shrink:0'
      ].join(';'));

      // Show a loading state while we check if the extension is installed
      label.textContent = 'Checking extension status\u2026';
      btn.textContent = '\u2026';
      btn.disabled = true;
      btn.style.opacity = '0.5';

      var spacer = document.createElement('span');
      spacer.setAttribute('style', 'flex:1');

      var close = document.createElement('button');
      close.textContent = '\u2715';
      close.setAttribute('style', [
        'background:none', 'border:none', 'color:#6366f1', 'font-size:16px',
        'cursor:pointer', 'padding:4px 6px', 'border-radius:4px',
        'transition:color .15s'
      ].join(';'));
      close.addEventListener('mouseenter', function() { close.style.color = '#a5b4fc'; });
      close.addEventListener('mouseleave', function() { close.style.color = '#6366f1'; });
      close.addEventListener('click', removeBar);

      bar.appendChild(logoWrap);
      bar.appendChild(sep);
      bar.appendChild(label);
      bar.appendChild(btn);
      bar.appendChild(spacer);
      bar.appendChild(close);

      var mount = document.body || document.documentElement;
      mount.insertBefore(bar, mount.firstChild);

      // Async check — update UI once we know
      if (window.__devlensExt && window.__devlensExt.isInstalled) {
        window.__devlensExt.isInstalled(extId).then(function(installed) {
          if (installed) {
            label.textContent = 'Already installed in DevLens';
            btn.textContent = '\u2713 Installed';
            btn.disabled = true;
            btn.style.opacity = '1';
            btn.style.background = '#16a34a';
            btn.style.cursor = 'default';
          } else {
            label.textContent = 'Install this extension in DevLens:';
            btn.textContent = '\uFF0B Add to DevLens';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.addEventListener('mouseenter', function() { btn.style.background = '#4f46e5'; });
            btn.addEventListener('mouseleave', function() { btn.style.background = '#6366f1'; });
            btn.addEventListener('click', function() {
              if (window.__devlensExt) window.__devlensExt.requestInstall(extId);
            });
          }
        }).catch(function() {
          label.textContent = 'Install this extension in DevLens:';
          btn.textContent = '\uFF0B Add to DevLens';
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.addEventListener('click', function() {
            if (window.__devlensExt) window.__devlensExt.requestInstall(extId);
          });
        });
      } else {
        label.textContent = 'Install this extension in DevLens:';
        btn.textContent = '\uFF0B Add to DevLens';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.addEventListener('mouseenter', function() { btn.style.background = '#4f46e5'; });
        btn.addEventListener('mouseleave', function() { btn.style.background = '#6366f1'; });
        btn.addEventListener('click', function() {
          if (window.__devlensExt) window.__devlensExt.requestInstall(extId);
        });
      }
    }

    function tryRender() {
      var extId = getExtId();
      if (extId) renderBar(extId);
      else removeBar();
    }

    // Initial render
    if (document.body) tryRender();
    else document.addEventListener('DOMContentLoaded', tryRender);

    // Handle SPA navigation (the store is a React SPA; URL changes without full reload)
    var lastPath = location.pathname;
    setInterval(function() {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        tryRender();
      }
    }, 400);
  })();
})();`;

function isWebStorePage(url: string): boolean {
  return url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore');
}

void app
  .whenReady()
  .then(async () => {
    setupApplicationMenu();
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
      sessionManager.initSession(workspaceBrowserPartition(ws.id));
    }

    // Inject the chrome API shim into Chrome Web Store pages.
    // We hook ALL webContents so webviews are covered.
    //
    // dom-ready       → fires at DOMContentLoaded, before React hydration — primary injection.
    // did-finish-load → fallback; also catches SPA navigations where dom-ready may
    //                   not re-fire (e.g. history.pushState on chromewebstore.google.com).
    const injectWebStoreShim = (wc: import('electron').WebContents): void => {
      try {
        if (isWebStorePage(wc.getURL())) {
          void wc.executeJavaScript(getWebstoreShim());
        }
      } catch {
        /* ignore */
      }
    };

    app.on('web-contents-created', (_e, wc) => {
      wc.on('dom-ready', () => injectWebStoreShim(wc));
      wc.on('did-finish-load', () => injectWebStoreShim(wc));
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
