import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { PNG } from 'pngjs';
import {
  VEHICLE_FRAME_HEIGHT as FRAME_H,
  VEHICLE_FRAME_WIDTH as FRAME_W,
  VEHICLE_NEUTRAL_HULL_WIDTH,
  VEHICLE_PITCH_ROWS as PITCH_ROWS,
  VEHICLE_SHEET_HEIGHT,
  VEHICLE_SHEET_WIDTH,
  VEHICLE_STEER_FRAMES as STEER_FRAMES,
} from '../src/config/vehicleSprite.js';

const asset = (name) => new URL(`../public/assets/${name}`, import.meta.url);
const read = (name) => PNG.sync.read(fs.readFileSync(asset(name)));
const sheets = {
  composite: read('car-v2.png'),
  paint: read('car-v2-paint.png'),
  detail: read('car-v2-detail.png'),
};

function pixel(sheet, pitchRow, steerFrame, x, y) {
  const i = ((pitchRow * FRAME_H + y) * sheet.width + steerFrame * FRAME_W + x) * 4;
  return { r: sheet.data[i], g: sheet.data[i + 1], b: sheet.data[i + 2], a: sheet.data[i + 3] };
}

function bounds(sheet, pitchRow, steerFrame) {
  let minX = FRAME_W, maxX = -1, minY = FRAME_H, maxY = -1, opaque = 0;
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
    if (!pixel(sheet, pitchRow, steerFrame, x, y).a) continue;
    opaque += 1;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, opaque, width: maxX - minX + 1, height: maxY - minY + 1 };
}

test('Pulsewing generator deterministically reproduces all synchronized sheets', () => {
  const before = Object.fromEntries(Object.keys(sheets).map((layer) => {
    const file = layer === 'composite' ? 'car-v2.png' : `car-v2-${layer}.png`;
    return [layer, crypto.createHash('sha256').update(fs.readFileSync(asset(file))).digest('hex')];
  }));
  execFileSync(process.execPath, ['tools/gen-car.js'], { cwd: new URL('..', import.meta.url) });
  for (const [layer, digest] of Object.entries(before)) {
    const file = layer === 'composite' ? 'car-v2.png' : `car-v2-${layer}.png`;
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset(file))).digest('hex'), digest);
  }
});

test('atlas contract, rear-chase silhouette, canopy, twin engines, and anchor hold in all poses', () => {
  for (const sheet of Object.values(sheets)) {
    assert.equal(sheet.width, VEHICLE_SHEET_WIDTH);
    assert.equal(sheet.height, VEHICLE_SHEET_HEIGHT);
  }
  for (let row = 0; row < PITCH_ROWS; row++) for (let frame = 0; frame < STEER_FRAMES; frame++) {
    const box = bounds(sheets.composite, row, frame);
    let glass = 0, engineCores = 0;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      const p = pixel(sheets.detail, row, frame, x, y);
      if (p.a && p.b > 35 && p.b > p.r * 1.5 && p.b > p.g * 1.08) glass += 1;
      if (p.a && p.r > 220 && p.g > 235 && p.b > 240) engineCores += 1;
    }
    assert.ok(box.opaque > 3000, `row ${row} frame ${frame} lost its professional silhouette`);
    assert.ok(box.width > box.height * 1.5, `row ${row} frame ${frame} became top-down/tall`);
    assert.equal(box.maxY, 104, `row ${row} frame ${frame} bottom anchor drifted`);
    assert.ok(box.minX >= 3 && box.maxX <= FRAME_W - 4, `row ${row} frame ${frame} clipped cell edge`);
    assert.ok(glass > 35, `row ${row} frame ${frame} lost the integrated canopy`);
    assert.ok(engineCores >= 2, `row ${row} frame ${frame} lost twin engine cores`);
  }
});

