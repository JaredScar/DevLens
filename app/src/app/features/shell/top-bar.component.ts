import { Component, HostListener, inject, signal, effect, computed } from '@angular/core';
import { IPC_CHANNELS } from '@dev-lens/shared';
import { FormsModule } from '@angular/forms';
import { IPC_EVENTS } from '@dev-lens/shared';
import { RENDERER_INVOKE } from '@core/electron-ipc-channels';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { ToastService } from '@core/services/toast.service';
import { LayoutService } from '@core/services/layout.service';
import { PageAiIntentService } from '@core/services/page-ai-intent.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { SplitViewService } from '@core/services/split-view.service';
import { TabsService } from '@core/services/tabs.service';
import { WidgetRegistryService } from '@core/services/widget-registry.service';
import { WorkspaceService } from '@core/services/workspace.service';
import { resolveNavigationInput } from '@core/navigation-url';

@Component({
  selector: 'app-top-bar',
  imports: [FormsModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly toast = inject(ToastService);
  readonly tabs = inject(TabsService);
  readonly layout = inject(LayoutService);
  readonly splitView = inject(SplitViewService);
  private readonly persisted = inject(PersistedStateService);
  private readonly pageAi = inject(PageAiIntentService);
  private readonly widgets = inject(WidgetRegistryService);
  private readonly workspace = inject(WorkspaceService);

  readonly inputUrl = signal('');
  readonly blocked = signal(0);
  readonly suggestionsOpen = signal(false);
  readonly selectedSuggestion = signal(0);
  readonly liveSuggestRows = signal<{ title: string; url: string; kind: string }[]>([]);
  readonly autofillOpen = signal(false);
  readonly moreMenuOpen = signal(false);

  /** Chrome extensions loaded in Electron (toolbar). */
  readonly chromeExtensions = signal<
    { id: string; name: string; iconDataUrl: string | null; popupPath: string | null }[]
  >([]);

  private liveSuggestTimer: ReturnType<typeof setTimeout> | null = null;
  private autofillCloseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly suggestionRowsList = computed(() => {
    const q = this.inputUrl().trim().toLowerCase();
    const rows: { title: string; url: string; kind: string }[] = [...this.liveSuggestRows()];
    const snap = this.persisted.snapshot();
    for (const b of snap?.bookmarks ?? []) {
      if (!q || `${b.title} ${b.url}`.toLowerCase().includes(q)) {
        rows.push({ title: b.title, url: b.url, kind: 'Bookmark' });
      }
    }
    for (const h of snap?.history ?? []) {
      if (!q || `${h.title} ${h.url}`.toLowerCase().includes(q)) {
        rows.push({ title: h.title, url: h.url, kind: 'History' });
      }
    }
    for (const t of this.tabs.tabs()) {
      if (t.kind !== 'browser') continue;
      if (!q || `${t.title} ${t.url}`.toLowerCase().includes(q)) {
        rows.push({ title: t.title, url: t.url, kind: 'Open tab' });
      }
    }
    return rows.slice(0, 14);
  });

  readonly isBookmarked = computed(() => {
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser') return false;
    return (this.persisted.snapshot()?.bookmarks ?? []).some((b) => b.url === tab.url);
  });

  readonly autofillHintsList = computed(
    () => this.persisted.snapshot()?.settings.autofillHints?.filter((h) => h.value.trim()) ?? [],
  );

  constructor() {
    effect(() => {
      const tab = this.tabs.activeTab();
      if (tab?.kind === 'browser') {
        this.inputUrl.set(tab.url);
      } else if (tab?.kind === 'internal') {
        this.inputUrl.set('');
      }
    });

    if (this.bridge.isElectron) {
      this.bridge.on(IPC_EVENTS.BLOCKER_STATS, (raw) => {
        const s = raw as { blockedSession?: number };
        this.blocked.set(s.blockedSession ?? 0);
      });
    }

    // Refresh Chrome extension toolbar when the active tab changes (cheap IPC).
    effect(() => {
      if (!this.bridge.isElectron) return;
      this.tabs.activeTab();
      void this.refreshChromeExtensions();
    });
  }

  private async refreshChromeExtensions(): Promise<void> {
    if (!this.bridge.isElectron) return;
    try {
      const list = await this.bridge.invoke<
        { id: string; name: string; iconDataUrl: string | null; popupPath: string | null }[]
      >(IPC_CHANNELS.EXT_LIST);
      this.chromeExtensions.set(Array.isArray(list) ? list : []);
    } catch {
      this.chromeExtensions.set([]);
    }
  }

  async openChromeExtensionPopup(
    ext: { id: string; name: string; popupPath: string | null },
    ev: MouseEvent,
  ): Promise<void> {
    if (!this.bridge.isElectron) return;
    if (!ext.popupPath?.trim()) {
      this.toast.show('This extension has no toolbar popup.');
      return;
    }
    const el = ev.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const tab = this.tabs.activeTab();
    const wsId = tab?.kind === 'browser' ? tab.workspaceId : this.workspace.activeWorkspaceId();
    const partition = `persist:dev-lens-ws-${wsId}`;
    const res = (await this.bridge.invoke<{ ok: boolean; error?: string }>(
      IPC_CHANNELS.EXT_OPEN_POPUP,
      {
        extensionId: ext.id,
        popupPath: ext.popupPath,
        partition,
        anchor: { x: r.left, y: r.top, width: r.width, height: r.height },
      },
    )) as { ok: boolean; error?: string };
    if (!res?.ok) this.toast.error(res?.error ?? 'Could not open extension popup.');
  }

  /** Exposed for template (`private bridge` is not visible in strict templates). */
  get electronShell(): boolean {
    return this.bridge.isElectron;
  }

  httpsHint(): boolean {
    return this.inputUrl().trim().startsWith('https://');
  }

  async goBack(): Promise<void> {
    await this.tabs.goBack();
  }

  async goForward(): Promise<void> {
    await this.tabs.goForward();
  }

  async reloadOrStop(): Promise<void> {
    if (this.tabs.activeGuestNav().loading) {
      this.tabs.stopActiveLoading();
    } else {
      await this.tabs.reload();
    }
  }

  async newTab(): Promise<void> {
    await this.tabs.addBrowserTab('about:blank', 'New Tab');
  }

  async submitNavigation(): Promise<void> {
    const engine = this.persisted.snapshot()?.settings.searchEngine ?? 'ddg';
    const url = resolveNavigationInput(this.inputUrl(), engine);
    const tab = this.tabs.activeTab();
    if (tab?.kind === 'browser') {
      await this.tabs.navigateActive(url);
    } else {
      await this.tabs.addBrowserTab(url, url);
    }
    this.suggestionsOpen.set(false);
  }

  async toggleBookmark(): Promise<void> {
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser') return;
    const snap = this.persisted.snapshot();
    const list = [...(snap?.bookmarks ?? [])];
    const exists = list.find((b) => b.url === tab.url);
    if (exists) {
      await this.persisted.patch({ bookmarks: list.filter((b) => b.id !== exists.id) });
    } else {
      list.push({ id: crypto.randomUUID(), url: tab.url, title: tab.title || tab.url });
      await this.persisted.patch({ bookmarks: list });
    }
  }

  async shareUrl(): Promise<void> {
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser') return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tab.url);
        this.toast.show('URL copied to clipboard.');
      }
    } catch {
      this.toast.error('Could not copy URL.');
    }
  }

  toggleMoreMenu(): void {
    this.moreMenuOpen.update((v) => !v);
  }

  closeMoreMenu(): void {
    this.moreMenuOpen.set(false);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.moreMenuOpen.set(false);
  }

  async openActiveUrlExternally(): Promise<void> {
    this.closeMoreMenu();
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser' || !tab.url?.trim()) return;
    if (!this.bridge.isElectron) {
      this.toast.show('Open in system browser is only available in the desktop app.');
      return;
    }
    const r = (await this.bridge.invoke(RENDERER_INVOKE.SHELL_OPEN_EXTERNAL, {
      url: tab.url,
    })) as { ok: boolean; error?: string };
    if (!r?.ok) this.toast.error(r?.error ?? 'Could not open URL externally.');
  }

  openSettingsFromMenu(): void {
    this.closeMoreMenu();
    void this.tabs.addInternalTab('settings', 'Settings');
  }

  async inspect(): Promise<void> {
    await this.tabs.toggleDevtools();
  }

  /** Opens the AI panel and queues a summarize prompt (omnibox quick action). */
  summarizePage(): void {
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser') return;
    this.widgets.select('ai');
    this.layout.openRightSidebar();
    this.pageAi.emitUserMessage('Summarize this page in a few concise bullet points.');
  }

  toggleAutofillMenu(): void {
    this.autofillOpen.update((v) => !v);
  }

  onAutofillFocusOut(): void {
    if (this.autofillCloseTimer) clearTimeout(this.autofillCloseTimer);
    this.autofillCloseTimer = setTimeout(() => this.autofillOpen.set(false), 200);
  }

  fillAutofillHint(value: string): void {
    const v = value.trim();
    if (!v) return;
    this.autofillOpen.set(false);
    const payload = JSON.stringify(v);
    const code = `(function(){
      var val = ${payload};
      var sels = [
        'input[type="email"]:not([readonly])',
        'input[autocomplete="email"]',
        'input[type="text"][name*="email" i]',
        'input[name*="user" i]',
        'input[name*="login" i]',
        'input[id*="email" i]'
      ];
      for (var i = 0; i < sels.length; i++) {
        var el = document.querySelector(sels[i]);
        if (el) {
          el.focus();
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
      var any = document.querySelector('input[type="text"]:not([readonly]),input[type="search"]:not([readonly])');
      if (any) {
        any.focus();
        any.value = val;
        any.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })();`;
    void this.tabs.executeJavaScriptInActive(code);
  }

  togglePanels(): void {
    this.layout.toggleRightSidebar();
  }

  toggleSplit(): void {
    this.splitView.attemptToggle(this.tabs);
  }

  onOmniboxInput(val: string): void {
    this.inputUrl.set(val);
    this.selectedSuggestion.set(0);
    if (this.liveSuggestTimer) clearTimeout(this.liveSuggestTimer);
    this.liveSuggestTimer = setTimeout(() => void this.refreshLiveSuggest(val), 250);
  }

  private async refreshLiveSuggest(raw: string): Promise<void> {
    const t = raw.trim();
    if (t.length < 2) {
      this.liveSuggestRows.set([]);
      this.selectedSuggestion.set(0);
      return;
    }
    try {
      const u = `https://duckduckgo.com/ac/?q=${encodeURIComponent(t)}&type=list`;
      const res = await fetch(u);
      const data = (await res.json()) as unknown;
      const phrases: string[] = [];
      if (Array.isArray(data)) {
        for (const row of data) {
          if (Array.isArray(row) && typeof row[0] === 'string') phrases.push(row[0]);
          else if (typeof row === 'string') phrases.push(row);
        }
      }
      const engine = this.persisted.snapshot()?.settings.searchEngine ?? 'ddg';
      const rows = phrases.slice(0, 6).map((phrase) => ({
        title: phrase,
        url: resolveNavigationInput(phrase, engine),
        kind: 'Search',
      }));
      this.liveSuggestRows.set(rows);
    } catch {
      this.liveSuggestRows.set([]);
    }
  }

  onFocusInput(): void {
    this.selectedSuggestion.set(0);
    this.suggestionsOpen.set(true);
  }

  onBlurInput(): void {
    setTimeout(() => this.suggestionsOpen.set(false), 150);
  }

  pickSuggestion(url: string): void {
    this.inputUrl.set(url);
    void this.submitNavigation();
  }

  keydownOmnibox(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      if (this.suggestionsOpen() && this.suggestionRowsList().length > 0) {
        ev.preventDefault();
        const row = this.suggestionRowsList()[this.selectedSuggestion()];
        if (row) this.pickSuggestion(row.url);
        else void this.submitNavigation();
      } else {
        ev.preventDefault();
        void this.submitNavigation();
      }
      return;
    }
    if (!this.suggestionsOpen()) return;
    const rows = this.suggestionRowsList();
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.selectedSuggestion.update((i) => (i + 1) % Math.max(rows.length, 1));
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.selectedSuggestion.update((i) => (i - 1 + rows.length) % Math.max(rows.length, 1));
    }
    if (ev.key === 'Escape') {
      this.suggestionsOpen.set(false);
    }
  }
}
