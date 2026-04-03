import { Injectable, signal } from '@angular/core';
import type { TabsService } from './tabs.service';

/**
 * Split-view: two browser panes side by side (primary = active tab, secondary = chosen tab).
 */
@Injectable({ providedIn: 'root' })
export class SplitViewService {
  readonly enabled = signal(false);

  /** Fraction of width for the primary (left) pane, 0–1. */
  readonly primaryRatio = signal(0.5);

  /** Second browser tab shown in the right pane when split is on. */
  readonly secondaryTabId = signal<string | null>(null);

  attemptToggle(tabs: TabsService): void {
    if (this.enabled()) {
      this.enabled.set(false);
      this.secondaryTabId.set(null);
      return;
    }
    const browsers = tabs.visibleTabs().filter((t) => t.kind === 'browser');
    if (browsers.length < 2) return;
    const activeId = tabs.activeTabId();
    const other = browsers.find((t) => t.id !== activeId);
    if (!other) return;
    this.secondaryTabId.set(other.id);
    this.enabled.set(true);
  }

  reconcile(tabs: TabsService): void {
    if (!this.enabled()) return;
    const active = tabs.activeTab();
    const sec = this.secondaryTabId();
    const browsers = tabs.visibleTabs().filter((t) => t.kind === 'browser');
    if (browsers.length < 2) {
      this.enabled.set(false);
      this.secondaryTabId.set(null);
      return;
    }
    if (
      active?.kind === 'browser' &&
      sec &&
      sec !== active.id &&
      browsers.some((t) => t.id === sec)
    ) {
      return;
    }
    const pick = browsers.find((t) => t.id !== active?.id) ?? null;
    this.secondaryTabId.set(pick?.id ?? null);
    if (!pick) this.enabled.set(false);
  }

  setRatio(ratio: number): void {
    const r = Math.min(0.85, Math.max(0.15, ratio));
    this.primaryRatio.set(r);
  }
}
