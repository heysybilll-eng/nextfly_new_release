# iOS v2.0.5 "What's New" H5

In-app release-notes page for the Nextfly iOS WebView, built from the Claude Design handoff for `iOS Release Notes H5.dc.html`. Single scrolling column, 11 locales with an in-page language picker, follows the OS light/dark setting. No CTA and no close button — the host WebView owns dismissal.

```
release-notes/ios/
  index.html      the deliverable — inline CSS + JS + all 11 locales
  assets/         images
  tools/          dev-time gates; NOT part of the deployed output
```

Deploy `index.html` + `assets/` to any static host. No fonts, scripts or stylesheets are fetched at runtime, so it renders fully offline once cached.

---

## Status

| Area | State |
|---|---|
| Layout, type, colour, radii vs handoff spec | **212/212 assertions pass** across 3 widths, both schemes |
| Light + dark, following the OS | Done |
| 11 locales, final copy ported verbatim | Done |
| Marker-underline highlights | Done, all 11 locales |
| Language sheet | Done |
| Layout sweep, 11 locales x 3 viewports x 2 schemes | **66/66 pass** |
| Real screenshots + hero art | Done — all 7 in place, incl. the dark hero |
| Real-device pass | Not done — needs a physical WKWebView |

Design source lives in `pics/` at the repo root. `_ds/*` and `support.js` were never available, but they are only needed by the prototype's own runtime — every value the page depends on is stated in the handoff.

One thing worth a look before shipping: `Group 2.png` (feature 2) is roughly 55% empty space below its two cards, so it renders as a tall mostly-blank panel next to the other four. The handoff specifies the full image, never cropped, so it is used as supplied — but a tighter capture would sit better.

---

## Dark mode — a change from the earlier brief

An earlier round of this work was scoped as **light-only**, on the understanding that this was what the design specified. The design says the opposite: the handoff states *"Theme follows the OS (light/dark). No in-page theme toggle,"* ships `colorScheme` as `auto`, and supplies a full dark token table. This page therefore follows the OS, which is also what a release announcing Dark Mode ought to do.

To force light-only anyway, delete the `@media (prefers-color-scheme: dark)` block and the `:root[data-scheme="dark"]` block in `index.html`, and change the `color-scheme` meta and `:root` declaration to `light`. Nothing else depends on it.

### How the theme is detected

**Pure CSS. No JavaScript, and the client passes nothing.** The whole mechanism is `@media (prefers-color-scheme: dark)`, which WKWebView answers from the trait collection of the view hosting it.

That last part is the one thing the client team has to get right. The app has its own **Appearance** setting (System / Light / Dark), so the OS setting and the app's effective theme can disagree. WKWebView reports whatever its *view hierarchy* says, not what iOS Settings says — so the host must apply the user's choice to the web view or an ancestor:

```swift
// wherever the app resolves its own Appearance preference
webView.overrideUserInterfaceStyle = .dark   // or .light, or .unspecified to follow the system
```

With that set, the page follows automatically and stays in sync with the rest of the app. Without it, a user who set the app to Dark on a Light phone gets a light H5 inside a dark app.

If that override cannot be applied reliably, pass `?theme=dark` / `?theme=light` instead — the page honours it and it takes precedence over the media query. It is otherwise a QA affordance; the `overrideUserInterfaceStyle` route is preferred because it needs no coordination between the client and the URL.

On Android WebView the equivalent is `WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)`, which is what makes `prefers-color-scheme` report dark there. (`setForceDark` is deprecated.)

### The hero illustration

The illustration ships in two purpose-drawn versions — black strokes for light, white for dark — selected through a `--hero-art` CSS token exactly like a colour. Only the applicable file is ever downloaded, because CSS does not fetch a `background-image` it isn't using.

This replaced an earlier `filter: invert(1)` on the black version. Inverting works for pure line art but this illustration is halftone-shaded, and inverting flips the dot pattern too, so shaded areas read backwards. The white version keeps the shading reading as shading.

---

## URL contract (for the client team)

```
https://<host>/release-notes/ios/?lang=ja&v=2.0.5
```

| Param | Required | Behaviour |
|---|---|---|
| `lang` / `locale` / `hl` | no | BCP-47 tag, checked in that order. Falls back to `navigator.language`, then `en`. |
| `v` | no | Version in the hero heading. Default `2.0.5`. Accepts `[\w.\-]{1,24}`. |
| `vw` | no | The word before the version. Default `Version`. Not localized — matches the design, where `versionWord` is a config input rather than a translated string. |
| `theme` | no | `light` / `dark`. **QA only** — ship without it so the page follows the OS. |
| `fullbleed` | no | `1` when the WebView is presented edge-to-edge under the status bar. Adds the top safe-area inset. Omit when the host has its own nav bar. |
| `header` | no | `0` hides the page's own title, keeping only the language control. Use when the host's nav bar already shows a title. |

### Presentation parameters

Neither of these is detectable from inside a WebView, so the host has to say.

