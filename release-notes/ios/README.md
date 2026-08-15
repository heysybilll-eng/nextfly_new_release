# iOS Release Notes H5

Single-file release-notes page for the Nextfly iOS app WebView. 11 locales, light-only, no runtime dependencies and no build step.

```
release-notes/ios/
  index.html          the deliverable — inline CSS + JS + all 11 locales
  assets/             images (WebP primary, PNG fallback)
  tools/              dev-time checks; NOT part of the deployed output
```

Deploy `index.html` + `assets/` to any static host. Nothing else is required — no fonts, scripts or stylesheets are fetched at runtime, so the page renders fully offline once cached.

---

## Status

| Area | State |
|---|---|
| Structure, layout, WebView hardening | Done |
| 11 locales + locale-aware typography | Done, translations are drafts (see below) |
| Layout regression sweep (11 locales x 3 viewports) | Passing |
| **Design-token port from the Claude Design file** | **Not done — design files never reached this environment** |
| **Real screenshots / hero artwork** | **Not done — `assets/` holds labelled placeholders** |
| Pixel + computed-style gates vs design | Tooling written, cannot run until the design file exists |

Everything under `:root` in `index.html` is a placeholder value and the images in `assets/` are visibly stamped `PLACEHOLDER`. See "Finishing the design port" below.

---

## URL contract (for the client team)

```
https://<host>/release-notes/ios/?lang=ja&v=3.2.0
```

| Param | Required | Behaviour |
|---|---|---|
| `lang` | no | BCP-47 tag. Falls back to `navigator.language`, then `en`. |
| `v` | no | Renders a version chip under the intro. Hidden when absent. Accepts `[\w.\-]{1,24}`. |

There is deliberately **no `theme` param** — the page is locked to light (see below). Passing one is a no-op.

**Supported `lang` values:** `en` `fr` `de` `it` `es` `ja` `ko` `zh-Hant` `id` `hi` `ru`

Resolution rules:
- Exact match wins, then the base subtag (`de-AT` → `de`, `pt-BR` → no match → `en`).
- `zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant-*` → `zh-Hant`.
- `zh-CN` / `zh-Hans` → `zh-Hant`, because Traditional Chinese is a far closer read than English for those users. Flip `ZH_HANS_TO_HANT` to `false` in `index.html` to send them to English instead.
- Anything unmatched → `en`.

The client does not have to pass `lang`; `navigator.language` inside a WKWebView follows the app's locale. Pass it explicitly if the app offers an in-app language setting that can differ from the system one.

---

## Light-only

The design is light-only, so the page pins itself there:

```html
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
```
plus `color-scheme: light` on `:root`.

This matters more than it looks. A hardcoded white background does **not** stop WebKit from auto-darkening a page when the OS is in dark mode — only the `color-scheme` declaration does. Removing those three lines will produce a washed-out, half-inverted page on dark-mode devices.

Worth flagging: this release's headline feature is Dark Mode, and a user on a dark phone will open a pure-white page to read about it. The token structure leaves room to add a dark palette later — a `@media (prefers-color-scheme: dark)` block that overrides the `:root` variables, no markup changes — if that reads badly in review.

---

## WebView specifics already handled

- `viewport-fit=cover` + `env(safe-area-inset-*)` padding — the WebView is usually presented full-bleed under the Dynamic Island and over the home indicator.
- `-webkit-text-size-adjust: 100%` — stops iOS inflating body text on rotation.
- `overscroll-behavior-y: none` — no grey band on rubber-band scroll.
- `-webkit-touch-callout: none` — no "Save Image" sheet on long-press.
- `-webkit-tap-highlight-color: transparent` — no grey flash on tap.
- Body copy stays user-selectable; chrome does not.

---

## Translations

All 11 locales are **drafts produced during implementation and have not been reviewed by native speakers.** Do not ship without review — the account-linking string in particular names an in-app path (`Settings › Login & Security`) that must match each locale's actual iOS UI strings, and no translation can be verified against the app from here.

Strings live in one `I18N` object in `index.html`. Replacing a translation is a one-line edit; nothing else references the copy. Keys:

