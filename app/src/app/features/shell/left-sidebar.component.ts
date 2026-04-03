import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDragEnd, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import type { UiTab } from '@core/services/tabs.service';
import { LayoutService } from '@core/services/layout.service';
import { SplitViewService } from '@core/services/split-view.service';
import { TabsService } from '@core/services/tabs.service';
import { WorkspaceService } from '@core/services/workspace.service';
import { AutomationService } from '@core/services/automation.service';
import { PageAiIntentService } from '@core/services/page-ai-intent.service';
import { WidgetRegistryService } from '@core/services/widget-registry.service';
import { PersistedStateService } from '@core/services/persisted-state.service';
import { ToastService } from '@core/services/toast.service';

type TabListItem =
  | { type: 'group'; id: string; title: string; color: string; collapsed: boolean }
  | { type: 'tab'; tab: UiTab };

@Component({
  selector: 'app-left-sidebar',
  imports: [FormsModule, DragDropModule],
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
})
export class LeftSidebarComponent {
  readonly layout = inject(LayoutService);
  private readonly pageAi = inject(PageAiIntentService);
  readonly tabs = inject(TabsService);
  readonly splitView = inject(SplitViewService);
  readonly workspace = inject(WorkspaceService);
  readonly widgets = inject(WidgetRegistryService);
  private readonly persisted = inject(PersistedStateService);
  private readonly automation = inject(AutomationService);
  private readonly toast = inject(ToastService);

  readonly workspaceColorPresets = [
    '#58a6ff',
    '#a371f7',
    '#f0883e',
    '#3fb950',
    '#f85149',
    '#d29922',
    '#8b949e',
  ] as const;

  readonly tabFilter = signal('');
  readonly wsDropdownOpen = signal(false);
  readonly tabContextMenu = signal<{ x: number; y: number; tab: UiTab } | null>(null);
  /** Inline dialog replacing window.prompt (unsupported in Electron renderer). */
  readonly dialog = signal<{ type: 'workspace' | 'group'; value: string; color?: string } | null>(
    null,
  );

  /** Multi-select mode for tab grouping */
  readonly selectMode = signal(false);
  readonly selectedTabIds = signal<Set<string>>(new Set());
  readonly canGroup = computed(() => this.selectedTabIds().size >= 2);

  readonly filteredTabs = computed(() => {
    const q = this.tabFilter().trim().toLowerCase();
    const list = this.tabs.visibleTabs();
    if (!q) return list;
    return list.filter((t) => `${t.title} ${t.url}`.toLowerCase().includes(q));
  });

  readonly groupedItems = computed((): TabListItem[] => {
    const tabs = this.filteredTabs();
    const groups = (this.persisted.snapshot()?.tabGroups ?? []).filter(
      (g) => g.workspaceId === this.workspace.activeWorkspaceId(),
    );
    const byGroup = new Map<string, UiTab[]>();
    const ungrouped: UiTab[] = [];
    for (const t of tabs) {
      if (t.groupId) {
        if (!byGroup.has(t.groupId)) byGroup.set(t.groupId, []);
        byGroup.get(t.groupId)!.push(t);
      } else {
        ungrouped.push(t);
      }
    }
    const result: TabListItem[] = [];
    for (const g of groups) {
      const gTabs = byGroup.get(g.id) ?? [];
      if (gTabs.length === 0) continue;
      const collapsed = !!g.collapsed;
      result.push({ type: 'group', id: g.id, title: g.title, color: g.color, collapsed });
      if (!collapsed) {
        for (const t of gTabs) result.push({ type: 'tab', tab: t });
      }
    }
    for (const t of ungrouped) result.push({ type: 'tab', tab: t });
    return result;
  });

  readonly activeWorkspaceName = computed(
    () =>
      this.workspace.workspaces().find((w) => w.id === this.workspace.activeWorkspaceId())?.name ??
      'Workspace',
  );

  readonly activeWorkspaceColor = computed(
    () =>
      this.workspace.workspaces().find((w) => w.id === this.workspace.activeWorkspaceId())?.color ??
      '#58a6ff',
  );

  tabCountForWorkspace(id: string): number {
    return this.tabs.tabs().filter((t) => t.workspaceId === id).length;
  }

  toggleWsDropdown(): void {
    this.wsDropdownOpen.update((v) => !v);
  }

  @HostListener('document:click')
  closeDropdownOnOutsideClick(): void {
    this.wsDropdownOpen.set(false);
    this.tabContextMenu.set(null);
  }

