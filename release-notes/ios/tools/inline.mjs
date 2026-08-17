/**
 * Produces index.standalone.html — every asset inlined as a data: URI, so the
 * page is a single literal file with no sibling requests.
 *
 *   node tools/inline.mjs
 *
 * Use this only if the distribution channel demands one file. The default
 * index.html + assets/ split is faster in a WebView: the HTML parses and paints
 * immediately while images stream in parallel, whereas an inlined build blocks
 * first paint behind the whole base64 payload.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, PAGE, ASSETS } from './_shared.mjs';

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

let html = await fs.readFile(PAGE, 'utf8');
const cache = new Map();
let inlined = 0;
let bytes = 0;
const missing = new Set();

async function dataUri(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const file = path.join(ROOT, rel);
  let buf;
  try {
    buf = await fs.readFile(file);
  } catch {
    missing.add(rel);
    return null;
  }
  const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const uri = `data:${mime};base64,${buf.toString('base64')}`;
  cache.set(rel, uri);
  inlined++;
  bytes += buf.length;
  return uri;
}

// src="assets/..." and srcset="assets/..." (single-candidate srcsets only,
// which is all this page uses).
const refs = [...html.matchAll(/(src|srcset)="(assets\/[^"]+)"/g)];
for (const [, attr, rel] of refs) {
  const uri = await dataUri(rel);
  if (uri) html = html.replace(`${attr}="${rel}"`, `${attr}="${uri}"`);
}

if (missing.size) {
  console.warn('Referenced but not found on disk:');
  for (const m of missing) console.warn(`  - ${m}`);
}

const out = path.join(ROOT, 'index.standalone.html');
await fs.writeFile(out, html);

const kb = n => (n / 1024).toFixed(1) + ' KB';
const stat = await fs.stat(out);
console.log(`inlined ${inlined} asset(s), ${kb(bytes)} raw`);
console.log(`${out}  ->  ${kb(stat.size)}`);
if (stat.size > 2 * 1024 * 1024) {
  console.warn('\n! over 2 MB — first paint in a WebView will be noticeably delayed.');
}
