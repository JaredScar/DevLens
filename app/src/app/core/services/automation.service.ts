import { Injectable, inject } from '@angular/core';
import type { AutomationRuleDTO } from '@dev-lens/shared';
import { FeatureFlagsService } from './feature-flags.service';
import { LayoutService } from './layout.service';
import { PersistedStateService } from './persisted-state.service';
import { TabsService } from './tabs.service';
import { WidgetRegistryService } from './widget-registry.service';
import { WorkspaceService } from './workspace.service';

function parseTimeWindow(raw: string): [number, number] | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = Number(m[3]) * 60 + Number(m[4]);
  if (a < 0 || a > 24 * 60 || b < 0 || b > 24 * 60) return null;
  return [a, b];
}

function minutesInLocalDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function inTimeWindow(start: number, end: number, now: number): boolean {
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function normalizeBlockHost(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  try {
    if (t.includes('://')) {
      const h = new URL(t).hostname.toLowerCase();
      return h || null;
    }
  } catch {
    /* fall through */
  }
  return (
    t
      .replace(/^www\./, '')
      .split('/')[0]
      ?.trim() || null
  );
}

@Injectable({ providedIn: 'root' })
export class AutomationService {
  private readonly persisted = inject(PersistedStateService);
  private readonly layout = inject(LayoutService);
  private readonly widgets = inject(WidgetRegistryService);
  private readonly features = inject(FeatureFlagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tabs = inject(TabsService);

  /** Previous evaluation: rule id → was inside time window. */
  private readonly wasInTimeWindow = new Map<string, boolean>();

  constructor() {
    queueMicrotask(() => this.evaluateTimeWindowTransition());
    window.setInterval(() => this.evaluateTimeWindowTransition(), 60_000);
  }

  /** Run enabled rules when the active browser tab navigates. */
  onBrowserUrl(url: string): void {
    if (!this.features.data('automation')) return;
    const rules = this.persisted.snapshot()?.automationRules ?? [];
    for (const r of rules) {
      if (!r.enabled || r.triggerType !== 'url_contains') continue;
      const needle = r.triggerValue.trim();
      if (!needle || !url.includes(needle)) continue;
      this.applyAction(r);
    }
  }

  /** Run enabled rules after the active workspace changes. */
  onWorkspaceActivated(workspaceId: string): void {
    if (!this.features.data('automation')) return;
    const rules = this.persisted.snapshot()?.automationRules ?? [];
    for (const r of rules) {
      if (!r.enabled || r.triggerType !== 'workspace_active') continue;
      if (r.triggerValue.trim() !== workspaceId) continue;
      this.applyAction(r);
    }
  }

  /** Fire once when local time enters a `time_window` (edge-triggered). */
  private evaluateTimeWindowTransition(): void {
    if (!this.features.data('automation')) return;
    const rules = this.persisted.snapshot()?.automationRules ?? [];
    const now = minutesInLocalDay();
    for (const r of rules) {
      if (!r.enabled || r.triggerType !== 'time_window') continue;
      const win = parseTimeWindow(r.triggerValue);
      if (!win) continue;
      const [a, b] = win;
      const inside = inTimeWindow(a, b, now);
      const prev = this.wasInTimeWindow.get(r.id) ?? false;
      if (inside && !prev) this.applyAction(r);
      this.wasInTimeWindow.set(r.id, inside);
    }
  }

  private applyAction(rule: AutomationRuleDTO): void {
    switch (rule.actionType) {
      case 'open_widget': {
        const id = rule.actionValue.trim();
        if (this.widgets.widgets().some((w) => w.id === id)) {
          this.widgets.select(id);
          this.layout.openRightSidebar();
        }
        break;
      }
      case 'switch_workspace': {
        const id = rule.actionValue.trim();
        if (this.workspace.workspaces().some((w) => w.id === id)) {
          void this.workspace.setActiveWorkspace(id);
        }
        break;
      }
      case 'run_javascript': {
        const code = rule.actionValue.trim();
        if (!code) break;
        void this.tabs.executeJavaScriptInActive(code);
        break;
      }
      case 'block_hostname': {
        const host = normalizeBlockHost(rule.actionValue);
        if (!host) break;
        const cur = this.persisted.snapshot()?.settings;
        if (!cur) break;
        const nextHosts = [...new Set([...(cur.userBlockedHosts ?? []), host])];
        void this.persisted.patch({ settings: { ...cur, userBlockedHosts: nextHosts } });
        break;
      }
      default:
        break;
    }
  }
}
