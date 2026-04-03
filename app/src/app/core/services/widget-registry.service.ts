import { Injectable, computed, inject, signal } from '@angular/core';
import { PluginRuntimeService } from './plugin-runtime.service';

export interface SidebarWidgetDescriptor {
  id: string;
  title: string;
  order: number;
}

export const WIDGET_IDS = [
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

@Injectable({ providedIn: 'root' })
export class WidgetRegistryService {
  private readonly plugins = inject(PluginRuntimeService);

  private readonly _builtins: SidebarWidgetDescriptor[] = [
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

  readonly widgets = computed(() => {
    const extra = this.plugins.sidebarPlugins().map((p, i) => ({
      id: `plugin:${p.id}`,
      title: p.sidebarTitle,
      order: 100 + i,
    }));
    return [...this._builtins, ...extra].sort((a, b) => a.order - b.order);
  });

  readonly activeId = signal<string>('notes');

  select(id: string): void {
    const okBuiltin = this._builtins.some((w) => w.id === id);
    const okPlugin =
      id.startsWith('plugin:') &&
      this.plugins.sidebarPlugins().some((p) => `plugin:${p.id}` === id);
    if (okBuiltin || okPlugin) {
      this.activeId.set(id);
    }
  }
}
