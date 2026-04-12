/**
 * Shared Workspaces Widget (Phase 3.4)
 * Create and manage shareable workspace exports.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedWorkspacesService } from '@core/services/shared-workspaces.service';
import { WorkspaceService } from '@core/services/workspace.service';
import { TabsService } from '@core/services/tabs.service';
import { LayoutService } from '@core/services/layout.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-shared-workspaces-widget',
  imports: [FormsModule],
  template: `
    <div class="sw-widget">
      <header class="sw-header">
        <h3 class="sw-title">
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 16 16"
          >
            <circle cx="8" cy="8" r="6.5" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
          Shared Workspaces
        </h3>
        <button
          type="button"
          class="sw-close"
          (click)="layout.closeRightSidebar()"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div class="sw-body">
        <!-- Share Current Workspace -->
        <div class="sw-section">
          <h4 class="sw-section-title">Share Current Workspace</h4>
          <p class="sw-hint">Share "{{ activeWorkspaceName() }}" with tabs and groups</p>
          <button type="button" class="sw-btn sw-btn--primary" (click)="shareCurrentWorkspace()">
            Create Share Link
          </button>
        </div>

        <!-- Import Workspace -->
        <div class="sw-section">
          <h4 class="sw-section-title">Import Workspace</h4>
          <textarea
            class="sw-textarea"
            [(ngModel)]="importJson"
            placeholder="Paste shared workspace JSON here..."
            rows="3"
          ></textarea>
          <button
            type="button"
            class="sw-btn sw-btn--secondary"
            (click)="importWorkspace()"
            [disabled]="!importJson.trim()"
          >
            Import
          </button>
        </div>

        <!-- Shared Workspaces List -->
        <div class="sw-section">
          <h4 class="sw-section-title">Your Shared Workspaces ({{ sharedWorkspaces().length }})</h4>
          @if (sharedWorkspaces().length === 0) {
            <p class="sw-empty">No shared workspaces yet</p>
          } @else {
            <ul class="sw-workspace-list">
              @for (workspace of sharedWorkspaces(); track workspace.id) {
                <li class="sw-workspace">
                  <div
                    class="sw-workspace-header"
                    (click)="toggleExpand(workspace.id)"
                    (keydown.enter)="toggleExpand(workspace.id)"
                    (keydown.space)="toggleExpand(workspace.id); $event.preventDefault()"
                    tabindex="0"
                    role="button"
                    [attr.aria-expanded]="expandedWorkspaces().has(workspace.id)"
                  >
                    <span class="sw-workspace-dot" [style.background]="workspace.color"></span>
                    <span class="sw-workspace-name">{{ workspace.name }}</span>
                    <span class="sw-workspace-count">{{ workspace.tabs.length }} tabs</span>
                    <button type="button" class="sw-expand-btn">
                      {{ expandedWorkspaces().has(workspace.id) ? '▼' : '▶' }}
                    </button>
                  </div>

                  @if (expandedWorkspaces().has(workspace.id)) {
                    <div class="sw-workspace-body">
                      <ul class="sw-tab-list">
                        @for (tab of workspace.tabs.slice(0, 5); track tab.url) {
                          <li class="sw-tab-item">{{ tab.title || tab.url }}</li>
                        }
                        @if (workspace.tabs.length > 5) {
                          <li class="sw-tab-more">...and {{ workspace.tabs.length - 5 }} more</li>
                        }
                      </ul>
                      <div class="sw-workspace-actions">
                        <button
                          type="button"
                          class="sw-btn sw-btn--small"
                          (click)="copyShareLink(workspace.id)"
                        >
                          Copy Share Link
                        </button>
                        <button
                          type="button"
                          class="sw-btn sw-btn--small sw-btn--danger"
                          (click)="deleteWorkspace(workspace.id)"
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
    .sw-widget {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--dl-bg);
      color: var(--dl-text);
    }
    .sw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .sw-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .sw-close {
      background: none;
      border: none;
      color: var(--dl-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
    }
    .sw-close:hover {
      color: var(--dl-text);
    }
    .sw-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .sw-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--dl-border);
    }
    .sw-section:last-child {
      border-bottom: none;
    }
    .sw-section-title {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--dl-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sw-hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--dl-muted);
    }
    .sw-textarea {
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
    .sw-textarea:focus {
      outline: none;
      border-color: var(--dl-accent);
    }
    .sw-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--dl-surface);
      color: var(--dl-text);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sw-btn:hover:not(:disabled) {
      background: var(--dl-hover);
    }
    .sw-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .sw-btn--primary {
      background: var(--dl-accent);
      color: white;
    }
    .sw-btn--primary:hover:not(:disabled) {
      background: var(--dl-accent-hover);
    }
    .sw-btn--secondary {
      background: var(--dl-muted);
    }
    .sw-btn--small {
      padding: 4px 12px;
      font-size: 12px;
    }
    .sw-btn--danger {
      background: #dc3545;
      color: white;
    }
    .sw-btn--danger:hover:not(:disabled) {
      background: #c82333;
    }
    .sw-empty {
      font-size: 12px;
      color: var(--dl-muted);
      font-style: italic;
    }
    .sw-workspace-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .sw-workspace {
      border: 1px solid var(--dl-border);
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .sw-workspace-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--dl-surface);
      cursor: pointer;
    }
    .sw-workspace-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .sw-workspace-name {
      flex: 1;
      font-weight: 500;
      font-size: 13px;
    }
    .sw-workspace-count {
      font-size: 11px;
      color: var(--dl-muted);
    }
    .sw-expand-btn {
      background: none;
      border: none;
      color: var(--dl-muted);
      cursor: pointer;
      padding: 0 4px;
    }
    .sw-workspace-body {
      padding: 12px;
      border-top: 1px solid var(--dl-border);
    }
    .sw-tab-list {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
    }
    .sw-tab-item {
      padding: 4px 0;
      font-size: 12px;
      color: var(--dl-text);
      word-break: break-all;
    }
    .sw-tab-more {
      font-size: 11px;
      color: var(--dl-muted);
      font-style: italic;
    }
    .sw-workspace-actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class SharedWorkspacesWidgetComponent {
  readonly shared = inject(SharedWorkspacesService);
  readonly workspaces = inject(WorkspaceService);
  readonly tabs = inject(TabsService);
  readonly layout = inject(LayoutService);
  readonly toast = inject(ToastService);

  readonly sharedWorkspaces = this.shared.sharedWorkspaces;
  readonly activeWorkspaceName = this.workspaces.activeWorkspaceName;
  readonly expandedWorkspaces = signal<Set<string>>(new Set());

  importJson = '';

  shareCurrentWorkspace(): void {
    const name = this.workspaces.activeWorkspaceName();
    const color = this.workspaces.activeWorkspaceColor();
    const visibleTabs = this.tabs.visibleTabs();
    this.doShare(name, color, visibleTabs);
  }

  private doShare(
    name: string,
    color: string,
    visibleTabs: { kind: string; url: string; title: string; pinned?: boolean }[],
  ): void {
    if (visibleTabs.length === 0) {
      this.toast.show('No tabs to share', 'error');
      return;
    }

    // Convert tabs to shareable format
    const shareableTabs = visibleTabs
      .filter((t) => t.kind === 'browser')
      .map((t) => ({
        url: t.url,
        title: t.title,
        pinned: t.pinned,
      }));

    // Get tab groups for current workspace
    // Note: In a full implementation, you'd get the actual groups
    const groups: { id: string; workspaceId: string; title: string; color: string }[] = [];

    this.shared.createSharedWorkspace(name, color, shareableTabs, groups);
  }

  importWorkspace(): void {
    const json = this.importJson.trim();
    if (!json) return;

    this.shared.importSharedWorkspace(json).then((success) => {
      if (success) {
        this.importJson = '';
      }
    });
  }

  copyShareLink(workspaceId: string): void {
    this.shared.copyShareLink(workspaceId);
  }

  deleteWorkspace(id: string): void {
    this.shared.deleteSharedWorkspace(id);
  }

  toggleExpand(workspaceId: string): void {
    this.expandedWorkspaces.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId);
      } else {
        newSet.add(workspaceId);
      }
      return newSet;
    });
  }
}
