import { Injectable, inject } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';

/** Default shortcuts (canonical combo string: modifiers + key, lowercase). */
export const SHORTCUT_DEFAULTS: Record<string, string> = {
  spotlight: 'ctrl+k',
  newTab: 'ctrl+t',
  closeTab: 'ctrl+w',
  cycleTabNext: 'ctrl+tab',
  cycleTabPrev: 'ctrl+shift+tab',
  toggleSplit: 'ctrl+shift+\\',
  focusMode: 'ctrl+alt+f',
  toggleDevtools: 'ctrl+shift+i',
  inspectElement: 'ctrl+shift+c',
};

export function normalizeShortcutBinding(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/\+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => {
      const order = (x: string): number => {
        if (x === 'ctrl' || x === 'meta' || x === 'cmd') return 0;
        if (x === 'alt') return 1;
        if (x === 'shift') return 2;
        return 3;
      };
      const d = order(a) - order(b);
      return d !== 0 ? d : a.localeCompare(b);
    })
    .map((p) => (p === 'meta' || p === 'cmd' ? 'ctrl' : p))
    .join('+');
}

function comboFromEvent(ev: KeyboardEvent): string | null {
  const keyRaw = ev.key;
  const k =
    keyRaw === 'Tab'
      ? 'tab'
      : keyRaw === ' '
        ? 'space'
        : keyRaw === '\\' || keyRaw === '|'
          ? '\\'
          : keyRaw.length === 1
            ? keyRaw.toLowerCase()
            : keyRaw.toLowerCase();

  const parts: string[] = [];
  if (ev.ctrlKey || ev.metaKey) parts.push('ctrl');
  if (ev.altKey) parts.push('alt');
  if (ev.shiftKey) parts.push('shift');
  parts.push(k);
  return normalizeShortcutBinding(parts.join('+'));
}

/** Effective bindings: defaults overridden by `custom`. */
export function buildMergedShortcutBindings(
  custom: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = { ...SHORTCUT_DEFAULTS };
  for (const [action, bound] of Object.entries(custom)) {
    if (typeof bound === 'string' && bound.trim()) merged[action] = bound;
  }
  return merged;
}

/** Human-readable lines listing actions that share the same combo. */
export function describeShortcutConflicts(merged: Record<string, string>): string[] {
  const byCombo = new Map<string, string[]>();
  for (const [action, bound] of Object.entries(merged)) {
    const c = normalizeShortcutBinding(bound);
    if (!byCombo.has(c)) byCombo.set(c, []);
    byCombo.get(c)!.push(action);
  }
  const out: string[] = [];
  for (const actions of byCombo.values()) {
    if (actions.length > 1) out.push(`${actions.join(' ↔ ')} share the same combo`);
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class ShortcutRegistryService {
  private readonly persisted = inject(PersistedStateService);

  /** Returns shortcut action id if the event matches a merged binding, else null. */
  matchAction(ev: KeyboardEvent): string | null {
    const combo = comboFromEvent(ev);
    if (!combo) return null;
    const custom = this.persisted.snapshot()?.settings.shortcutBindings ?? {};
    const merged = buildMergedShortcutBindings(custom);
    for (const [action, bound] of Object.entries(merged)) {
      if (normalizeShortcutBinding(bound) === combo) return action;
    }
    return null;
  }

  /** Human-readable combo for Settings (uses Ctrl for display on all platforms). */
  displayCombo(bound: string): string {
    return bound
      .split('+')
      .map((p) => (p === 'ctrl' ? 'Ctrl' : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('+');
  }
}
