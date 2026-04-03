import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { IPC_CHANNELS, IPC_EVENTS, pluginHasPermission } from '@dev-lens/shared';
import type { DiscoveredPlugin } from './plugin-loader';
import type { UserStore } from './user-data-store';
import { PluginSetEnabledSchema } from './ipc-zod';
import { patchUserStore } from './user-data-store';
import type { SessionManager } from './session-manager';

function findPlugin(list: DiscoveredPlugin[], id: string): DiscoveredPlugin | undefined {
  return list.find((p) => p.id === id);
}

function safeOpenUrl(raw: string): { url: string; title: string } | null {
  const t = raw.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'about:') {
    return { url: u.href, title: u.href };
  }
  return null;
}

export interface PluginIpcContext {
  store: UserStore;
  sessionManager: SessionManager;
  getMainWindow: () => BrowserWindow | null;
  getDiscovered: () => DiscoveredPlugin[];
  getActiveTab: () => { url: string; title: string } | null;
}

export function registerPluginIpc(ctx: PluginIpcContext): void {
  ipcMain.handle(IPC_CHANNELS.PLUGIN_DISCOVER, () => {
    const states = ctx.store.get('pluginStates');
    return {
      plugins: ctx.getDiscovered().map((p) => ({
        id: p.id,
        name: p.manifest.name,
        version: p.manifest.version,
        permissions: p.manifest.permissions,
        sidebarTitle: p.manifest.sidebar.title,
        entryBaseUrl: p.entryBaseUrl,
        bundled: p.bundled,
        enabled: states[p.id]?.enabled === true,
      })),
    };
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_SET_ENABLED, (_e, raw: unknown) => {
    const r = PluginSetEnabledSchema.safeParse(raw);
    if (!r.success) return { ok: false as const };
    patchUserStore(ctx.store, {
      pluginStates: { [r.data.id]: { enabled: r.data.enabled } },
    });
    return { ok: true as const };
  });

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_STORAGE_GET,
    (_e, payload: { pluginId: string; key: string }) => {
      const p = findPlugin(ctx.getDiscovered(), payload.pluginId);
      if (!p || !ctx.store.get('pluginStates')[payload.pluginId]?.enabled) return undefined;
      if (!pluginHasPermission(p.manifest, 'storage')) return undefined;
      const bag = ctx.store.get('pluginStorage')[payload.pluginId] ?? {};
      return bag[payload.key];
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_STORAGE_SET,
    (_e, payload: { pluginId: string; key: string; value: unknown }) => {
      const p = findPlugin(ctx.getDiscovered(), payload.pluginId);
      if (!p || !ctx.store.get('pluginStates')[payload.pluginId]?.enabled)
        return { ok: false as const };
      if (!pluginHasPermission(p.manifest, 'storage')) return { ok: false as const };
      const prev = ctx.store.get('pluginStorage')[payload.pluginId] ?? {};
      patchUserStore(ctx.store, {
        pluginStorage: { [payload.pluginId]: { ...prev, [payload.key]: payload.value } },
      });
      return { ok: true as const };
    },
  );

  ipcMain.handle(IPC_CHANNELS.PLUGIN_GUEST_ACTIVE_TAB, (_e, payload: { pluginId: string }) => {
    const p = findPlugin(ctx.getDiscovered(), payload.pluginId);
    if (!p || !ctx.store.get('pluginStates')[payload.pluginId]?.enabled) return null;
    if (!pluginHasPermission(p.manifest, 'activeTab')) return null;
    const s = ctx.getActiveTab();
    if (!s || !s.url) return null;
    return s;
  });

  ipcMain.handle(
    IPC_CHANNELS.PLUGIN_GUEST_OPEN_TAB,
    (_e, payload: { pluginId: string; url: string }) => {
      const p = findPlugin(ctx.getDiscovered(), payload.pluginId);
      if (!p || !ctx.store.get('pluginStates')[payload.pluginId]?.enabled)
        return { ok: false as const };
      if (!pluginHasPermission(p.manifest, 'tabs')) return { ok: false as const };
      const u = safeOpenUrl(payload.url);
      if (!u) return { ok: false as const };
      const win = ctx.getMainWindow();
      if (!win || win.isDestroyed()) return { ok: false as const };
      win.webContents.send(IPC_EVENTS.PLUGIN_OPEN_URL, u);
      return { ok: true as const };
    },
  );

  ipcMain.handle(IPC_CHANNELS.PLUGIN_GUEST_BLOCKER_STATS, (_e, payload: { pluginId: string }) => {
    const p = findPlugin(ctx.getDiscovered(), payload.pluginId);
    if (!p || !ctx.store.get('pluginStates')[payload.pluginId]?.enabled) return null;
    if (!pluginHasPermission(p.manifest, 'blocker')) return null;
    return { blockedSession: ctx.sessionManager.getBlockedSessionCount() };
  });
}
