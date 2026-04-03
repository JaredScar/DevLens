import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  afterNextRender,
  effect,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { appendClipboardEntryIfNew } from '@core/clipboard-merge';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { FocusModeService } from '@core/services/focus-mode.service';
import { GuestLogService } from '@core/services/guest-log.service';
import { LayoutService } from '@core/services/layout.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { SplitViewService } from '@core/services/split-view.service';
import { TabsService } from '@core/services/tabs.service';
import { WorkspaceService } from '@core/services/workspace.service';
import { IPC_CHANNELS, IPC_EVENTS, type SavedSessionDTO } from '@dev-lens/shared';
import { THEME_CSS_VARIABLE_KEYS } from '@core/theme-tokens';
import { PluginRuntimeService } from '@core/services/plugin-runtime.service';
import { ShortcutRegistryService } from '@core/services/shortcut-registry.service';
import { SpotlightService } from '@features/spotlight/spotlight.service';
import { SpotlightComponent } from '@features/spotlight/spotlight.component';
import { BrowserTabViewComponent } from './browser-tab-view.component';
import { LeftSidebarComponent } from './left-sidebar.component';
import { RightSidebarComponent } from './right-sidebar.component';
import { TopBarComponent } from './top-bar.component';
import { ToastContainerComponent } from '@ui/toast-container.component';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    TopBarComponent,
    LeftSidebarComponent,
    RightSidebarComponent,
    SpotlightComponent,
    BrowserTabViewComponent,
    ToastContainerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly spotlightSvc = inject(SpotlightService);
  readonly tabs = inject(TabsService);
  readonly layout = inject(LayoutService);
  readonly splitView = inject(SplitViewService);
  readonly focusMode = inject(FocusModeService);
  private readonly bridge = inject(ElectronBridgeService);
  private readonly persisted = inject(PersistedStateService);
  private readonly workspace = inject(WorkspaceService);
  private readonly guestLog = inject(GuestLogService);
  private readonly shortcuts = inject(ShortcutRegistryService);
  private readonly pluginRuntime = inject(PluginRuntimeService);
  private readonly destroyRef = inject(DestroyRef);

  private splitDrag = false;
  private splitRafPending = false;
  private splitContentEl: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      void this.tabs.bootstrap().then(() => void this.pluginRuntime.refresh());
      this.tabs.bindMainProcessEvents();
      this.bindMainProcessClipboardAndQuit();
    });
    effect(() => {
      this.tabs.tabs();
      this.tabs.activeTabId();
      this.splitView.reconcile(this.tabs);
    });
    effect(() => {
      const snap = this.persisted.snapshot();
      const preset = snap?.settings.themePreset ?? 'dark';
      const el = document.documentElement;
      for (const key of THEME_CSS_VARIABLE_KEYS) {
        el.style.removeProperty(key);
      }
      el.setAttribute('data-theme', preset);
      const customs = snap?.settings.customThemeVariables ?? {};
      for (const [k, v] of Object.entries(customs)) {
        if (typeof v === 'string' && v.trim()) el.style.setProperty(k, v.trim());
      }
    });
    effect(() => {
      const snap = this.persisted.snapshot();
      const lang = snap?.settings.language?.trim() || 'en';
      document.documentElement.lang = lang;
      document.documentElement.dir = snap?.settings.uiRtl ? 'rtl' : 'ltr';
    });
  }

  private bindMainProcessClipboardAndQuit(): void {
    if (!this.bridge.isElectron) return;
    const offClip = this.bridge.on(IPC_EVENTS.CLIPBOARD_FROM_MAIN, (raw) => {
      const text = (raw as { text?: string })?.text;
      if (!text) return;
      if (this.persisted.snapshot()?.settings.clipboardMonitoringPaused) return;
      void appendClipboardEntryIfNew(this.persisted, text);
    });
    const offQuit = this.bridge.on(IPC_EVENTS.APP_WILL_CLOSE, () => {
      void this.saveAutoSessionAndClose();
    });
    const offNet = this.bridge.on(IPC_EVENTS.NETWORK_LOG, (raw) => {
      const p = raw as {
        partition?: string;
        method?: string;
        url?: string;
        statusCode?: number;
        t?: number;
        resourceType?: string;
      };
      if (!p.partition || !p.method || !p.url || p.statusCode === undefined) return;
      this.guestLog.pushNetwork({
        partition: p.partition,
        method: p.method,
        url: p.url,
        statusCode: p.statusCode,
        t: p.t ?? Date.now(),
        resourceType: p.resourceType ?? 'other',
      });
    });
    this.destroyRef.onDestroy(() => {
      offClip();
      offQuit();
      offNet();
    });
  }

  private async saveAutoSessionAndClose(): Promise<void> {
    try {
      const wsId = this.workspace.activeWorkspaceId();
      const browserTabs = this.tabs.visibleTabs().filter((t) => t.kind === 'browser');
      const session: SavedSessionDTO = {
        id: crypto.randomUUID(),
        name: `Auto-saved ${new Date().toLocaleString()}`,
        workspaceId: wsId,
        tabs: browserTabs.map((t) => ({ url: t.url, title: t.title })),
        savedAt: Date.now(),
      };
      const prev = this.persisted.snapshot()?.savedSessions ?? [];
      await this.persisted.patch({ savedSessions: [session, ...prev].slice(0, 80) });
    } catch (e) {
      console.error('[auto-save session]', e);
    } finally {
      await this.bridge.invoke(IPC_CHANNELS.APP_CLOSE_READY);
    }
  }

  showInternalOutlet(): boolean {
    return this.tabs.activeTab()?.kind === 'internal';
  }

  splitUi(): boolean {
    if (!this.splitView.enabled()) return false;
    const a = this.tabs.activeTab();
    const sec = this.splitView.secondaryTabId();
    if (!a || a.kind !== 'browser' || !sec || sec === a.id) return false;
    return this.tabs.browserTabs().some((t) => t.id === sec);
  }

  splitGridCols(): string {
    const r = this.splitView.primaryRatio();
    const left = Math.max(15, Math.min(85, Math.round(r * 100)));
    const right = 100 - left;
    return `minmax(0, ${left}fr) 5px minmax(0, ${right}fr)`;
  }

  browserPaneVisible(tabId: string): boolean {
    if (this.tabs.activeTab()?.kind === 'internal') return false;
    if (!this.splitUi()) return this.tabs.activeTabId() === tabId;
    const sec = this.splitView.secondaryTabId();
    const aid = this.tabs.activeTabId();
    return tabId === aid || tabId === sec;
  }

  onSplitGrabDown(ev: MouseEvent): void {
    ev.preventDefault();
    this.splitDrag = true;
    this.splitContentEl = document.querySelector('.shell__content--split');
    // Disable pointer-events on webviews during drag to prevent them stealing mouse
    document.querySelectorAll<HTMLElement>('webview').forEach((w) => {
      w.style.pointerEvents = 'none';
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onSplitGrabMove(ev: MouseEvent): void {
    if (!this.splitDrag || !this.splitUi()) return;
    const mid = this.splitContentEl;
    if (!mid || this.splitRafPending) return;
    this.splitRafPending = true;
    const clientX = ev.clientX;
    requestAnimationFrame(() => {
      this.splitRafPending = false;
      if (!this.splitDrag || !mid) return;
      const rect = mid.getBoundingClientRect();
      const ratio = Math.min(0.9, Math.max(0.1, (clientX - rect.left) / rect.width));
      // Apply grid template directly to DOM — no Angular CD on every frame
      mid.style.gridTemplateColumns = `${ratio * 100}% 4px ${(1 - ratio) * 100}%`;
    });
  }

  @HostListener('document:mouseup')
  onSplitGrabUp(): void {
    if (!this.splitDrag) return;
    this.splitDrag = false;
    // Restore pointer-events on webviews
    document.querySelectorAll<HTMLElement>('webview').forEach((w) => {
      w.style.pointerEvents = '';
    });
    // Commit the ratio from the live DOM style into the signal (single CD cycle)
    const mid = this.splitContentEl;
    this.splitContentEl = null;
    if (mid) {
      const rect = mid.getBoundingClientRect();
      const cols = mid.style.gridTemplateColumns;
      mid.style.gridTemplateColumns = '';
      if (cols) {
        const pct = parseFloat(cols);
        if (!isNaN(pct)) this.splitView.setRatio(pct / 100);
      } else {
        // Fallback: derive from current layout
        const left = mid.querySelector<HTMLElement>('app-browser-tab-view:first-of-type');
        if (left) this.splitView.setRatio(left.getBoundingClientRect().width / rect.width);
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (this.focusMode.enabled() && ev.key === 'Escape') {
      ev.preventDefault();
      this.focusMode.disable();
      return;
    }
    const meta = ev.ctrlKey || ev.metaKey;
    if (meta && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.spotlightSvc.toggle();
      return;
    }
    if (this.spotlightSvc.open()) return;

    const action = this.shortcuts.matchAction(ev);
    if (action) {
      ev.preventDefault();
      switch (action) {
        case 'spotlight':
          this.spotlightSvc.toggle();
          break;
        case 'newTab':
          void this.tabs.addBrowserTab('about:blank', 'New Tab');
          break;
        case 'closeTab': {
          const id = this.tabs.activeTabId();
          if (id) void this.tabs.closeTab(id);
          break;
        }
        case 'cycleTabNext':
          this.tabs.cycleTab(1);
          break;
        case 'cycleTabPrev':
          this.tabs.cycleTab(-1);
          break;
        case 'toggleSplit':
          this.splitView.attemptToggle(this.tabs);
          break;
        case 'focusMode':
          this.focusMode.toggle();
          break;
        case 'toggleDevtools':
          void this.tabs.toggleDevtools();
          break;
        case 'inspectElement':
          void this.tabs.inspectGuestElement();
          break;
        default:
          break;
      }
    }
  }
}
