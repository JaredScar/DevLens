import {
  NO_ERRORS_SCHEMA,
  Component,
  AfterViewInit,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RENDERER_INVOKE } from '@core/electron-ipc-channels';
import { AutomationService } from '@core/services/automation.service';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { GuestLogService } from '@core/services/guest-log.service';
import { InspectPointerService } from '@core/services/inspect-pointer.service';
import type { UiTab, WebviewHandler } from '@core/services/tabs.service';
import { TabsService } from '@core/services/tabs.service';

const GUEST_CONSOLE_CHANNEL = 'dev-lens-console-log';

/**
 * Minimal type surface for the Electron `<webview>` DOM element.
 */
interface WebviewEl extends HTMLElement {
  src: string;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  getTitle(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  openDevTools(): void;
  closeDevTools(): void;
  isDevToolsOpened(): boolean;
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  inspectElement?(x: number, y: number): void;
  getWebContentsId?(): number;
}

@Component({
  selector: 'app-browser-tab-view',
  schemas: [NO_ERRORS_SCHEMA],
  /*
   * [attr.src] is set once (from initialSrc) so the webview starts loading
   * the URL immediately when inserted into the DOM, bypassing any dom-ready
   * timing issues.  For about:blank / new-tab pages we omit src so the
   * webview still initialises and fires dom-ready with no content yet.
   */
  template: `<webview
    #wv
    class="wv"
    [attr.src]="initialSrc"
    [attr.partition]="partitionAttr"
    allowpopups
  ></webview>`,
  styleUrl: './browser-tab-view.component.scss',
})
export class BrowserTabViewComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly tab = input.required<UiTab>();

  private readonly wvRef = viewChild.required<ElementRef<HTMLElement>>('wv');
  private readonly bridge = inject(ElectronBridgeService);
  private readonly tabsSvc = inject(TabsService);
  private readonly guestLog = inject(GuestLogService);
  private readonly inspectPtr = inject(InspectPointerService);
  private readonly automation = inject(AutomationService);

  /**
   * Initial URL captured once in ngOnInit.
   * Kept as a plain field (not a signal) so the [attr.src] binding evaluates
   * to a stable value and Angular never re-applies it on later CD cycles.
   */
  initialSrc: string | null = null;

  /** True once the guest document has fired its first dom-ready. */
  private guestReady = false;
  private listenersRegistered = false;
  /** URL queued before dom-ready fired (for programmatic navigations). */
  private pendingNavigate: string | null = null;

  get partitionAttr(): string {
    return `persist:dev-lens-ws-${this.tab().workspaceId}`;
  }

  private get wv(): WebviewEl | null {
    const el = this.wvRef()?.nativeElement;
    return el ? (el as WebviewEl) : null;
  }

  private readonly onDomReady = (): void => {
    const wv = this.wv;
    if (!wv) return;
    this.guestReady = true;

    if (!this.listenersRegistered) {
      this.listenersRegistered = true;
      wv.addEventListener('did-navigate', this.onNavigate);
      wv.addEventListener('did-navigate-in-page', this.onNavigate);
      wv.addEventListener('page-title-updated', this.onTitle);
      wv.addEventListener('new-window', this.onNewWindow);
      wv.addEventListener('mousemove', this.onGuestMouseMove);
      wv.addEventListener('did-start-loading', this.onStartLoading);
      wv.addEventListener('did-stop-loading', this.onStopLoading);
      wv.addEventListener('did-fail-load', this.onStopLoading);
    }
    this.syncGuestNav();

    // Flush a navigate that arrived before the guest was ready.
    // (The initial URL is already loading via the src attribute.)
    if (this.pendingNavigate) {
      const url = this.pendingNavigate;
      this.pendingNavigate = null;
      void wv.loadURL(url);
    }
  };

