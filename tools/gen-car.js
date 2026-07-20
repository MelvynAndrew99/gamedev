// tools/gen-car.js — apocalypse Jeep, rear-3/4 view, v3.
// Fixes from playtest feedback: (1) full-width cab window band + roof rail
// replaces v2's disconnected twin-post cage — the actual "does this read
// as a car" fix; (2) a mounted spare tire on the tailgate as the
// unmistakable Jeep signature; (3) FIVE steering frames instead of three
// (hard-left, left, straight, right, hard-right), needed once airbrake
// leans are in play — three frames can't show a hard shoulder-button bank
// distinctly from a light stick correction, five can.
// Map computed programmatically (tools/design.py) for guaranteed symmetry.

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const PALETTE = {
  '.': null,
  K: [0x0a, 0x0a, 0x14],
  G: [0x5c, 0x5c, 0x6c],
  g: [0x9a, 0x9a, 0xaa],
  D: [0x14, 0x16, 0x22],
  R: [0xa8, 0x50, 0x1f],
  r: [0x7a, 0x38, 0x14],
  H: [0xd0, 0x7a, 0x35],
  A: [0x6b, 0x70, 0x60],
  a: [0x4a, 0x4f, 0x42],
  Y: [0xff, 0xcf, 0x3f],
  t: [0x2a, 0x10, 0x10],
  T: [0xff, 0x2d, 0x55],
  O: [0xff, 0x8a, 0x1a],
  C: [0x9a, 0x9a, 0xa8],
  c: [0xff, 0x7a, 0x1a],
  W: [0x14, 0x14, 0x18],
  w: [0xc9, 0xc9, 0xd4],
  S: [0xb8, 0xb8, 0xc8],
};

const MAP = [
  '.....KGGGGGGGGGGGGGGGGGGGGK.....',
  '.....KGGGGGGGGGGGGGGGGGGGGK.....',
  '.....KGGGGGGGGGGGGGGGGGGGGK.....',
  '.....KKKGGggggggggggggGGKKK.....',
  '........GGDDDDDggDDDDDGG........',
  '........GGDDDDDggDDDDDGG........',
  '........GGDDDDDggDDDDDGG........',
  '........GGDDDDDggDDDDDGG........',
  '...KKKKKGGDDDDDDDDDDDDGGKKKKK...',
  '...KRaaaaaaaaaaaaaaaaaaaaaaRK...',
  '...KRAAAAAAAAAAAAAAAAAAAAAARK...',
  '...KRRRYYYYYYYYYYYYYYYYYYRRRK...',
  '...KRRrrRHHRRRRKKKRRRHHRrrRRK...',
  '...KRRrrRHHRRKKWWWKKRHHRrrRRK...',
  '...KRTTOOHHRRKWWWWWKRHHOOTTRK...',
  'KKKKRTwOOHHRKWWWwWWWKHHOOwTRKKKK',
  'CCKKRTTOOHHRKWWwwwWWKHHOOTTRKKCC',
  'CCKKRTTOOHHRKWWWwWWWKHHOOTTRKKCC',
  'CCKKRRrrRHHRRKWWWWWKRHHRrrRRKKCC',
  'KKKKKKrrKRRRRKKWWWKKRrrrrrKKKKKK',
  'ccKKKKKWKaAaAaAaAaAaAaArWKKKKKcc',
  'KwwwwwKWKAaAaAaAaAaAaAaKWKwwwwwK',
  'KKKKKAAAAAAAAAAAAAAAAAAAAAAKKKKK',
  'WWWWWWWSK..S...SS...S..KSWWWWWWW'
];

const SCALE = 2;
const FW = MAP[0].length * SCALE;
const FH = MAP.length * SCALE;
const FRAMES = 5; // hard-left, left, straight, right, hard-right
const SHEAR_STEPS = [-2, -1, 0, 1, 2]; // multiples of MAX_SHEAR per frame
const MAX_SHEAR = 4;

function rasterize() {
  const buf = Buffer.alloc(FW * FH * 4);
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

// Three-zone weighted lean (cab leans hardest, body half as much, wheels
// stay nearly planted) — reads as banking weight, not a skewed decal.
function blit(sheet, frame, frameIndex, dirSteps) {
  const wheelLine = FH - 8 * SCALE;
  for (let y = 0; y < FH; y++) {
    let mul;
    if (y < wheelLine * 0.4) mul = MAX_SHEAR;
    else if (y < wheelLine) mul = MAX_SHEAR * 0.5;
    else mul = 0.5;
    const shift = dirSteps * mul;
    for (let x = 0; x < FW; x++) {
      const sx = x - Math.round(shift);
      if (sx < 0 || sx >= FW) continue;
      const si = (y * FW + sx) * 4;
      if (frame[si + 3] === 0) continue;
      const di = (y * sheet.width + frameIndex * FW + x) * 4;
      sheet.data[di] = frame[si]; sheet.data[di+1] = frame[si+1];
      sheet.data[di+2] = frame[si+2]; sheet.data[di+3] = 255;
    }
  }
}

const sheet = new PNG({ width: FW * FRAMES, height: FH });
const frame = rasterize();
SHEAR_STEPS.forEach((steps, i) => blit(sheet, frame, i, steps));

const out = path.join(process.cwd(), 'public', 'assets', 'car.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(`wrote ${out} (${sheet.width}x${sheet.height}, ${FRAMES} frames of ${FW}x${FH})`);