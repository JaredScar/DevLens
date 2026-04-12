/**
 * Push notification bridge service (Phase 3.3).
 * Handles local notifications and remote tab opening from paired devices.
 */
import { Injectable, inject, signal } from '@angular/core';
import { IPC_CHANNELS, IPC_EVENTS } from '@dev-lens/shared';
import { ElectronBridgeService } from './electron-bridge.service';
import { TabsService } from './tabs.service';
import { ToastService } from './toast.service';
import { DevicePairingService } from './device-pairing.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface RemoteOpenTabEvent {
  url: string;
  title?: string;
  deviceId: string;
  deviceName: string;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly bridge = inject(ElectronBridgeService);
  private readonly tabs = inject(TabsService);
  private readonly toast = inject(ToastService);
  private readonly pairing = inject(DevicePairingService);

  readonly notificationsEnabled = signal(false);
  readonly pendingRemoteTabs = signal<RemoteOpenTabEvent[]>([]);

  constructor() {
    this.checkNotificationSupport();
    this.listenForNotifications();
    this.listenForRemoteTabs();
  }

  /** Check if notifications are supported. */
  private async checkNotificationSupport(): Promise<void> {
    if (!this.bridge.isElectron) return;
    // In Electron, notifications are always supported via the main process
    this.notificationsEnabled.set(true);
  }

  /** Show a local notification. */
  async showNotification(payload: NotificationPayload): Promise<boolean> {
    if (!this.bridge.isElectron) return false;

    try {
      const result = await this.bridge.invoke<{ shown: boolean }>(
        IPC_CHANNELS.NOTIFICATION_SHOW,
        payload,
      );
      return result.shown;
    } catch (_err) {
      console.error('Failed to show notification', _err);
      return false;
    }
  }

  /** Show notification for a new tab from paired device. */
  async notifyNewTabFromDevice(deviceId: string, url: string, title?: string): Promise<void> {
    const device = this.pairing.getDeviceById(deviceId);
    const deviceName = device?.name || 'Unknown Device';

    await this.showNotification({
      title: `New tab from ${deviceName}`,
      body: title || url,
      data: { url, deviceId, type: 'remote-tab' },
    });
  }

  private listenForNotifications(): void {
    if (!this.bridge.isElectron) return;

    window.devLens?.on(IPC_EVENTS.PUSH_NOTIFICATION_RECEIVED, (data) => {
      const notification = data as NotificationPayload & {
        clicked?: boolean;
        data?: Record<string, unknown>;
      };

      if (notification.clicked && notification.data?.['type'] === 'remote-tab') {
        // Open the tab when notification is clicked
        const url = notification.data['url'] as string;
        const title = notification.data['title'] as string | undefined;
        this.tabs.addBrowserTab(url, title || url);
      }
    });
  }

  private listenForRemoteTabs(): void {
    if (!this.bridge.isElectron) return;

    window.devLens?.on(IPC_EVENTS.REMOTE_OPEN_TAB, (data) => {
      const event = data as RemoteOpenTabEvent;
      this.pendingRemoteTabs.update((list) => [...list, event]);

      // Show toast notification
      this.toast.show(`New tab from ${event.deviceName}: ${event.title || event.url}`, 'info');

      // Optionally show native notification
      this.showNotification({
        title: `New tab from ${event.deviceName}`,
        body: event.title || event.url,
        data: { url: event.url, title: event.title, deviceId: event.deviceId, type: 'remote-tab' },
      });
    });
  }

  /** Accept a pending remote tab (open it). */
  acceptRemoteTab(event: RemoteOpenTabEvent): void {
    this.tabs.addBrowserTab(event.url, event.title || event.url);
    this.pendingRemoteTabs.update((list) =>
      list.filter((t) => t.url !== event.url || t.deviceId !== event.deviceId),
    );
  }

  /** Dismiss a pending remote tab. */
  dismissRemoteTab(event: RemoteOpenTabEvent): void {
    this.pendingRemoteTabs.update((list) =>
      list.filter((t) => t.url !== event.url || t.deviceId !== event.deviceId),
    );
  }

  /** Clear all pending remote tabs. */
  clearPendingTabs(): void {
    this.pendingRemoteTabs.set([]);
  }
}
