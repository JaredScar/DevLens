import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { DevLensFeatureWidgetFlags } from '@dev-lens/shared';
import { FeatureFlagsService } from './feature-flags.service';
import { PluginRuntimeService } from './plugin-runtime.service';

export interface SidebarWidgetDescriptor {
  id: string;
  title: string;
  order: number;
}

export const WIDGET_IDS = [
  'bookmarks',
  'notes',
  'ai',
  'console',
  'clipboard',
  'sessions',
  'api',
  'history',
  'readlater',
  'perf',
  'json',
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

const WIDGET_FLAG: Record<string, keyof DevLensFeatureWidgetFlags> = {
  bookmarks: 'bookmarks',
  notes: 'notes',
  ai: 'ai',
  console: 'console',
  clipboard: 'clipboard',
  sessions: 'sessions',
  api: 'api',
  history: 'history',
  readlater: 'readlater',
  perf: 'perf',
  json: 'json',
};

@Injectable({ providedIn: 'root' })
export class WidgetRegistryService {
  private readonly plugins = inject(PluginRuntimeService);
  private readonly features = inject(FeatureFlagsService);

  private readonly _builtins: SidebarWidgetDescriptor[] = [
    { id: 'bookmarks', title: 'Bookmarks', order: -1 },
    { id: 'notes', title: 'Notes', order: 0 },
    { id: 'ai', title: 'AI Assistant', order: 1 },
    { id: 'console', title: 'Console', order: 2 },
    { id: 'clipboard', title: 'Clipboard', order: 3 },
    { id: 'sessions', title: 'Sessions', order: 4 },
    { id: 'api', title: 'API Tester', order: 5 },
    { id: 'history', title: 'History', order: 6 },
    { id: 'readlater', title: 'Read later', order: 7 },
    { id: 'perf', title: 'Performance', order: 8 },
    { id: 'json', title: 'JSON', order: 9 },
  ];

  /** Built-in + plugin widgets visible with current feature flags (empty if right sidebar off). */
  readonly widgets = computed(() => {
    const ff = this.features.flags();
    if (!ff.rightSidebar) return [];
    const extra = this.plugins.sidebarPlugins().map((p, i) => ({
      id: `plugin:${p.id}`,
      title: p.sidebarTitle,
      order: 100 + i,
    }));
    const combined = [...this._builtins, ...extra].sort((a, b) => a.order - b.order);
    return combined.filter((w) => {
      if (w.id.startsWith('plugin:')) return true;
      const key = WIDGET_FLAG[w.id];
      return key ? ff.widgets[key] : true;
    });
  });

  readonly activeId = signal<string>('notes');

  constructor() {
    effect(() => {
      const list = this.widgets();
      if (list.length === 0) {
        this.activeId.set('');
        return;
      }
      const cur = this.activeId();
      if (cur && list.some((w) => w.id === cur)) return;
      this.activeId.set(list[0]!.id);
    });
  }

  select(id: string): void {
    if (!this.widgets().some((w) => w.id === id)) return;
    this.activeId.set(id);
  }
}
