import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IPC_CHANNELS, IPC_EVENTS, type PersistedTabDTO } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';
import { InspectPointerService } from './inspect-pointer.service';
import { PersistedStateService } from './persisted-state.service';
import { SplitViewService } from './split-view.service';
import { WorkspaceService } from './workspace.service';

export interface UiTab {
  id: string;
  workspaceId: string;
  kind: 'browser' | 'internal';
  url: string;
  title: string;
  internalRoute?: string;
  pinned?: boolean;
  groupId?: string | null;
}

export interface WebviewHandler {
  navigate(url: string): void;
  back(): void;
  forward(): void;
  reload(): void;
  stop?: () => void;
  toggleDevtools(): void;
  executeJavaScript(code: string): Promise<unknown>;
  /** Unload guest to about:blank to reduce memory when tab is auto-suspended. */
  suspendToBlank(): void;
  /** DevTools “pick element” at guest viewport coordinates. */
  inspectElement?(x: number, y: number): void;
  /** Returns the Electron WebContentsId of the guest webview for DevTools attachment. */
  getWebContentsId?(): number | undefined;
}

function toUi(dto: PersistedTabDTO): UiTab {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    kind: dto.kind,
    url: dto.url,
    title: dto.title,
    internalRoute: dto.internalRoute,
    pinned: dto.pinned,
    groupId: dto.groupId ?? null,
  };
}

function toDto(t: UiTab): PersistedTabDTO {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    kind: t.kind,
    url: t.url,
    title: t.title,
    internalRoute: t.internalRoute,
    pinned: t.pinned,
    groupId: t.groupId,
  };
}

@Injectable({ providedIn: 'root' })
export class TabsService {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly persisted = inject(PersistedStateService);
  private readonly workspace = inject(WorkspaceService);
  private readonly splitView = inject(SplitViewService);
  private readonly router = inject(Router);

  private readonly tabLastSelectedAt = new Map<string, number>();
  private readonly suspendedBrowserIds = new Set<string>();
  private suspendTimer: ReturnType<typeof setInterval> | null = null;

  readonly tabs = signal<UiTab[]>([]);
  readonly activeTabId = signal<string | null>(null);

  readonly visibleTabs = computed(() =>
    this.tabs().filter((t) => t.workspaceId === this.workspace.activeWorkspaceId()),
  );

  readonly activeTab = computed(() => {
    const id = this.activeTabId();
    if (!id) return undefined;
    return this.tabs().find((t) => t.id === id);
  });

  /** Browser tabs visible to Angular `@for` → `BrowserTabViewComponent`. */
  readonly browserTabs = computed(() => this.tabs().filter((t) => t.kind === 'browser'));

  // ── Webview handler registry ───────────────────────────────────────────────
  private readonly webviewHandlers = new Map<string, WebviewHandler>();
  private readonly inspectPointer = inject(InspectPointerService);

  /** Per-tab guest navigation state (updated from BrowserTabViewComponent). */
  private readonly guestNavState = signal<
    Record<string, { canBack: boolean; canFwd: boolean; loading: boolean }>
  >({});

  readonly activeGuestNav = computed(() => {
    const id = this.activeTabId();
    if (!id) return { canBack: false, canFwd: false, loading: false };
    return this.guestNavState()[id] ?? { canBack: false, canFwd: false, loading: false };
  });

  setGuestNavState(
    tabId: string,
    patch: Partial<{ canBack: boolean; canFwd: boolean; loading: boolean }>,
  ): void {
    this.guestNavState.update((m) => {
      const cur = m[tabId] ?? { canBack: false, canFwd: false, loading: false };
      return { ...m, [tabId]: { ...cur, ...patch } };
    });
  }

  registerWebview(tabId: string, handler: WebviewHandler): void {
    this.webviewHandlers.set(tabId, handler);
  }

