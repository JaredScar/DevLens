import { Injectable, signal } from '@angular/core';

/**
 * Coordinates sidebar drag-resize with any native overlay (e.g. the DevTools
 * BrowserView) that needs to be hidden/restored around the drag.
 *
 * Components that manage native overlays call `registerOverlayCallbacks()` to
 * supply hide/restore functions.  The right-sidebar calls `beginResize()` and
 * `endResize()` which invoke those callbacks SYNCHRONOUSLY — before any
 * mousemove event can reach the native overlay and steal pointer capture.
 */
@Injectable({ providedIn: 'root' })
export class ResizeStateService {
  readonly isSidebarResizing = signal(false);

  private hideCallback: (() => void) | null = null;
  private restoreCallback: (() => void) | null = null;

  registerOverlayCallbacks(hide: () => void, restore: () => void): void {
    this.hideCallback = hide;
    this.restoreCallback = restore;
  }

  /**
   * Called on mousedown — hides the overlay immediately (synchronous IPC fire)
   * and sets the resizing signal so Angular effects can also react.
   */
  beginResize(): void {
    this.isSidebarResizing.set(true);
    this.hideCallback?.();
  }

  /**
   * Called on mouseup — restores the overlay to the new position and clears
   * the resizing signal.
   */
  endResize(): void {
    this.isSidebarResizing.set(false);
    this.restoreCallback?.();
  }
}
