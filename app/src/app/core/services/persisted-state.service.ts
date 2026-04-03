import { Injectable, inject, signal } from '@angular/core';
import { IPC_CHANNELS, type DevLensStoreSnapshot } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class PersistedStateService {
  private readonly bridge = inject(ElectronBridgeService);

  readonly snapshot = signal<DevLensStoreSnapshot | null>(null);

  async hydrate(): Promise<void> {
    if (!this.bridge.isElectron) return;
    const data = await this.bridge.invoke<DevLensStoreSnapshot>(IPC_CHANNELS.STORE_GET);
    this.snapshot.set(data);
  }

  async patch(partial: Partial<DevLensStoreSnapshot>): Promise<void> {
    if (!this.bridge.isElectron) return;
    const res = await this.bridge.invoke<{ ok?: boolean; error?: string }>(
      IPC_CHANNELS.STORE_PATCH,
      partial,
    );
    if (res && typeof res === 'object' && 'ok' in res && res.ok === false) {
      throw new Error(res.error ?? 'Store update rejected');
    }
    await this.hydrate();
  }
}
