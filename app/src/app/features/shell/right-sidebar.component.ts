import { Component, HostListener, inject } from '@angular/core';
import { LayoutService } from '@core/services/layout.service';
import { PluginRuntimeService } from '@core/services/plugin-runtime.service';
import { ResizeStateService } from '@core/services/resize-state.service';
import { WidgetRegistryService } from '@core/services/widget-registry.service';
import { NotesWidgetComponent } from '@features/sidebar-widgets/notes-widget.component';
import { BookmarksWidgetComponent } from '@features/sidebar-widgets/bookmarks-widget.component';
import { AiWidgetComponent } from '@features/sidebar-widgets/ai-widget.component';
import { ConsoleWidgetComponent } from '@features/sidebar-widgets/console-widget.component';
import { ClipboardWidgetComponent } from '@features/sidebar-widgets/clipboard-widget.component';
import { SessionsWidgetComponent } from '@features/sidebar-widgets/sessions-widget.component';
import { ApiTesterWidgetComponent } from '@features/sidebar-widgets/api-tester-widget.component';
import { HistoryWidgetComponent } from '@features/sidebar-widgets/history-widget.component';
import { JsonFormatterWidgetComponent } from '@features/sidebar-widgets/json-formatter-widget.component';
import { PerformanceWidgetComponent } from '@features/sidebar-widgets/performance-widget.component';
import { PluginHostWidgetComponent } from '@features/sidebar-widgets/plugin-host-widget.component';
import { ReadLaterWidgetComponent } from '@features/sidebar-widgets/read-later-widget.component';

@Component({
  selector: 'app-right-sidebar',
  imports: [
    NotesWidgetComponent,
    BookmarksWidgetComponent,
    AiWidgetComponent,
    ConsoleWidgetComponent,
    ClipboardWidgetComponent,
    SessionsWidgetComponent,
    ApiTesterWidgetComponent,
    HistoryWidgetComponent,
    ReadLaterWidgetComponent,
    PerformanceWidgetComponent,
    JsonFormatterWidgetComponent,
    PluginHostWidgetComponent,
  ],
  templateUrl: './right-sidebar.component.html',
  styleUrl: './right-sidebar.component.scss',
})
export class RightSidebarComponent {
  readonly layout = inject(LayoutService);
  readonly widgets = inject(WidgetRegistryService);
  readonly pluginRuntime = inject(PluginRuntimeService);
  private readonly resizeState = inject(ResizeStateService);

  private resizing = false;
  private resizeStartX = 0;
  private resizeStartW = 0;

  onResizeDown(ev: MouseEvent): void {
    ev.preventDefault();
    this.resizing = true;
    this.resizeStartX = ev.clientX;
    this.resizeStartW = this.layout.rightSidebarWidthPx();
    // beginResize() synchronously:
    //   1. hides the BrowserView DevTools overlay (via registered callback)
    //   2. sets isSidebarResizing signal
    // This must happen BEFORE any mousemove fires so the BrowserView cannot
    // intercept pointer events during the drag.
    this.resizeState.beginResize();
    // Block webviews from capturing mouse events — same as split-view drag.
    document.querySelectorAll<HTMLElement>('webview').forEach((w) => {
      w.style.pointerEvents = 'none';
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(ev: MouseEvent): void {
    if (!this.resizing) return;
    const delta = this.resizeStartX - ev.clientX;
    const clamped = Math.min(560, Math.max(200, Math.round(this.resizeStartW + delta)));
    // Write CSS variable directly (same as split-view) — no Angular CD per frame.
    document.documentElement.style.setProperty('--dl-right-sidebar-width', `${clamped}px`);
  }

  @HostListener('document:mouseup')
  onResizeUp(): void {
    if (!this.resizing) return;
    this.resizing = false;
    // Restore webview pointer events.
    document.querySelectorAll<HTMLElement>('webview').forEach((w) => {
      w.style.pointerEvents = '';
    });
    // Read final width from DOM and commit to signal + store.
    const raw = parseInt(
      document.documentElement.style.getPropertyValue('--dl-right-sidebar-width'),
      10,
    );
    const finalW = isNaN(raw)
      ? this.layout.rightSidebarWidthPx()
      : Math.min(560, Math.max(200, raw));
    this.layout.setRightSidebarWidthPx(finalW);
    // endResize() synchronously:
    //   1. restores the BrowserView overlay to new position (via callback)
    //   2. clears isSidebarResizing signal
    this.resizeState.endResize();
    void this.layout.saveRightSidebarWidth();
  }

  close(): void {
    this.layout.closeRightSidebar();
  }

  pick(id: string): void {
    this.widgets.select(id);
    this.layout.openRightSidebar();
  }
}
