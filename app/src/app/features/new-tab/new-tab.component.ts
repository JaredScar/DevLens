import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { TabsService } from '@core/services/tabs.service';
import { WorkspaceService } from '@core/services/workspace.service';
import { resolveNavigationInput } from '@core/navigation-url';

@Component({
  selector: 'app-new-tab',
  imports: [DatePipe, FormsModule],
  templateUrl: './new-tab.component.html',
  styleUrl: './new-tab.component.scss',
})
export class NewTabComponent {
  readonly tabs = inject(TabsService);
  readonly persisted = inject(PersistedStateService);
  readonly workspace = inject(WorkspaceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly now = signal(new Date());
  readonly searchQuery = signal('');

  constructor() {
    const id = window.setInterval(() => this.now.set(new Date()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  activeWorkspaceName(): string {
    const id = this.workspace.activeWorkspaceId();
    return this.workspace.workspaces().find((w) => w.id === id)?.name ?? '—';
  }

  greeting(): string {
    const h = this.now().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  submitSearch(): void {
    const q = this.searchQuery().trim();
    if (!q) return;
    const engine = this.persisted.snapshot()?.settings.searchEngine ?? 'ddg';
    const url = resolveNavigationInput(q, engine);
    void this.tabs.addBrowserTab(url, q);
    this.searchQuery.set('');
  }

  open(url: string, title: string): void {
    void this.tabs.addBrowserTab(url, title);
  }

  openSettings(): void {
    void this.tabs.addInternalTab('settings', 'Settings');
  }
}
