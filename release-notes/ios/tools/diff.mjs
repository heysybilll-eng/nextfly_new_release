/**
 * Pixel-fidelity gate against the Claude Design canvas file.
 *
 *   node tools/diff.mjs --design "../../_design/iOS Release Notes H5.dc.html"
 *
 * Renders the design file and index.html at the gate viewport (390 @3x) and
 * reports the mismatch ratio plus a diff image.
 *
 * Scope note: this container has no SF Pro / PingFang / Hiragino, so glyph
 * rasterisation differs from iOS no matter how correct the CSS is. Text areas
 * therefore carry irreducible noise. Treat this as the gate for GEOMETRY and
 * COLOUR; typography correctness is asserted by tools/assert-styles.mjs, which
 * compares computed values rather than pixels.
 */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VIEWPORTS, OUT, CHROMIUM, argOf, pageUrl } from './_shared.mjs';

const DESIGN = argOf('--design');
const THRESHOLD = Number(argOf('--threshold', '1.0')); // percent

if (!DESIGN) {
  console.error('Usage: node tools/diff.mjs --design <path-to-.dc.html> [--threshold 1.0]');
  process.exit(2);
}

const designPath = path.resolve(DESIGN);
try {
  await fs.access(designPath);
} catch {
  console.error(`Design file not found: ${designPath}`);
  process.exit(2);
}

const vp = VIEWPORTS.find(v => v.gate);
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function shoot(url, out) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    locale: 'en'
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    await Promise.all([...document.images].map(i => i.complete ? null : i.decode().catch(() => null)));
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, fullPage: true });
  const h = await page.evaluate(() => document.body.scrollHeight);
  await ctx.close();
  return h;
}

const refPath = path.join(OUT, 'design.png');
const buildPath = path.join(OUT, 'build.png');

const refH = await shoot(`file://${designPath}`, refPath);
const buildH = await shoot(pageUrl({ lang: 'en' }), buildPath);
await browser.close();

const ref = PNG.sync.read(await fs.readFile(refPath));
const build = PNG.sync.read(await fs.readFile(buildPath));

console.log(`design: ${ref.width}x${ref.height}px  (css height ${refH})`);
console.log(`build : ${build.width}x${build.height}px  (css height ${buildH})`);

const heightDelta = Math.abs(refH - buildH);
if (heightDelta > 4) {
  console.warn(
    `\n! page heights differ by ${heightDelta}css px — vertical rhythm is off ` +
    `somewhere. Fix that before reading the mismatch number; comparing pages of ` +
    `different heights inflates it into meaninglessness.`
  );
}

// Compare over the common area so a height mismatch still yields a usable map.
const w = Math.min(ref.width, build.width);
const h = Math.min(ref.height, build.height);

const crop = (src) => {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(src, out, 0, 0, w, h, 0, 0);
  return out;
};

const a = crop(ref);
const b = crop(build);
const diff = new PNG({ width: w, height: h });

const mismatched = pixelmatch(a.data, b.data, diff.data, w, h, {
  threshold: 0.12,
  includeAA: false,
  alpha: 0.25
});

const diffPath = path.join(OUT, 'diff.png');
await fs.writeFile(diffPath, PNG.sync.write(diff));

const pct = (mismatched / (w * h)) * 100;
console.log(`\nmismatch: ${mismatched.toLocaleString()} px of ${(w * h).toLocaleString()} = ${pct.toFixed(3)}%`);
console.log(`diff map: ${diffPath}`);

if (pct > THRESHOLD) {
  console.error(
    `\nFAIL: ${pct.toFixed(3)}% > ${THRESHOLD}% threshold.\n` +
    `Open the diff map: solid red blocks mean structural drift (wrong spacing, ` +
    `size or colour) and must be fixed. Red confined to glyph edges is the ` +
    `expected font-rasterisation noise described at the top of this file.`
  );
  process.exit(1);
}

console.log(`\nPASS: within ${THRESHOLD}% threshold.`);
