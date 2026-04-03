import { Component, computed, inject } from '@angular/core';
import type { HistoryEntryDTO } from '@dev-lens/shared';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';
import { ToastService } from '@core/services/toast.service';

interface HistoryDayGroup {
  label: string;
  entries: HistoryEntryDTO[];
}

@Component({
  selector: 'app-history-widget',
  imports: [],
  templateUrl: './history-widget.component.html',
  styleUrl: './history-widget.component.scss',
})
export class HistoryWidgetComponent {
  readonly persisted = inject(PersistedStateService);
  private readonly tabs = inject(TabsService);
  private readonly toast = inject(ToastService);

  readonly groups = computed((): HistoryDayGroup[] => {
    const h = this.persisted.snapshot()?.history ?? [];
    const sorted = [...h].sort((a, b) => b.at - a.at);
    const map = new Map<string, HistoryEntryDTO[]>();
    const today = new Date();
    const todayStr = today.toDateString();
    for (const e of sorted) {
      const d = new Date(e.at);
      let label: string;
      if (d.toDateString() === todayStr) label = 'Today';
      else if (d.toDateString() === new Date(today.getTime() - 86400000).toDateString())
        label = 'Yesterday';
      else
        label = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return [...map.entries()].map(([label, entries]) => ({ label, entries }));
  });

  openUrl(url: string): void {
    void this.tabs.addBrowserTab(url, url);
  }

  formatTime(at: number): string {
    return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  async removeEntry(id: string): Promise<void> {
    const snap = this.persisted.snapshot();
    if (!snap) return;
    await this.persisted.patch({ history: snap.history.filter((e) => e.id !== id) });
  }

  async clearAllHistory(): Promise<void> {
    await this.persisted.patch({ history: [] });
    this.toast.show('Browsing history cleared.');
  }
}
