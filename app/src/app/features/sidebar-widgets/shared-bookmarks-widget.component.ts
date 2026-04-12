/**
 * Shared Bookmarks Widget (Phase 3.4)
 * Create and manage shareable bookmark collections.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedBookmarksService } from '@core/services/shared-bookmarks.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { LayoutService } from '@core/services/layout.service';
import { TabsService } from '@core/services/tabs.service';
import { ToastService } from '@core/services/toast.service';
import type { BookmarkDTO } from '@dev-lens/shared';

@Component({
  selector: 'app-shared-bookmarks-widget',
  imports: [FormsModule],
  template: `
    <div class="sb-widget">
      <header class="sb-header">
        <h3 class="sb-title">
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 16 16"
          >
            <path d="M3 2h10a1 1 0 011 1v11l-6-3-6 3V3a1 1 0 011-1z" />
          </svg>
          Shared Bookmarks
        </h3>
        <button
          type="button"
          class="sb-close"
          (click)="layout.closeRightSidebar()"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div class="sb-body">
        <!-- Create Collection -->
        <div class="sb-section">
          <h4 class="sb-section-title">Create Collection</h4>
          <div class="sb-input-group">
            <input
              type="text"
              class="sb-input"
              [(ngModel)]="newCollectionName"
              placeholder="Collection name"
            />
            <button
              type="button"
              class="sb-btn sb-btn--primary"
              (click)="createCollection()"
              [disabled]="!newCollectionName.trim()"
            >
              Create
            </button>
          </div>
        </div>

        <!-- Import Collection -->
        <div class="sb-section">
          <h4 class="sb-section-title">Import Collection</h4>
          <textarea
            class="sb-textarea"
            [(ngModel)]="importJson"
            placeholder="Paste shared bookmark JSON here..."
            rows="3"
          ></textarea>
          <button
            type="button"
            class="sb-btn sb-btn--secondary"
            (click)="importCollection()"
            [disabled]="!importJson.trim()"
          >
            Import
          </button>
        </div>

        <!-- Collections List -->
        <div class="sb-section">
          <h4 class="sb-section-title">Your Collections ({{ collections().length }})</h4>
          @if (collections().length === 0) {
            <p class="sb-empty">No shared collections yet</p>
          } @else {
            <ul class="sb-collection-list">
              @for (collection of collections(); track collection.id) {
                <li class="sb-collection">
                  <div
                    class="sb-collection-header"
                    (click)="toggleExpand(collection.id)"
                    (keydown.enter)="toggleExpand(collection.id)"
                    (keydown.space)="toggleExpand(collection.id); $event.preventDefault()"
                    tabindex="0"
                    role="button"
                    [attr.aria-expanded]="expandedCollections().has(collection.id)"
                  >
                    <span class="sb-collection-name">{{ collection.name }}</span>
                    <span class="sb-collection-count"
                      >{{ collection.bookmarks.length }} bookmarks</span
                    >
                    <button type="button" class="sb-expand-btn">
                      {{ expandedCollections().has(collection.id) ? '▼' : '▶' }}
                    </button>
                  </div>

                  @if (expandedCollections().has(collection.id)) {
                    <div class="sb-collection-body">
                      <ul class="sb-bookmark-list">
                        @for (bookmark of collection.bookmarks; track bookmark.id) {
                          <li class="sb-bookmark">
                            <a
                              [href]="bookmark.url"
                              target="_blank"
                              class="sb-bookmark-link"
                              (click)="openBookmark(bookmark); $event.preventDefault()"
                            >
                              {{ bookmark.title || bookmark.url }}
                            </a>
                          </li>
                        }
                      </ul>
                      <div class="sb-collection-actions">
                        <button
                          type="button"
                          class="sb-btn sb-btn--small"
                          (click)="copyShareLink(collection.id)"
                        >
                          Copy Share Link
                        </button>
                        <button
                          type="button"
                          class="sb-btn sb-btn--small sb-btn--danger"
                          (click)="deleteCollection(collection.id)"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .sb-widget {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--dl-bg);
      color: var(--dl-text);
    }
    .sb-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .sb-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .sb-close {
      background: none;
      border: none;
      color: var(--dl-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
    }
    .sb-close:hover {
      color: var(--dl-text);
    }
    .sb-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .sb-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .sb-section:last-child {
      border-bottom: none;
    }
    .sb-section-title {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--dl-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sb-input-group {
      display: flex;
      gap: 8px;
    }
    .sb-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--dl-border);
      border-radius: 6px;
      background: var(--dl-input-bg);
      color: var(--dl-text);
      font-size: 13px;
    }
    .sb-input:focus {
      outline: none;
      border-color: var(--dl-accent);
    }
    .sb-textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--dl-border);
      border-radius: 6px;
      background: var(--dl-input-bg);
      color: var(--dl-text);
      font-size: 13px;
      resize: vertical;
      margin-bottom: 8px;
    }
    .sb-textarea:focus {
      outline: none;
      border-color: var(--dl-accent);
    }
    .sb-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--dl-surface);
      color: var(--dl-text);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sb-btn:hover:not(:disabled) {
      background: var(--dl-hover);
    }
    .sb-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .sb-btn--primary {
      background: var(--dl-accent);
      color: white;
    }
    .sb-btn--primary:hover:not(:disabled) {
      background: var(--dl-accent-hover);
    }
    .sb-btn--secondary {
      background: var(--dl-muted);
    }
    .sb-btn--small {
      padding: 4px 12px;
      font-size: 12px;
    }
    .sb-btn--danger {
      background: #dc3545;
      color: white;
    }
    .sb-btn--danger:hover:not(:disabled) {
      background: #c82333;
    }
    .sb-empty {
      font-size: 12px;
      color: var(--dl-muted);
      font-style: italic;
    }
    .sb-collection-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .sb-collection {
      border: 1px solid var(--dl-border);
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .sb-collection-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--dl-surface);
      cursor: pointer;
    }
    .sb-collection-name {
      flex: 1;
      font-weight: 500;
      font-size: 13px;
    }
    .sb-collection-count {
      font-size: 11px;
      color: var(--dl-muted);
    }
    .sb-expand-btn {
      background: none;
      border: none;
      color: var(--dl-muted);
      cursor: pointer;
      padding: 0 4px;
    }
    .sb-collection-body {
      padding: 12px;
      border-top: 1px solid var(--dl-border);
    }
    .sb-bookmark-list {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
    }
    .sb-bookmark {
      padding: 6px 0;
      border-bottom: 1px solid var(--dl-border-subtle);
    }
    .sb-bookmark:last-child {
      border-bottom: none;
    }
    .sb-bookmark-link {
      color: var(--dl-accent);
      text-decoration: none;
      font-size: 12px;
      word-break: break-all;
    }
    .sb-bookmark-link:hover {
      text-decoration: underline;
    }
    .sb-collection-actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class SharedBookmarksWidgetComponent {
  readonly shared = inject(SharedBookmarksService);
  readonly persisted = inject(PersistedStateService);
  readonly layout = inject(LayoutService);
  readonly tabs = inject(TabsService);
  readonly toast = inject(ToastService);

  readonly collections = this.shared.collections;
  readonly expandedCollections = signal<Set<string>>(new Set());

  newCollectionName = '';
  importJson = '';

  createCollection(): void {
    const name = this.newCollectionName.trim();
    if (!name) return;

    // Get current bookmarks for the collection
    const bookmarks = this.persisted.snapshot()?.bookmarks || [];
    if (bookmarks.length === 0) {
      this.toast.show('No bookmarks to share. Add bookmarks first.', 'error');
      return;
    }

    this.shared.createCollection(name, bookmarks).then(() => {
      this.newCollectionName = '';
    });
  }

  importCollection(): void {
    const json = this.importJson.trim();
    if (!json) return;

    this.shared.importSharedBookmarks(json).then((success) => {
      if (success) {
        this.importJson = '';
      }
    });
  }

  copyShareLink(collectionId: string): void {
    this.shared.copyShareLink(collectionId);
  }

  deleteCollection(id: string): void {
    this.shared.deleteCollection(id);
  }

  openBookmark(bookmark: BookmarkDTO): void {
    this.tabs.addBrowserTab(bookmark.url, bookmark.title);
  }

  toggleExpand(collectionId: string): void {
    this.expandedCollections.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  }
}