The page does **not** add a top safe-area inset by default. The design has the
host own dismissal, which means a native nav bar exists and has already
consumed the status bar; adding `env(safe-area-inset-top)` on top of that
inserts a second status-bar-sized gap. On Android the inset is measured against
the window, so it stays non-zero even when the WebView starts below the native
toolbar — which is exactly how that gap appeared in testing.

| Presentation | Parameters |
|---|---|
| Native nav bar showing its own title (typical) | `?header=0` |
| Native nav bar, no title | *(none)* |
| Edge-to-edge, page supplies its own header | `?fullbleed=1` |


**Supported languages:** `en` `fr` `de` `it` `es` `ja` `ko` `zh-TW` `id` `hi` `ru`

Resolution: exact match, then base subtag (`fr-CA` → `fr`), and any `zh*` → `zh-TW`. Unmatched → `en`. A user's in-page pick overrides everything for that session.

The client need not pass `lang` — `navigator.language` follows the app locale inside a WKWebView. Pass it explicitly only if the app has its own language setting that can diverge from the system one.

---

## Marker highlights

Feature bodies 1–4 carry gold hand-drawn underlines (`#D9A441`, the exact SVG from the handoff). Block 5 has none, and uses `line-height: 1.45` where the others use `1.7`.

The handoff recommends an explicit markup token over substring matching, so phrases are marked inline in each locale's own string:

```js
f3b: '[[Dark Mode]] is here on iOS. It follows your system setting, or you can switch it yourself.'
```

`[[...]]` is split into `.mark` spans at render time via `createTextNode`, never `innerHTML`, so copy can't inject markup. A phrase spanning a line break gets one underline segment per line — intended, it reads as hand marking.

Two things this fixed versus the prototype:

- The prototype keyed `F1_MARK` as `zh` while `STRINGS` was keyed `zh-TW`, so Traditional Chinese silently lost its feature-1 highlight. Inline tokens make that class of mismatch impossible.
- The prototype only had highlight phrases for **English** on features 2–4, so 10 locales rendered those paragraphs plain. Equivalents are now marked in every locale — **these need native review** (see below).

---

## Copy

All strings are the final ones from the handoff's `STRINGS` object, ported verbatim. Keys: `navTitle`, `langName`, `intro`, `sectionLabel`, `f1t`/`f1b` … `f5t`/`f5b`, `parityTitle`, `parityBody`, `feedback`, `langSheetTitle`.

Two items for the localization owner:

1. **Highlight phrase choices in the 10 non-English locales are mine, not the design's.** The handoff explicitly leaves these to localization. They follow the English pattern (the Settings path, the "iOS and Android" pair, the Dark Mode term, the membership clause), but a native speaker should confirm each marks the phrase worth marking.
2. **`ko.f1b` reads `레이아웃, 여백, 서자`.** `서자` is an unusual choice where `서체` (typeface) would be expected. It is carried through verbatim from the handoff because the copy is marked final — worth a check.

---

## Responsive behaviour

The page adapts by constraint rather than by breakpoints: `max-width: 480px` with `margin: 0 auto` caps and centres the column, gutters are `max(18px, env(safe-area-inset-*))`, screenshots are `width: 66%`, and the hero is `width: 100%` up to `max-width: 340px`. Measured, with zero horizontal overflow at every width:

| | column | screenshot | body copy |
|---|---|---|---|
| 320 (SE) | 320 | 158 | ~33 chars/line |
| 390 (14) | 390 | 205 | ~42 |
| 430 (Pro Max) | 430 | 231 | ~46 |
| 768+ | 480 | 264 | ~52 |

Two width breakpoints sit on top of that. **Neither comes from the design**, which specifies one scale for one phone-width column — they exist so the page holds up outside its intended envelope, and both are asserted in `assert-spec.mjs` so they cannot silently regress.

- **`max-width: 359px`** — hero heading 34→28px, feature titles 22→18px, gutter 18→16px. At 320px the design scale runs the heading to the edge and breaks the intro onto three lines. Body copy, colour and spacing rhythm are untouched.
- **`min-width: 600px`** — the column becomes a bordered, rounded card on a `--surface-elevated` ground, and the header drops `position: sticky` so it cannot slide out of the card's rounded top. Nothing inside the column changes. This is a fallback for the URL being opened in a desktop browser or a large iPad; in the app it never applies.

`assert-spec.mjs` also asserts that **390pt renders exactly as before** — no card, sticky header, 34px heading, 18px gutter — so the in-app path is pinned against both new rules.

Not covered: type is fixed `px` and `text-size-adjust` is pinned to `100%`, so the page does not respond to iOS Dynamic Type or a browser's root font-size setting. That is a deliberate trade for layout fidelity on a short, read-once page; moving to `rem` and releasing `text-size-adjust` would be the fix if accessibility requirements change.

---

## Locale typography

The design specifies one Latin-tuned treatment. Two corrections sit on top of it, both needed to render that design faithfully rather than to restyle it:

