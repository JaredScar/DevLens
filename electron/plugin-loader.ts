import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginManifest, type PluginManifestV1 } from '@dev-lens/shared';

export interface DiscoveredPlugin {
  id: string;
  manifest: PluginManifestV1;
  rootDir: string;
  /** file:// URL to sidebar entry HTML (with query added by host). */
  entryBaseUrl: string;
  bundled: boolean;
}

function readManifestFile(filePath: string): PluginManifestV1 | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const v = validatePluginManifest(raw);
    if (!v.ok) {
      console.warn('[plugin]', filePath, v.error);
      return null;
    }
    return v.manifest;
  } catch (e) {
    console.warn('[plugin] invalid manifest', filePath, e);
    return null;
  }
}

function discoverInRoot(pluginsRoot: string, bundled: boolean): DiscoveredPlugin[] {
  const out: DiscoveredPlugin[] = [];
  if (!fs.existsSync(pluginsRoot)) return out;
  let names: string[];
  try {
    names = fs
      .readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return out;
  }
  for (const name of names) {
    const rootDir = path.join(pluginsRoot, name);
    const mf = path.join(rootDir, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    const manifest = readManifestFile(mf);
    if (!manifest) continue;
    if (manifest.id !== name) {
      console.warn(`[plugin] folder "${name}" manifest id "${manifest.id}" mismatch — skipped`);
      continue;
    }
    const entryPath = path.join(rootDir, manifest.sidebar.entry);
    if (!fs.existsSync(entryPath)) {
      console.warn('[plugin] missing entry', entryPath);
      continue;
    }
    const entryBaseUrl = pathToFileURL(entryPath).href;
    out.push({ id: manifest.id, manifest, rootDir, entryBaseUrl, bundled });
  }
  return out;
}

export function discoverAllPlugins(bundledDir: string, userDir: string): DiscoveredPlugin[] {
  const bundled = discoverInRoot(bundledDir, true);
  const user = discoverInRoot(userDir, false);
  const byId = new Map<string, DiscoveredPlugin>();
  for (const p of bundled) byId.set(p.id, p);
  for (const p of user) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
