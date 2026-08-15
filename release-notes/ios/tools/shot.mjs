/**
 * Screenshot + layout regression sweep.
 *
 *   node tools/shot.mjs --all                 every locale x every viewport
 *   node tools/shot.mjs --lang de --vp iphone single combination
 *   node tools/shot.mjs --gate                gate viewport (390) only, all locales
 *
 * Beyond producing PNGs this asserts the things that actually break a WebView
 * release-notes page: horizontal overflow, clipped text, and images that never
 * decoded. Exits non-zero when any check fails, so it can run in CI.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LOCALES, VIEWPORTS, OUT, CHROMIUM, argOf, hasFlag, pageUrl } from './_shared.mjs';

const ONE_LANG = argOf('--lang');
const ONE_VP = argOf('--vp');
const GATE_ONLY = hasFlag('--gate');

const locales = ONE_LANG ? [ONE_LANG] : LOCALES;
const viewports = ONE_VP
  ? VIEWPORTS.filter(v => v.name === ONE_VP)
  : GATE_ONLY
    ? VIEWPORTS.filter(v => v.gate)
    : VIEWPORTS;

if (!viewports.length) {
  console.error(`Unknown viewport "${ONE_VP}". Known: ${VIEWPORTS.map(v => v.name).join(', ')}`);
  process.exit(2);
}

const shotDir = path.join(OUT, 'shots');
await fs.mkdir(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures = [];
const rows = [];

for (const vp of viewports) {
  for (const lang of locales) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: true,
      hasTouch: true,
      // Exercise the navigator.language path too, not just ?lang=.
      locale: lang
    });
    const page = await ctx.newPage();

    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(String(e)));

    await page.goto(pageUrl({ lang }), { waitUntil: 'load' });
    // Lazy images below the fold must be forced in before a full-page shot.
    await page.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
      await Promise.all(
        [...document.images].map(i => i.complete ? null : i.decode().catch(() => null))
      );
    });
    await page.waitForTimeout(120);

    const probe = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;

      // Any element whose content box is wider than the viewport.
      const wide = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > de.clientWidth + 0.5 && el !== de && el !== document.body) {
          wide.push(`${el.tagName.toLowerCase()}.${el.className || '-'} (${Math.round(r.width)}px)`);
        }
      });

      // Text taller than its box = clipped glyphs (the Devanagari failure mode).
      const clipped = [];
      document.querySelectorAll('h1, h2, p').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
          clipped.push(`${el.className || el.tagName}`);
        }
      });

      const emptyStrings = [...document.querySelectorAll('[data-i18n]')]
        .filter(el => !el.textContent.trim())
        .map(el => el.getAttribute('data-i18n'));

      const brokenImages = [...document.images]
        .filter(i => !i.complete || i.naturalWidth === 0)
        .map(i => i.getAttribute('src'));

      return {
        lang: de.lang,
        overflow,
        wide: wide.slice(0, 5),
        clipped,
        emptyStrings,
        brokenImages,
        height: document.body.scrollHeight
      };
    });

    const file = path.join(shotDir, `${vp.name}-${lang}.png`);
    await page.screenshot({ path: file, fullPage: true });

    const problems = [];
    if (probe.overflow > 0) problems.push(`h-overflow ${probe.overflow}px [${probe.wide.join(', ')}]`);
    if (probe.clipped.length) problems.push(`clipped: ${probe.clipped.join(', ')}`);
    if (probe.emptyStrings.length) problems.push(`missing strings: ${probe.emptyStrings.join(', ')}`);
    if (probe.brokenImages.length) problems.push(`broken images: ${probe.brokenImages.join(', ')}`);
    if (consoleErrors.length) problems.push(`js errors: ${consoleErrors.join(' | ')}`);
    if (probe.lang !== lang) problems.push(`lang resolved to "${probe.lang}", expected "${lang}"`);

    rows.push({
      vp: vp.name,
      lang,
      height: probe.height,
      status: problems.length ? 'FAIL' : 'ok'
    });
    if (problems.length) failures.push({ vp: vp.name, lang, problems });

    await ctx.close();
  }
}

await browser.close();

// ---- report -----------------------------------------------------------------
const w = (s, n) => String(s).padEnd(n);
console.log(`\n${w('viewport', 10)}${w('locale', 10)}${w('page h', 9)}status`);
console.log('-'.repeat(38));
for (const r of rows) console.log(`${w(r.vp, 10)}${w(r.lang, 10)}${w(r.height + 'px', 9)}${r.status}`);

// Page-height spread flags locales whose copy blew past the design's rhythm.
const gateRows = rows.filter(r => r.vp === 'iphone');
if (gateRows.length > 1) {
  const base = gateRows.find(r => r.lang === 'en');
  if (base) {
    console.log('\nHeight vs en @390:');
    for (const r of gateRows) {
      const delta = Math.round(((r.height - base.height) / base.height) * 100);
      const mark = Math.abs(delta) > 25 ? '  <-- review' : '';
      console.log(`  ${w(r.lang, 10)}${delta >= 0 ? '+' : ''}${delta}%${mark}`);
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} failing combination(s):\n`);
  for (const f of failures) {
    console.error(`  [${f.vp} / ${f.lang}]`);
    for (const p of f.problems) console.error(`    - ${p}`);
  }
  console.error(`\nShots written to ${shotDir}`);
  process.exit(1);
}

console.log(`\nAll ${rows.length} combinations passed. Shots in ${shotDir}`);
