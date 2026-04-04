/**
 * Renders devlens-official-logo.svg → electron/assets/icon.png (512×512)
 * and branded DMG background PNGs for macOS disk images.
 * Run with: npm run gen-icon
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const svgPath = path.join(root, 'devlens-official-logo.svg');
const assetsDir = path.join(root, 'electron', 'assets');
const iconOut = path.join(assetsDir, 'icon.png');
const dmg1x = path.join(assetsDir, 'dmg-background.png');
const dmg2x = path.join(assetsDir, 'dmg-background@2x.png');

if (!fs.existsSync(svgPath)) {
  console.error(`Missing logo SVG: ${svgPath}`);
  process.exit(1);
}

fs.mkdirSync(assetsDir, { recursive: true });

const svgSource = fs.readFileSync(svgPath);

function renderSvgToPng(buffer, options) {
  const resvg = new Resvg(buffer, {
    background: 'rgba(0,0,0,0)',
    ...options,
  });
  const img = resvg.render();
  return Buffer.from(img.asPng());
}

const iconPng = renderSvgToPng(svgSource, {
  fitTo: { mode: 'width', value: 512 },
});
fs.writeFileSync(iconOut, iconPng);
console.log(`Icon written → ${iconOut}`);

function dmgBackgroundSvg(width, height, logoPx) {
  const b64 = iconPng.toString('base64');
  const lx = (width - logoPx) / 2;
  const ly = (height - logoPx) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="dmgBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#312E81"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#dmgBg)"/>
  <image xlink:href="data:image/png;base64,${b64}" href="data:image/png;base64,${b64}" x="${lx}" y="${ly}" width="${logoPx}" height="${logoPx}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

const png1x = renderSvgToPng(Buffer.from(dmgBackgroundSvg(540, 380, 200)));
fs.writeFileSync(dmg1x, png1x);
console.log(`DMG background → ${dmg1x}`);

const png2x = renderSvgToPng(Buffer.from(dmgBackgroundSvg(1080, 760, 400)));
fs.writeFileSync(dmg2x, png2x);
console.log(`DMG background @2x → ${dmg2x}`);
