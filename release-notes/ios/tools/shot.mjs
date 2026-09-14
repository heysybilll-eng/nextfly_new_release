/**
 * Screenshot + layout regression sweep.
 *
 *   node tools/shot.mjs --all                    every locale x viewport x scheme
 *   node tools/shot.mjs --gate                   gate viewport only, both schemes
 *   node tools/shot.mjs --lang de --vp se --scheme dark
 *
 * Beyond producing PNGs this asserts what actually breaks a WebView release-
 * notes page: horizontal overflow, clipped text, images that never decoded,
 * unresolved copy, and missing marker highlights. Exits non-zero on any
 * failure so it can gate CI.
 *
 * Dark mode is driven through prefers-color-scheme (the production path), not
 * the ?theme= QA override, so the sweep exercises what ships.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LOCALES, VIEWPORTS, SCHEMES, OUT, CHROMIUM, argOf, hasFlag, pageUrl, RELEASE } from './_shared.mjs';

const HERO = {
  'v2.0.5': ['rocket-lineart.png', 'rocket-lineart-white.png'],
  'v2.0.6': ['hero.png', 'hero-white.png']
}[RELEASE];

const ONE_LANG = argOf('--lang');
const ONE_VP = argOf('--vp');
const ONE_SCHEME = argOf('--scheme');
const GATE_ONLY = hasFlag('--gate');

/** Feature bodies 1-4 carry marker-underlined phrases; block 5 does not. */
const MARKED_KEYS = { 'v2.0.5': ['f1b','f2b','f3b','f4b'], 'v2.0.6': ['f1b','f2b','f3b','f4b','f5b','f6b'] }[RELEASE];

const locales = ONE_LANG ? [ONE_LANG] : LOCALES;
const schemes = ONE_SCHEME ? [ONE_SCHEME] : SCHEMES;
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

