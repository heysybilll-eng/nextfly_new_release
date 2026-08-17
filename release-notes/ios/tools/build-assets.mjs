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

/**
 * design upload -> shipped asset + max rendered width in CSS px.
 *
 * The upload-to-feature mapping is NOT in filename order — it comes from the
 * design handoff's Assets section, confirmed against the screenshots themselves:
 *   1.PNG       -> feature 1, interface polish    (Home, dark)
 *   Group 2.png -> feature 2, account linking     (Login & security)
 *   3.PNG       -> feature 3, Dark Mode           (Settings, dark)
 *   2.PNG       -> feature 4, membership expiry   (Settings, light — Pro+ expiry row)
 *   4.PNG       -> feature 5, trip stats          (My Trips, flight passport card)
 *
 * 2.PNG and 3.PNG look "swapped" because they are the light and dark captures
 * of the same Settings screen: the dark one illustrates Dark Mode, the light
 * one illustrates the membership expiry row. The ordering is deliberate.
 *
 * Screenshots render at 66% of the 400px panel content box (~264 CSS px), so
 * 600px covers 2x with headroom. The rocket renders at up to 340px.
 */
const MAP = [
  { from: '1.PNG',                          to: 'shot-1',          maxCssWidth: 300 },
  { from: 'Group 2.png',                    to: 'shot-2',          maxCssWidth: 300 },
  { from: '3.PNG',                          to: 'shot-3',          maxCssWidth: 300 },
  { from: '2.PNG',                          to: 'shot-4',          maxCssWidth: 300 },
  { from: '4.PNG',                          to: 'shot-5',          maxCssWidth: 300 },
  { from: 'rocket-lineart-even@2x.png',     to: 'rocket-lineart',  maxCssWidth: 340 }
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
