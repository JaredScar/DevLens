/**
 * Shared workspaces service (Phase 3.4).
 * Enables creating shareable workspace exports via export/import.
 */
import { Injectable, inject, computed } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';
import { ToastService } from './toast.service';
import { TabsService } from './tabs.service';
import type { TabGroupDTO, SharedWorkspaceDTO } from '@dev-lens/shared';

export interface WorkspaceSharePayload {
  workspaceId: string;
  name: string;
  color: string;
  tabs: { url: string; title: string; pinned?: boolean }[];
  groups: TabGroupDTO[];
}

@Injectable({ providedIn: 'root' })
export class SharedWorkspacesService {
  private readonly persisted = inject(PersistedStateService);
  private readonly toast = inject(ToastService);
  private readonly tabs = inject(TabsService);

  readonly sharedWorkspaces = computed(() => this.persisted.snapshot()?.sharedWorkspaces ?? []);

  /** Create a new shared workspace export. */
  async createSharedWorkspace(
    name: string,
    color: string,
    tabs: WorkspaceSharePayload['tabs'],
    groups: TabGroupDTO[],
  ): Promise<string> {
    const id = crypto.randomUUID();
    const shareToken = this.generateShareToken();

    const workspace: SharedWorkspaceDTO = {
      id,
      name,
      color,
      createdAt: Date.now(),
      shareToken,
      tabs,
      groups,
    };

    const current = this.persisted.snapshot()?.sharedWorkspaces ?? [];
    await this.persisted.patch({
      sharedWorkspaces: [...current, workspace],
    });

    this.toast.show('Shared workspace created', 'success');
    return shareToken;
  }

  /** Get workspace by share token. */
  getWorkspaceByToken(token: string): SharedWorkspaceDTO | undefined {
    return this.sharedWorkspaces().find((w) => w.shareToken === token);
  }

  /** Delete a shared workspace. */
  async deleteSharedWorkspace(id: string): Promise<void> {
    const current = this.persisted.snapshot()?.sharedWorkspaces ?? [];
    await this.persisted.patch({
      sharedWorkspaces: current.filter((w) => w.id !== id),
    });
    this.toast.show('Shared workspace deleted', 'success');
  }

  /** Export workspace as JSON for sharing. */
  exportWorkspaceAsJson(workspaceId: string): string | null {
    const workspace = this.sharedWorkspaces().find((w) => w.id === workspaceId);
    if (!workspace) return null;

    const exportData = {
      type: 'dev-lens-workspace',
      version: 1,
      name: workspace.name,
      color: workspace.color,
      tabs: workspace.tabs,
      groups: workspace.groups,
      shareToken: workspace.shareToken,
      exportedAt: Date.now(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /** Import workspace from a share payload. */
  async importSharedWorkspace(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);

      if (data.type !== 'dev-lens-workspace' || data.version !== 1) {
        this.toast.show('Invalid workspace share format', 'error');
        return false;
      }

      const name: string = data.name || 'Imported Workspace';
      const color: string = data.color || '#58a6ff';
      const tabs: { url: string; title: string }[] = data.tabs || [];

      // Create the shared workspace entry
      await this.createSharedWorkspace(name, color, tabs, data.groups || []);

      // Optionally open tabs from the shared workspace
      if (tabs.length > 0) {
        for (const tab of tabs.slice(0, 5)) {
          // Limit to 5 tabs on import
          this.tabs.addBrowserTab(tab.url, tab.title);
        }
      }

      this.toast.show(`Imported workspace "${name}" with ${tabs.length} tabs`, 'success');
      return true;
    } catch {
      this.toast.show('Failed to import workspace', 'error');
      return false;
    }
  }

  /** Copy share link to clipboard. */
  async copyShareLink(workspaceId: string): Promise<void> {
    const workspace = this.sharedWorkspaces().find((w) => w.id === workspaceId);
    if (!workspace) {
      this.toast.show('Workspace not found', 'error');
      return;
    }

    const exportData = {
      type: 'dev-lens-workspace',
      version: 1,
      name: workspace.name,
      color: workspace.color,
      tabs: workspace.tabs,
      groups: workspace.groups,
      shareToken: workspace.shareToken,
      exportedAt: Date.now(),
    };

    const jsonString = JSON.stringify(exportData);
    await navigator.clipboard.writeText(jsonString);
    this.toast.show('Workspace share link copied to clipboard', 'success');
  }

  private generateShareToken(): string {
    return `ws-${crypto.randomUUID().slice(0, 8)}`;
  }
}
