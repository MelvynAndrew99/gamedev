// tools/gen-car.js — generates public/assets/car.png, a 3-frame steering
// sprite sheet (left / straight / right), 48x64 per frame, 144x64 total.
//
// The car is drawn once as a 24x32 pixel map (strings, one char per pixel),
// scaled 2x, then the steering frames are made by shearing: each row shifts
// horizontally, more at the top (far end) than the bottom, which reads as
// the machine yawing into the turn. Cheap, and at pixel-art scale, convincing.
//
// Usage:  npm i -D pngjs && node tools/gen-car.js
// Tweak the palette or the map, re-run, refresh the browser. Art as code.

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const PALETTE = {
  '.': null,                 // transparent
  K: [0x0a, 0x0a, 0x14],     // outline
  B: [0x22, 0x55, 0xee],     // hull
  L: [0x4d, 0x7d, 0xff],     // hull highlight
  D: [0x1a, 0x3c, 0xb0],     // hull shadow
  M: [0xd8, 0x1b, 0x7f],     // side pod (magenta, matches rumble)
  m: [0x8f, 0x12, 0x57],     // pod shadow
  G: [0x9b, 0xe8, 0xff],     // canopy glass
  g: [0x3a, 0x9f, 0xc9],     // glass shade
  C: [0x00, 0xe5, 0xff],     // engine glow (cyan, matches rumble)
  W: [0xff, 0xff, 0xff],     // glint
};

// 24 wide x 32 tall, viewed from behind-and-above. Nose at top (far),
// engines at bottom (near) — matching the road's perspective.
const MAP = [
  '.........KKKKKK.........',
  '........KBBBBBBK........',
  '.......KBLBBBBLBK.......',
  '.......KBLBBBBLBK.......',
  '......KBBLBBBBLBBK......',
  '......KBBLBBBBLBBK......',
  '.....KBBBLBBBBLBBBK.....',
  '.....KBBBLBBBBLBBBK.....',
  '....KBBBBKKKKKKBBBBK....',
  '....KBBBKGGGGGGKBBBK....',
  '...KBBBBKGWGGGGKBBBBK...',
  '...KBBBBKGGGGggKBBBBK...',
  '...KBBBBKggggggKBBBBK...',
  '..KMKBBBBKKKKKKBBBBKMK..',
  '..KMMKBBBBBBBBBBBBKMMK..',
  '.KMMMKBBBBBBBBBBBBKMMMK.',
  '.KMMMKBBLBBBBBBLBBKMMMK.',
  '.KMMMKBBLBBBBBBLBBKMMMK.',
  '.KMmMKBBBBBBBBBBBBKMmMK.',
  '.KMmMKBBBBBBBBBBBBKMmMK.',
  '.KMmMKBDBBBBBBBBDBKMmMK.',
  '.KMmMKBDBBBBBBBBDBKMmMK.',
  '..KmMKBDDBBBBBBDDBKMmK..',
  '..KmKDDDDBBBBBBDDDDKmK..',
  '...KKDDDDDDDDDDDDDDKK...',
  '....KDDDDDDDDDDDDDDK....',
  '....KKCCKKDDDDKKCCKK....',
  '....KCCCCKKDDKKCCCCK....',
  '....KCWCCK.KK.KCCWCK....',
  '.....KCCK......KCCK.....',
  '......KK........KK......',
  '........................',
];

const SCALE = 2;
const FW = MAP[0].length * SCALE; // 48
const FH = MAP.length * SCALE;    // 64
const FRAMES = 3;                 // left, straight, right
const MAX_SHEAR = 4;              // px at top row, 0 at bottom row

// Rasterize the map at SCALE into an RGBA buffer (one frame, no shear).
function rasterize() {
  const buf = Buffer.alloc(FW * FH * 4); // zeroed = transparent
  MAP.forEach((row, my) => {
    [...row].forEach((ch, mx) => {
      const c = PALETTE[ch];
      if (!c) return;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const i = ((my * SCALE + dy) * FW + mx * SCALE + dx) * 4;
          buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
        }
      }
    });
  });
  return buf;
}

// Copy a frame into the sheet, shearing each row by dir * shear(y).
function blit(sheet, frame, frameIndex, dir) {
  for (let y = 0; y < FH; y++) {
    const shift = dir * Math.round(MAX_SHEAR * (1 - y / FH));
    for (let x = 0; x < FW; x++) {
      const sx = x - shift; // sample source shifted opposite the lean
      if (sx < 0 || sx >= FW) continue;
      const si = (y * FW + sx) * 4;
      if (frame[si + 3] === 0) continue;
      const di = (y * sheet.width + frameIndex * FW + x) * 4;
      sheet.data[di] = frame[si];
      sheet.data[di + 1] = frame[si + 1];
      sheet.data[di + 2] = frame[si + 2];
      sheet.data[di + 3] = 255;
    }
  }
}

const sheet = new PNG({ width: FW * FRAMES, height: FH });
const frame = rasterize();
blit(sheet, frame, 0, -1); // frame 0: leaning left
blit(sheet, frame, 1, 0);  // frame 1: straight
blit(sheet, frame, 2, 1);  // frame 2: leaning right

const out = path.join(process.cwd(), 'public', 'assets', 'car.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(`wrote ${out} (${sheet.width}x${sheet.height}, ${FRAMES} frames of ${FW}x${FH})`);