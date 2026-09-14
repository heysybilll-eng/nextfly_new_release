/**
 * Generates stand-in assets so the layout is testable before the design
 * uploads land. Every image is visibly labelled PLACEHOLDER so one can never
 * be mistaken for a real screenshot in a review.
 *
 * Delete assets/ and run `npm run assets -- --src <uploads>` once the real
 * design files arrive.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS, RELEASE } from './_shared.mjs';

/**
 * Sizes must match the width/height attributes in index.html, otherwise the
 * reserved aspect ratio is wrong and the page shifts as images decode.
 * Labels follow the design handoff's upload-to-feature mapping.
 */
/**
 * Slots per release. Labels name the screen each slot expects, so a reviewer
 * can tell at a glance whether a dropped-in asset landed in the right place.
 */
const BY_RELEASE = {
  'v2.0.5': [
    { name: 'shot-1', w: 600, h: 1301, label: '1.PNG · Home, dark' },
    { name: 'shot-2', w: 600, h: 1301, label: 'Group 2.png · Login & security' },
    { name: 'shot-3', w: 600, h: 1301, label: '3.PNG · Settings, dark' },
    { name: 'shot-4', w: 600, h: 1301, label: '2.PNG · Settings, light' },
    { name: 'shot-5', w: 600, h: 1301, label: '4.PNG · My Trips, passport' },
    { name: 'rocket-lineart',       w: 680, h: 707, label: 'Rocket line art', lineart: true },
    { name: 'rocket-lineart-white', w: 680, h: 707, label: 'Rocket line art', lineart: true, white: true }
  ],
  'v2.1.0': [
    { name: 'shot-1', w: 600, h: 1301, label: "Who's it for? · 角色绑定" },
    { name: 'shot-2', w: 600, h: 1301, label: 'My Trips 筛选栏 · 行程筛选' },
    { name: 'shot-3', w: 600, h: 1301, label: '搜索 + 自定义键盘' },
    { name: 'shot-4', w: 600, h: 1301, label: '主屏小组件' },
    { name: 'shot-5', w: 600, h: 1301, label: '锁屏实时活动 · 灵动岛' },
    { name: 'shot-6', w: 600, h: 1301, label: 'Feedback · 用户反馈' },
    { name: 'hero',       w: 680, h: 742, label: 'Hero line art', lineart: true },
    { name: 'hero-white', w: 680, h: 742, label: 'Hero line art', lineart: true, white: true }
  ]
};

const ITEMS = BY_RELEASE[RELEASE];
if (!ITEMS) {
  console.error(`No placeholder slots defined for ${RELEASE}`);
  process.exit(2);
}

/** `--only shot-2` regenerates a single slot without clobbering real assets. */
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;
const targets = only ? ITEMS.filter(i => i.name === only) : ITEMS;
if (only && !targets.length) {
  console.error(`Unknown placeholder "${only}". Known: ${ITEMS.map(i => i.name).join(', ')}`);
  process.exit(2);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

await fs.mkdir(ASSETS, { recursive: true });

for (const it of targets) {
  const fs_ = Math.max(14, Math.round(it.w / 22));
  let svg;

  if (it.lineart) {
    // Transparent ground with black strokes, matching the real hero asset, so
    // the dark-mode invert(1) treatment is genuinely exercised by the sweep.
    const c = it.w / 2;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${it.w}" height="${it.h}">
      <g fill="none" stroke="${it.white ? '#FFFFFF' : '#000000'}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M${c} ${c * 0.35}c${c * 0.28} ${c * 0.3} ${c * 0.28} ${c * 0.72} 0 ${c * 1.0}
                 c-${c * 0.28}-${c * 0.28}-${c * 0.28}-${c * 0.7} 0-${c * 1.0}z"/>
        <circle cx="${c}" cy="${c * 0.75}" r="${c * 0.16}"/>
        <path d="M${c * 0.72} ${c * 1.12}l-${c * 0.22} ${c * 0.26} ${c * 0.3}-.04"/>
        <path d="M${c * 1.28} ${c * 1.12}l${c * 0.22} ${c * 0.26}-${c * 0.3}-.04"/>
        <path d="M${c} ${c * 1.42}v${c * 0.3}"/>
      </g>
      <text x="50%" y="${c * 1.85}" text-anchor="middle" fill="${it.white ? '#FFFFFF' : '#000000'}"
            font-family="sans-serif" font-size="${fs_}" font-weight="600">PLACEHOLDER</text>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${it.w}" height="${it.h}">
      <rect width="100%" height="100%" fill="#EDEDF0"/>
      <rect x="1" y="1" width="${it.w - 2}" height="${it.h - 2}" fill="none"
            stroke="#C7C7CC" stroke-width="2" stroke-dasharray="12 10"/>
      <text x="50%" y="48%" text-anchor="middle" fill="#8E8E93"
            font-family="sans-serif" font-size="${fs_}" font-weight="600">${esc(it.label)}</text>
      <text x="50%" y="48%" dy="${fs_ * 1.6}" text-anchor="middle" fill="#AEAEB2"
            font-family="sans-serif" font-size="${Math.round(fs_ * 0.9)}">PLACEHOLDER</text>
      <text x="50%" y="48%" dy="${fs_ * 3}" text-anchor="middle" fill="#AEAEB2"
            font-family="sans-serif" font-size="${Math.round(fs_ * 0.8)}">${it.w}x${it.h}</text>
    </svg>`;
  }

  const buf = Buffer.from(svg);
  await sharp(buf).webp({ quality: 80, alphaQuality: 100 }).toFile(path.join(ASSETS, `${it.name}.webp`));
  await sharp(buf).png({ compressionLevel: 9 }).toFile(path.join(ASSETS, `${it.name}.png`));
  console.log(`placeholder ${it.name}  ${it.w}x${it.h}${it.lineart ? '  (transparent line art)' : ''}`);
}

console.log(`\n${targets.length} placeholder(s) written to ${ASSETS}`);
