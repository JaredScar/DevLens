import { Component, inject, OnDestroy, signal } from '@angular/core';
import { IPC_CHANNELS } from '@dev-lens/shared';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { TabsService } from '@core/services/tabs.service';

@Component({
  selector: 'app-performance-widget',
  template: `
    <div class="perf">
      <h2 class="perf__title">Performance</h2>
      <p class="perf__scope">
        <strong>App &amp; process</strong> — not page Web Vitals. For load time / paint on the
        active page, open the <strong>Console</strong> widget and use the <strong>PERF</strong> tab.
      </p>
      <p class="perf__hint">
        Main process memory (approximate). Tab webviews run in separate processes.
      </p>
      @if (metrics()) {
        <dl class="perf__grid">
          <dt>RSS</dt>
          <dd>{{ formatBytes(metrics()!.rss) }}</dd>
          <dt>Heap used</dt>
          <dd>{{ formatBytes(metrics()!.heapUsed) }}</dd>
          <dt>Heap total</dt>
          <dd>{{ formatBytes(metrics()!.heapTotal) }}</dd>
        </dl>
      } @else {
        <p class="perf__muted">No data (run inside Electron).</p>
      }
      <h3 class="perf__sub">Tabs</h3>
      <p>Browser tabs: {{ browserTabCount() }} · Suspended: {{ suspendedCount() }}</p>
    </div>
  `,
  styles: `
    .perf {
      padding: 12px;
      font-size: 13px;
    }
    .perf__title {
      margin: 0 0 8px;
      font-size: 15px;
    }
    .perf__sub {
      margin: 16px 0 6px;
      font-size: 13px;
    }
    .perf__scope {
      font-size: 11px;
      line-height: 1.45;
      color: var(--dl-text);
      margin: 0 0 8px;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--dl-border);
      background: var(--dl-bg-base);
    }
    .perf__hint,
    .perf__muted {
      color: var(--dl-muted);
      font-size: 12px;
      margin: 0 0 12px;
      line-height: 1.4;
    }
    .perf__grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    .perf__grid dt {
      color: var(--dl-muted);
      margin: 0;
    }
    .perf__grid dd {
      margin: 0;
      font-family: ui-monospace, monospace;
    }
  `,
})
export class PerformanceWidgetComponent implements OnDestroy {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly tabs = inject(TabsService);

  readonly metrics = signal<{
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  } | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), 4000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  browserTabCount(): number {
    return this.tabs.browserTabs().length;
  }

  suspendedCount(): number {
    return this.tabs.browserTabs().filter((t) => this.tabs.isBrowserTabSuspended(t.id)).length;
  }

  formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async poll(): Promise<void> {
    if (!this.bridge.isElectron) return;
    try {
      const m = await this.bridge.invoke<{
        rss: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
      }>(IPC_CHANNELS.APP_GET_METRICS);
      this.metrics.set(m);
    } catch {
      this.metrics.set(null);
    }
  }
}
