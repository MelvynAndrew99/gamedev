// patterns.js — road formations, third revision. The grammar, simplified:
//
//   A CONE MEANS "SOMETHING IS COMING." Two or three cones in a lane are
//   the universal warning — the payload behind them might be rocks, might
//   be a ramp, might be a ramp with rocks to fly over. The warning is
//   honest about WHERE and silent about WHAT. That ambiguity is the
//   design: a parsed-once fixed grammar goes invisible; an ambiguous one
//   makes every cone line a live decision (commit or cover the brake).
//
//   Cones are harmless to hit (0 damage) — signage, not candy, not tax.
//
// Everything stays lane-anchored and learnable at the WHERE level; only
// the WHAT is variable.

import { OBSTACLES } from '../config/obstacles.js';

export const LANES = [-0.66, 0, 0.66];

function put(model, i, def, offset) {
  const seg = model.segments[i];
  if (!seg) return;
  seg.sprites.push({ def, key: def.key, view: def.view, offset, hit: false });
}

// The universal warning: 2-3 cones down the lane. Returns segments used.
function warn(model, at, lane) {
  const count = 2 + Math.floor(Math.random() * 2);
  let i = at;
  for (let c = 0; c < count; c++, i += 4) put(model, i, OBSTACLES.cone, lane);
  return i - at + 2; // small gap after the last cone
}

// --- Payloads: what the warning was about --------------------------------

function rocksPayload(model, at, lane) {
  let i = at;
  for (let r = 0; r < 3; r++, i += 5) put(model, i, OBSTACLES.rock, lane);
  return i - at;
}

function rampPayload(model, at, lane) {
  put(model, at, OBSTACLES.ramp, lane);
  return 5;
}

// Ramp with a rock field behind it — commit and fly, or brake and thread.
// Rocks start 6 past the ramp: inside the jump arc even at half speed.
function rampOverRocksPayload(model, at, lane) {
  put(model, at, OBSTACLES.ramp, lane);
  const rockStart = at + 6;
  for (let r = 0; r < 4; r++) put(model, rockStart + r * 4, OBSTACLES.rock, lane);
  return rockStart + 3 * 4 + 4 - at;
}

const PAYLOADS = [
  { fn: rocksPayload, weight: 4 },
  { fn: rampPayload, weight: 3 },
  { fn: rampOverRocksPayload, weight: 3 },
];
const TOTAL_WEIGHT = PAYLOADS.reduce((s, p) => s + p.weight, 0);

function pickPayload() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const p of PAYLOADS) {
    if ((r -= p.weight) <= 0) return p.fn;
  }
  return PAYLOADS[0].fn;
}

// --- Wide formations (warned across the affected lanes) ------------------

// Two lanes closing: cones mark BOTH doomed lanes, rocks follow. The gap
// in the warning is the way through.
function gate(model, at) {
  const open = Math.floor(Math.random() * LANES.length);
  let i = at;
  for (let c = 0; c < 2; c++, i += 4) {
    LANES.forEach((lane, li) => { if (li !== open) put(model, i, OBSTACLES.cone, lane); });
  }
  i += 2;
  LANES.forEach((lane, li) => {
    if (li !== open) { put(model, i, OBSTACLES.rock, lane); put(model, i + 4, OBSTACLES.rock, lane); }
  });
  return i + 8 - at;
}

// One edge closing: cones along the edge, then a rock wall there.
function edgeSqueeze(model, at) {
  const side = Math.random() < 0.5 ? -1 : 1;
  let i = at;
  for (let c = 0; c < 2; c++, i += 4) put(model, i, OBSTACLES.cone, side * 0.8);
  i += 2;
  for (let r = 0; r < 5; r++, i += 4) put(model, i, OBSTACLES.rock, side * 0.82);
  return i - at;
}

// --- Entry point ---------------------------------------------------------

export function stampPattern(model, at) {
  const roll = Math.random();
  if (roll < 0.7) {
    // Lane event: warning, then a mystery payload in the same lane.
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const used = warn(model, at, lane);
    return used + pickPayload()(model, at + used, lane);
  }
  if (roll < 0.85) return gate(model, at);
  return edgeSqueeze(model, at);
}