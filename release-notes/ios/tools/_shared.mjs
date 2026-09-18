import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fsSync from 'node:fs';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES = path.join(PROJECT, 'releases');

/**
 * One page per app release, sharing this toolchain. `--release v2.0.5` targets
 * an older one; without it the newest directory wins, so day-to-day work needs
 * no flag and an older release can still be rebuilt exactly as it shipped.
 */
function resolveRelease() {
  const want = process.argv[process.argv.indexOf('--release') + 1];
  const all = fsSync.readdirSync(RELEASES)
    .filter(d => /^v\d+(\.\d+)*$/.test(d))
    .sort((a, b) => {
      const pa = a.slice(1).split('.').map(Number);
      const pb = b.slice(1).split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
      }
      return 0;
    });
  if (!all.length) throw new Error(`No release directories under ${RELEASES}`);
  if (process.argv.includes('--release')) {
    if (!all.includes(want)) {
      throw new Error(`Unknown release "${want}". Known: ${all.join(', ')}`);
    }
    return want;
  }
  return all[all.length - 1];
}

export const RELEASE = resolveRelease();
export const VERSION = RELEASE.slice(1);
export const ROOT = path.join(RELEASES, RELEASE);
export const PAGE = path.join(ROOT, 'index.html');
export const ASSETS = path.join(ROOT, 'assets');
export const OUT = path.join(PROJECT, '.out', RELEASE);

/** Original captures, kept full-resolution outside the shipping tree. */
export const PICS = path.join(PROJECT, '..', '..', 'pics', VERSION);

/**
 * Design upload -> shipped asset name, per release.
 *
 * Lives here because two tools need it and they need different things from the
 * same files: the page wants them downscaled to a payload budget, the
 * announcement card wants them at full resolution. One map, so a renamed
 * capture cannot fix one tool and silently break the other.
 */
export const SOURCE_MAP = {
  'v2.0.5': [
    // Not in filename order: 2.PNG and 3.PNG are the light and dark captures of
    // the same Settings screen, feeding membership-expiry and Dark Mode.
    { from: '1.PNG',                            to: 'shot-1',               maxCssWidth: 300 },
    { from: 'Group 2.png',                      to: 'shot-2',               maxCssWidth: 300 },
    { from: '3.PNG',                            to: 'shot-3',               maxCssWidth: 300 },
    { from: '2.PNG',                            to: 'shot-4',               maxCssWidth: 300 },
    { from: '4.PNG',                            to: 'shot-5',               maxCssWidth: 300 },
    { from: 'rocket-lineart-even@2x.png',       to: 'rocket-lineart',       maxCssWidth: 340 },
    { from: 'rocket-lineart-even-white@2x.png', to: 'rocket-lineart-white', maxCssWidth: 340 }
  ],
  'v2.0.6': [
    { from: '他人航班关注.PNG',                     to: 'shot-1',     maxCssWidth: 300 },
    { from: '行程筛选器.PNG',                       to: 'shot-2',     maxCssWidth: 300 },
    { from: '备注.PNG',                            to: 'shot-3',     maxCssWidth: 300 },
    { from: '自定义键盘.PNG',                       to: 'shot-4',     maxCssWidth: 300 },
    { from: '小组件.PNG',                          to: 'shot-5',     maxCssWidth: 300 },
    { from: '实时活动_new.PNG',                     to: 'shot-6',     maxCssWidth: 300 },
    { from: '用户反馈页面.PNG',                     to: 'shot-7',     maxCssWidth: 300 },
    { from: 'header.png',                        to: 'hero',       maxCssWidth: 340 },
    { from: '0_3-white-line-transparent-4x.png', to: 'hero-white', maxCssWidth: 340 }
  ]
};

/** Every locale the page ships. Keep in sync with CODES in index.html. */
export const LOCALES = ['en', 'fr', 'de', 'it', 'es', 'ja', 'ko', 'zh-TW', 'id', 'hi', 'ru'];

/** The design ships as auto, so both schemes are part of the deliverable. */
export const SCHEMES = ['light', 'dark'];

/**
 * Viewports. `gate` marks the width the design was drawn at — that is the one
 * the pixel-fidelity threshold applies to. The others are reflow regression
 * checks only.
 */
export const VIEWPORTS = [
  { name: 'se',      width: 320, height: 568, dpr: 2, gate: false },
  { name: 'iphone',  width: 390, height: 844, dpr: 3, gate: true  },
  { name: 'promax',  width: 430, height: 932, dpr: 3, gate: false }
];

/** Chromium bundled with the container — never download a browser here. */
export const CHROMIUM = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium')
  : undefined;

export function argOf(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function hasFlag(flag) {
  return process.argv.includes(flag);
}

export function pageUrl({ lang, version, theme } = {}) {
  const q = new URLSearchParams();
  if (lang) q.set('lang', lang);
  if (version) q.set('v', version);
  if (theme) q.set('theme', theme);
  const qs = q.toString();
  return `file://${PAGE}${qs ? '?' + qs : ''}`;
}
