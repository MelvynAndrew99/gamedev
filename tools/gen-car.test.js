import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PNG } from 'pngjs';

const FRAME_W = 64;
const FRAME_H = 56;
const FRAMES = 5;
const sheet = PNG.sync.read(
  fs.readFileSync(new URL('../public/assets/car.png', import.meta.url))
);

function pixel(frame, x, y) {
  const i = (y * sheet.width + frame * FRAME_W + x) * 4;
  return {
    r: sheet.data[i],
    g: sheet.data[i + 1],
    b: sheet.data[i + 2],
    a: sheet.data[i + 3],
  };
}

test('generated steering sheet keeps a rear-view silhouette and glass cabin', () => {
  assert.equal(sheet.width, FRAME_W * FRAMES);
  assert.equal(sheet.height, FRAME_H);

  for (let frame = 0; frame < FRAMES; frame++) {
    let opaque = 0;
    let glass = 0;
    let minX = FRAME_W, maxX = -1;
    let minY = FRAME_H, maxY = -1;
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const p = pixel(frame, x, y);
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
    assert.ok(opaque > 300, `frame ${frame} lost its car silhouette`);
    assert.ok(
      visibleW > visibleH * 1.8,
      `frame ${frame} drifted toward an overhead perspective`
    );
    assert.ok(glass > 30, `frame ${frame} lost its glass-cabin read`);
  }
});

test('opposite steering silhouettes remain exact mirrors', () => {
  for (const [left, right] of [[0, 4], [1, 3]]) {
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        assert.equal(
          pixel(left, x, y).a > 0,
          pixel(right, FRAME_W - 1 - x, y).a > 0,
          `frames ${left}/${right} diverged at ${x},${y}`
        );
      }
    }
  }
});
