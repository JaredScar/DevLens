import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ReadLaterEntryDTO } from '@dev-lens/shared';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';

@Component({
  selector: 'app-read-later-widget',
  imports: [FormsModule],
  templateUrl: './read-later-widget.component.html',
  styleUrl: './read-later-widget.component.scss',
})
export class ReadLaterWidgetComponent {
  private readonly persisted = inject(PersistedStateService);
  private readonly tabs = inject(TabsService);

  draftUrl = '';

  entries(): ReadLaterEntryDTO[] {
    return this.persisted.snapshot()?.readLater ?? [];
  }

  async add(): Promise<void> {
    const url = this.draftUrl.trim();
    if (!url) return;
    let title = url;
    try {
      const u = new URL(url);
      title = u.hostname + u.pathname;
    } catch {
      /* keep */
    }
    const list = [...(this.persisted.snapshot()?.readLater ?? [])];
    list.unshift({
      id: crypto.randomUUID(),
      url,
      title,
      addedAt: Date.now(),
    });
    await this.persisted.patch({ readLater: list.slice(0, 200) });
    this.draftUrl = '';
  }

  async remove(id: string): Promise<void> {
    const list = (this.persisted.snapshot()?.readLater ?? []).filter((e) => e.id !== id);
    await this.persisted.patch({ readLater: list });
  }

  async open(e: ReadLaterEntryDTO): Promise<void> {
    await this.tabs.addBrowserTab(e.url, e.title || e.url);
  }
}
