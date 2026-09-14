/**
 * Builds the deployable package.
 *
 *   node tools/dist.mjs
 *
 * Produces dist/ (gitignored) and a zip beside it that is committed, so the
 * package can be downloaded straight from GitHub without cloning.
 *
 * Only files the page actually references are included — the asset list is
 * read out of index.html rather than globbed, so an orphaned file in assets/
 * never ships and a referenced file that is missing fails the build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, PAGE, VERSION } from './_shared.mjs';

const run = promisify(execFile);

const NAME = `nextfly-release-notes-ios-v${VERSION}`;
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, NAME);
const ZIP = path.join(ROOT, `${NAME}.zip`);

const html = await fs.readFile(PAGE, 'utf8');

// Every assets/… path the page references, from both markup and stylesheet.
const referenced = [...new Set([...html.matchAll(/assets\/[A-Za-z0-9._-]+/g)].map(m => m[0]))].sort();
if (!referenced.length) throw new Error('No asset references found in index.html');

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(path.join(STAGE, 'assets'), { recursive: true });

await fs.copyFile(PAGE, path.join(STAGE, 'index.html'));

let assetBytes = 0;
for (const rel of referenced) {
  const src = path.join(ROOT, rel);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat) throw new Error(`index.html references ${rel}, which does not exist`);
  await fs.copyFile(src, path.join(STAGE, rel));
  assetBytes += stat.size;
}

// The single-file variant, for backends that accept only one file.
const standalone = path.join(ROOT, 'index.standalone.html');
let hasStandalone = false;
if (await fs.stat(standalone).then(() => true).catch(() => false)) {
  await fs.copyFile(standalone, path.join(STAGE, 'index.standalone.html'));
  hasStandalone = true;
}

const kb = n => (n / 1024).toFixed(1) + ' KB';

await fs.writeFile(path.join(STAGE, 'DEPLOY.md'), `# NextFly iOS v${VERSION} — "What's New" H5

Static page for the in-app WebView. No build step, no server-side code, no
runtime network calls: nothing is fetched from any other host, so it renders
fully offline once cached.

## What to upload

\`\`\`
index.html
assets/           ${referenced.length} images
\`\`\`

Upload both, keeping \`assets/\` as a sibling of \`index.html\`. Every path in the
page is relative, so it works at any URL depth — \`/release-notes/ios/\`,
\`/h5/whatsnew/\`, or a bucket root, no configuration needed.

${hasStandalone ? `\`index.standalone.html\` is an alternative: one file with every image inlined
as a data URI and no \`assets/\` folder. Use it only if the backend accepts a
single file and nothing else — it is larger and blocks first paint behind the
whole payload, where the split version parses and paints immediately while
images stream in parallel. Do not upload both.

` : ''}## Server configuration

One thing to check: **\`.webp\` must be served as \`image/webp\`.** Most stacks do
this already; some older nginx builds ship a \`mime.types\` that predates WebP.
If it is served as \`application/octet-stream\` the screenshots silently fail to
render, because a \`<picture>\` whose \`<source>\` fails does *not* fall back to
its \`<img>\`. Verify with:

\`\`\`
curl -sI https://<host>/<path>/assets/shot-1.webp | grep -i content-type
\`\`\`

Suggested caching: the files under \`assets/\` are content-stable, so they take a
long \`max-age\`. Give \`index.html\` a short one (or \`no-cache\`) so copy fixes go
out without waiting for a cache to expire.

## URL parameters

All optional. \`https://<host>/<path>/?lang=ja&v=${VERSION}\`

| Param | Behaviour |
|---|---|
| \`lang\` / \`locale\` / \`hl\` | BCP-47 tag, checked in that order. Falls back to \`navigator.language\`, then \`en\`. |
| \`v\` | Version shown in the heading. Defaults to \`${VERSION}\`. |
| \`vw\` | The word before the version. Defaults to \`Version\`. |
| \`theme\` | \`light\` / \`dark\`. See below — normally omit it. |

Supported languages: \`en fr de it es ja ko zh-TW id hi ru\`. Any \`zh*\` resolves
to \`zh-TW\`; anything unmatched falls back to \`en\`. Inside a WKWebView
\`navigator.language\` already follows the app locale, so \`lang\` only needs
passing if the app has its own language setting that can diverge from it.

## Dark mode

The page follows the OS through \`prefers-color-scheme\`. No JavaScript is
involved and **no parameter is required.**

The one thing to verify on the client side: WKWebView answers that query from
the trait collection of the view hosting it, not from iOS Settings. Since the
app has its own Appearance control, the two can disagree unless the app's
choice is applied to the web view or an ancestor:

\`\`\`swift
webView.overrideUserInterfaceStyle = .dark   // or .light, or .unspecified
\`\`\`

Apps that set this on the window already cover the WebView by inheritance. To
check: set the phone to Light, the app to Dark, and open the page — it should
render dark. If it renders light, either apply the override or pass
\`?theme=dark\`, which the page honours and which takes precedence over the
media query.

On Android WebView the equivalent is
\`WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)\`.

## Verified before packaging

- 212 computed-style assertions against the design handoff, across light and
  dark and three widths
- 66 layout combinations: 11 locales x 3 viewports x 2 colour schemes, checking
  horizontal overflow, clipped glyphs, unresolved copy, broken images and
  correct locale resolution

Not covered, and still worth a pass on a real device: safe-area insets,
scroll rubber-banding, and the Appearance check described above.
`);

// ---- zip --------------------------------------------------------------------
await fs.rm(ZIP, { force: true });
await run('zip', ['-r', '-q', '-X', ZIP, NAME], { cwd: DIST });

const zipStat = await fs.stat(ZIP);
const { stdout } = await run('unzip', ['-l', ZIP]);

console.log(stdout.trim());
console.log(`\nindex.html        ${kb((await fs.stat(PAGE)).size)}`);
console.log(`assets (${String(referenced.length).padStart(2)})       ${kb(assetBytes)}`);
if (hasStandalone) console.log(`standalone        ${kb((await fs.stat(standalone)).size)}`);
console.log(`\n${ZIP}  ->  ${kb(zipStat.size)}`);
