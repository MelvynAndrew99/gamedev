import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PNG } from 'pngjs';

const FRAME_W = 64;
const FRAME_H = 56;
const STEER_FRAMES = 5;
const PITCH_ROWS = 3;
const sheet = PNG.sync.read(
  fs.readFileSync(new URL('../public/assets/car.png', import.meta.url))
);

function pixel(pitchRow, steerFrame, x, y) {
  const sheetY = pitchRow * FRAME_H + y;
  const i = (sheetY * sheet.width + steerFrame * FRAME_W + x) * 4;
  return {
    r: sheet.data[i],
    g: sheet.data[i + 1],
    b: sheet.data[i + 2],
    a: sheet.data[i + 3],
  };
}

test('generated steering sheet keeps a rear-view silhouette and glass cabin', () => {
  assert.equal(sheet.width, FRAME_W * STEER_FRAMES);
  assert.equal(sheet.height, FRAME_H * PITCH_ROWS);

  for (let pitchRow = 0; pitchRow < PITCH_ROWS; pitchRow++) {
    for (let frame = 0; frame < STEER_FRAMES; frame++) {
      let opaque = 0;
      let glass = 0;
      let minX = FRAME_W, maxX = -1;
      let minY = FRAME_H, maxY = -1;
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const p = pixel(pitchRow, frame, x, y);
          if (p.a === 0) continue;
          opaque++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          // The glass palette is more cyan than the blue hull, including its
          // quantized shadow bands and bright reflection facet.
          if (p.b > 40 && p.g / p.b > 0.55 && p.g > p.r * 2) glass++;
        }
      }
      const visibleW = maxX - minX + 1;
      const visibleH = maxY - minY + 1;
      assert.ok(opaque > 300, `pitch ${pitchRow}, frame ${frame} lost its car silhouette`);
      assert.ok(
        visibleW > visibleH * 1.35,
        `pitch ${pitchRow}, frame ${frame} drifted toward an overhead perspective`
      );
      assert.ok(glass > 20, `pitch ${pitchRow}, frame ${frame} lost its glass-cabin read`);
    }
  }
});

test('opposite steering silhouettes remain exact mirrors', () => {
  for (let pitchRow = 0; pitchRow < PITCH_ROWS; pitchRow++) {
    for (const [left, right] of [[0, 4], [1, 3]]) {
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          assert.equal(
            pixel(pitchRow, left, x, y).a > 0,
            pixel(pitchRow, right, FRAME_W - 1 - x, y).a > 0,
            `pitch ${pitchRow}, frames ${left}/${right} diverged at ${x},${y}`
          );
        }
      }
    }
  }
});

test('nose-down and nose-up rows reveal genuinely different 3D silhouettes', () => {
  let differingPixels = 0;
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const down = pixel(0, 2, x, y);
      const up = pixel(2, 2, x, y);
      if (
        down.r !== up.r || down.g !== up.g ||
        down.b !== up.b || down.a !== up.a
      ) differingPixels++;
    }
  }
  assert.ok(differingPixels > 250, 'pitch rows collapsed into the same raster pose');
});

test('neutral rival frame keeps the opaque-width contract used by projection', () => {
  let minX = FRAME_W;
  let maxX = -1;
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (pixel(1, 2, x, y).a === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  assert.equal(maxX - minX + 1, 30);
});
