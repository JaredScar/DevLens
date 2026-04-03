/**
 * Converts devlens-official-logo.svg → electron/assets/icon.png (512×512)
 * Run once with:  node scripts/gen-icon.mjs
 *
 * The SVG uses a 500×500 viewBox but the visible logo content lives roughly
 * in the region (55, 55) → (445, 445). We tighten the viewBox here and add a
 * solid navy background so the icon reads clearly on any OS taskbar colour.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const raw = fs.readFileSync(path.join(root, 'devlens-official-logo.svg'), 'utf8');

// Tighten the viewBox to the visible content area and inject a background
// rect so the icon has a solid fill instead of a transparent canvas.
const svgData = raw
  // Crop viewBox to the logo content (globe extends ~70-430; add 20px padding)
  .replace(/viewBox="[^"]*"/, 'viewBox="50 50 400 400"')
  // Inject a rounded-rect background right after <defs> closes
  .replace('</defs>', '</defs>\n  <rect x="50" y="50" width="400" height="400" rx="80" fill="#1a1b2e"/>');

const resvg = new Resvg(svgData, {
  fitTo: { mode: 'width', value: 512 },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

const outPath = path.join(root, 'electron', 'assets', 'icon.png');
fs.writeFileSync(outPath, pngBuffer);
console.log(`Icon written → ${outPath} (${pngBuffer.length} bytes)`);
