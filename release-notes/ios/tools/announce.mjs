/**
 * Renders the announcement image that goes out with the release post.
 *
 *   node tools/announce.mjs                 # every locale, every size
 *   node tools/announce.mjs --locale zh     # just one
 *
 * The page copy already lists the features, so this image is not another copy
 * of that list — it shows the product. Version, one headline, the three most
 * recognisable screens, and the feature names in one compact run so the image
 * still explains itself when someone forwards it without the text.
 *
 * Colours are read out of index.html rather than restated here, so the card
 * cannot drift away from the page it is announcing.
 *
 * Fonts: the container has no SF Pro and its only CJK face is WenQuanYi Zen
 * Hei, which looks dated at display sizes. Inter and Noto Sans SC are fetched
 * once into .fonts/ (gitignored, ~18 MB) and embedded as data URIs, because
 * Chromium here has no outbound network of its own.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { ROOT, PAGE, OUT, VERSION, argOf } from './_shared.mjs';

const run = promisify(execFile);
const FONTDIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.fonts');

/* ---- fonts ---------------------------------------------------------------
   A user agent predating woff2 (Chrome 36) makes Google Fonts serve one
   complete .woff per weight instead of ~100 unicode-range woff2 shards, which
   is what makes a one-shot fetch practical for a CJK face. */
const UA = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) '
         + 'Chrome/30.0.1599.101 Safari/537.36';
const FACES = [
  ['Inter', 400], ['Inter', 600], ['Inter', 700],
  ['NotoSansSC', 400], ['NotoSansSC', 500], ['NotoSansSC', 700],
];

async function ensureFonts() {
  await fs.mkdir(FONTDIR, { recursive: true });
  const have = await fs.readdir(FONTDIR);
  if (FACES.every(([f, w]) => have.includes(`${f}-${w}.woff`))) return;

  console.log('fetching fonts into .fonts/ (once) …');
  const url = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700'
            + '&family=Inter:wght@400;600;700';
  const { stdout: css } = await run('curl', ['-sS', '--max-time', '40', '-A', UA, url]);
  if (!/@font-face/.test(css)) throw new Error('Google Fonts returned no @font-face rules');

  for (const blk of css.split('@font-face').slice(1)) {
    const fam = blk.match(/font-family:\s*'([^']+)'/)?.[1].replace(/\s/g, '');
    const wt = blk.match(/font-weight:\s*(\d+)/)?.[1];
    const src = blk.match(/url\((https:\/\/[^)]+)\)/)?.[1];
    if (!fam || !wt || !src) continue;
    const dest = path.join(FONTDIR, `${fam}-${wt}.woff`);
    await run('curl', ['-sSL', '--max-time', '120', '-A', UA, '-o', dest, src]);
  }
  const missing = [];
  for (const [f, w] of FACES) {
    const st = await fs.stat(path.join(FONTDIR, `${f}-${w}.woff`)).catch(() => null);
    if (!st || st.size < 20_000) missing.push(`${f}-${w}`);
  }
  if (missing.length) throw new Error(`font download incomplete: ${missing.join(', ')}`);
}

async function fontCss() {
  let out = '';
  for (const [fam, wt] of FACES) {
    const buf = await fs.readFile(path.join(FONTDIR, `${fam}-${wt}.woff`));
    const name = fam === 'Inter' ? 'Inter' : 'Noto Sans SC';
    out += `@font-face{font-family:'${name}';font-style:normal;font-weight:${wt};`
         + `src:url(data:font/woff;base64,${buf.toString('base64')}) format('woff');}\n`;
  }
  return out;
}

/* ---- tokens, read from the page this card announces ---------------------- */
const page = await fs.readFile(PAGE, 'utf8');
const rootBlock = page.match(/:root \{([\s\S]*?)\n\}/)?.[1];
if (!rootBlock) throw new Error('Could not read :root tokens from index.html');
const token = n => {
  const v = rootBlock.match(new RegExp(`--${n}:\\s*([^;]+);`))?.[1].trim();
  if (!v) throw new Error(`token --${n} not found in index.html`);
  return v;
};
const T = {
  bg: token('surface-bg'), elevated: token('surface-elevated'),
  hairline: token('border-hairline'), primary: token('text-primary'),
  secondary: token('text-secondary'), tertiary: token('text-tertiary'),
  accent: token('accent-primary'), gold: token('marker-gold'),
};

