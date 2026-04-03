import { Component, inject, OnDestroy, signal } from '@angular/core';
import { IPC_CHANNELS } from '@dev-lens/shared';
import { ElectronBridgeService } from '@core/services/electron-bridge.service';
import { TabsService } from '@core/services/tabs.service';

@Component({
  selector: 'app-performance-widget',
  templateUrl: './performance-widget.component.html',
  styleUrl: './performance-widget.component.scss',
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
