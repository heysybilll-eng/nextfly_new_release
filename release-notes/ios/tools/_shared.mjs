import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = path.join(ROOT, 'index.html');
export const ASSETS = path.join(ROOT, 'assets');
export const OUT = path.join(ROOT, '.out');

/** Every locale the page ships. Keep in sync with SUPPORTED in index.html. */
export const LOCALES = ['en', 'fr', 'de', 'it', 'es', 'ja', 'ko', 'zh-Hant', 'id', 'hi', 'ru'];

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

export function pageUrl({ lang, version } = {}) {
  const q = new URLSearchParams();
  if (lang) q.set('lang', lang);
  if (version) q.set('v', version);
  const qs = q.toString();
  return `file://${PAGE}${qs ? '?' + qs : ''}`;
}
