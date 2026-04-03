import { Injectable, computed, inject, signal } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';
import { TabsService } from './tabs.service';

function hostnameFromUrl(url: string): string | null {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatchesTabHost(tabHost: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  const core = p.replace(/^\*\./, '');
  return tabHost === core || tabHost.endsWith(`.${core}`);
}

/** Distraction-free layout: hides sidebars and top bar; Escape exits. */
@Injectable({ providedIn: 'root' })
export class FocusModeService {
  private readonly tabs = inject(TabsService);
  private readonly persisted = inject(PersistedStateService);

  readonly enabled = signal(false);

  private pomodoroTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * When true, shell applies focus chrome hiding. Allowlisted active tab hosts
   * keep normal chrome while focus mode stays “on” (timer + exit control).
   */
  readonly hidesChrome = computed(() => {
    if (!this.enabled()) return false;
    const raw = this.persisted.snapshot()?.settings.focusModeAllowlistHosts ?? [];
    const list = raw.map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return true;
    const tab = this.tabs.activeTab();
    if (!tab || tab.kind !== 'browser') return true;
    const host = hostnameFromUrl(tab.url);
    if (!host) return true;
    return !list.some((pat) => hostMatchesTabHost(host, pat));
  });

  toggle(): void {
    const next = !this.enabled();
    this.enabled.set(next);
    if (next) this.armPomodoro();
    else this.clearPomodoro();
  }

  disable(): void {
    this.clearPomodoro();
    this.enabled.set(false);
  }

  private clearPomodoro(): void {
    if (this.pomodoroTimer !== null) {
      clearTimeout(this.pomodoroTimer);
      this.pomodoroTimer = null;
    }
  }

  private armPomodoro(): void {
    this.clearPomodoro();
    const mins = this.persisted.snapshot()?.settings.focusPomodoroMinutes ?? 0;
    if (mins <= 0) return;
    this.pomodoroTimer = setTimeout(() => {
      this.pomodoroTimer = null;
      try {
        new Notification('Dev-Lens', { body: 'Focus session timer elapsed.' });
      } catch {
        /* ignore (no permission / non-secure context) */
      }
    }, mins * 60_000);
  }
}
