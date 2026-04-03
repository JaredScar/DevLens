import { Injectable, inject, computed, signal } from '@angular/core';
import type { NoteDTO } from '@dev-lens/shared';
import { PersistedStateService } from './persisted-state.service';
import { WorkspaceService } from './workspace.service';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly persisted = inject(PersistedStateService);
  private readonly workspace = inject(WorkspaceService);

  /** Spotlight / external callers scroll to this note id once in the Notes widget. */
  readonly highlightNoteId = signal<string | null>(null);

  requestFocusNote(id: string | null): void {
    this.highlightNoteId.set(id);
  }

  readonly notes = computed(() => {
    const ws = this.workspace.activeWorkspaceId();
    return (this.persisted.snapshot()?.notes ?? []).filter((n) => n.workspaceId === ws);
  });

  async upsert(
    note: Omit<NoteDTO, 'workspaceId' | 'updatedAt'> & {
      workspaceId?: string;
      updatedAt?: number;
    },
  ): Promise<void> {
    const all = [...(this.persisted.snapshot()?.notes ?? [])];
    const idx = all.findIndex((n) => n.id === note.id);
    const row: NoteDTO = {
      id: note.id,
      title: note.title,
      body: note.body,
      url: note.url,
      workspaceId: note.workspaceId ?? this.workspace.activeWorkspaceId(),
      updatedAt: note.updatedAt ?? Date.now(),
    };
    if (idx >= 0) all[idx] = row;
    else all.push(row);
    await this.persisted.patch({ notes: all });
  }

  async remove(id: string): Promise<void> {
    const all = (this.persisted.snapshot()?.notes ?? []).filter((n) => n.id !== id);
    await this.persisted.patch({ notes: all });
  }
}
