import { Injectable, inject, signal } from '@angular/core';
import { IPC_CHANNELS } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';

export interface DiscoveredPluginUi {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  sidebarTitle: string;
  entryBaseUrl: string;
  bundled: boolean;
  enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PluginRuntimeService {
  private readonly bridge = inject(ElectronBridgeService);

  /** Plugins that are enabled (shown in sidebar). */
  readonly sidebarPlugins = signal<DiscoveredPluginUi[]>([]);
  /** Full discovery list (Settings UI). */
  readonly allPlugins = signal<DiscoveredPluginUi[]>([]);

  async refresh(): Promise<void> {
    if (!this.bridge.isElectron) {
      this.sidebarPlugins.set([]);
      this.allPlugins.set([]);
      return;
    }
    const r = await this.bridge.invoke<{ plugins: DiscoveredPluginUi[] }>(
      IPC_CHANNELS.PLUGIN_DISCOVER,
    );
    const list = r.plugins ?? [];
    this.allPlugins.set(list);
    this.sidebarPlugins.set(list.filter((p) => p.enabled));
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    if (!this.bridge.isElectron) return;
    const res = await this.bridge.invoke<{ ok?: boolean }>(IPC_CHANNELS.PLUGIN_SET_ENABLED, {
      id,
      enabled,
    });
    if (res && typeof res === 'object' && 'ok' in res && res.ok === false) return;
    await this.refresh();
  }
}
