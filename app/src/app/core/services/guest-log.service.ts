import { Injectable, computed, inject, signal } from '@angular/core';
import { workspaceBrowserPartition } from '@dev-lens/shared';
import { TabsService } from './tabs.service';

export interface GuestConsoleLine {
  tabId: string;
  level: string;
  msg: string;
  t: number;
  source: 'guest' | 'repl';
}

export interface NetworkLogLine {
  partition: string;
  method: string;
  url: string;
  statusCode: number;
  t: number;
  /** Chromium resource type from `webRequest` (e.g. `xhr`, `script`, `mainFrame`). */
  resourceType: string;
}

const MAX_CONSOLE = 400;
const MAX_NET = 300;

@Injectable({ providedIn: 'root' })
export class GuestLogService {
  private readonly tabs = inject(TabsService);

  private readonly consoleLines = signal<GuestConsoleLine[]>([]);
  private readonly networkLines = signal<NetworkLogLine[]>([]);

  /** `all` or a Chromium `resourceType` value (`xhr`, `mainFrame`, …). */
  readonly networkResourceFilter = signal<string>('all');

  readonly activePartition = computed(() => {
    const t = this.tabs.activeTab();
    if (!t || t.kind !== 'browser') return null;
    return workspaceBrowserPartition(t.workspaceId);
  });

  readonly filteredConsole = computed(() => {
    const id = this.tabs.activeTabId();
    if (!id) return [];
    return this.consoleLines()
      .filter((l) => l.tabId === id)
      .sort((a, b) => a.t - b.t);
  });

  readonly filteredNetwork = computed(() => {
    const p = this.activePartition();
    if (!p) return [];
    const f = this.networkResourceFilter();
    let rows = this.networkLines().filter((l) => l.partition === p);
    if (f !== 'all') {
      rows = rows.filter((l) => (l.resourceType || 'other') === f);
    }
    return rows.sort((a, b) => b.t - a.t).slice(0, 150);
  });

  pushGuest(tabId: string, payload: { level?: string; msg?: string; t?: number }): void {
    const level = payload.level ?? 'log';
    const msg = payload.msg ?? '';
    const t = payload.t ?? Date.now();
    this.consoleLines.update((list) =>
      [{ tabId, level, msg, t, source: 'guest' as const }, ...list].slice(0, MAX_CONSOLE),
    );
  }

  pushRepl(tabId: string, level: 'info' | 'error' | 'result', text: string): void {
    const t = Date.now();
    this.consoleLines.update((list) =>
      [{ tabId, level, msg: text, t, source: 'repl' as const }, ...list].slice(0, MAX_CONSOLE),
    );
  }

  pushNetwork(line: NetworkLogLine): void {
    const normalized: NetworkLogLine = {
      ...line,
      resourceType: line.resourceType || 'other',
    };
    this.networkLines.update((list) => [normalized, ...list].slice(0, MAX_NET));
  }

  setNetworkResourceFilter(value: string): void {
    this.networkResourceFilter.set(value);
  }

  clearConsoleForActiveTab(): void {
    const id = this.tabs.activeTabId();
    if (!id) return;
    this.consoleLines.update((list) => list.filter((l) => l.tabId !== id));
  }

  clearNetworkForActivePartition(): void {
    const p = this.activePartition();
    if (!p) return;
    this.networkLines.update((list) => list.filter((l) => l.partition !== p));
  }

  clearTab(tabId: string): void {
    this.consoleLines.update((list) => list.filter((l) => l.tabId !== tabId));
  }

  exportHarForActivePartition(): string {
    const p = this.activePartition();
    const lines = p ? this.networkLines().filter((l) => l.partition === p) : [];
    const started =
      lines.length > 0
        ? new Date(Math.min(...lines.map((l) => l.t))).toISOString()
        : new Date().toISOString();
    const entries = lines.map((l) => ({
      startedDateTime: new Date(l.t).toISOString(),
      time: 0,
      comment: `resourceType:${l.resourceType || 'other'}`,
      request: { method: l.method, url: l.url, httpVersion: 'HTTP/1.1', headers: [] },
      response: { status: l.statusCode, statusText: '', httpVersion: 'HTTP/1.1', headers: [] },
    }));
    return JSON.stringify(
      {
        log: {
          version: '1.2',
          creator: { name: 'Dev-Lens' },
          pages: [],
          entries,
          startedDateTime: started,
        },
      },
      null,
      2,
    );
  }
}
