/**
 * Shared bookmark collections service (Phase 3.4).
 * Enables creating shareable bookmark collections via export/import.
 */
import { Injectable, inject, computed } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';
import { ToastService } from './toast.service';
import type { BookmarkDTO, SharedBookmarkCollectionDTO } from '@dev-lens/shared';

export interface BookmarkSharePayload {
  collectionId: string;
  name: string;
  bookmarks: BookmarkDTO[];
}

@Injectable({ providedIn: 'root' })
export class SharedBookmarksService {
  private readonly persisted = inject(PersistedStateService);
  private readonly toast = inject(ToastService);

  readonly collections = computed(() => this.persisted.snapshot()?.sharedBookmarkCollections ?? []);

  /** Create a new shared bookmark collection. */
  async createCollection(name: string, bookmarks: BookmarkDTO[]): Promise<string> {
    const id = crypto.randomUUID();
    const shareToken = this.generateShareToken();

    const collection: SharedBookmarkCollectionDTO = {
      id,
      name,
      createdAt: Date.now(),
      bookmarks,
      shareToken,
    };

    const current = this.persisted.snapshot()?.sharedBookmarkCollections ?? [];
    await this.persisted.patch({
      sharedBookmarkCollections: [...current, collection],
    });

    this.toast.show('Shared bookmark collection created', 'success');
    return shareToken;
  }

  /** Get collection by share token. */
  getCollectionByToken(token: string): SharedBookmarkCollectionDTO | undefined {
    return this.collections().find((c) => c.shareToken === token);
  }

  /** Delete a collection. */
  async deleteCollection(id: string): Promise<void> {
    const current = this.persisted.snapshot()?.sharedBookmarkCollections ?? [];
    await this.persisted.patch({
      sharedBookmarkCollections: current.filter((c) => c.id !== id),
    });
    this.toast.show('Collection deleted', 'success');
  }

  /** Export collection as JSON for sharing. */
  exportCollectionAsJson(collectionId: string): string | null {
    const collection = this.collections().find((c) => c.id === collectionId);
    if (!collection) return null;

    const exportData = {
      type: 'dev-lens-bookmarks',
      version: 1,
      name: collection.name,
      bookmarks: collection.bookmarks,
      shareToken: collection.shareToken,
      exportedAt: Date.now(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /** Import bookmarks from a share payload. */
  async importSharedBookmarks(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);

      if (data.type !== 'dev-lens-bookmarks' || data.version !== 1) {
        this.toast.show('Invalid bookmark share format', 'error');
        return false;
      }

      const bookmarks: BookmarkDTO[] = data.bookmarks || [];
      const name: string = data.name || 'Imported Collection';

      await this.createCollection(name, bookmarks);
      this.toast.show(`Imported ${bookmarks.length} bookmarks`, 'success');
      return true;
    } catch {
      this.toast.show('Failed to import bookmarks', 'error');
      return false;
    }
  }

  /** Copy share link to clipboard. */
  async copyShareLink(collectionId: string): Promise<void> {
    const collection = this.collections().find((c) => c.id === collectionId);
    if (!collection) {
      this.toast.show('Collection not found', 'error');
      return;
    }

    const exportData = {
      type: 'dev-lens-bookmarks',
      version: 1,
      name: collection.name,
      bookmarks: collection.bookmarks,
      shareToken: collection.shareToken,
      exportedAt: Date.now(),
    };

    const jsonString = JSON.stringify(exportData);
    await navigator.clipboard.writeText(jsonString);
    this.toast.show('Share link copied to clipboard', 'success');
  }

  private generateShareToken(): string {
    return `bm-${crypto.randomUUID().slice(0, 8)}`;
  }
}