  onTabContextMenu(ev: MouseEvent, tab: UiTab): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.tabContextMenu.set({ x: ev.clientX, y: ev.clientY, tab });
  }

  closeTabMenu(): void {
    this.tabContextMenu.set(null);
  }

  async menuDuplicate(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    if (tab.kind === 'browser') await this.tabs.duplicateTab(tab.id);
  }

  async menuExplainSelection(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    if (tab.kind !== 'browser') return;
    await this.tabs.selectTab(tab.id, false);
    let sel = '';
    try {
      sel = (await this.tabs.executeJavaScriptInActive(
        '(function(){try{return window.getSelection().toString()||"";}catch(e){return""}})()',
      )) as string;
    } catch {
      /* ignore */
    }
    const t = sel.trim();
    if (!t) {
      this.toast.show('Select some text in the page first, then try again.');
      return;
    }
    this.widgets.select('ai');
    this.layout.openRightSidebar();
    this.pageAi.emitUserMessage(
      'Explain the following text from the page in simple terms:\n\n' + t.slice(0, 8000),
    );
  }

  async menuInspectElement(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    if (tab.kind !== 'browser') return;
    await this.tabs.selectTab(tab.id, false);
    await this.tabs.inspectGuestElement();
  }

  async menuTogglePin(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    await this.tabs.setPinned(tab.id, !tab.pinned);
  }

  async menuMoveTo(tab: UiTab, workspaceId: string): Promise<void> {
    this.closeTabMenu();
    await this.tabs.moveTabToWorkspace(tab.id, workspaceId);
  }

  async menuClose(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    await this.tabs.closeTab(tab.id);
  }

  async menuCloseOthers(tab: UiTab): Promise<void> {
    this.closeTabMenu();
    await this.tabs.closeOtherTabs(tab.id);
  }

  async switchWorkspace(id: string): Promise<void> {
    this.wsDropdownOpen.set(false);
    await this.workspace.setActiveWorkspace(id);
    this.automation.onWorkspaceActivated(id);
    const first = this.tabs.tabs().find((t) => t.workspaceId === id);
    if (first) await this.tabs.selectTab(first.id, false);
    else await this.tabs.addInternalTab('new-tab', 'New Tab', false);
  }

  openNewWorkspaceDialog(): void {
    this.wsDropdownOpen.set(false);
    this.dialog.set({ type: 'workspace', value: '', color: '#58a6ff' });
  }

  toggleSelectMode(): void {
    this.selectMode.update((v) => !v);
    if (!this.selectMode()) this.selectedTabIds.set(new Set());
  }

  toggleTabSelection(tabId: string): void {
    this.selectedTabIds.update((s) => {
      const next = new Set(s);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  }

  openNewGroupDialog(): void {
    if (this.selectMode() && this.canGroup()) {
      this.dialog.set({ type: 'group', value: '' });
    } else {
      this.selectMode.set(true);
      this.toast.show('Select 2 or more tabs, then click GROUP.');
    }
  }

  dismissDialog(): void {
    this.dialog.set(null);
  }

  setDialogValue(value: string): void {
    this.dialog.update((d) => (d ? { ...d, value } : d));
  }

  setWorkspaceDialogColor(color: string): void {
    this.dialog.update((d) => (d?.type === 'workspace' ? { ...d, color } : d));
  }

  async confirmDialog(): Promise<void> {
    const d = this.dialog();
    if (!d || !d.value.trim()) {
      this.dialog.set(null);
      return;
    }
    const val = d.value.trim();
    this.dialog.set(null);
    if (d.type === 'workspace') {
      await this.workspace.createWorkspace(val, d.color ?? '#58a6ff');
    } else {
      const selectedIds = [...this.selectedTabIds()];
      await this.tabs.addTabGroup(
        val,
        '#f0883e',
        selectedIds.length >= 2 ? selectedIds : undefined,
      );
      this.selectedTabIds.set(new Set());
      this.selectMode.set(false);
    }
  }

  dialogKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') void this.confirmDialog();
    if (ev.key === 'Escape') this.dismissDialog();
  }

  onTabDragEnd(ev: CdkDragEnd, tab: UiTab): void {
    if (tab.kind !== 'browser') return;
    const el = ev.source.getRootElement();
    const r = el.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const w = window.innerWidth;
    if (cx <= w * 0.88) return;
    const browsers = this.tabs.visibleTabs().filter((t) => t.kind === 'browser');
    if (browsers.length < 2) return;
    if (tab.id === this.tabs.activeTabId()) {
      const other = browsers.find((t) => t.id !== tab.id);
      if (!other) return;
      void this.tabs.selectTab(other.id, true);
    }
    this.splitView.secondaryTabId.set(tab.id);
    this.splitView.enabled.set(true);
  }

  drop(ev: CdkDragDrop<TabListItem[]>): void {
    if (this.tabFilter().trim()) return;
    const tabItems = this.groupedItems()
      .filter((i): i is Extract<TabListItem, { type: 'tab' }> => i.type === 'tab')
      .map((i) => i.tab.id);
    moveItemInArray(tabItems, ev.previousIndex, ev.currentIndex);
    this.tabs.reorderVisibleTabs(tabItems);
  }

  tabTitle(t: { title: string; url: string }): string {
    return t.title?.trim() || t.url || 'Tab';
  }

  faviconUrl(tab: UiTab): string {
    if (tab.kind === 'internal') return '';
    try {
      const domain = new URL(tab.url).hostname;
      if (!domain) return '';
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return '';
    }
  }

  tabEmoji(tab: UiTab): string {
    if (tab.kind === 'internal') {
      if (tab.internalRoute === 'settings') return '⚙';
      return '⌂';
    }
    return '';
  }

  openWidget(id: string): void {
    this.widgets.select(id);
    this.layout.openRightSidebar();
  }

  openSettings(): void {
    void this.tabs.addInternalTab('settings', 'Settings');
  }
}
