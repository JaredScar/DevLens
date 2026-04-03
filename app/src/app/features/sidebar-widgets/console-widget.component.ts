import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { GuestLogService, type GuestConsoleLine } from '@core/services/guest-log.service';
import { ResizeStateService } from '@core/services/resize-state.service';
import { TabsService } from '@core/services/tabs.service';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { RENDERER_INVOKE } from '@core/electron-ipc-channels';

type DisplayLevel = 'info' | 'warn' | 'error' | 'result';
type PanelTab = 'console' | 'network' | 'elements' | 'sources' | 'performance';

interface ConsoleDisplayLine {
  level: DisplayLevel;
  text: string;
  time: string;
}

export interface DomNode {
  tag: string;
  id: string;
  classes: string;
  children: DomNode[];
  textSnippet: string;
}

export interface SourceEntry {
  name: string;
  type: string;
  size: number;
  duration: number;
}

export interface PerfMetrics {
  loadMs: number | null;
  domReadyMs: number | null;
  resources: number;
  scripts: number;
  memUsed: number | null;
  memTotal: number | null;
  paint: { name: string; time: number }[];
  lcp: number | null;
}

export const NETWORK_RESOURCE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'xhr', label: 'XHR' },
  { value: 'mainFrame', label: 'Document' },
  { value: 'subFrame', label: 'Subframe' },
  { value: 'script', label: 'Script' },
  { value: 'stylesheet', label: 'Stylesheet' },
  { value: 'image', label: 'Image' },
  { value: 'font', label: 'Font' },
  { value: 'media', label: 'Media' },
  { value: 'webSocket', label: 'WebSocket' },
  { value: 'ping', label: 'Ping' },
  { value: 'cspReport', label: 'CSP report' },
  { value: 'object', label: 'Object' },
  { value: 'other', label: 'Other' },
];

const DOM_SNAPSHOT_JS = `(function(){
  function snap(el, depth){
    if(!el||depth>4) return null;
    var cs=Array.from(el.children).slice(0,12).map(function(c){return snap(c,depth+1);}).filter(Boolean);
    var txt=el.children.length===0?(el.textContent||'').trim().slice(0,60):'';
    return {tag:(el.tagName||'').toLowerCase(),id:el.id||'',classes:(el.className&&typeof el.className==='string'?el.className.trim().split(/\\s+/).slice(0,3).join(' '):''),children:cs,textSnippet:txt};
  }
  return JSON.stringify(snap(document.body,0));
})()`;

const SOURCES_JS = `(function(){
  try{
    var entries=performance.getEntriesByType('resource');
    return JSON.stringify(entries.slice(0,80).map(function(e){
      return {name:e.name,type:e.initiatorType,size:Math.round(e.transferSize||0),duration:Math.round(e.duration)};
    }));
  }catch(ex){return '[]';}
})()`;

const PERF_JS = `(function(){
  var t=window.performance.timing||null;
  var entries=performance.getEntriesByType('resource');
  var paint=performance.getEntriesByType('paint').map(function(e){return {name:e.name,time:Math.round(e.startTime)};});
  var lcp=null;
  try{ if(typeof window.__devLensLcp==='number') lcp=Math.round(window.__devLensLcp); }catch(e){}
  return JSON.stringify({
    loadMs:t?(t.loadEventEnd-t.navigationStart)||null:null,
    domReadyMs:t?(t.domContentLoadedEventEnd-t.navigationStart)||null:null,
    resources:entries.length,
    scripts:entries.filter(function(e){return e.initiatorType==='script';}).length,
    memUsed:performance.memory?performance.memory.usedJSHeapSize:null,
    memTotal:performance.memory?performance.memory.totalJSHeapSize:null,
    paint:paint,lcp:lcp
  });
})()`;

function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString('en-US', { hour12: false });
}

function guestToDisplayLevel(line: GuestConsoleLine): DisplayLevel {
  if (line.source === 'repl')
    return line.level === 'error' ? 'error' : line.level === 'result' ? 'result' : 'info';
  if (line.level === 'warn') return 'warn';
  if (line.level === 'error') return 'error';
  return 'info';
}

