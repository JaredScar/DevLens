import { Injectable, signal } from '@angular/core';

/** Last pointer position inside each guest webview (viewport coordinates) for inspectElement. */
@Injectable({ providedIn: 'root' })
export class InspectPointerService {
  private readonly byTab = signal<Record<string, { x: number; y: number }>>({});

  record(tabId: string, x: number, y: number): void {
    this.byTab.update((m) => ({ ...m, [tabId]: { x, y } }));
  }

  peek(tabId: string): { x: number; y: number } {
    const p = this.byTab()[tabId];
    return p ?? { x: 48, y: 48 };
  }
}