```
doc_title  hero_eyebrow  hero_title  hero_intro
f_polish_title   f_polish_body
f_account_title  f_account_body
f_dark_title     f_dark_body
f_expiry_title   f_expiry_body
f_stats_title    f_stats_body
sync_title  sync_body  footer_title  footer_body
```

A missing key falls back to English rather than rendering blank, so a partial translation is safe to ship.

### Locale typography

CJK and Devanagari do not inherit the Latin type treatment, handled via `:lang()` rules rather than JS:

- **ja / ko / zh-Hant** — letter-spacing reset to 0 (the negative tracking is tuned for Latin and crowds CJK), line-height raised to 1.7, `word-break: normal; line-break: strict` so kinsoku line-breaking rules are respected, and the uppercase eyebrow left un-uppercased.
- **hi** — line-height raised to 1.75. Devanagari matras and conjuncts extend past the Latin em box and get clipped at 1.5.
- **de / ru** — display sizes eased slightly; these run ~35% longer than English. `overflow-wrap: anywhere` guards long German compounds from widening the page.

---

## Dev commands

```bash
npm install                                   # tools only; the page needs nothing

npm run check                                 # 11 locales x 3 viewports sweep
node tools/shot.mjs --gate                    # 390pt gate viewport, all locales
node tools/shot.mjs --lang de --vp se         # one combination

node tools/make-placeholders.mjs              # regenerate stand-in assets
node tools/build-assets.mjs --src <uploads>   # real design uploads -> assets/
node tools/inline.mjs                         # -> index.standalone.html
```

`npm run check` fails the build on horizontal overflow, clipped text, unresolved i18n keys, broken images, JS errors, or a locale resolving to the wrong language. Output lands in `.out/` (gitignored).

It also prints each locale's page height relative to English. A locale drifting more than ~25% means its copy no longer fits the design's vertical rhythm and should be tightened rather than allowed to reflow the page.

---

## Finishing the design port

The Claude Design project could not be reached from the build environment — `DesignSync` requires an interactive `/design-login`, the `claude.ai/design` URL returns 403 and the API returns 401. Once these files are available locally:

```
iOS Release Notes H5.dc.html
_ds/fused-design-system-f83c2a1e-.../tokens/{colors,fonts,radius,spacing,typography}.css
_ds/fused-design-system-f83c2a1e-.../{styles.css,_ds_bundle.js}
support.js
uploads/{1,2,3,4}.PNG, Group 2.png, rocket-lineart-even@2x.png
```

1. **Port the tokens verbatim** into the `:root` block. Do not re-derive values by eye from a screenshot — that is exactly what the token files exist to prevent. Nothing outside `:root` contains a literal colour, radius or spacing value, so this is a swap rather than a rewrite.
2. **Confirm `--page-max`** against the canvas width in the `.dc.html`.
3. **Build the assets**: `node tools/build-assets.mjs --src <uploads>`, then copy the printed intrinsic sizes into the `width`/`height` attributes in `index.html`.
4. **Verify the image mapping.** The current wiring assumes `1–4.PNG` map to account linking / dark mode / membership expiry / trip stats in that order, and that `Group 2.png` belongs to the sync callout. Both are inferences from the file list and need checking against the design.
5. **Run the gates:**
   ```bash
   node tools/assert-styles.mjs --design "<path>/iOS Release Notes H5.dc.html"
   node tools/diff.mjs --design "<path>/iOS Release Notes H5.dc.html"
   ```

On the two gates: `assert-styles.mjs` is the typography gate and `diff.mjs` is the geometry and colour gate. This container has no SF Pro or PingFang, so glyphs rasterise differently from iOS no matter how correct the CSS is and text areas carry irreducible pixel noise. Computed style values are font-independent and are what actually prove the type is right. Read the diff map structurally: solid red blocks are real drift, red confined to glyph edges is expected.

Neither gate substitutes for a real-device pass — safe-area insets, overscroll behaviour and dark-mode forcing can only be confirmed in an actual WKWebView.

### Localised screenshots

The screenshots are English app UI. Every locale currently uses them. To localise:

1. Drop a per-locale set at `assets/<lang>/shot-{1,2,3,4}.{webp,png}`.
2. Add that locale code to `LOCALIZED_SHOTS` in `index.html`.

The list is empty by default so the page never requests a file that does not exist. Locales not in the list keep the English images.