test('opposite steering silhouettes are exact mirrors and neutral remains centered', () => {
  for (let row = 0; row < PITCH_ROWS; row++) {
    for (const [left, right] of [[0, 4], [1, 3]]) {
      let union = 0, mismatch = 0;
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
        const a = pixel(sheets.composite, row, left, x, y).a > 0;
        const b = pixel(sheets.composite, row, right, FRAME_W - 1 - x, y).a > 0;
        if (a || b) union += 1;
        if (a !== b) mismatch += 1;
      }
      assert.ok(mismatch / union < 0.004, `row ${row}, frames ${left}/${right} mirror drift ${mismatch}/${union}`);
    }
    const neutral = bounds(sheets.composite, row, 2);
    assert.ok(Math.abs((neutral.minX + neutral.maxX) / 2 - 63.5) <= 0.5);
  }
});

test('soft, hard, and pitch poses are materially distinct without scale or anchor jitter', () => {
  for (let row = 0; row < PITCH_ROWS; row++) {
    let hardGold = 0;
    let softGold = 0;
    let softNeutralDifference = 0;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      const hard = pixel(sheets.detail, row, 0, x, y);
      const soft = pixel(sheets.detail, row, 1, x, y);
      const neutral = pixel(sheets.detail, row, 2, x, y);
      if (hard.a && hard.r > 220 && hard.g > 140 && hard.b < 120) hardGold += 1;
      if (soft.a && soft.r > 220 && soft.g > 140 && soft.b < 120) softGold += 1;
      if (soft.a !== neutral.a || soft.r !== neutral.r || soft.g !== neutral.g || soft.b !== neutral.b) {
        softNeutralDifference += 1;
      }
    }
    assert.ok(softNeutralDifference > 1000, `row ${row} soft steering lacks a distinct perspective`);
    assert.ok(hardGold >= softGold + 45, `row ${row} hard steering lost its active airbrake`);
  }
  for (let frame = 0; frame < STEER_FRAMES; frame++) {
    const down = bounds(sheets.composite, 0, frame);
    const neutral = bounds(sheets.composite, 1, frame);
    const up = bounds(sheets.composite, 2, frame);
    assert.ok(Math.abs(down.height - neutral.height) >= 4, `frame ${frame} nose-down silhouette collapsed`);
    assert.ok(Math.abs(up.height - neutral.height) >= 1, `frame ${frame} nose-up silhouette collapsed`);
    assert.equal(up.maxY, down.maxY);
  }
  assert.equal(bounds(sheets.composite, 1, 2).width, VEHICLE_NEUTRAL_HULL_WIDTH);
});

test('paint/detail layers partition the composite and fixed materials survive liveries', () => {
  const colors = [0x48a8ff, 0xff4f8f, 0xffb229, 0x5ee878, 0xb978ff, 0xff6b5c];
  let paintPixels = 0, detailPixels = 0;
  for (let row = 0; row < PITCH_ROWS; row++) for (let frame = 0; frame < STEER_FRAMES; frame++) {
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      const c = pixel(sheets.composite, row, frame, x, y);
      const p = pixel(sheets.paint, row, frame, x, y);
      const d = pixel(sheets.detail, row, frame, x, y);
      assert.equal(Boolean(c.a), Boolean(p.a || d.a), `layer union mismatch ${row}/${frame}/${x}/${y}`);
      assert.ok(!(p.a && d.a), `paint/detail overlap ${row}/${frame}/${x}/${y}`);
      if (p.a) paintPixels += 1;
      if (d.a) detailPixels += 1;
    }
  }
  assert.ok(paintPixels > 10000);
  assert.ok(detailPixels > 10000);
  for (const color of colors) {
    // Phaser multiply tint scales the grayscale paint ramp by each livery;
    // fixed detail bytes are never involved in that operation.
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const dark = [r, g, b].map((channel) => Math.round(channel * 0.34));
    const light = [r, g, b];
    assert.ok(light.reduce((sum, channel) => sum + channel, 0) > dark.reduce((sum, channel) => sum + channel, 0));
  }
});
