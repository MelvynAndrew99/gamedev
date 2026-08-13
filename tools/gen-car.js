// Deterministic Pulsewing atlas builder.
//
// The image-generated concept is art direction, not a runtime sheet: this
// tool isolates its five-by-three pose study, removes chroma, normalizes every
// pose to one scale/contact anchor, mirrors one authored steering side for
// exact coherence, and emits synchronized paint/detail layers for liveries.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  VEHICLE_FRAME_HEIGHT as FRAME_H,
  VEHICLE_FRAME_WIDTH as FRAME_W,
  VEHICLE_PITCH_ROWS,
  VEHICLE_SHEET_HEIGHT,
  VEHICLE_SHEET_WIDTH,
  VEHICLE_STEER_FRAMES,
} from '../src/config/vehicleSprite.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(ROOT, 'art', 'pulsewing-concept-v1.png');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets');
const SOURCE_SCALE = 0.45;
const CONTACT_Y = 104;
const CLEARANCE = 3;

if (VEHICLE_STEER_FRAMES !== 5 || VEHICLE_PITCH_ROWS !== 3) {
  throw new Error('Pulsewing source contract requires five steering columns and three pitch rows');
}

function sourcePixel(source, x, y) {
  const i = (y * source.width + x) * 4;
  return [source.data[i], source.data[i + 1], source.data[i + 2], source.data[i + 3]];
}

function isChroma([r, g, b, a]) {
  if (!a) return true;
  // The concept uses a bright green-only field. A ratio test removes its
  // antialiased edge spill without deleting cyan engines or blue paint.
  return g > 105 && g > r * 1.34 && g > b * 1.2;
}

