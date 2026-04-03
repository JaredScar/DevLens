/**
 * Dev-Lens plugin manifest (manifest.json at the plugin root).
 * Plugins load from userData plugins folder and bundled electron/bundled-plugins directories.
 */

export const PLUGIN_MANIFEST_VERSION = 1 as const;

export type PluginPermission = 'storage' | 'activeTab' | 'tabs' | 'blocker';

export interface PluginManifestV1 {
  devLensPlugin: typeof PLUGIN_MANIFEST_VERSION;
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions: PluginPermission[];
  sidebar: {
    title: string;
    /** Path relative to plugin root (e.g. index.html). */
    entry: string;
  };
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isValidPluginPermission(p: string): p is PluginPermission {
  return p === 'storage' || p === 'activeTab' || p === 'tabs' || p === 'blocker';
}

export function validatePluginManifest(
  raw: unknown,
): { ok: true; manifest: PluginManifestV1 } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Manifest is not an object' };
  const o = raw as Record<string, unknown>;
  if (o['devLensPlugin'] !== PLUGIN_MANIFEST_VERSION) {
    return { ok: false, error: 'devLensPlugin must be 1' };
  }
  const id = o['id'];
  const name = o['name'];
  const version = o['version'];
  const perms = o['permissions'];
  const sidebar = o['sidebar'];
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    return { ok: false, error: 'id must be a lowercase slug (1–63 chars, a-z0-9-)' };
  }
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'name is required' };
  if (typeof version !== 'string' || !version.trim())
    return { ok: false, error: 'version is required' };
  if (!Array.isArray(perms) || perms.length === 0) {
    return { ok: false, error: 'permissions must be a non-empty array' };
  }
  for (const p of perms) {
    if (typeof p !== 'string' || !isValidPluginPermission(p)) {
      return { ok: false, error: 'Unknown permission: ' + String(p) };
    }
  }
  if (!sidebar || typeof sidebar !== 'object') return { ok: false, error: 'sidebar is required' };
  const sb = sidebar as Record<string, unknown>;
  if (typeof sb['title'] !== 'string' || !sb['title'].trim())
    return { ok: false, error: 'sidebar.title is required' };
  if (typeof sb['entry'] !== 'string' || !sb['entry'].trim())
    return { ok: false, error: 'sidebar.entry is required' };
  if (sb['entry'].includes('..') || sb['entry'].startsWith('/') || sb['entry'].startsWith('\\')) {
    return { ok: false, error: 'sidebar.entry must be a relative path' };
  }

  return {
    ok: true,
    manifest: {
      devLensPlugin: PLUGIN_MANIFEST_VERSION,
      id,
      name: name.trim(),
      version: version.trim(),
      description: typeof o['description'] === 'string' ? o['description'] : undefined,
      permissions: [...perms] as PluginPermission[],
      sidebar: { title: sb['title'].trim(), entry: sb['entry'].trim().replace(/\\/g, '/') },
    },
  };
}

export function pluginHasPermission(manifest: PluginManifestV1, perm: PluginPermission): boolean {
  return manifest.permissions.includes(perm);
}
