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
import { ASSETS, argOf, RELEASE, SOURCE_MAP } from './_shared.mjs';

const SRC = argOf('--src');
if (!SRC) {
  console.error('Usage: node tools/build-assets.mjs --src <path-to-design/uploads>');
  process.exit(2);
}

const MAP = SOURCE_MAP[RELEASE];
if (!MAP) {
  console.error(`No asset map defined for ${RELEASE}`);
  process.exit(2);
}

const DPR = 2;
await fs.mkdir(ASSETS, { recursive: true });

const kb = n => (n / 1024).toFixed(1) + ' KB';
let totalBefore = 0;
let totalAfter = 0;
const missing = [];

const available = await fs.readdir(SRC).catch(() => []);

/**
 * Resolve an expected upload name against what is actually in the folder.
 * iOS screenshot exports routinely pick up a timestamp suffix ("3.PNG" ->
 * "3 18.40.03.PNG"), so fall back to matching on the stem before extension.
 */
function resolve(want) {
  if (available.includes(want)) return want;
  const stem = path.parse(want).name;
  const hit = available.find(f => {
    const s = path.parse(f).name;
    return s === stem || s.startsWith(stem + ' ');
  });
  return hit || null;
}

for (const item of MAP) {
  const found = resolve(item.from);
  if (!found) {
    missing.push(item.from);
    continue;
  }
  if (found !== item.from) {
    console.log(`  (matched "${item.from}" to "${found}")`);
  }

  let input;
  try {
    input = await fs.readFile(path.join(SRC, found));
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

  // Both files are always written: a <picture> whose <source> 404s does NOT
  // fall back to the <img>, it just fails. But when PNG wins there is no point
  // serving the WebP, so drop that asset's <source> in the markup.
  if (webp.length > png.length) {
    console.log(
      `  ! PNG is smaller than WebP here (${kb(png.length)} vs ${kb(webp.length)}) — ` +
      `serve the PNG and omit the <source> for this one.`
    );
  }
}

if (missing.length) {
  console.warn(`\nNot found in ${SRC}:`);
  for (const m of missing) console.warn(`  - ${m}`);
}

console.log(
  `\nWebP payload: ${kb(totalAfter)} (design uploads were ${kb(totalBefore)}).` +
  `\nUpdate the width/height attributes in index.html to the intrinsic sizes above.`
);