for (const scheme of schemes) {
  for (const vp of viewports) {
    for (const lang of locales) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: true,
        hasTouch: true,
        locale: lang,
        colorScheme: scheme
      });
      const page = await ctx.newPage();

      const jsErrors = [];
      page.on('pageerror', e => jsErrors.push(String(e)));

      await page.goto(pageUrl({ lang }), { waitUntil: 'load' });
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
        await Promise.all(
          [...document.images].map(i => i.complete ? null : i.decode().catch(() => null))
        );
      });
      await page.waitForTimeout(120);

      const probe = await page.evaluate((markedKeys) => {
        const de = document.documentElement;
        const overflow = de.scrollWidth - de.clientWidth;

        const wide = [];
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > de.clientWidth + 0.5 && el !== de && el !== document.body) {
            wide.push(`${el.tagName.toLowerCase()}.${el.className || '-'} (${Math.round(r.width)}px)`);
          }
        });

        // Text taller than its box = clipped glyphs (the Devanagari failure mode).
        const clipped = [];
        document.querySelectorAll('h1, h2, .f__title, .parity__title, .hdr__title').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
            clipped.push(el.className || el.tagName);
          }
        });

        const empty = [...document.querySelectorAll('[data-t]')]
          .filter(el => !el.textContent.trim())
          .map(el => el.getAttribute('data-t'));

        // Unparsed markup tokens leaking into rendered copy.
        const leaked = [...document.querySelectorAll('[data-t]')]
          .filter(el => /\[\[|\]\]/.test(el.textContent))
          .map(el => el.getAttribute('data-t'));

        // Every marked block must actually produce highlight spans.
        const missingMarks = markedKeys.filter(k => {
          const el = document.querySelector(`[data-t="${k}"]`);
          return !el || el.querySelectorAll('.mark').length === 0;
        });

        const brokenImages = [...document.images]
          .filter(i => !i.complete || i.naturalWidth === 0)
          .map(i => i.getAttribute('src'));

        // The hero illustration is painted from a CSS token, so it is not in
        // document.images and needs its own check.
        const heroArt = getComputedStyle(document.querySelector('.hero-art')).backgroundImage;

        // The sheet must list every locale and mark exactly one active.
        const rowsCount = document.querySelectorAll('.sheet__row').length;
        const activeCount = document.querySelectorAll('.sheet__row[aria-selected="true"]').length;

        return {
          lang: de.lang,
          bg: getComputedStyle(document.body).backgroundColor,
          overflow, wide: wide.slice(0, 5), clipped, empty, leaked,
          missingMarks, brokenImages, rowsCount, activeCount, heroArt,
          height: document.body.scrollHeight
        };
      }, MARKED_KEYS);

      const tag = `${vp.name}-${scheme}-${lang}`;
      await page.screenshot({ path: path.join(shotDir, `${tag}.png`), fullPage: true });

      const problems = [];
      if (probe.overflow > 0) problems.push(`h-overflow ${probe.overflow}px [${probe.wide.join(', ')}]`);
      if (probe.clipped.length) problems.push(`clipped: ${probe.clipped.join(', ')}`);
      if (probe.empty.length) problems.push(`empty strings: ${probe.empty.join(', ')}`);
      if (probe.leaked.length) problems.push(`unparsed [[ ]] in: ${probe.leaked.join(', ')}`);
      if (probe.missingMarks.length) problems.push(`no highlight spans in: ${probe.missingMarks.join(', ')}`);
      if (probe.brokenImages.length) problems.push(`broken images: ${probe.brokenImages.join(', ')}`);
      const wantHero = scheme === 'dark' ? HERO[1] : HERO[0];
      if (!probe.heroArt || probe.heroArt === 'none') problems.push('hero illustration has no background-image');
      else if (!probe.heroArt.includes(wantHero)) problems.push(`hero art is ${probe.heroArt}, expected ${wantHero}`);
      if (probe.rowsCount !== LOCALES.length) problems.push(`sheet has ${probe.rowsCount} rows, expected ${LOCALES.length}`);
      if (probe.activeCount !== 1) problems.push(`sheet marks ${probe.activeCount} active rows, expected 1`);
      if (jsErrors.length) problems.push(`js errors: ${jsErrors.join(' | ')}`);
      if (probe.lang !== lang) problems.push(`lang resolved to "${probe.lang}", expected "${lang}"`);

      // Verify the scheme actually took effect rather than silently staying light.
      const isBlack = /rgb\(0,\s*0,\s*0\)/.test(probe.bg);
      if (scheme === 'dark' && !isBlack) problems.push(`dark scheme did not apply (body bg ${probe.bg})`);
      if (scheme === 'light' && isBlack) problems.push(`light scheme rendered dark (body bg ${probe.bg})`);

      rows.push({ vp: vp.name, scheme, lang, height: probe.height, status: problems.length ? 'FAIL' : 'ok' });
      if (problems.length) failures.push({ tag, problems });

      await ctx.close();
    }
  }
}

await browser.close();

const w = (s, n) => String(s).padEnd(n);
console.log(`\n${w('viewport', 10)}${w('scheme', 8)}${w('locale', 9)}${w('page h', 9)}status`);
console.log('-'.repeat(45));
for (const r of rows) {
  console.log(`${w(r.vp, 10)}${w(r.scheme, 8)}${w(r.lang, 9)}${w(r.height + 'px', 9)}${r.status}`);
}

const gate = rows.filter(r => r.vp === 'iphone' && r.scheme === 'light');
const base = gate.find(r => r.lang === 'en');
if (base && gate.length > 1) {
  console.log('\nHeight vs en @390 (light):');
  for (const r of gate) {
    const d = Math.round(((r.height - base.height) / base.height) * 100);
    console.log(`  ${w(r.lang, 9)}${d >= 0 ? '+' : ''}${d}%${Math.abs(d) > 25 ? '  <-- review' : ''}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} failing combination(s):\n`);
  for (const f of failures) {
    console.error(`  [${f.tag}]`);
    for (const p of f.problems) console.error(`    - ${p}`);
  }
  console.error(`\nShots written to ${shotDir}`);
  process.exit(1);
}

console.log(`\nAll ${rows.length} combinations passed. Shots in ${shotDir}`);
