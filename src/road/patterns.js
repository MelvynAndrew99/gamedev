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
function warn(model, at, lane, rng) {
  const count = 2 + Math.floor(rng() * 2);
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

// Zipper runway into a ramp: paint feeds speed, speed feeds airtime.
// The strip is part of the road (segment.zipper), the ramp is a sprite —
// hit the paint at the right line and the jump is a rocket launch.
function zipRampPayload(model, at, lane) {
  for (let k = at; k < at + 5; k++) {
    const seg = model.segments[k];
    if (seg) seg.zipper = { offset: lane, w: 0.22 };
  }
  put(model, at + 7, OBSTACLES.ramp, lane);
  return 12;
}

const PAYLOADS = [
  { fn: rocksPayload, weight: 4 },
  { fn: rampPayload, weight: 2 },
  { fn: rampOverRocksPayload, weight: 3 },
  { fn: zipRampPayload, weight: 3 },
];
const TOTAL_WEIGHT = PAYLOADS.reduce((s, p) => s + p.weight, 0);

function pickPayload(rng) {
  let r = rng() * TOTAL_WEIGHT;
  for (const p of PAYLOADS) {
    if ((r -= p.weight) <= 0) return p.fn;
  }
  return PAYLOADS[0].fn;
}

// --- The combo line (Tony Hawk foundation) -------------------------------
// An authored chain: zip runway -> ramp -> landing strip in the ADJACENT
// lane -> return strip. Rocks guard the launch lane's landing zone
// (cone-warned for anyone grounded), so the trick is carving to the new
// lane MID-AIR with the airbrakes. Every beat feeds the combo; the whole
// line fits far inside the combo window at band speed, so a clean run
// compounds: zip x1, ramp x2, zip x3, zip x4...
function setZip(model, i, lane) {
  const seg = model.segments[i];
  if (seg) seg.zipper = { offset: lane, w: 0.22 };
}

function comboLine(model, at, rng) {
  const li = Math.floor(rng() * LANES.length);
  const laneA = LANES[li];
  const laneB = LANES[(li + 1 + Math.floor(rng() * 2)) % LANES.length];
  let i = at;
  for (let k = 0; k < 5; k++) setZip(model, i + k, laneA);   // runway
  i += 7;
  put(model, i, OBSTACLES.ramp, laneA);                      // launch
  put(model, i + 4, OBSTACLES.cone, laneA);                  // grounded-warning:
  put(model, i + 8, OBSTACLES.cone, laneA);                  // rocks ahead in A
  const land = i + 14;
  for (let k = 0; k < 5; k++) setZip(model, land + k, laneB); // landing strip (B)
  put(model, land + 1, OBSTACLES.rock, laneA);               // A's landing is mined
  put(model, land + 5, OBSTACLES.rock, laneA);
  i = land + 12;
  for (let k = 0; k < 5; k++) setZip(model, i + k, laneA);   // return strip
  return i + 8 - at;
}

// --- Wide formations (warned across the affected lanes) ------------------

// Two lanes closing: cones mark BOTH doomed lanes, rocks follow. The gap
// in the warning is the way through.
function gate(model, at, rng) {
  const open = Math.floor(rng() * LANES.length);
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
function edgeSqueeze(model, at, rng) {
  const side = rng() < 0.5 ? -1 : 1;
  let i = at;
  for (let c = 0; c < 2; c++, i += 4) put(model, i, OBSTACLES.cone, side * 0.8);
  i += 2;
  for (let r = 0; r < 5; r++, i += 4) put(model, i, OBSTACLES.rock, side * 0.82);
  return i - at;
}

// --- Entry point ---------------------------------------------------------

export function stampPattern(model, at, rng = Math.random) {
  const roll = rng();
  if (roll < 0.55) {
    // Lane event: warning, then a mystery payload in the same lane.
    const lane = LANES[Math.floor(rng() * LANES.length)];
    const used = warn(model, at, lane, rng);
    return used + pickPayload(rng)(model, at + used, lane);
  }
  if (roll < 0.73) return comboLine(model, at, rng);
  if (roll < 0.87) return gate(model, at, rng);
  return edgeSqueeze(model, at, rng);
}