  private readonly onNavigate = (e: Event): void => {
    const url = (e as unknown as { url?: string }).url ?? this.wv?.getURL() ?? '';
    const title = this.wv?.getTitle() ?? url;
    this.tabsSvc.updateTabState(this.tab().id, url, title);
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void this.bridge.invoke(RENDERER_INVOKE.HISTORY_APPEND, { url, title: title || url });
    }
    this.automation.onBrowserUrl(url);
    this.syncGuestNav();
  };

  private readonly syncGuestNav = (): void => {
    const wv = this.wv;
    if (!wv || !this.guestReady) return;
    this.tabsSvc.setGuestNavState(this.tab().id, {
      canBack: wv.canGoBack(),
      canFwd: wv.canGoForward(),
    });
  };

  private readonly onStartLoading = (): void => {
    this.tabsSvc.setGuestNavState(this.tab().id, { loading: true });
  };

  private readonly onStopLoading = (): void => {
    this.tabsSvc.setGuestNavState(this.tab().id, { loading: false });
    this.syncGuestNav();
  };

  private readonly onGuestMouseMove = (e: MouseEvent): void => {
    const wv = this.wv;
    if (!wv) return;
    const r = wv.getBoundingClientRect();
    this.inspectPtr.record(this.tab().id, e.clientX - r.left, e.clientY - r.top);
  };

  private readonly onTitle = (e: Event): void => {
    const title = (e as unknown as { title?: string }).title ?? '';
    const url = this.wv?.getURL() ?? this.tab().url;
    if (title) this.tabsSvc.updateTabState(this.tab().id, url, title);
    this.syncGuestNav();
  };

  private readonly onNewWindow = (e: Event): void => {
    const url = (e as unknown as { url?: string }).url ?? '';
    if (url) void this.bridge.invoke(RENDERER_INVOKE.SHELL_OPEN_EXTERNAL, { url });
  };

  private readonly onGuestIpc = (e: Event): void => {
    const ev = e as unknown as { channel?: string; args?: unknown[] };
    if (ev.channel !== GUEST_CONSOLE_CHANNEL) return;
    const payload = ev.args?.[0] as { level?: string; msg?: string; t?: number } | undefined;
    if (!payload) return;
    this.guestLog.pushGuest(this.tab().id, payload);
  };

  ngOnInit(): void {
    // Capture the initial URL once so the [attr.src] binding stays stable.
    const url = this.tab().url;
    this.initialSrc = url && url !== 'about:blank' ? url : null;

    void this.bridge.invoke(RENDERER_INVOKE.SESSION_INIT, { partition: this.partitionAttr });

    const handler: WebviewHandler = {
      navigate: (target) => {
        if (!this.guestReady) {
          this.pendingNavigate = target;
          return;
        }
        void this.wv?.loadURL(target);
      },
      back: () => {
        if (this.guestReady) this.wv?.goBack();
      },
      forward: () => {
        if (this.guestReady) this.wv?.goForward();
      },
      reload: () => {
        if (this.guestReady) this.wv?.reload();
      },
      stop: () => {
        if (!this.guestReady) return;
        const w = this.wv;
        if (w && typeof w.stop === 'function') w.stop();
      },
      toggleDevtools: () => {
        if (!this.guestReady) return;
        const wv = this.wv;
        if (!wv) return;
        if (wv.isDevToolsOpened()) wv.closeDevTools();
        else wv.openDevTools();
      },
      executeJavaScript: (code: string) => {
        if (!this.guestReady || !this.wv) return Promise.resolve(undefined);
        return this.wv.executeJavaScript(code);
      },
      suspendToBlank: () => {
        if (!this.guestReady || !this.wv) return;
        void this.wv.loadURL('about:blank');
      },
      inspectElement: (x: number, y: number) => {
        if (!this.guestReady || !this.wv) return;
        this.wv.inspectElement?.(x, y);
      },
      getWebContentsId: () => {
        const wv = this.wv;
        if (!this.guestReady || !wv) return undefined;
        const id = wv.getWebContentsId?.();
        return typeof id === 'number' ? id : undefined;
      },
    };
    this.tabsSvc.registerWebview(this.tab().id, handler);
  }

  ngAfterViewInit(): void {
    const wv = this.wv;
    if (!wv) return;
    wv.addEventListener('ipc-message', this.onGuestIpc);
    /*
     * dom-ready fires:
     *  – for src="" navigations: when the initial page's DOM is ready
     *  – for about:blank tabs: very quickly after the guest is attached
     * We keep the listener alive (no `once`) so dom-ready can fire again if
     * the guest process restarts (rare but possible on heavy pages).
     */
    wv.addEventListener('dom-ready', this.onDomReady);
  }

  ngOnDestroy(): void {
    const wv = this.wv;
    if (wv) {
      wv.removeEventListener('ipc-message', this.onGuestIpc);
      wv.removeEventListener('dom-ready', this.onDomReady);
      wv.removeEventListener('did-navigate', this.onNavigate);
      wv.removeEventListener('did-navigate-in-page', this.onNavigate);
      wv.removeEventListener('page-title-updated', this.onTitle);
      wv.removeEventListener('new-window', this.onNewWindow);
      wv.removeEventListener('mousemove', this.onGuestMouseMove);
      wv.removeEventListener('did-start-loading', this.onStartLoading);
      wv.removeEventListener('did-stop-loading', this.onStopLoading);
      wv.removeEventListener('did-fail-load', this.onStopLoading);
    }
    this.guestLog.clearTab(this.tab().id);
    this.tabsSvc.unregisterWebview(this.tab().id);
  }
}
