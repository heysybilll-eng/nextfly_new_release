/**
 * Executable fidelity gate.
 *
 *   node tools/assert-spec.mjs
 *
 * The design handoff states every colour, type size, spacing and radius as a
 * literal value. This encodes that spec and asserts the built page resolves to
 * it, in both schemes.
 *
 * Why this and not a pixel diff against `iOS Release Notes H5.dc.html`: that
 * file is a design-canvas prototype that only renders under its own runtime
 * (`support.js`) and design-system bundle (`_ds/_ds_bundle.js`). Without those
 * the `<x-dc>` tree is never processed and its `{{ }}` bindings stay unfilled,
 * so it cannot be screenshotted for comparison. The handoff's stated values are
 * the authority instead — and asserting computed values is stronger than pixels
 * anyway, since this container has no SF Pro and rasterises type differently
 * from iOS regardless of how correct the CSS is.
 *
 * tools/diff.mjs and tools/assert-styles.mjs remain for the day the full design
 * bundle is available locally.
 */
import { chromium } from 'playwright';
import { VIEWPORTS, CHROMIUM, pageUrl } from './_shared.mjs';

const rgb = (r, g, b) => `rgb(${r}, ${g}, ${b})`;

const LIGHT = {
  bg:        rgb(255, 255, 255),  // --surface-bg      #FFFFFF
  elevated:  rgb(247, 247, 249),  // --surface-elevated #F7F7F9
  card:      rgb(242, 242, 247),  // --surface-card     #F2F2F7
  hairline:  rgb(227, 227, 232),  // --border-hairline  #E3E3E8
  primary:   rgb(22, 22, 26),     // --text-primary     #16161A
  secondary: rgb(110, 110, 115),  // --text-secondary   #6E6E73
  tertiary:  rgb(174, 174, 178),  // --text-tertiary    #AEAEB2
  heroArt:   'rocket-lineart.png'
};

const DARK = {
  bg:        rgb(0, 0, 0),        // #000000
  elevated:  rgb(28, 28, 30),     // #1C1C1E
  card:      rgb(35, 35, 38),     // #232326
  hairline:  rgb(44, 44, 46),     // #2C2C2E
  primary:   rgb(255, 255, 255),  // #FFFFFF
  secondary: rgb(142, 142, 147),  // #8E8E93
  tertiary:  rgb(99, 99, 102),    // #636366
  heroArt:   'rocket-lineart-white.png'
};

const ACCENT = rgb(62, 106, 225); // --accent-primary #3E6AE1

