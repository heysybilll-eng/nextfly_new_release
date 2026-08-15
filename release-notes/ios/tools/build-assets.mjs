/**
 * Design uploads -> shipping assets.
 *
 *   node tools/build-assets.mjs --src "../../_design/uploads"
 *
 * Reads the Claude Design `uploads/` folder and emits a WebP + PNG pair per
 * image into assets/. WebP is the primary source; the PNG stays as the
 * <picture> fallback for iOS 13 and older Android WebViews.
 *
 * Screenshots are capped at 2x the 390pt layout column — the raw device grabs
 * are far larger than they are ever displayed, and shipping them untouched is
 * the single biggest first-paint cost on this page.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS, argOf } from './_shared.mjs';

const SRC = argOf('--src');
if (!SRC) {
  console.error('Usage: node tools/build-assets.mjs --src <path-to-design/uploads>');
  process.exit(2);
}

/** design upload name -> shipped asset name + max rendered width in CSS px */
const MAP = [
  { from: '1.PNG',                       to: 'shot-1',  maxCssWidth: 380 },
  { from: '2.PNG',                       to: 'shot-2',  maxCssWidth: 380 },
  { from: '3.PNG',                       to: 'shot-3',  maxCssWidth: 380 },
  { from: '4.PNG',                       to: 'shot-4',  maxCssWidth: 380 },
  { from: 'rocket-lineart-even@2x.png',  to: 'rocket',  maxCssWidth: 132 },
  { from: 'Group 2.png',                 to: 'group-2', maxCssWidth: 96  }
];

const DPR = 2;
await fs.mkdir(ASSETS, { recursive: true });

const kb = n => (n / 1024).toFixed(1) + ' KB';
let totalBefore = 0;
let totalAfter = 0;
const missing = [];

for (const item of MAP) {
  const src = path.join(SRC, item.from);

  let input;
  try {
    input = await fs.readFile(src);
  } catch {
    missing.push(item.from);
    continue;
  }
  totalBefore += input.length;

  const meta = await sharp(input).metadata();
  const targetW = Math.min(meta.width, item.maxCssWidth * DPR);

  const base = sharp(input).resize({ width: targetW, withoutEnlargement: true });

  const webp = await base.clone().webp({ quality: 82, effort: 6 }).toBuffer();
  const png = await base.clone().png({ compressionLevel: 9, palette: true }).toBuffer();

  await fs.writeFile(path.join(ASSETS, `${item.to}.webp`), webp);
  await fs.writeFile(path.join(ASSETS, `${item.to}.png`), png);
  totalAfter += webp.length;

  const out = await sharp(webp).metadata();
  console.log(
    `${item.from.padEnd(30)} -> ${item.to.padEnd(9)} ` +
    `${out.width}x${out.height}  webp ${kb(webp.length).padStart(9)}  ` +
    `png ${kb(png.length).padStart(9)}  (from ${kb(input.length)})`
  );
  console.log(`  intrinsic size for <img width/height>: ${out.width} x ${out.height}`);
}

if (missing.length) {
  console.warn(`\nNot found in ${SRC}:`);
  for (const m of missing) console.warn(`  - ${m}`);
}

console.log(
  `\nWebP payload: ${kb(totalAfter)} (design uploads were ${kb(totalBefore)}).` +
  `\nUpdate the width/height attributes in index.html to the intrinsic sizes above.`
);