  unregisterWebview(tabId: string): void {
    this.webviewHandlers.delete(tabId);
    this.guestNavState.update((m) => {
      const rest = { ...m };
      delete rest[tabId];
      return rest;
    });
  }

  private getActiveHandler(): WebviewHandler | undefined {
    const id = this.activeTabId();
    return id ? this.webviewHandlers.get(id) : undefined;
  }

  private applyHttpsOnly(url: string): string {
    if (!this.persisted.snapshot()?.settings.httpsOnlyMode) return url;
    const t = url.trim();
    if (t.toLowerCase().startsWith('http://')) return `https://${t.slice(7)}`;
    return url;
  }

  private reportActiveTabToMain(): void {
    if (!this.bridge.isElectron) return;
    const t = this.activeTab();
    if (!t || t.kind !== 'browser') {
      void this.bridge.invoke(IPC_CHANNELS.TABS_REPORT_ACTIVE, { url: '', title: '' });
      return;
    }
    void this.bridge.invoke(IPC_CHANNELS.TABS_REPORT_ACTIVE, { url: t.url, title: t.title });
  }

  // ── Reactive state update from BrowserTabViewComponent ────────────────────
  updateTabState(tabId: string, url: string, title: string): void {
    this.tabs.update((list) =>
      list.map((t) =>
        t.id === tabId && t.kind === 'browser'
          ? { ...t, url: url || t.url, title: title || url || t.title }
          : t,
      ),
    );
    if (tabId === this.activeTabId()) this.reportActiveTabToMain();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  private listenersBound = false;

  bindMainProcessEvents(): void {
    if (this.listenersBound || !this.bridge.isElectron) return;
    this.listenersBound = true;
    this.bridge.on(IPC_EVENTS.PLUGIN_OPEN_URL, (raw) => {
      const p = raw as { url?: string; title?: string };
      if (!p.url?.trim()) return;
      void this.addBrowserTab(p.url, p.title || p.url);
    });
    // Blocker stats arrive via IPC_EVENTS.BLOCKER_STATS – handled in TopBarComponent.
    // Tab updates now come directly from BrowserTabViewComponent (no main-process round-trip).
    void this.bridge.invoke(IPC_CHANNELS.BLOCKER_GET_STATS);
    if (!this.suspendTimer) {
      this.suspendTimer = setInterval(() => this.applyAutoSuspend(), 30_000);
    }
  }

  isBrowserTabSuspended(tabId: string): boolean {
    return this.suspendedBrowserIds.has(tabId);
  }

  private applyAutoSuspend(): void {
    const mins = this.persisted.snapshot()?.settings.tabSuspendAfterMinutes ?? 0;
    if (!mins) {
      this.suspendedBrowserIds.clear();
      return;
    }
    const ms = mins * 60 * 1000;
    const now = Date.now();
    const active = this.activeTabId();
    const sec = this.splitView.enabled() ? this.splitView.secondaryTabId() : null;
    const ws = this.workspace.activeWorkspaceId();
    for (const t of this.tabs()) {
      if (t.workspaceId !== ws || t.kind !== 'browser') continue;
      if (t.id === active || t.id === sec) continue;
      const last = this.tabLastSelectedAt.get(t.id) ?? 0;
      if (now - last < ms) continue;
      if (this.suspendedBrowserIds.has(t.id)) continue;
      this.suspendedBrowserIds.add(t.id);
      this.webviewHandlers.get(t.id)?.suspendToBlank();
    }
  }

  async bootstrap(): Promise<void> {
    if (!this.bridge.isElectron) return;
    await this.persisted.hydrate();
    const snap = this.persisted.snapshot();
    if (!snap) return;

    if (snap.openTabs.length > 0) {
      // Restore tab state — BrowserTabViewComponents handle their own URL loading.
      this.tabs.set(snap.openTabs.map(toUi));
      const now = Date.now();
      for (const t of snap.openTabs) this.tabLastSelectedAt.set(t.id, now);
      const inWs = snap.openTabs.filter((t) => t.workspaceId === snap.activeWorkspaceId);
      const pick = inWs[0] ?? snap.openTabs[0];
      if (pick) await this.selectTab(pick.id, false);
    } else {
      await this.addInternalTab('new-tab', 'New Tab', false);
    }
  }

  async persistOpenTabs(): Promise<void> {
    await this.persisted.patch({ openTabs: this.tabs().map(toDto) });
  }

  async selectTab(tabId: string, persist = true): Promise<void> {
    this.activeTabId.set(tabId);
    const tab = this.tabs().find((t) => t.id === tabId);
    if (!tab) return;

    this.tabLastSelectedAt.set(tabId, Date.now());
    if (tab.kind === 'browser' && this.suspendedBrowserIds.has(tabId)) {
      this.suspendedBrowserIds.delete(tabId);
      this.webviewHandlers.get(tabId)?.navigate(tab.url);
    }

    if (tab.kind === 'internal') {
      const route = tab.internalRoute ?? 'new-tab';
      await this.router.navigateByUrl(`/${route}`);
    }
    // For browser tabs, activeTabId change causes Angular to show the correct
    // BrowserTabViewComponent (display:block) and hide others (display:none).

    if (persist) await this.persistOpenTabs();
    this.reportActiveTabToMain();
  }

  async addInternalTab(route: string, title: string, persist = true): Promise<string> {
    const id = crypto.randomUUID();
    const ws = this.workspace.activeWorkspaceId();
    const tab: UiTab = {
      id,
      workspaceId: ws,
      kind: 'internal',
      url: `dev-lens:${route}`,
      title,
      internalRoute: route,
    };
    this.tabs.update((list) => [...list, tab]);
    await this.selectTab(id, false);
    if (persist) await this.persistOpenTabs();
    return id;
  }

  async addBrowserTab(url = 'about:blank', title = 'New Tab', persist = true): Promise<string> {
    const id = crypto.randomUUID();
    const ws = this.workspace.activeWorkspaceId();
    const u = this.applyHttpsOnly(url);
    const tab: UiTab = { id, workspaceId: ws, kind: 'browser', url: u, title };
    this.tabs.update((list) => [...list, tab]);
    await this.selectTab(id, false);
    if (persist) await this.persistOpenTabs();
    return id;
  }

  async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs().find((t) => t.id === tabId);
    if (!tab) return;
    this.tabLastSelectedAt.delete(tabId);
    this.suspendedBrowserIds.delete(tabId);
    if (this.splitView.secondaryTabId() === tabId) {
      this.splitView.secondaryTabId.set(null);
    }
    // BrowserTabViewComponent unmounts automatically via @for removing it from browserTabs().
    const list = this.tabs().filter((t) => t.id !== tabId);
    this.tabs.set(list);
    if (this.activeTabId() === tabId) {
      const next = list.find((t) => t.workspaceId === tab.workspaceId);
      if (next) await this.selectTab(next.id, false);
      else await this.addInternalTab('new-tab', 'New Tab', false);
    }
    await this.persistOpenTabs();
  }

