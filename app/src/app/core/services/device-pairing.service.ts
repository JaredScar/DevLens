/**
 * Device pairing service for QR-code cross-device sync (Phase 3.3).
 */
import { Injectable, inject, signal } from '@angular/core';
import { IPC_CHANNELS, IPC_EVENTS } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';
import { ToastService } from './toast.service';
import type { PairedDeviceDTO } from '@dev-lens/shared';

export interface PairingResult {
  pairingCode: string;
  qrDataUrl: string;
  expiresAt: number;
}

export interface DeviceConnectionEvent {
  deviceId: string;
  deviceName: string;
}

@Injectable({ providedIn: 'root' })
export class DevicePairingService {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly toast = inject(ToastService);

  readonly pairedDevices = signal<PairedDeviceDTO[]>([]);
  readonly currentPairing = signal<PairingResult | null>(null);
  readonly isLoading = signal(false);

  constructor() {
    this.loadDevices();
    this.listenForDeviceConnections();
  }

  /** Generate a new pairing QR code. */
  async generatePairing(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.bridge.invoke<PairingResult>(IPC_CHANNELS.PAIRING_GENERATE);
      this.currentPairing.set(result);
    } catch {
      this.toast.show('Failed to generate pairing code', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Complete pairing with a code (called on the receiving device). */
  async completePairing(pairingCode: string, deviceName: string): Promise<boolean> {
    this.isLoading.set(true);
    try {
      const result = await this.bridge.invoke<{ success: boolean; error?: string }>(
        IPC_CHANNELS.PAIRING_COMPLETE,
        { pairingCode, deviceName },
      );

      if (result.success) {
        this.toast.show(`Paired with ${deviceName}`, 'success');
        await this.loadDevices();
        return true;
      } else {
        this.toast.show(result.error || 'Pairing failed', 'error');
        return false;
      }
    } catch {
      this.toast.show('Pairing failed', 'error');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Load all paired devices. */
  async loadDevices(): Promise<void> {
    try {
      const devices = await this.bridge.invoke<PairedDeviceDTO[]>(
        IPC_CHANNELS.PAIRING_LIST_DEVICES,
      );
      this.pairedDevices.set(devices);
    } catch {
      // Silently ignore errors
    }
  }

  /** Remove a paired device. */
  async removeDevice(deviceId: string): Promise<void> {
    try {
      await this.bridge.invoke(IPC_CHANNELS.PAIRING_REMOVE_DEVICE, { deviceId });
      await this.loadDevices();
      this.toast.show('Device removed', 'success');
    } catch {
      this.toast.show('Failed to remove device', 'error');
    }
  }

  /** Get paired device by ID. */
  getDeviceById(deviceId: string): PairedDeviceDTO | undefined {
    return this.pairedDevices().find((d) => d.id === deviceId);
  }

  /** Listen for device connection events. */
  private listenForDeviceConnections(): void {
    if (!this.bridge.isElectron) return;

    window.devLens?.on(IPC_EVENTS.PAIRING_DEVICE_CONNECTED, (data) => {
      const event = data as DeviceConnectionEvent;
      this.toast.show(`Device "${event.deviceName}" connected`, 'success');
      this.loadDevices();
    });
  }

  /** Clear current pairing code. */
  clearPairing(): void {
    this.currentPairing.set(null);
  }
}
