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
| Layout, type, colour, radii vs handoff spec | **188/188 assertions pass**, both schemes |
| Light + dark, following the OS | Done |
| 11 locales, final copy ported verbatim | Done |
| Marker-underline highlights | Done, all 11 locales |
| Language sheet | Done |
| Layout sweep, 11 locales x 3 viewports x 2 schemes | **66/66 pass** |
| **Real screenshots + hero art** | **Not done — `assets/` holds labelled placeholders** |
| Real-device pass | Not done — needs a physical WKWebView |

The design source files (`uploads/*`, `_ds/*`, `support.js`) were never reachable from the build environment. Only `iOS Release Notes H5.dc.html` and the handoff README were supplied, which is enough for every value but not for the images.

---

## Dark mode — a change from the earlier brief

An earlier round of this work was scoped as **light-only**, on the understanding that this was what the design specified. The design says the opposite: the handoff states *"Theme follows the OS (light/dark). No in-page theme toggle,"* ships `colorScheme` as `auto`, and supplies a full dark token table. This page therefore follows the OS, which is also what a release announcing Dark Mode ought to do.

To force light-only anyway, delete the `@media (prefers-color-scheme: dark)` block and the `:root[data-scheme="dark"]` block in `index.html`, and change the `color-scheme` meta and `:root` declaration to `light`. Nothing else depends on it.

The hero line art is a transparent PNG with black strokes and has no dark counterpart, so dark mode applies `filter: invert(1)` — the approach the handoff calls for. Supplying a real dark asset would be cleaner if the illustration ever gains colour.

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

node tools/make-placeholders.mjs           # regenerate stand-in assets
node tools/build-assets.mjs --src <uploads>  # real design uploads -> assets/
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

`assets/` currently holds placeholders, visibly stamped `PLACEHOLDER`. The upload-to-feature mapping comes from the handoff and has been confirmed against the screenshots themselves. It is **not** in filename order:

| Design upload | Ships as | Feature | Screen |
|---|---|---|---|
| `1.PNG` | `shot-1` | 1 — Interface polish | Home, dark |
| `Group 2.png` | `shot-2` | 2 — Account linking | Login & security |
| `3.PNG` | `shot-3` | 3 — Dark Mode | Settings, dark |
| `2.PNG` | `shot-4` | 4 — Membership expiry | Settings, light (Pro+ expiry row) |
| `4.PNG` | `shot-5` | 5 — Trip stats | My Trips, flight passport card |
| `rocket-lineart-even@2x.png` | `rocket-lineart` | hero | — |

`2.PNG` and `3.PNG` look swapped because they are the light and dark captures of the *same* Settings screen: the dark one illustrates Dark Mode, the light one illustrates the membership expiry row. The ordering is deliberate, not an error in the handoff.

Note that feature 1 and 3 use dark captures while feature 4 uses a light one, so the page shows a mix of both in either scheme. That is what the design specifies.

To swap in the real images:

```bash
node tools/build-assets.mjs --src <path-to-design/uploads>
```

Then copy the intrinsic sizes it prints into the `width`/`height` attributes in `index.html` — those attributes reserve the aspect ratio and prevent layout shift as images decode.

Screenshots render at 66% of the 400px panel content box (≈264 CSS px), so ~600px wide sources cover 2× comfortably. The hero renders up to 340px. Keep the hero transparent with black strokes, or the dark-mode invert will not work.

### Localized screenshots

All locales currently share the same (English UI) screenshots. There is no per-locale image layer in this build — the design does not specify one. If it's wanted later, the cleanest hook is a locale-keyed prefix on the `src` in `render()`.
