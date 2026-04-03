import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';

@Component({
  selector: 'app-bookmarks-widget',
  imports: [FormsModule],
  templateUrl: './bookmarks-widget.component.html',
  styleUrl: './bookmarks-widget.component.scss',
})
export class BookmarksWidgetComponent {
  readonly persisted = inject(PersistedStateService);
  readonly tabs = inject(TabsService);

  readonly editingId = signal<string | null>(null);
  readonly editTitle = signal('');
  readonly editUrl = signal('');

  bookmarks() {
    return this.persisted.snapshot()?.bookmarks ?? [];
  }

  async open(url: string, title: string): Promise<void> {
    await this.tabs.addBrowserTab(url, title || url);
  }

  async remove(id: string): Promise<void> {
    const snap = this.persisted.snapshot();
    const list = (snap?.bookmarks ?? []).filter((b) => b.id !== id);
    await this.persisted.patch({ bookmarks: list });
    if (this.editingId() === id) this.cancelEdit();
  }

  startEdit(b: { id: string; title: string; url: string }): void {
    this.editingId.set(b.id);
    this.editTitle.set(b.title);
    this.editUrl.set(b.url);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editTitle.set('');
    this.editUrl.set('');
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const title = this.editTitle().trim() || 'Bookmark';
    const url = this.editUrl().trim();
    if (!url) return;
    const snap = this.persisted.snapshot();
    if (!snap) return;
    const list = snap.bookmarks.map((b) => (b.id === id ? { ...b, title, url } : b));
    await this.persisted.patch({ bookmarks: list });
    this.cancelEdit();
  }
}
