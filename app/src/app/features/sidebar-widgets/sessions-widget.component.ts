import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SavedSessionDTO } from '@dev-lens/shared';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';
import { ToastService } from '@core/services/toast.service';
import { WorkspaceService } from '@core/services/workspace.service';

@Component({
  selector: 'app-sessions-widget',
  imports: [FormsModule],
  templateUrl: './sessions-widget.component.html',
  styleUrl: './sessions-widget.component.scss',
})
export class SessionsWidgetComponent {
  private readonly persisted = inject(PersistedStateService);
  private readonly tabs = inject(TabsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly diffA = signal<string | null>(null);
  readonly diffB = signal<string | null>(null);
  readonly saveDialog = signal<{ value: string } | null>(null);
  readonly restoreChoiceSession = signal<SavedSessionDTO | null>(null);

  readonly sessions = computed<SavedSessionDTO[]>(
    () => this.persisted.snapshot()?.savedSessions ?? [],
  );

  readonly diffResult = computed(() => {
    const idA = this.diffA();
    const idB = this.diffB();
    if (!idA || !idB || idA === idB) return null;
    const a = this.sessions().find((s) => s.id === idA);
    const b = this.sessions().find((s) => s.id === idB);
    if (!a || !b) return null;
    const urlsA = new Set(a.tabs.map((t) => t.url));
    const urlsB = new Set(b.tabs.map((t) => t.url));
    const onlyA = [...urlsA].filter((u) => !urlsB.has(u));
    const onlyB = [...urlsB].filter((u) => !urlsA.has(u));
    const both = [...urlsA].filter((u) => urlsB.has(u));
    return { nameA: a.name, nameB: b.name, onlyA, onlyB, both };
  });

  openSaveSessionDialog(): void {
    this.saveDialog.set({ value: `Session ${new Date().toLocaleTimeString()}` });
  }

  dismissSaveDialog(): void {
    this.saveDialog.set(null);
  }

  onSessionsModalBackdropKeydown(ev: KeyboardEvent, which: 'save' | 'restore'): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    if (which === 'save') this.dismissSaveDialog();
    else this.dismissRestoreChoice();
  }

  setSaveDialogValue(value: string): void {
    this.saveDialog.update((d) => (d ? { value } : d));
  }

  async confirmSaveSession(): Promise<void> {
    const d = this.saveDialog();
    if (!d?.value?.trim()) {
      this.saveDialog.set(null);
      return;
    }
    const name = d.value.trim();
    this.saveDialog.set(null);
    this.saving.set(true);
    const wsId = this.workspace.activeWorkspaceId();
    const browserTabs = this.tabs.visibleTabs().filter((t) => t.kind === 'browser');
    const session: SavedSessionDTO = {
      id: crypto.randomUUID(),
      name,
      workspaceId: wsId,
      tabs: browserTabs.map((t) => ({ url: t.url, title: t.title })),
      savedAt: Date.now(),
    };
    const updated = [session, ...(this.persisted.snapshot()?.savedSessions ?? [])];
    await this.persisted.patch({ savedSessions: updated });
    this.saving.set(false);
    this.toast.show('Session saved.');
  }

  openRestoreChoice(session: SavedSessionDTO): void {
    this.restoreChoiceSession.set(session);
  }

  dismissRestoreChoice(): void {
    this.restoreChoiceSession.set(null);
  }

  async restoreKeepExisting(): Promise<void> {
    const session = this.restoreChoiceSession();
    if (!session) return;
    this.restoreChoiceSession.set(null);
    for (const tab of session.tabs) {
      await this.tabs.addBrowserTab(tab.url, tab.title, false);
    }
    this.toast.show(`Opened ${session.tabs.length} tab(s) from “${session.name}”.`);
  }

  async restoreReplaceBrowserTabs(): Promise<void> {
    const session = this.restoreChoiceSession();
    if (!session) return;
    this.restoreChoiceSession.set(null);
    await this.tabs.closeAllBrowserTabsInActiveWorkspace();
    for (const tab of session.tabs) {
      await this.tabs.addBrowserTab(tab.url, tab.title, false);
    }
    this.toast.show(`Replaced browser tabs with “${session.name}”.`);
  }

  async deleteSession(id: string): Promise<void> {
    const updated = (this.persisted.snapshot()?.savedSessions ?? []).filter((s) => s.id !== id);
    await this.persisted.patch({ savedSessions: updated });
    if (this.diffA() === id) this.diffA.set(null);
    if (this.diffB() === id) this.diffB.set(null);
  }

  formatSessionDate(ts: number): string {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(
        new Date(ts),
      );
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  async shareSessionJson(session: SavedSessionDTO): Promise<void> {
    const payload = {
      devLensSessionShare: 1 as const,
      exportedAt: Date.now(),
      name: session.name,
      workspaceId: session.workspaceId,
      tabs: session.tabs,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show('Session share JSON copied to clipboard.');
    } catch {
      this.toast.error(
        'Clipboard is not available here. Open DevTools and copy the session from storage if needed.',
      );
    }
  }
}