  async closeOtherTabs(tabId: string): Promise<void> {
    const tab = this.tabs().find((t) => t.id === tabId);
    if (!tab) return;
    const closeIds = new Set(
      this.tabs()
        .filter((t) => t.workspaceId === tab.workspaceId && t.id !== tabId)
        .map((t) => t.id),
    );
    if (closeIds.size === 0) return;
    for (const id of closeIds) {
      this.tabLastSelectedAt.delete(id);
      this.suspendedBrowserIds.delete(id);
    }
    if (this.splitView.secondaryTabId() && closeIds.has(this.splitView.secondaryTabId()!)) {
      this.splitView.secondaryTabId.set(null);
    }
    this.tabs.update((list) => list.filter((t) => !closeIds.has(t.id)));
    await this.selectTab(tabId, false);
    await this.persistOpenTabs();
  }

  async navigateActive(url: string): Promise<void> {
    const tab = this.activeTab();
    if (!tab || tab.kind !== 'browser') return;
    const u = this.applyHttpsOnly(url);
    this.getActiveHandler()?.navigate(u);
    this.tabs.update((list) => list.map((t) => (t.id === tab.id ? { ...t, url: u, title: u } : t)));
    await this.persistOpenTabs();
    this.reportActiveTabToMain();
  }

  async goBack(): Promise<void> {
    this.getActiveHandler()?.back();
  }

