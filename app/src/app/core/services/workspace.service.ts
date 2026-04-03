import { Injectable, inject, computed } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly persisted = inject(PersistedStateService);

  readonly workspaces = computed(() => this.persisted.snapshot()?.workspaces ?? []);
  readonly activeWorkspaceId = computed(
    () => this.persisted.snapshot()?.activeWorkspaceId ?? 'ws-default',
  );

  async setActiveWorkspace(id: string): Promise<void> {
    await this.persisted.patch({ activeWorkspaceId: id });
  }

  async createWorkspace(name: string, color: string): Promise<void> {
    const id = crypto.randomUUID();
    const next = [...this.workspaces(), { id, name, color }];
    await this.persisted.patch({ workspaces: next, activeWorkspaceId: id });
  }
}
