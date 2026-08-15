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
import { ASSETS } from './_shared.mjs';

const ITEMS = [
  // Sizes must match the width/height attributes in index.html, otherwise the
  // reserved aspect ratio is wrong and the page shifts as images decode.
  { name: 'shot-1',  w: 780, h: 1688, label: 'Account linking' },
  { name: 'shot-2',  w: 780, h: 1688, label: 'Dark Mode' },
  { name: 'shot-3',  w: 780, h: 1688, label: 'Membership expiry' },
  { name: 'shot-4',  w: 780, h: 1688, label: 'Trip stats' },
  { name: 'rocket',  w: 264, h: 264,  label: 'Rocket' },
  { name: 'group-2', w: 192, h: 192,  label: 'Group 2' }
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

await fs.mkdir(ASSETS, { recursive: true });

for (const it of ITEMS) {
  const fs_ = Math.max(14, Math.round(it.w / 16));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${it.w}" height="${it.h}">
    <rect width="100%" height="100%" fill="#EDEDF0"/>
    <rect x="1" y="1" width="${it.w - 2}" height="${it.h - 2}" fill="none"
          stroke="#C7C7CC" stroke-width="2" stroke-dasharray="12 10"/>
    <text x="50%" y="48%" text-anchor="middle" fill="#8E8E93"
          font-family="sans-serif" font-size="${fs_}" font-weight="600">${esc(it.label)}</text>
    <text x="50%" y="48%" dy="${fs_ * 1.5}" text-anchor="middle" fill="#AEAEB2"
          font-family="sans-serif" font-size="${Math.round(fs_ * 0.8)}">PLACEHOLDER</text>
    <text x="50%" y="48%" dy="${fs_ * 2.7}" text-anchor="middle" fill="#AEAEB2"
          font-family="sans-serif" font-size="${Math.round(fs_ * 0.7)}">${it.w}x${it.h}</text>
  </svg>`;

  const buf = Buffer.from(svg);
  await sharp(buf).webp({ quality: 80 }).toFile(path.join(ASSETS, `${it.name}.webp`));
  await sharp(buf).png({ compressionLevel: 9 }).toFile(path.join(ASSETS, `${it.name}.png`));
  console.log(`placeholder ${it.name}  ${it.w}x${it.h}`);
}

console.log(`\n${ITEMS.length} placeholders written to ${ASSETS}`);