  async goForward(): Promise<void> {
    this.getActiveHandler()?.forward();
  }

  async reload(): Promise<void> {
    this.getActiveHandler()?.reload();
  }

  stopActiveLoading(): void {
    this.getActiveHandler()?.stop?.();
  }

  /** Close every browser tab in the active workspace (internal tabs unchanged). */
  async closeAllBrowserTabsInActiveWorkspace(): Promise<void> {
    const ws = this.workspace.activeWorkspaceId();
    const ids = this.tabs()
      .filter((t) => t.workspaceId === ws && t.kind === 'browser')
      .map((t) => t.id);
    for (const id of ids) {
      await this.closeTab(id);
    }
  }

  async toggleDevtools(): Promise<void> {
    this.getActiveHandler()?.toggleDevtools();
  }

  /** Returns the Electron WebContentsId of the currently active guest webview, or undefined. */
  getActiveGuestWcId(): number | undefined {
    return this.getActiveHandler()?.getWebContentsId?.();
  }

  async inspectGuestElement(): Promise<void> {
    const id = this.activeTabId();
    if (!id) return;
    const h = this.webviewHandlers.get(id);
    const fn = h?.inspectElement;
    if (!fn) return;
    const p = this.inspectPointer.peek(id);
    fn.call(h, Math.max(0, Math.floor(p.x)), Math.max(0, Math.floor(p.y)));
  }

  async executeJavaScriptInActive(code: string): Promise<unknown> {
    const h = this.getActiveHandler();
    if (!h) return undefined;
    return h.executeJavaScript(code);
  }

  async duplicateTab(tabId: string): Promise<void> {
    const tab = this.tabs().find((t) => t.id === tabId);
    if (!tab || tab.kind !== 'browser') return;
    await this.addBrowserTab(tab.url, `${tab.title} copy`);
  }

  async setPinned(tabId: string, pinned: boolean): Promise<void> {
    this.tabs.update((list) => list.map((t) => (t.id === tabId ? { ...t, pinned } : t)));
    await this.persistOpenTabs();
  }

  async moveTabToWorkspace(tabId: string, workspaceId: string): Promise<void> {
    this.tabs.update((list) => list.map((t) => (t.id === tabId ? { ...t, workspaceId } : t)));
    await this.persistOpenTabs();
  }

  reorderVisibleTabs(orderedIds: string[]): void {
    const ws = this.workspace.activeWorkspaceId();
    const otherWs = this.tabs().filter((t) => t.workspaceId !== ws);
    const idToTab = new Map(this.tabs().map((t) => [t.id, t]));
    const ordered = orderedIds.map((id) => idToTab.get(id)).filter((t): t is UiTab => !!t);
    const orderedSet = new Set(orderedIds);
    const sameWsTail = this.tabs().filter((t) => t.workspaceId === ws && !orderedSet.has(t.id));
    this.tabs.set([...otherWs, ...ordered, ...sameWsTail]);
    void this.persistOpenTabs();
  }

  async addTabGroup(title: string, color: string, tabIds?: string[]): Promise<string> {
    const id = crypto.randomUUID();
    const ws = this.workspace.activeWorkspaceId();
    const groups = [
      ...(this.persisted.snapshot()?.tabGroups ?? []),
      { id, workspaceId: ws, title, color },
    ];
    await this.persisted.patch({ tabGroups: groups });
    if (tabIds?.length) {
      for (const tabId of tabIds) {
        await this.assignTabToGroup(tabId, id);
      }
    }
    return id;
  }

