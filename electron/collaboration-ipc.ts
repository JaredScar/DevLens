/**
 * Collaboration IPC handlers for:
 * - QR-code device pairing (Phase 3.3)
 * - Push notifications (Phase 3.3)
 * - Page annotations (Phase 3.4)
 */

import { ipcMain, BrowserWindow, Notification } from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type PairedDeviceDTO,
  type AnnotationDTO,
  type SharedBookmarkCollectionDTO,
  type SharedWorkspaceDTO,
} from '@dev-lens/shared';
import { createUserStore } from './user-data-store';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

/** Pending pairing codes (code → { deviceName?, createdAt, expiresAt }). */
const pendingPairings = new Map<
  string,
  { deviceName?: string; createdAt: number; expiresAt: number }
>();

/** Cleanup expired pairings every minute. */
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingPairings.entries()) {
    if (now > data.expiresAt) {
      pendingPairings.delete(code);
    }
  }
}, 60000);

/** Generate a 6-digit pairing code. */
function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Register collaboration IPC handlers. */
export function registerCollaborationIpc(mainWindow: BrowserWindow): void {
  // ========== QR-CODE PAIRING (Phase 3.3) ==========

  ipcMain.handle(IPC_CHANNELS.PAIRING_GENERATE, async () => {
    const code = generatePairingCode();
    const createdAt = Date.now();
    const expiresAt = createdAt + 10 * 60 * 1000; // 10 minutes

    pendingPairings.set(code, { createdAt, expiresAt });

    // Generate QR data URL for the pairing code
    const qrDataUrl = await QRCode.toDataURL(
      JSON.stringify({
        type: 'dev-lens-pair',
        code,
        expiresAt,
      }),
      { width: 256, margin: 2 },
    );

    return { pairingCode: code, qrDataUrl, expiresAt };
  });

  ipcMain.handle(
    IPC_CHANNELS.PAIRING_COMPLETE,
    (_event, payload: { pairingCode: string; deviceName: string }) => {
      const pending = pendingPairings.get(payload.pairingCode);
      if (!pending) {
        return { success: false, error: 'Invalid or expired pairing code' };
      }

      const now = Date.now();
      if (now > pending.expiresAt) {
        pendingPairings.delete(payload.pairingCode);
        return { success: false, error: 'Pairing code expired' };
      }

      const deviceId = crypto.randomUUID();
      const store = createUserStore();
      const devices = (store.get('pairedDevices') as PairedDeviceDTO[] | undefined) ?? [];

      devices.push({
        id: deviceId,
        name: payload.deviceName,
        pairedAt: now,
        lastSeenAt: now,
      });

      store.set('pairedDevices', devices);
      pendingPairings.delete(payload.pairingCode);

      // Notify renderer a device connected
      mainWindow.webContents.send(IPC_EVENTS.PAIRING_DEVICE_CONNECTED, {
        deviceId,
        deviceName: payload.deviceName,
      });

      return { success: true, deviceId };
    },
  );

  ipcMain.handle(IPC_CHANNELS.PAIRING_LIST_DEVICES, () => {
    const store = createUserStore();
    return (store.get('pairedDevices') as PairedDeviceDTO[] | undefined) ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.PAIRING_REMOVE_DEVICE, (_event, payload: { deviceId: string }) => {
    const store = createUserStore();
    const devices = ((store.get('pairedDevices') as PairedDeviceDTO[] | undefined) ?? []).filter(
      (d) => d.id !== payload.deviceId,
    );
    store.set('pairedDevices', devices);
    return { success: true };
  });

  // ========== PUSH NOTIFICATIONS (Phase 3.3) ==========

  ipcMain.handle(
    IPC_CHANNELS.NOTIFICATION_SHOW,
    (_event, payload: { title: string; body: string; data?: Record<string, unknown> }) => {
      if (!Notification.isSupported()) {
        return { shown: false, error: 'Notifications not supported' };
      }

      const notification = new Notification({
        title: payload.title,
        body: payload.body,
        icon: './electron/assets/icon.png',
      });

      notification.on('click', () => {
        mainWindow.focus();
        // Notify renderer about notification click
        mainWindow.webContents.send(IPC_EVENTS.PUSH_NOTIFICATION_RECEIVED, {
          title: payload.title,
          body: payload.body,
          data: payload.data,
          clicked: true,
        });
      });

      notification.show();
      return { shown: true };
    },
  );

  // ========== ANNOTATIONS (Phase 3.4) ==========

  ipcMain.handle(
    IPC_CHANNELS.ANNOTATION_SAVE,
    (
      _event,
      payload: {
        url: string;
        selector: string;
        text: string;
        note: string;
        x?: number;
        y?: number;
      },
    ) => {
      const store = createUserStore();
      const annotations = (store.get('annotations') as AnnotationDTO[] | undefined) ?? [];
      const now = Date.now();

      const annotation = {
        id: crypto.randomUUID(),
        url: payload.url,
        selector: payload.selector,
        text: payload.text,
        note: payload.note,
        x: payload.x,
        y: payload.y,
        createdAt: now,
        updatedAt: now,
        shared: false,
        authorName: 'Me',
      } satisfies AnnotationDTO;

      annotations.push(annotation);
      store.set('annotations', annotations);

      // Notify renderer about annotation update for this URL
      const urlAnnotations = annotations.filter((a) => a.url === payload.url);
      mainWindow.webContents.send(IPC_EVENTS.ANNOTATIONS_UPDATED, {
        url: payload.url,
        annotations: urlAnnotations,
      });

      return { id: annotation.id };
    },
  );

  ipcMain.handle(IPC_CHANNELS.ANNOTATION_GET_FOR_URL, (_event, payload: { url: string }) => {
    const store = createUserStore();
    const annotations = (store.get('annotations') as AnnotationDTO[] | undefined) ?? [];
    return annotations.filter((a) => a.url === payload.url);
  });

  ipcMain.handle(IPC_CHANNELS.ANNOTATION_DELETE, (_event, payload: { id: string }) => {
    const store = createUserStore();
    const annotations = (store.get('annotations') as AnnotationDTO[] | undefined) ?? [];
    const annotation = annotations.find((a) => a.id === payload.id);

    const filtered = annotations.filter((a) => a.id !== payload.id);
    store.set('annotations', filtered);

    // Notify renderer about annotation update
    if (annotation) {
      const urlAnnotations = filtered.filter((a) => a.url === annotation.url);
      mainWindow.webContents.send(IPC_EVENTS.ANNOTATIONS_UPDATED, {
        url: annotation.url,
        annotations: urlAnnotations,
      });
    }

    return { success: true };
  });

  ipcMain.handle(
    IPC_CHANNELS.ANNOTATION_SET_SHARED,
    (_event, payload: { id: string; shared: boolean }) => {
      const store = createUserStore();
      const annotations = (store.get('annotations') as AnnotationDTO[] | undefined) ?? [];

      const annotation = annotations.find((a) => a.id === payload.id);
      if (!annotation) {
        return { success: false, error: 'Annotation not found' };
      }

      annotation.shared = payload.shared;
      annotation.updatedAt = Date.now();
      store.set('annotations', annotations);

      // Notify renderer about annotation update
      const urlAnnotations = annotations.filter((a) => a.url === annotation.url);
      mainWindow.webContents.send(IPC_EVENTS.ANNOTATIONS_UPDATED, {
        url: annotation.url,
        annotations: urlAnnotations,
      });

      return { success: true };
    },
  );
}

/** Show a notification for a new tab from a paired device. */
export function notifyRemoteOpenTab(deviceName: string, url: string, title?: string): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: `New tab from ${deviceName}`,
    body: title || url,
    icon: './electron/assets/icon.png',
  });

  notification.show();
}

/** Simulate receiving a tab from a paired device (for demo purposes). */
export function simulateRemoteTab(
  mainWindow: BrowserWindow,
  deviceId: string,
  url: string,
  title?: string,
): void {
  const store = createUserStore();
  const devices = (store.get('pairedDevices') as PairedDeviceDTO[] | undefined) ?? [];
  const device = devices.find((d) => d.id === deviceId);

  if (!device) return;

  mainWindow.webContents.send(IPC_EVENTS.REMOTE_OPEN_TAB, {
    url,
    title,
    deviceId,
    deviceName: device.name,
  });

  notifyRemoteOpenTab(device.name, url, title);
}