/* ---- copy ---------------------------------------------------------------- */
const COPY = {
  zh: {
    headline: '七项更新',
    sub: '让接送机这件事，更省心一点',
    groups: [
      { label: '双端', items: ['关注角色', '按人筛选', '航班备注'] },
      { label: '仅 iOS', items: ['主屏幕小组件', '灵动岛焕新', '航班号键盘', '意见反馈'] },
    ],
    cta: {
      upcoming: { both: '即将上线', ios: '即将上线', android: '即将上线' },
      live: { both: 'iOS / Android 已上线', ios: 'App Store 已上线',
              android: 'Google Play 已上线' },
    },
  },
  en: {
    headline: 'Seven things that are new',
    sub: 'Making airport runs a little easier',
    groups: [
      { label: 'Both', items: ['Follow roles', 'Filter by person', 'Flight notes'] },
      { label: 'iOS only', items: ['Home Screen widget', 'Live Activity',
                                   'Flight-number keyboard', 'In-app feedback'] },
    ],
    cta: {
      upcoming: { both: 'Coming soon', ios: 'Coming soon', android: 'Coming soon' },
      live: { both: 'Now on iOS & Android', ios: 'Now on the App Store',
              android: 'Now on Google Play' },
    },
  },
};

/* The announcement goes out while the build is still in review, so the card
   ships in two states and the same command regenerates it the day it lands. */
const STATE = argOf('--state') || 'upcoming';
if (!['upcoming', 'live'].includes(STATE)) {
  throw new Error(`--state must be "upcoming" or "live", got "${STATE}"`);
}

/* Which stores the pill names. Not every release goes out on both, so this is
   a flag rather than a constant. */
const STORES = argOf('--stores') || 'both';
if (!['both', 'ios', 'android'].includes(STORES)) {
  throw new Error(`--stores must be "both", "ios" or "android", got "${STORES}"`);
}

/* Two of the three are features both platforms get, because an Android reader
   should see something they can actually go and use. The Lock Screen earns its
   place anyway: it is the only dark screen, and without it the trio is three
   pale lists that blur together at thumbnail size. The platform rows above say
   which is which.

   This also keeps the Home Screen capture out of the card — it carries a
   "NextFly(Beta)" widget label from a TestFlight build. */
const SHOTS = ['shot-1.png', 'shot-3.png', 'shot-6.png'];

const SIZES = [
  { name: 'square', w: 1080, h: 1080 },
  { name: 'wide', w: 1200, h: 630 },
];