  async assignTabToGroup(tabId: string, groupId: string | null): Promise<void> {
    this.tabs.update((list) => list.map((t) => (t.id === tabId ? { ...t, groupId } : t)));
    await this.persistOpenTabs();
  }

  async renameGroup(groupId: string, title: string): Promise<void> {
    const groups = (this.persisted.snapshot()?.tabGroups ?? []).map((g) =>
      g.id === groupId ? { ...g, title } : g,
    );
    await this.persisted.patch({ tabGroups: groups });
  }

  async toggleGroupCollapsed(groupId: string): Promise<void> {
    const groups = (this.persisted.snapshot()?.tabGroups ?? []).map((g) =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
    );
    await this.persisted.patch({ tabGroups: groups });
  }

  /** Remove the group row and clear `groupId` on all tabs in that group. */
  async ungroupGroup(groupId: string): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const groups = snap.tabGroups.filter((g) => g.id !== groupId);
    this.tabs.update((list) =>
      list.map((t) => (t.groupId === groupId ? { ...t, groupId: null } : t)),
    );
    await this.persisted.patch({ tabGroups: groups, openTabs: this.tabs().map(toDto) });
  }

  /**
   * Remove a workspace, move its tabs and related data to another workspace.
   * @returns false if this was the last workspace (nothing done).
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const wss = this.workspace.workspaces();
    if (wss.length <= 1) return false;
    const target = wss.find((w) => w.id !== workspaceId)?.id;
    if (!target) return false;

    const snap = this.persisted.snapshot();
    if (!snap) return false;

    const wasActive = this.workspace.activeWorkspaceId() === workspaceId;
    const nextActive = wasActive ? target : this.workspace.activeWorkspaceId();
    const nextWorkspaces = wss.filter((w) => w.id !== workspaceId);
    const nextTabGroups = snap.tabGroups.filter((g) => g.workspaceId !== workspaceId);

    const sec = this.splitView.secondaryTabId();
    if (sec) {
      const secTab = this.tabs().find((t) => t.id === sec);
      if (secTab?.workspaceId === workspaceId) {
        this.splitView.secondaryTabId.set(null);
        this.splitView.enabled.set(false);
      }
    }

    this.tabs.update((list) =>
      list.map((t) =>
        t.workspaceId === workspaceId ? { ...t, workspaceId: target, groupId: null } : t,
      ),
    );

    const nextNotes = snap.notes.map((n) =>
      n.workspaceId === workspaceId ? { ...n, workspaceId: target } : n,
    );
    const nextSessions = snap.savedSessions.map((s) =>
      s.workspaceId === workspaceId ? { ...s, workspaceId: target } : s,
    );
    const nextRules = snap.automationRules.filter(
      (r) =>
        !(r.triggerType === 'workspace_active' && r.triggerValue.trim() === workspaceId) &&
        !(r.actionType === 'switch_workspace' && r.actionValue.trim() === workspaceId),
    );

    await this.persisted.patch({
      workspaces: nextWorkspaces,
      activeWorkspaceId: nextActive,
      tabGroups: nextTabGroups,
      openTabs: this.tabs().map(toDto),
      notes: nextNotes,
      savedSessions: nextSessions,
      automationRules: nextRules,
    });

    this.splitView.reconcile(this);

    if (wasActive) {
      const first = this.tabs().find((t) => t.workspaceId === nextActive);
      if (first) await this.selectTab(first.id, false);
      else await this.addInternalTab('new-tab', 'New Tab', false);
    }

    return true;
  }

  cycleTab(dir: 1 | -1): void {
    const vis = this.visibleTabs();
    const cur = this.activeTabId();
    const idx = vis.findIndex((t) => t.id === cur);
    if (vis.length === 0) return;
    const next = (idx + dir + vis.length) % vis.length;
    void this.selectTab(vis[next].id);
  }
}