/** [selector, property, expected]  — expected may be a value or a t=>bool */
function specFor(C) {
  return [
    ['body', 'backgroundColor', C.bg],
    ['body', 'color', C.primary],

    // Header — sticky, no bottom border
    ['.hdr', 'position', 'sticky'],
    ['.hdr', 'top', '0px'],
    ['.hdr', 'zIndex', '20'],
    ['.hdr', 'backgroundColor', C.bg],
    ['.hdr', 'borderBottomWidth', '0px'],
    ['.hdr__in', 'maxWidth', '480px'],
    ['.hdr__in', 'paddingTop', '8px'],
    ['.hdr__in', 'paddingLeft', '12px'],
    ['.hdr__in', 'gap', '8px'],
    ['.hdr__title', 'fontSize', '17px'],
    ['.hdr__title', 'fontWeight', '600'],
    ['.hdr__title', 'letterSpacing', '-0.17px'],
    ['.hdr__title', 'textOverflow', 'ellipsis'],

    // Language pill
    ['.langbtn', 'height', '32px'],
    ['.langbtn', 'paddingLeft', '12px'],
    ['.langbtn', 'gap', '4px'],
    ['.langbtn', 'fontSize', '13px'],
    ['.langbtn', 'fontWeight', '500'],
    ['.langbtn', 'backgroundColor', C.elevated],
    ['.langbtn', 'borderTopWidth', '1px'],
    ['.langbtn', 'borderTopColor', C.hairline],

    // Body column
    ['.body', 'maxWidth', '480px'],
    ['.body', 'paddingTop', '32px'],
    ['.body', 'paddingLeft', '18px'],
    ['.body', 'gap', '32px'],

    // Hero
    ['.hero', 'gap', '12px'],
    ['.hero-art', 'maxWidth', '340px'],
    ['.hero-art', 'marginBottom', '8px'],
    ['.hero-art', 'backgroundImage', C.heroArt],
    ['.hero-art', 'filter', 'none'],   // the invert hack must stay gone
    ['.hero__heading', 'fontSize', '34px'],
    ['.hero__heading', 'fontWeight', '700'],
    ['.hero__heading', 'lineHeight', '35.7px'],   // 1.05
    ['.hero__heading', 'letterSpacing', '-0.68px'], // -0.02em
    ['.hero__heading', 'marginTop', '8px'],
    ['.hero__intro', 'fontSize', '17px'],
    ['.hero__intro', 'lineHeight', '23.8px'],     // 1.4
    ['.hero__intro', 'color', C.secondary],

    // Section label + the page's only hairline rule
    ['.seclabel', 'gap', '12px'],
    ['.seclabel__text', 'fontSize', '13px'],
    ['.seclabel__text', 'fontWeight', '600'],
    ['.seclabel__text', 'letterSpacing', '1.04px'], // 0.08em
    ['.seclabel__text', 'color', C.secondary],
    ['.seclabel__rule', 'height', '1px'],
    ['.seclabel__rule', 'backgroundColor', C.hairline],

    // Feature blocks
    ['.f', 'gap', '10px'],
    ['.f__title', 'fontSize', '22px'],
    ['.f__title', 'fontWeight', '600'],
    ['.f__title', 'lineHeight', '26.4px'],        // 1.2
    ['.f__title', 'letterSpacing', '-0.22px'],    // -0.01em
    ['.f__title', 'color', C.primary],
    ['.f__body', 'fontSize', '17px'],
    ['.f__body', 'lineHeight', '28.9px'],         // 1.7, blocks 1-4
    ['.f__body', 'color', C.secondary],
    ['.f--plain .f__body', 'lineHeight', '24.65px'], // 1.45, block 5

    // Screenshot panel — no border on the panel, 1px on the image
    ['.shot', 'marginTop', '6px'],
    ['.shot', 'borderRadius', '16px'],
    ['.shot', 'backgroundColor', C.elevated],
    ['.shot', 'paddingTop', '22px'],
    ['.shot', 'borderTopWidth', '0px'],
    ['.shot', 'overflow', 'hidden'],
    ['.shot img', 'borderRadius', '14px'],
    ['.shot img', 'borderTopWidth', '1px'],
    ['.shot img', 'borderTopColor', C.hairline],

    // Parity card
    ['.parity', 'borderRadius', '16px'],
    ['.parity', 'borderTopWidth', '1px'],
    ['.parity', 'borderTopColor', C.hairline],
    ['.parity', 'backgroundColor', C.card],
    ['.parity', 'paddingTop', '16px'],
    ['.parity', 'gap', '8px'],
    ['.parity__row', 'gap', '8px'],
    ['.parity__row', 'color', ACCENT],
    ['.parity__title', 'fontSize', '17px'],
    ['.parity__title', 'fontWeight', '600'],
    ['.parity__title', 'letterSpacing', '-0.17px'],
    ['.parity__title', 'color', C.primary],
    ['.parity__body', 'fontSize', '15px'],
    ['.parity__body', 'lineHeight', '21.75px'],   // 1.45
    ['.parity__body', 'color', C.secondary],

    // Feedback line
    ['.feedback', 'fontSize', '13px'],
    ['.feedback', 'lineHeight', '19.5px'],        // 1.5
    ['.feedback', 'color', C.tertiary],

    // Sheet
    ['.sheet__panel', 'maxWidth', '480px'],
    ['.sheet__panel', 'backgroundColor', C.elevated],
    ['.sheet__panel', 'borderTopLeftRadius', '24px'],
    ['.sheet__grabber', 'width', '36px'],
    ['.sheet__grabber', 'height', '5px'],
    ['.sheet__grabber', 'backgroundColor', C.hairline],
    ['.sheet__title', 'fontSize', '17px'],
    ['.sheet__title', 'fontWeight', '600'],
    ['.sheet__row', 'minHeight', '52px'],
    ['.sheet__row', 'fontSize', '17px'],
    ['.sheet__row', 'borderBottomWidth', '1px'],
    ['.sheet__row', 'borderBottomColor', C.hairline]
  ];
}

const NUMERIC = /^-?[\d.]+px$/;
const vp = VIEWPORTS.find(v => v.gate);
const browser = await chromium.launch({ executablePath: CHROMIUM });
let failed = 0;
let checked = 0;

