/**
 * Preload for `<webview>` guests running Dev-Lens sidebar plugins (`persist:dev-lens-plugin-*`).
 * Exposes `window.devLensPlugin` with permission-gated IPC to the main process.
 */
import { contextBridge, ipcRenderer } from 'electron';

/** Keep in sync with `shared/src/ipc-channels.ts` (guest preload cannot import workspace packages). */
const CH = {
  STORAGE_GET: 'dev-lens:plugin:storage-get',
  STORAGE_SET: 'dev-lens:plugin:storage-set',
  ACTIVE_TAB: 'dev-lens:plugin:active-tab',
  OPEN_URL: 'dev-lens:plugin:guest-open-tab',
  BLOCKER_STATS: 'dev-lens:plugin:guest-blocker-stats',
} as const;

function pluginIdFromLocation(): string {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get('devLensPluginId')?.trim() || '';
  } catch {
    return '';
  }
}

const pluginId = pluginIdFromLocation();

contextBridge.exposeInMainWorld('devLensPlugin', {
  pluginId,
  async getStorage(key: string): Promise<unknown> {
    if (!pluginId) return undefined;
    return ipcRenderer.invoke(CH.STORAGE_GET, { pluginId, key: String(key) });
  },
  async setStorage(key: string, value: unknown): Promise<{ ok: boolean }> {
    if (!pluginId) return { ok: false };
    return ipcRenderer.invoke(CH.STORAGE_SET, { pluginId, key: String(key), value }) as Promise<{
      ok: boolean;
    }>;
  },
  async getActiveTab(): Promise<{ url: string; title: string } | null> {
    if (!pluginId) return null;
    return ipcRenderer.invoke(CH.ACTIVE_TAB, { pluginId }) as Promise<{
      url: string;
      title: string;
    } | null>;
  },
  async openInNewTab(url: string): Promise<{ ok: boolean }> {
    if (!pluginId) return { ok: false };
    return ipcRenderer.invoke(CH.OPEN_URL, { pluginId, url: String(url) }) as Promise<{
      ok: boolean;
    }>;
  },
  async getBlockerStats(): Promise<{ blockedSession: number } | null> {
    if (!pluginId) return null;
    return ipcRenderer.invoke(CH.BLOCKER_STATS, { pluginId }) as Promise<{
      blockedSession: number;
    } | null>;
  },
});
