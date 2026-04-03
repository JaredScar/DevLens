import { Injectable, inject, signal, effect } from '@angular/core';
import { PersistedStateService } from './persisted-state.service';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly persisted = inject(PersistedStateService);

  readonly leftSidebarCollapsed = signal(false);
  readonly rightSidebarOpen = signal(false);
  readonly rightSidebarWidthPx = signal(260);

  constructor() {
    effect(() => {
      const w = this.persisted.snapshot()?.settings.rightSidebarWidthPx;
      if (typeof w === 'number' && w >= 200 && w <= 560) {
        this.rightSidebarWidthPx.set(w);
      }
    });
    effect(() => {
      const px = this.rightSidebarWidthPx();
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--dl-right-sidebar-width', `${px}px`);
      }
    });
  }

  toggleLeftSidebar(): void {
    this.leftSidebarCollapsed.update((v) => !v);
  }

  toggleRightSidebar(): void {
    this.rightSidebarOpen.update((v) => !v);
  }

  openRightSidebar(): void {
    this.rightSidebarOpen.set(true);
  }

  closeRightSidebar(): void {
    this.rightSidebarOpen.set(false);
  }

  /**
   * Update the sidebar width signal AND the CSS variable synchronously.
   * Setting the CSS variable directly here ensures the layout responds on the
   * same frame as the call — no Angular change-detection cycle in between.
   */
  setRightSidebarWidthPx(px: number): void {
    const clamped = Math.min(560, Math.max(200, Math.round(px)));
    this.rightSidebarWidthPx.set(clamped);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--dl-right-sidebar-width', `${clamped}px`);
    }
  }

  /** Persist the current sidebar width to the store (call only on mouseup). */
  async saveRightSidebarWidth(): Promise<void> {
    const clamped = this.rightSidebarWidthPx();
    const cur = this.persisted.snapshot()?.settings;
    if (!cur) return;
    await this.persisted.patch({ settings: { ...cur, rightSidebarWidthPx: clamped } });
  }
}