function subjectBounds(source, column, row) {
  const cellX0 = Math.floor(column * source.width / VEHICLE_STEER_FRAMES);
  const cellX1 = Math.floor((column + 1) * source.width / VEHICLE_STEER_FRAMES);
  const cellY0 = Math.floor(row * source.height / VEHICLE_PITCH_ROWS);
  const cellY1 = Math.floor((row + 1) * source.height / VEHICLE_PITCH_ROWS);
  let minX = cellX1;
  let minY = cellY1;
  let maxX = -1;
  let maxY = -1;
  for (let y = cellY0; y < cellY1; y += 1) {
    for (let x = cellX0; x < cellX1; x += 1) {
      if (isChroma(sourcePixel(source, x, y))) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`No vehicle found in source cell ${row}/${column}`);
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function makeFrame() {
  return new PNG({ width: FRAME_W, height: FRAME_H });
}

function setPixel(frame, x, y, rgba) {
  if (x < 0 || x >= FRAME_W || y < 0 || y >= FRAME_H) return;
  const i = (y * FRAME_W + x) * 4;
  frame.data[i] = rgba[0];
  frame.data[i + 1] = rgba[1];
  frame.data[i + 2] = rgba[2];
  frame.data[i + 3] = rgba[3];
}

function alphaBounds(frame) {
  let minX = FRAME_W;
  let minY = FRAME_H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < FRAME_H; y += 1) {
    for (let x = 0; x < FRAME_W; x += 1) {
      if (!frame.data[(y * FRAME_W + x) * 4 + 3]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function isolateFrame(source, sourceColumn, row) {
  const box = subjectBounds(source, sourceColumn, row);
  const scaledW = Math.round(box.width * SOURCE_SCALE);
  const scaledH = Math.round(box.height * SOURCE_SCALE);
  if (scaledW > FRAME_W - CLEARANCE * 2 || scaledH > FRAME_H - CLEARANCE * 2) {
    throw new Error(`Source cell ${row}/${sourceColumn} does not fit the runtime frame`);
  }
  const frame = makeFrame();
  const targetX = Math.round((FRAME_W - scaledW) / 2);
  const targetY = CONTACT_Y - scaledH + 1;
  for (let y = 0; y < scaledH; y += 1) {
    for (let x = 0; x < scaledW; x += 1) {
      const sx = box.minX + Math.min(box.width - 1, Math.floor(x / SOURCE_SCALE));
      const sy = box.minY + Math.min(box.height - 1, Math.floor(y / SOURCE_SCALE));
      const color = sourcePixel(source, sx, sy);
      if (isChroma(color)) continue;
      // Hard alpha is intentional: nearest-neighbor display stays crisp and
      // no green matte survives rival recoloring.
      setPixel(frame, targetX + x, targetY + y, [color[0], color[1], color[2], 255]);
    }
  }
  return frame;
}

function mirrorFrame(source) {
  const frame = makeFrame();
  for (let y = 0; y < FRAME_H; y += 1) {
    for (let x = 0; x < FRAME_W; x += 1) {
      const si = (y * FRAME_W + x) * 4;
      setPixel(frame, FRAME_W - 1 - x, y, [
        source.data[si], source.data[si + 1], source.data[si + 2], source.data[si + 3],
      ]);
    }
  }
  return frame;
}

function fillPolygon(frame, points, color) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) setPixel(frame, x, y, color);
    }
  }
}

function addHardTurnAirbrake(frame) {
  const box = alphaBounds(frame);
  // A raised gold vane grows directly from the near rear shoulder. Its pearl
  // hinge keeps the cue attached to the vehicle rather than floating beside it.
  const hingeX = box.minX + Math.round(box.width * 0.28);
  const baseY = box.minY + Math.round(box.height * 0.56);
  fillPolygon(frame, [
    [hingeX - 5, baseY + 2],
    [hingeX - 4, Math.max(CLEARANCE, box.minY - 10)],
    [hingeX + 2, Math.max(CLEARANCE + 1, box.minY - 7)],
    [hingeX + 4, baseY + 3],
  ], [255, 207, 63, 255]);
  fillPolygon(frame, [
    [hingeX + 2, baseY + 2],
    [hingeX + 2, Math.max(CLEARANCE + 1, box.minY - 7)],
    [hingeX + 4, Math.max(CLEARANCE + 2, box.minY - 5)],
    [hingeX + 5, baseY + 3],
  ], [232, 236, 255, 255]);
}

function isPaint(r, g, b) {
  const bright = Math.max(r, g, b);
  const blueHull = b > r * 1.25 && b > g * 1.08 && bright >= 72;
  const cyanMaterial = g > 105 && b > 130 && b - g < 82;
  return blueHull && !cyanMaterial;
}

function splitFrame(composite) {
  const paint = makeFrame();
  const detail = makeFrame();
  for (let y = 0; y < FRAME_H; y += 1) {
    for (let x = 0; x < FRAME_W; x += 1) {
      const i = (y * FRAME_W + x) * 4;
      const r = composite.data[i];
      const g = composite.data[i + 1];
      const b = composite.data[i + 2];
      const a = composite.data[i + 3];
      if (!a) continue;
      if (isPaint(r, g, b)) {
        const luminance = Math.max(58, Math.min(255, Math.round(r * 0.25 + g * 0.5 + b * 0.38)));
        setPixel(paint, x, y, [luminance, luminance, luminance, 255]);
      } else {
        setPixel(detail, x, y, [r, g, b, 255]);
      }
    }
  }
  return { paint, detail };
}

function blit(sheet, frame, column, row) {
  for (let y = 0; y < FRAME_H; y += 1) {
    for (let x = 0; x < FRAME_W; x += 1) {
      const si = (y * FRAME_W + x) * 4;
      const di = ((row * FRAME_H + y) * sheet.width + column * FRAME_W + x) * 4;
      sheet.data[di] = frame.data[si];
      sheet.data[di + 1] = frame.data[si + 1];
      sheet.data[di + 2] = frame.data[si + 2];
      sheet.data[di + 3] = frame.data[si + 3];
    }
  }
}

const source = PNG.sync.read(fs.readFileSync(SOURCE_PATH));
const compositeSheet = new PNG({ width: VEHICLE_SHEET_WIDTH, height: VEHICLE_SHEET_HEIGHT });
const paintSheet = new PNG({ width: VEHICLE_SHEET_WIDTH, height: VEHICLE_SHEET_HEIGHT });
const detailSheet = new PNG({ width: VEHICLE_SHEET_WIDTH, height: VEHICLE_SHEET_HEIGHT });

for (let row = 0; row < VEHICLE_PITCH_ROWS; row += 1) {
  const hardLeft = isolateFrame(source, 0, row);
  addHardTurnAirbrake(hardLeft);
  const softLeft = isolateFrame(source, 1, row);
  const neutral = isolateFrame(source, 2, row);
  const frames = [hardLeft, softLeft, neutral, mirrorFrame(softLeft), mirrorFrame(hardLeft)];
  frames.forEach((frame, column) => {
    const { paint, detail } = splitFrame(frame);
    blit(compositeSheet, frame, column, row);
    blit(paintSheet, paint, column, row);
    blit(detailSheet, detail, column, row);
  });
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'car-v2.png'), PNG.sync.write(compositeSheet));
fs.writeFileSync(path.join(OUTPUT_DIR, 'car-v2-paint.png'), PNG.sync.write(paintSheet));
fs.writeFileSync(path.join(OUTPUT_DIR, 'car-v2-detail.png'), PNG.sync.write(detailSheet));
console.log(`Generated Pulsewing runtime sheets ${VEHICLE_SHEET_WIDTH}x${VEHICLE_SHEET_HEIGHT} from ${path.relative(ROOT, SOURCE_PATH)}`);
