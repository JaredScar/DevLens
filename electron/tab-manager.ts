import { BrowserView, BrowserWindow, shell } from 'electron';
import type { TabUpdatedPayload } from '@dev-lens/shared';
import { attachRequestBlocker } from './blocker';

type ViewEntry = { view: BrowserView };

export class TabManager {
  private readonly views = new Map<string, ViewEntry>();
  private activeTabId: string | null = null;
  private bounds = { x: 0, y: 0, width: 800, height: 600 };
  private blockedSession = 0;

  constructor(
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly isBlockerEnabled: () => boolean,
    private readonly emitTabUpdated: (p: TabUpdatedPayload) => void,
    private readonly emitBlockerStats: () => void,
    private readonly onBrowserHistory: (url: string, title: string) => void,
  ) {}

  setBounds(rect: { x: number; y: number; width: number; height: number }): void {
    this.bounds = { ...rect };
    this.applyBoundsToActive();
  }

  hideAllViews(): void {
    const win = this.getMainWindow();
    if (!win) return;
    for (const { view } of this.views.values()) {
      win.removeBrowserView(view);
    }
    this.activeTabId = null;
  }

  create(tabId: string, workspaceId: string): { ok: true } | { ok: false; error: string } {
    if (this.views.has(tabId)) return { ok: false, error: 'exists' };
    const win = this.getMainWindow();
    if (!win) return { ok: false, error: 'no-window' };

    const partition = `persist:dev-lens-ws-${sanitizePartition(workspaceId)}`;
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition,
      },
    });

    attachRequestBlocker(view.webContents.session, this.isBlockerEnabled, () => {
      this.blockedSession++;
      this.emitBlockerStats();
    });

    view.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    view.webContents.on('page-title-updated', (_e, title) => {
      this.pushTabState(tabId, title);
    });

    view.webContents.on('did-navigate', (_e, url) => {
      this.recordHistoryIfWeb(url, view.webContents.getTitle());
      this.pushTabState(tabId);
    });

    view.webContents.on('did-navigate-in-page', (_e, url) => {
      this.recordHistoryIfWeb(url, view.webContents.getTitle());
      this.pushTabState(tabId);
    });

    this.views.set(tabId, { view });
    return { ok: true };
  }

  destroy(tabId: string): { ok: true } | { ok: false; error: string } {
    const win = this.getMainWindow();
    const entry = this.views.get(tabId);
    if (!entry || !win) return { ok: false, error: 'not-found' };
    win.removeBrowserView(entry.view);
    this.views.delete(tabId);
    if (this.activeTabId === tabId) this.activeTabId = null;
    return { ok: true };
  }

  setActive(tabId: string | null): void {
    const win = this.getMainWindow();
    if (!win) return;

    for (const { view } of this.views.values()) {
      win.removeBrowserView(view);
    }

    if (!tabId || !this.views.has(tabId)) {
      this.activeTabId = null;
      return;
    }

    const { view } = this.views.get(tabId)!;
    win.addBrowserView(view);
    this.activeTabId = tabId;
    this.applyBoundsToActive();
    this.pushTabState(tabId);
  }

  async navigate(tabId: string, url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const entry = this.views.get(tabId);
    if (!entry) return { ok: false, error: 'not-found' };
    try {
      await entry.view.webContents.loadURL(url);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  goBack(tabId: string): boolean {
    const v = this.views.get(tabId)?.view;
    if (!v?.webContents.canGoBack()) return false;
    v.webContents.goBack();
    return true;
  }

  goForward(tabId: string): boolean {
    const v = this.views.get(tabId)?.view;
    if (!v?.webContents.canGoForward()) return false;
    v.webContents.goForward();
    return true;
  }

  reload(tabId: string): void {
    this.views.get(tabId)?.view.webContents.reload();
  }

  toggleDevtools(tabId: string): void {
    const wc = this.views.get(tabId)?.view.webContents;
    if (!wc) return;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
  }

  getState(tabId: string): TabUpdatedPayload | null {
    const v = this.views.get(tabId)?.view;
    if (!v) return null;
    const wc = v.webContents;
    return {
      tabId,
      url: wc.getURL() || '',
      title: wc.getTitle() || '',
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward(),
    };
  }

  getBlockedSessionCount(): number {
    return this.blockedSession;
  }

  resetBlockerStats(): void {
    this.blockedSession = 0;
    this.emitBlockerStats();
  }

  private applyBoundsToActive(): void {
    if (!this.activeTabId) return;
    const entry = this.views.get(this.activeTabId);
    if (!entry) return;
    const { width, height } = this.bounds;
    if (width <= 0 || height <= 0) {
      entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    entry.view.setBounds({
      x: Math.round(this.bounds.x),
      y: Math.round(this.bounds.y),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
    });
  }

  private pushTabState(tabId: string, titleOverride?: string): void {
    const state = this.getState(tabId);
    if (!state) return;
    if (titleOverride !== undefined) state.title = titleOverride;
    this.emitTabUpdated(state);
  }

  private recordHistoryIfWeb(url: string, title: string): void {
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;
    this.onBrowserHistory(url, title || url);
  }
}

function sanitizePartition(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}
