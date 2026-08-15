/**
 * Computed-style comparison against the design canvas.
 *
 *   node tools/assert-styles.mjs --design "../../_design/iOS Release Notes H5.dc.html"
 *
 * This is the real typography gate. Pixel diffing cannot validate type on a
 * Linux container that lacks the iOS system fonts, but computed values are
 * font-independent: if the design says 17px/1.5/-0.011em/#6E6E73 and the build
 * resolves to the same numbers, the type is correct regardless of how either
 * one rasterises here.
 *
 * Pairing is by visual reading order of text nodes, so it survives the design
 * file being absolutely-positioned canvas output while the build is flow
 * layout.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VIEWPORTS, OUT, CHROMIUM, argOf, pageUrl } from './_shared.mjs';

const DESIGN = argOf('--design');
if (!DESIGN) {
  console.error('Usage: node tools/assert-styles.mjs --design <path-to-.dc.html>');
  process.exit(2);
}
const designPath = path.resolve(DESIGN);
try {
  await fs.access(designPath);
} catch {
  console.error(`Design file not found: ${designPath}`);
  process.exit(2);
}

const PROPS = [
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'color', 'backgroundColor', 'borderRadius', 'textAlign'
];

const vp = VIEWPORTS.find(v => v.gate);
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function harvest(url) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    locale: 'en'
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(150);

  const data = await page.evaluate((props) => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      const style = {};
      for (const p of props) style[p] = cs[p];
      out.push({ text: text.slice(0, 48), top: Math.round(r.top + window.scrollY), style });
    }
    return out.sort((a, b) => a.top - b.top);
  }, PROPS);

  await ctx.close();
  return data;
}

const design = await harvest(`file://${designPath}`);
const build = await harvest(pageUrl({ lang: 'en' }));
await browser.close();

console.log(`design text nodes: ${design.length}`);
console.log(`build  text nodes: ${build.length}\n`);

if (design.length !== build.length) {
  console.warn(
    `! node counts differ (${design.length} vs ${build.length}) — pairing is by ` +
    `reading order, so a count mismatch means some rows below are compared ` +
    `against the wrong element. Reconcile the structure first.\n`
  );
}

const n = Math.min(design.length, build.length);
let bad = 0;

for (let i = 0; i < n; i++) {
  const d = design[i], b = build[i];
  const deltas = [];
  for (const p of PROPS) {
    if (d.style[p] !== b.style[p]) deltas.push(`${p}: design ${d.style[p]} / build ${b.style[p]}`);
  }
  if (deltas.length) {
    bad++;
    console.log(`[${i}] "${d.text}"`);
    if (d.text !== b.text) console.log(`      build text: "${b.text}"`);
    for (const x of deltas) console.log(`      ${x}`);
  }
}

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'styles-design.json'), JSON.stringify(design, null, 2));
await fs.writeFile(path.join(OUT, 'styles-build.json'), JSON.stringify(build, null, 2));

if (bad) {
  console.error(`\nFAIL: ${bad} of ${n} text nodes differ. Full dumps in ${OUT}/styles-*.json`);
  process.exit(1);
}
console.log(`PASS: all ${n} compared text nodes match on ${PROPS.join(', ')}.`);