for (const [scheme, C] of [['light', LIGHT], ['dark', DARK]]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    colorScheme: scheme
  });
  const page = await ctx.newPage();
  await page.goto(pageUrl({ lang: 'en' }), { waitUntil: 'load' });
  // The sheet must be open for its computed styles to be measurable.
  await page.click('#langBtn');
  await page.waitForTimeout(350);

  const results = await page.evaluate((spec) => {
    return spec.map(([sel, prop, want]) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, prop, want, got: '<no such element>', ok: false };
      let got = getComputedStyle(el)[prop];
      // url() resolves to an absolute address at computed time; the filename
      // is the part the spec actually pins.
      if (prop === 'backgroundImage' && got.startsWith('url(')) {
        got = got.replace(/^url\(["']?|["']?\)$/g, '').split('/').pop();
      }
      return { sel, prop, want, got, ok: got === want };
    });
  }, specFor(C));

  const bad = [];
  for (const r of results) {
    checked++;
    if (r.ok) continue;
    // Sub-pixel tolerance for derived line-heights and letter-spacing.
    if (NUMERIC.test(String(r.want)) && NUMERIC.test(String(r.got))) {
      if (Math.abs(parseFloat(r.want) - parseFloat(r.got)) <= 0.5) continue;
    }
    bad.push(r);
  }

  console.log(`\n[${scheme}]  ${results.length - bad.length}/${results.length} assertions pass`);
  for (const r of bad) {
    console.log(`  ${r.sel} { ${r.prop} }  expected ${r.want}  got ${r.got}`);
  }
  failed += bad.length;

  // The handoff is explicit: no drop shadows anywhere on this page.
  const shadowed = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter(el => {
        const s = getComputedStyle(el).boxShadow;
        return s && s !== 'none';
      })
      .map(el => el.className || el.tagName)
  );
  if (shadowed.length) {
    console.log(`  box-shadow present on: ${shadowed.join(', ')} (spec says none)`);
    failed += shadowed.length;
  }

  await ctx.close();
}

await browser.close();

/* ============================================================================
   BREAKPOINTS
   ---------------------------------------------------------------------------
   Neither breakpoint comes from the design — the handoff specifies one scale
   for one phone-width column. They exist so the page holds up on a 320pt
   phone and when the URL is opened outside the app. Asserted here so they
   cannot silently regress, and so the 390pt gate above stays the authority on
   design fidelity.
   ========================================================================== */
const BREAKPOINTS = [
  {
    name: 'narrow (320)',
    width: 320, height: 568, dpr: 2, mobile: true,
    checks: [
      ['.hero__heading', 'fontSize', '28px'],
      ['.f__title', 'fontSize', '18px'],
      ['.body', 'paddingLeft', '16px'],
      ['.f__body', 'fontSize', '17px'],          // body copy must NOT shrink
      ['.hdr', 'position', 'sticky']
    ]
  },
  {
    name: 'wide (1280)',
    width: 1280, height: 800, dpr: 1, mobile: false,
    checks: [
      ['body', 'backgroundColor', LIGHT.elevated],
      ['.shell', 'maxWidth', '480px'],
      ['.shell', 'backgroundColor', LIGHT.bg],
      ['.shell', 'borderTopWidth', '1px'],
      ['.shell', 'borderTopColor', LIGHT.hairline],
      ['.shell', 'borderRadius', '20px'],
      ['.hdr', 'position', 'static'],            // must not detach from the card
      ['.hero__heading', 'fontSize', '34px'],    // design scale, unchanged
      ['.f__title', 'fontSize', '22px']
    ]
  },
  {
    name: 'phone (390) unchanged',
    width: 390, height: 844, dpr: 3, mobile: true,
    checks: [
      ['body', 'backgroundColor', LIGHT.bg],     // no card treatment in-app
      ['.shell', 'maxWidth', 'none'],
      ['.shell', 'borderTopWidth', '0px'],
      ['.hdr', 'position', 'sticky'],
      ['.hero__heading', 'fontSize', '34px'],
      ['.body', 'paddingLeft', '18px']
    ]
  }
];

const bp = await chromium.launch({ executablePath: CHROMIUM });
for (const b of BREAKPOINTS) {
  const ctx = await bp.newContext({
    viewport: { width: b.width, height: b.height },
    deviceScaleFactor: b.dpr,
    isMobile: b.mobile,
    colorScheme: 'light'
  });
  const page = await ctx.newPage();
  await page.goto(pageUrl({ lang: 'en' }), { waitUntil: 'load' });
  await page.waitForTimeout(150);

  const results = await page.evaluate((spec) => spec.map(([sel, prop, want]) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, prop, want, got: '<no such element>', ok: false };
    const got = getComputedStyle(el)[prop];
    return { sel, prop, want, got, ok: got === want };
  }), b.checks);

  const bad = results.filter(r => !r.ok);
  checked += results.length;
  failed += bad.length;
  console.log(`\n[${b.name}]  ${results.length - bad.length}/${results.length} assertions pass`);
  for (const r of bad) console.log(`  ${r.sel} { ${r.prop} }  expected ${r.want}  got ${r.got}`);

  await ctx.close();
}
await bp.close();

if (failed) {
  console.error(`\nFAIL: ${failed} deviation(s) from the design spec.`);
  process.exit(1);
}
console.log(`\nPASS: ${checked} assertions across both schemes match the design handoff.`);