async function dataUri(rel) {
  const buf = await fs.readFile(path.join(ROOT, 'assets', rel));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function html({ copy, size, fonts, shots, hero, scheme }) {
  const dark = scheme === 'dark';
  const c = dark
    ? { bg: '#000000', elevated: '#1C1C1E', hairline: '#2C2C2E',
        primary: '#FFFFFF', secondary: '#8E8E93', tertiary: '#636366' }
    : { bg: T.bg, elevated: T.elevated, hairline: T.hairline,
        primary: T.primary, secondary: T.secondary, tertiary: T.tertiary };
  const wide = size.name === 'wide';
  const pad = wide ? 58 : 84;

  /* Phone height is derived, not guessed. The screenshots are 600x1301, so a
     height budget converts straight into a width and the three phones cannot
     grow into the copy above them as the copy changes length. */
  const AR = 600 / 1301;
  const midH = wide ? 330 : 498;
  const midW = Math.round(midH * AR);
  const sideW = Math.round(midW * 0.87);

  return `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${size.w}px;height:${size.h}px;overflow:hidden}
body{
  background:${c.bg}; color:${c.primary};
  font-family:'Inter','Noto Sans SC',sans-serif;
  -webkit-font-smoothing:antialiased;
  overflow:hidden; position:relative;
  display:${wide ? 'flex' : 'block'};
  padding:${pad}px;
}
/* One soft wash for the phones to stand on, so they read as placed rather
   than floating on flat white. It bleeds off-frame on purpose; the frame
   clips it, and the content check below measures content, not this. */
.wash{
  position:absolute; z-index:0;
  ${wide
    ? `right:-140px; top:50%; transform:translateY(-50%);
       width:760px; height:760px; border-radius:50%;`
    : `left:50%; transform:translateX(-50%); bottom:-340px;
       width:1240px; height:820px; border-radius:620px 620px 0 0;`}
  background:${c.elevated};
}
.col{position:relative; z-index:2; ${wide ? 'width:498px;' : ''}}
.eyebrow{
  font-size:${wide ? 18 : 22}px; font-weight:600; letter-spacing:.20em;
  color:${c.tertiary}; text-transform:uppercase;
}
.title{display:flex; align-items:center; gap:${wide ? 14 : 20}px;
       margin-top:${wide ? 10 : 16}px;}
.ver{font-size:${wide ? 68 : 100}px; font-weight:700; letter-spacing:-.035em;
     line-height:1.04; color:${c.primary};}
.cta{
  font-size:${wide ? 16 : 20}px; font-weight:600; color:${T.accent};
  border:2px solid ${T.accent}; border-radius:999px;
  padding:${wide ? '5px 13px' : '7px 17px'}; white-space:nowrap;
  position:relative; top:${wide ? 4 : 7}px;
}
.headline{font-size:${wide ? 30 : 44}px; font-weight:700; letter-spacing:-.015em;
          margin-top:${wide ? 14 : 22}px; color:${c.primary};}
.sub{font-size:${wide ? 19 : 26}px; font-weight:400; color:${c.secondary};
     margin-top:${wide ? 7 : 12}px;}
/* Every name, grouped by platform. The image gets forwarded without the post
   more often than anyone plans for, so it has to stand alone — and standing
   alone means an Android reader can tell at a glance which four of these are
   not coming to their phone. */
.row{display:flex; align-items:baseline; gap:${wide ? 10 : 14}px;
     margin-top:${wide ? 12 : 20}px;}
.tag{
  flex:none; width:${wide ? 62 : 78}px; text-align:center;
  font-size:${wide ? 13 : 16}px; font-weight:600; letter-spacing:.01em;
  color:${c.tertiary}; border:1px solid ${c.hairline}; border-radius:999px;
  padding:${wide ? '3px 0' : '4px 0'}; position:relative; top:${wide ? -1 : -2}px;
}
.feats{display:flex; flex-wrap:wrap; align-items:baseline;
       max-width:${wide ? 404 : 820}px; row-gap:${wide ? 4 : 8}px;}
.feat{font-size:${wide ? 16 : 20}px; font-weight:500; color:${c.secondary};
      white-space:nowrap;}
/* The separator sits inside the preceding item so a wrap can never put a
   dot at the start of a line. */
.dot{color:${c.tertiary}; padding:0 ${wide ? 8 : 11}px;}
/* The release's own illustration, same asset the page uses, so the card and
   the page are visibly the same announcement. */
.hero{
  position:absolute; z-index:1; pointer-events:none;
  ${wide ? 'right:34px; top:30px; width:150px;'
         : 'right:74px; top:86px; width:270px;'}
  opacity:${dark ? .92 : .86};
}
.phones{
  position:absolute; z-index:2; left:0; right:0;
  ${wide ? `bottom:${pad}px; justify-content:flex-end; padding-right:${pad}px;`
         : `bottom:${pad - 14}px; justify-content:center;`}
  display:flex; align-items:flex-end; gap:${wide ? 18 : 28}px;
}
.phone{
  border-radius:${wide ? 18 : 26}px; border:1px solid ${c.hairline};
  box-shadow:0 ${wide ? 16 : 24}px ${wide ? 36 : 56}px rgba(0,0,0,${dark ? .55 : .14}),
             0 2px 6px rgba(0,0,0,${dark ? .45 : .06});
  display:block; background:${c.bg};
}
.phone.side{width:${sideW}px; margin-bottom:${wide ? 20 : 34}px;}
.phone.mid{width:${midW}px;}
</style>
<div class="wash"></div>
<img class="hero" src="${hero}">
<div class="col">
  <div class="eyebrow">NextFly</div>
  <div class="title">
    <span class="ver">${VERSION}</span>
    <span class="cta">${copy.cta[STATE][STORES]}</span>
  </div>
  <div class="headline">${copy.headline}</div>
  <div class="sub">${copy.sub}</div>
  ${copy.groups.map(g => `<div class="row">
    <span class="tag">${g.label}</span>
    <span class="feats">${g.items
      .map((f, i) => `<span class="feat">${f}` +
                     (i < g.items.length - 1 ? `<span class="dot">·</span>` : '') +
                     `</span>`)
      .join('')}</span>
  </div>`).join('')}
</div>
<div class="phones">
  <img class="phone side" src="${shots[0]}">
  <img class="phone mid"  src="${shots[1]}">
  <img class="phone side" src="${shots[2]}">
</div>
`;
}

/* ---- render -------------------------------------------------------------- */
await ensureFonts();
const fonts = await fontCss();
const shots = await Promise.all(SHOTS.map(dataUri));
const heroArt = { light: await dataUri('hero.png'), dark: await dataUri('hero-white.png') };

const onlyLocale = argOf('--locale');
const onlyScheme = argOf('--scheme');
const outDir = path.join(OUT, 'announce');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const made = [];
for (const [key, copy] of Object.entries(COPY)) {
  if (onlyLocale && key !== onlyLocale) continue;
  for (const scheme of ['light', 'dark']) {
    if (onlyScheme && scheme !== onlyScheme) continue;
    for (const size of SIZES) {
      const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1,
      });
      const p = await ctx.newPage();
      await p.setContent(html({ copy, size, fonts, shots, hero: heroArt[scheme], scheme }), { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      /* The card is a fixed frame, so the frame clips everything — which means
         a layout that has gone wrong looks identical to one that is fine. The
         wash is *supposed* to bleed, so measure the content instead: every
         text element and every phone must sit fully inside the frame. */
      const clipped = await p.evaluate(() => {
        const W = window.innerWidth, H = window.innerHeight;
        const out = [];
        for (const el of document.querySelectorAll(
              '.eyebrow,.ver,.headline,.sub,.feat,.tag,.cta,.phone')) {
          const r = el.getBoundingClientRect();
          if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) {
            out.push(`${el.className.split(' ')[0]}:` +
                     `${Math.round(r.left)},${Math.round(r.top)}` +
                     `-${Math.round(r.right)},${Math.round(r.bottom)}`);
          }
        }
        /* Phones must not sit on the copy. A real rectangle intersection, not
           a vertical comparison: in the wide layout the phones are beside the
           text, so overlapping rows are expected and only overlapping area is
           a fault. */
        const hit = (a, b) => a.left < b.right && b.left < a.right &&
                              a.top < b.bottom && b.top < a.bottom;
        const copyRects = [...document.querySelectorAll('.eyebrow,.ver,.cta,.headline,.sub,.feat,.tag')]
          .map(e => e.getBoundingClientRect());
        for (const ph of document.querySelectorAll('.phone')) {
          const r = ph.getBoundingClientRect();
          if (copyRects.some(cr => hit(r, cr))) out.push('phone overlaps copy');
        }
        return out;
      });
      if (clipped.length) {
        throw new Error(`${key}/${scheme}/${size.name}: ${clipped.join('  ')}`);
      }
      const file = path.join(outDir,
        `nextfly-${VERSION}-${key}-${STATE}-${STORES}-${scheme}-${size.name}.png`);
      await p.screenshot({ path: file });
      made.push(file);
      await ctx.close();
    }
  }
}
await browser.close();

const kb = n => (n / 1024).toFixed(0) + ' KB';
for (const f of made) console.log(`${path.basename(f).padEnd(42)} ${kb((await fs.stat(f)).size)}`);
console.log(`\n${made.length} images in ${outDir}`);
