import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ReadLaterEntryDTO } from '@dev-lens/shared';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';

@Component({
  selector: 'app-read-later-widget',
  imports: [FormsModule],
  template: `
    <div class="rl">
      <h2 class="rl__title">Read later</h2>
      <p class="rl__hint">Local queue (export as companion JSON from Settings → Sync).</p>
      <div class="rl__add">
        <input type="url" placeholder="https://…" [(ngModel)]="draftUrl" (keydown.enter)="add()" />
        <button type="button" class="rl__btn" (click)="add()">Add</button>
      </div>
      <ul class="rl__list">
        @for (e of entries(); track e.id) {
          <li class="rl__item">
            <button type="button" class="rl__link" (click)="open(e)">{{ e.title || e.url }}</button>
            <button type="button" class="rl__x" title="Remove" (click)="remove(e.id)">×</button>
          </li>
        } @empty {
          <li class="rl__empty">Nothing saved yet.</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .rl {
      padding: 12px;
      font-size: 13px;
    }
    .rl__title {
      margin: 0 0 6px;
      font-size: 15px;
    }
    .rl__hint {
      color: var(--dl-muted);
      font-size: 12px;
      margin: 0 0 10px;
    }
    .rl__add {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .rl__add input {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--dl-border);
      background: var(--dl-bg-base);
      color: var(--dl-text);
    }
    .rl__btn {
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background: var(--dl-accent);
      color: var(--dl-bg-base);
      cursor: pointer;
      font-weight: 600;
    }
    .rl__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .rl__item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 0;
      border-bottom: 1px solid var(--dl-border);
    }
    .rl__link {
      flex: 1;
      min-width: 0;
      text-align: left;
      border: none;
      background: none;
      color: var(--dl-accent);
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }
    .rl__x {
      border: none;
      background: transparent;
      color: var(--dl-muted);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
    }
    .rl__empty {
      color: var(--dl-muted);
      padding: 8px 0;
    }
  `,
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