function fmtBytes(b: number | null): string {
  if (b === null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type DtStatus = 'idle' | 'attaching' | 'attached' | 'no-tab' | 'error';

@Component({
  selector: 'app-console-widget',
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './console-widget.component.html',
  styleUrl: './console-widget.component.scss',
})
export class ConsoleWidgetComponent {
  private readonly tabs = inject(TabsService);
  readonly bridge = inject(ElectronBridgeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly guestLog = inject(GuestLogService);
  private readonly resizeState = inject(ResizeStateService);

  /** Container div that marks where the BrowserView overlay should sit. */
  private readonly dtAreaRef = viewChild<ElementRef>('dtArea');

  /** Whether the currently active tab is a browser tab (has a guest webview). */
  readonly activeBrowserTabId = computed(() => {
    const tab = this.tabs.activeTab();
    return tab?.kind === 'browser' ? tab.id : null;
  });

  readonly dtStatus = signal<DtStatus>('idle');
  readonly dtError = signal<string | null>(null);

  /** WebContentsId of the guest we currently have DevTools attached to. */
  private lastGuestWcId: number | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  readonly activeTab = signal<PanelTab>('console');
  readonly command = signal('');

  readonly consoleLines = computed<ConsoleDisplayLine[]>(() =>
    this.guestLog.filteredConsole().map((l) => ({
      level: guestToDisplayLevel(l),
      text: l.msg,
      time: formatTime(l.t),
    })),
  );

  readonly networkLines = this.guestLog.filteredNetwork;
  readonly networkUrlFilter = signal('');
  readonly filteredNetworkLines = computed(() => {
    const q = this.networkUrlFilter().trim().toLowerCase();
    const rows = this.networkLines();
    return q ? rows.filter((r) => r.url.toLowerCase().includes(q)) : rows;
  });
  readonly netFilterOptions = NETWORK_RESOURCE_FILTER_OPTIONS;

  readonly domTree = signal<DomNode | null>(null);
  readonly domLoading = signal(false);
  readonly sourcesEntries = signal<SourceEntry[]>([]);
  readonly sourcesLoading = signal(false);
  readonly perfMetrics = signal<PerfMetrics | null>(null);
  readonly perfLoading = signal(false);

  readonly fmtBytes = fmtBytes;

  constructor() {
    if (this.bridge.isElectron) {
      this.setupElectronDevTools();
    }

    // Detach cleanly when the component is destroyed.
    this.destroyRef.onDestroy(() => {
      this.teardownObservers();
      void this.detachDevTools();
    });

    // Refresh custom panel data when switching tabs (non-Electron fallback).
    effect(() => {
      if (this.bridge.isElectron) return;
      const tab = this.activeTab();
      if (tab === 'elements') void this.refreshElements();
      else if (tab === 'sources') void this.refreshSources();
      else if (tab === 'performance') void this.refreshPerf();
    });
  }

  private setupElectronDevTools(): void {
    let prevBrowserTabId: string | null = null;

    // React to active-tab changes: detach the old DevTools and re-attach for the
    // new tab. The actual DEVTOOLS_ATTACH IPC is deferred until the #dtArea div
    // is in the DOM and has non-zero dimensions.
    effect(() => {
      const id = this.activeBrowserTabId();
      if (id === prevBrowserTabId) return;
      prevBrowserTabId = id;

      void this.detachDevTools();

      if (id === null) {
        this.dtStatus.set('no-tab');
      } else {
        this.dtStatus.set('attaching');
        this.dtError.set(null);
        // dtArea may not be in the DOM yet (first render); retry until visible.
        void this.attachWhenReady();
      }
    });

    // When #dtArea appears or disappears, wire up / tear down the observers that
    // keep the BrowserView overlay in sync with the element's position & size.
    effect(() => {
      const el = this.dtAreaRef()?.nativeElement as HTMLElement | undefined;
      if (el) {
        this.setupObservers(el);
      } else {
        this.teardownObservers();
      }
    });

    // Register synchronous hide/restore callbacks with ResizeStateService.
    // These fire IMMEDIATELY inside onResizeDown / onResizeUp in the
    // right-sidebar component — before any mousemove can reach the
    // BrowserView overlay and steal pointer events.
    this.resizeState.registerOverlayCallbacks(
      // hide — called synchronously on mousedown
      () => {
        if (this.lastGuestWcId !== null) this.hideOverlay();
      },
      // restore — called synchronously on mouseup; rAF lets the browser
      // finish painting the sidebar at its final width before we read bounds.
      () => {
        if (this.lastGuestWcId !== null) {
          requestAnimationFrame(() => {
            const bounds = this.getDtBounds();
            if (bounds) void this.bridge.invoke(RENDERER_INVOKE.DEVTOOLS_SET_BOUNDS, { bounds });
          });
        }
      },
    );
  }

  // ── BrowserView overlay helpers ─────────────────────────────────────────────

  private getDtBounds(): { x: number; y: number; width: number; height: number } | null {
    const el = this.dtAreaRef()?.nativeElement as HTMLElement | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  /** Try to attach DevTools, retrying with rAF if the area isn't rendered yet. */
  private async attachWhenReady(attempt = 0): Promise<void> {
    const bounds = this.getDtBounds();
    if (!bounds) {
      if (attempt < 60) {
        await new Promise<void>((res) => requestAnimationFrame(() => res()));
        return this.attachWhenReady(attempt + 1);
      }
      // After ~1s of retries still no bounds — leave status as 'attaching' so
      // the IntersectionObserver can recover when the panel becomes visible.
      return;
    }
    await this.attachDevTools(bounds);
  }

  private async attachDevTools(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<void> {
    const guestWcId = this.tabs.getActiveGuestWcId();
    if (!guestWcId) {
      this.dtStatus.set('no-tab');
      return;
    }

    this.lastGuestWcId = guestWcId;

    const res = await this.bridge.invoke<{ ok: boolean; error?: string }>(
      RENDERER_INVOKE.DEVTOOLS_ATTACH,
      { guestWcId, bounds },
    );

    if (res.ok) {
      this.dtStatus.set('attached');
      this.dtError.set(null);
    } else {
      this.dtStatus.set('error');
      this.dtError.set(res.error ?? 'Failed to attach DevTools.');
      this.lastGuestWcId = null;
    }
  }

  private async detachDevTools(): Promise<void> {
    const wcId = this.lastGuestWcId;
    this.lastGuestWcId = null;
    if (wcId !== null) {
      await this.bridge.invoke(RENDERER_INVOKE.DEVTOOLS_DETACH, { guestWcId: wcId });
    } else {
      await this.bridge.invoke(RENDERER_INVOKE.DEVTOOLS_DETACH, {});
    }
  }

  /** Reposition the overlay to match the current #dtArea bounds. */
  private updateBounds(): void {
    if (this.lastGuestWcId === null) return;
    if (this.resizeState.isSidebarResizing()) return;
    const bounds = this.getDtBounds();
    if (bounds) {
      void this.bridge.invoke(RENDERER_INVOKE.DEVTOOLS_SET_BOUNDS, { bounds });
    }
  }

  /** Move overlay off-screen without detaching the DevTools connection. */
  private hideOverlay(): void {
    void this.bridge.invoke(RENDERER_INVOKE.DEVTOOLS_SET_BOUNDS, {
      bounds: { x: -32000, y: -32000, width: 1, height: 1 },
    });
  }

  private setupObservers(el: HTMLElement): void {
    this.teardownObservers();

    // Keep overlay in sync when the element resizes (e.g. sidebar width changes).
    this.resizeObserver = new ResizeObserver(() => this.updateBounds());
    this.resizeObserver.observe(el);

    // Hide/show the BrowserView overlay when the element scrolls out of view
    // (e.g. user collapses the right sidebar).
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          if (this.lastGuestWcId !== null) {
            this.updateBounds();
          } else if (this.activeBrowserTabId() !== null) {
            void this.attachWhenReady();
          }
        } else {
          this.hideOverlay();
        }
      },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(el);

    // Also handle window-level resize (position may shift even if element size stays the same).
    const onWindowResize = (): void => this.updateBounds();
    window.addEventListener('resize', onWindowResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onWindowResize));
  }

  private teardownObservers(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
  }

  // ── Non-Electron fallback helpers ──────────────────────────────────────────

  async refreshElements(): Promise<void> {
    if (!this.tabs.activeTabId()) return;
    this.domLoading.set(true);
    try {
      const raw = await this.tabs.executeJavaScriptInActive(DOM_SNAPSHOT_JS);
      this.domTree.set(raw ? (JSON.parse(raw as string) as DomNode) : null);
    } catch {
      this.domTree.set(null);
    } finally {
      this.domLoading.set(false);
    }
  }

  async refreshSources(): Promise<void> {
    if (!this.tabs.activeTabId()) return;
    this.sourcesLoading.set(true);
    try {
      const raw = await this.tabs.executeJavaScriptInActive(SOURCES_JS);
      this.sourcesEntries.set(raw ? (JSON.parse(raw as string) as SourceEntry[]) : []);
    } catch {
      this.sourcesEntries.set([]);
    } finally {
      this.sourcesLoading.set(false);
    }
  }

  async refreshPerf(): Promise<void> {
    if (!this.tabs.activeTabId()) return;
    this.perfLoading.set(true);
    try {
      const raw = await this.tabs.executeJavaScriptInActive(PERF_JS);
      this.perfMetrics.set(raw ? (JSON.parse(raw as string) as PerfMetrics) : null);
    } catch {
      this.perfMetrics.set(null);
    } finally {
      this.perfLoading.set(false);
    }
  }

  async runCommand(): Promise<void> {
    const code = this.command().trim();
    const tabId = this.tabs.activeTabId();
    if (!code || !tabId) return;
    this.command.set('');
    this.guestLog.pushRepl(tabId, 'info', `> ${code}`);
    try {
      const result = await this.tabs.executeJavaScriptInActive(code);
      const text = result === undefined ? 'undefined' : JSON.stringify(result, null, 2);
      this.guestLog.pushRepl(tabId, 'result', text);
    } catch (err) {
      this.guestLog.pushRepl(tabId, 'error', err instanceof Error ? err.message : String(err));
    }
  }

  openNativeDevTools(): void {
    void this.tabs.toggleDevtools();
  }

  clearPanel(): void {
    if (this.activeTab() === 'console') this.guestLog.clearConsoleForActiveTab();
    else if (this.activeTab() === 'network') this.guestLog.clearNetworkForActivePartition();
  }

  exportHar(): void {
    const json = this.guestLog.exportHarForActivePartition();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dev-lens-network-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  statusClass(code: number): string {
    if (code >= 200 && code < 300) return 'con__net-status--2';
    if (code >= 300 && code < 400) return 'con__net-status--3';
    if (code >= 400 && code < 500) return 'con__net-status--4';
    if (code >= 500) return 'con__net-status--5';
    return 'con__net-status--0';
  }

  netTimeLabel(t: number): string {
    const d = new Date(t);
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }
}
