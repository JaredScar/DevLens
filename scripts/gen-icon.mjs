/**
 * Copies devlens-taskbar-256.png → electron/assets/icon.png
 * Run with:  npm run gen-icon
 *
 * Used by Electron (window icon) and electron-builder (installers).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const src = path.join(root, 'devlens-taskbar-256.png');
const outPath = path.join(root, 'electron', 'assets', 'icon.png');

if (!fs.existsSync(src)) {
  console.error(`Missing source icon: ${src}`);
  process.exit(1);
}

fs.copyFileSync(src, outPath);
console.log(`Icon written → ${outPath}`);
