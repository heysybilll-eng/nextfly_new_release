/**
 * Builds a shareable preview of index.html.
 *
 *   node tools/preview.mjs
 *
 * The preview must be one self-contained file with no sibling requests, and
 * its host stamps data-theme on the root element rather than relying on
 * prefers-color-scheme alone. Both are hosting concerns, not product ones, so
 * they are applied here at build time and index.html stays untouched.
 *
 * What this does:
 *   1. inlines every asset as a data: URI
 *   2. unwraps doctype/html/head/body, since the host supplies that skeleton
 *   3. maps the existing colour tokens onto data-theme, derived from the
 *      stylesheet rather than restated, so the two cannot drift apart
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, PAGE, OUT, VERSION } from './_shared.mjs';

const TITLE = `NextFly ${VERSION} What&rsquo;s New`;
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

let html = await fs.readFile(PAGE, 'utf8');

/* A data: URI cannot live in a srcset — the comma in "base64,…" is parsed as a
   candidate separator, so the source silently fails to resolve. Drop the WebP
   <source> elements and let each <picture> fall through to its PNG <img>,
   whose src handles data URIs correctly. Same pixels, and it halves the file. */
const droppedSources = (html.match(/<source[^>]*>\s*/g) || []).length;
html = html.replace(/<source[^>]*>\s*/g, '');

// ---- 1. inline assets -------------------------------------------------------
const cache = new Map();
let bytes = 0;
async function uri(rel) {
  if (!cache.has(rel)) {
    const buf = await fs.readFile(path.join(ROOT, rel));
    bytes += buf.length;
    const mime = MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';
    cache.set(rel, `data:${mime};base64,${buf.toString('base64')}`);
  }
  return cache.get(rel);
}

// markup: src="assets/…"
for (const [, attr, rel] of [...html.matchAll(/(src)="(assets\/[^"]+)"/g)]) {
  html = html.replace(`${attr}="${rel}"`, `${attr}="${await uri(rel)}"`);
}
// stylesheet: url("assets/…") — the hero illustration is a CSS token
for (const [full, rel] of [...html.matchAll(/url\("(assets\/[^"]+)"\)/g)]) {
  html = html.split(full).join(`url("${await uri(rel)}")`);
}

// ---- 2. unwrap --------------------------------------------------------------
const style = html.match(/<style>([\s\S]*?)<\/style>/);
const body = html.match(/<body>([\s\S]*?)<\/body>/);
if (!style || !body) throw new Error('Could not locate <style> or <body> in index.html');

let css = style[1];

// ---- 3. derive the data-theme mapping --------------------------------------
// The dark block is the authority on which tokens are theme-dependent; the
// light values for those same tokens are read back out of :root. Nothing is
// restated by hand, so adding a token to the design updates the preview too.
const darkBlock = css.match(/:root\[data-scheme="dark"\]\s*\{([\s\S]*?)\}/);
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!darkBlock || !rootBlock) throw new Error('Could not locate the :root token blocks');

const darkDecls = darkBlock[1].trim();
const themedProps = [...darkDecls.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]);

const lightDecls = themedProps
  .map(prop => {
    const hit = rootBlock[1].match(new RegExp(`${prop}\\s*:\\s*([^;]+);`));
    if (!hit) throw new Error(`No light value found for ${prop}`);
    return `  ${prop}: ${hit[1].trim()};`;
  })
  .join('\n');

// An explicit light choice must also beat a dark OS, so widen the existing
// media-query guard to cover the host's attribute as well as our own.
css = css.replace(
  ':root:not([data-scheme="light"])',
  ':root:not([data-scheme="light"]):not([data-theme="light"])'
);

css += `

/* ============================================================================
   PREVIEW HOST THEMING  (build-time only — not present in the shipped page)
   ---------------------------------------------------------------------------
   The host stamps data-theme="dark"/"light" when the viewer picks a theme, and
   stamps nothing when they leave it on system. The bare :root above covers
   light, the media query above covers system-dark, and these two cover the
   explicit choices. Declared last so they win over the media query.

   --hero-art is one of those tokens, so the illustration swaps with the
   palette. An earlier version also forced filter: invert(1) here, left over
   from when a single black asset was inverted for dark mode; layered on top
   of the white asset it now yields black strokes on a black ground.
   ========================================================================== */
:root[data-theme="dark"] {
${darkDecls}
}
:root[data-theme="light"] {
${lightDecls}
}
`;

/* The host supplies <head>, so this meta is normally redundant — but if it
   ever ships without one, a mobile browser falls back to a ~980px layout
   viewport, the min-width:600px rule matches on a phone, and the page renders
   as a desktop card at unreadable size. Browsers honour the tag wherever they
   find it, and a duplicate with identical content is inert. */
const out = `<title>${TITLE}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
${css}
</style>
${body[1].trim()}
`;

await fs.mkdir(OUT, { recursive: true });
const file = path.join(OUT, 'preview.html');
await fs.writeFile(file, out);

const kb = n => (n / 1024).toFixed(1) + ' KB';
const stat = await fs.stat(file);
console.log(`dropped ${droppedSources} WebP <source> elements (data: URIs are invalid in srcset)`);
console.log(`inlined ${cache.size} assets (${kb(bytes)} raw)`);
console.log(`themed tokens mapped onto data-theme: ${themedProps.length}`);
console.log(`${file}  ->  ${kb(stat.size)}`);
if (stat.size > 16 * 1024 * 1024) console.warn('! over the 16 MB artifact limit');