- **`hi`** — feature titles at `line-height: 1.2` clip Devanagari matras and conjuncts, which extend past the Latin em box. Raised to 1.45.
- **`ja` / `ko` / `zh-TW`** — the `-0.01em` tracking is tuned for Latin and visibly crowds CJK, so it is reset to 0 on headings; `word-break: normal; line-break: strict` keeps kinsoku line-breaking intact.

The sweep's clipped-text check is what these are answering; remove them and it fails.

---

## Dev commands

```bash
npm install                                # tools only; the page needs nothing

npm run check                              # spec gate + full sweep (the gate to pass)
npm run spec                               # 188 computed-value assertions vs the handoff
node tools/shot.mjs --gate                 # 390pt, both schemes, all locales
node tools/shot.mjs --lang de --vp se --scheme dark

node tools/make-placeholders.mjs --only shot-2   # regenerate one stand-in
node tools/build-assets.mjs --src ../../pics     # source images -> assets/
node tools/inline.mjs                      # -> index.standalone.html
```

`shot.mjs` fails on horizontal overflow, clipped text, unresolved copy, leaked `[[ ]]` tokens, missing highlight spans, broken images, a wrong sheet row count, JS errors, wrong locale resolution, or a colour scheme that didn't take effect. Output lands in `.out/` (gitignored).

### On the two gates

`assert-spec.mjs` encodes the handoff's stated values and checks the built page against them in both schemes. It is the fidelity gate.

`diff.mjs` and `assert-styles.mjs` compare against `iOS Release Notes H5.dc.html` directly. **They cannot run yet**: that file is a design-canvas prototype that only renders under its own runtime (`support.js`) and design-system bundle (`_ds/_ds_bundle.js`), neither of which is available here — without them the `<x-dc>` tree is never processed and its `{{ }}` bindings stay unfilled. They are kept for whenever the full bundle lands locally.

Note that a pixel diff would be the weaker check regardless: this container has no SF Pro, so type rasterises differently from iOS no matter how correct the CSS is. Computed values are font-independent.

Neither gate replaces a real-device pass — safe-area insets, overscroll behaviour and scheme switching can only be confirmed in an actual WKWebView.

---

## Assets

Source images live in `pics/`. The upload-to-feature mapping comes from the handoff, confirmed against the screenshots themselves. It is **not** in filename order:

| Design upload | Ships as | Feature | Screen |
|---|---|---|---|
| `1.PNG` | `shot-1` | 1 — Interface polish | Home, dark |
| `Group 2.png` | `shot-2` | 2 — Account linking | Login & security |
| `3.PNG` | `shot-3` | 3 — Dark Mode | Settings, dark |
| `2.PNG` | `shot-4` | 4 — Membership expiry | Settings, light (Pro+ expiry row) |
| `4.PNG` | `shot-5` | 5 — Trip stats | My Trips, flight passport card |
| `rocket-lineart-even@2x.png` | `rocket-lineart` | hero, light | — |
| `rocket-lineart-even-white@2x.png` | `rocket-lineart-white` | hero, dark | — |

`2.PNG` and `3.PNG` look swapped because they are the light and dark captures of the *same* Settings screen: the dark one illustrates Dark Mode, the light one illustrates the membership expiry row. The ordering is deliberate, not an error in the handoff.

Note that feature 1 and 3 use dark captures while feature 4 uses a light one, so the page shows a mix of both in either scheme. That is what the design specifies.

Rebuild after changing any source image:

```bash
node tools/build-assets.mjs --src ../../pics
```

Then copy the intrinsic sizes it prints into the `width`/`height` attributes in `index.html` — those reserve the aspect ratio and prevent layout shift as images decode. Current build: screenshots 600x1301 except `shot-2` at 590x1278, hero 680x707. Total WebP payload 257 KB, down from 2.0 MB of source PNGs.

`Group 2.png` is a 1x capture where the rest are 2x, so it resolves to 590px wide rather than 600. At the ~264 CSS px display width that is still 2.2x, and the aspect ratio matches the others to within a rounding step, so it needs no special handling beyond its own `width`/`height` attributes.

The resolver tolerates iOS screenshot rename artifacts, so `3.PNG` still matches when it arrives as `3 18.40.03.PNG`.

Screenshots render at 66% of the 400px panel content box (≈264 CSS px), so 600px sources cover 2x comfortably. The hero renders up to 340px, and must stay a transparent PNG with black strokes or the dark-mode invert breaks.

**Both hero variants are served as PNG, no WebP.** WebP encodes this dithered line art *larger* than PNG (124 vs 109 KB, and 130 vs 114 KB), so the WebP copies are deleted after building. `build-assets.mjs` prints a warning whenever it produces a WebP that loses to its PNG.

For the screenshots, which do benefit from WebP, both formats are always written: a `<picture>` whose `<source>` 404s does not fall back to its `<img>`, it simply fails.

### Localized screenshots

All locales currently share the same (English UI) screenshots. There is no per-locale image layer in this build — the design does not specify one. If it's wanted later, the cleanest hook is a locale-keyed prefix on the `src` in `render()`.
