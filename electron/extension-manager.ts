/**
 * Chrome extension installer for Dev-Lens.
 *
 * Downloads a .crx3 file from Google's CDN, strips the CRX header to obtain
 * the embedded ZIP, extracts it to userData/installed-extensions/{id}/, and
 * loads it into the requested Electron sessions via session.loadExtension().
 *
 * On startup, loadAllInstalledExtensions() re-loads every previously installed
 * extension from disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { app } from 'electron';
import type { Session } from 'electron';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip') as new (buf: Buffer) => {
  extractAllTo(dir: string, overwrite: boolean): void;
};

function extensionsDir(): string {
  return path.join(app.getPath('userData'), 'installed-extensions');
}

function crxDownloadUrl(extensionId: string): string {
  return (
    'https://clients2.google.com/service/update2/crx' +
    '?response=redirect&prodversion=120.0.0.0&acceptformat=crx3' +
    `&x=id%3D${extensionId}%26uc`
  );
}

async function fetchWithRedirects(url: string, depth = 0): Promise<Buffer> {
  if (depth > 8) throw new Error('Too many redirects');
  return new Promise<Buffer>((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          if (
            res.statusCode !== undefined &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            resolve(fetchWithRedirects(res.headers.location, depth + 1));
            res.resume();
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode ?? 'unknown'} for ${url}`));
            res.resume();
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        },
      )
      .on('error', reject);
  });
}

/**
 * Strip the CRX2/CRX3 header and return the raw ZIP bytes.
 */
function crxToZip(buf: Buffer): Buffer {
  const magic = buf.toString('ascii', 0, 4);
  // Already a ZIP?
  if (buf[0] === 0x50 && buf[1] === 0x4b) return buf;
  if (magic !== 'Cr24') throw new Error(`Unrecognised CRX magic: ${JSON.stringify(magic)}`);

  const version = buf.readUInt32LE(4);
  if (version === 3) {
    const headerSize = buf.readUInt32LE(8);
    return buf.subarray(12 + headerSize);
  }
  if (version === 2) {
    const pkLen = buf.readUInt32LE(8);
    const sigLen = buf.readUInt32LE(12);
    return buf.subarray(16 + pkLen + sigLen);
  }
  throw new Error(`Unknown CRX version: ${version}`);
}

function readExtensionName(dir: string): string {
  try {
    const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
    const mf = JSON.parse(raw) as { name?: string };
    return mf.name ?? path.basename(dir);
  } catch {
    return path.basename(dir);
  }
}

/**
 * Download and install a Chrome extension by ID.
 * Returns the extension display name.
 */
export async function installChromeExtension(
  extensionId: string,
  sessions: Session[],
): Promise<string> {
  const extDir = path.join(extensionsDir(), extensionId);

  if (!fs.existsSync(extDir)) {
    const crxBuf = await fetchWithRedirects(crxDownloadUrl(extensionId));
    const zipBuf = crxToZip(crxBuf);
    fs.mkdirSync(extDir, { recursive: true });
    const zip = new AdmZip(zipBuf);
    zip.extractAllTo(extDir, true);
  }

  const name = readExtensionName(extDir);

  for (const ses of sessions) {
    try {
      await ses.loadExtension(extDir, { allowFileAccess: true });
    } catch (e) {
      console.warn('[ext] loadExtension failed for session:', e);
    }
  }

  return name;
}

/**
 * On app startup, re-load every previously installed extension into the given
 * sessions.
 */
export async function loadAllInstalledExtensions(sessions: Session[]): Promise<void> {
  const dir = extensionsDir();
  if (!fs.existsSync(dir)) return;

  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name));

  for (const extPath of entries) {
    for (const ses of sessions) {
      try {
        await ses.loadExtension(extPath, { allowFileAccess: true });
      } catch (e) {
        console.warn('[ext] loadExtension failed:', extPath, e);
      }
    }
  }
}
