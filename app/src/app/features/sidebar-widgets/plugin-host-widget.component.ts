import { NO_ERRORS_SCHEMA, Component, computed, inject, input } from '@angular/core';
import { PluginRuntimeService } from '@core/services/plugin-runtime.service';

@Component({
  selector: 'app-plugin-host-widget',
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    @if (src()) {
      <webview
        class="plugin-host__wv"
        [attr.src]="src()!"
        [attr.partition]="partition()"
        allowpopups
      ></webview>
    } @else {
      <p class="plugin-host__empty">Plugin not loaded.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    .plugin-host__wv {
      flex: 1;
      width: 100%;
      border: none;
    }
    .plugin-host__empty {
      padding: 12px;
      color: var(--dl-muted);
      font-size: 13px;
    }
  `,
})
export class PluginHostWidgetComponent {
  private readonly runtime = inject(PluginRuntimeService);

  /** Manifest id (no plugin: prefix). */
  readonly pluginId = input.required<string>();

  readonly src = computed(() => {
    const id = this.pluginId();
    const p = this.runtime.sidebarPlugins().find((x) => x.id === id);
    if (!p?.entryBaseUrl) return null;
    try {
      const u = new URL(p.entryBaseUrl);
      u.searchParams.set('devLensPluginId', id);
      return u.href;
    } catch {
      return null;
    }
  });

  readonly partition = computed(() => `persist:dev-lens-plugin-${this.pluginId()}`);
}
