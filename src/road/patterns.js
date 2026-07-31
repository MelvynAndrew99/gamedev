// patterns.js — road formations, third revision. The grammar, simplified:
//
//   CONES MEAN DANGER. Two or three cones in a lane warn that rocks are
//   closing that line. They are tall, vertical markers, never invitations.
//
//   RAMPS MEAN OPPORTUNITY. A yellow/cyan launch lane leads to a physical
//   raised ramp. The paint is only a sightline aid: the ramp, jump arc,
//   airborne steering, and landing reward remain the actual interaction.
//
// Cones remain harmless to hit (0 damage) — signage, not candy, not tax.

import { OBSTACLES } from '../config/obstacles.js';

export const LANES = [-0.66, 0, 0.66];

const CONE_INTERVAL = 12;
const CONE_TO_PAYLOAD = 18;
const RAMP_APPROACH = 28;

export const DEFAULT_PATTERN_WEIGHTS = Object.freeze({
  lane: 0.55,
  combo: 0.18,
  gate: 0.14,
  edge: 0.13,
});

function put(model, i, def, offset) {
  const seg = model.segments[i];
  if (!seg) return;
  seg.sprites.push({ def, key: def.key, view: def.view, offset, hit: false });
}

// A readable danger countdown. At max speed the old four-segment cadence
// collapsed the full warning into a few tenths of a second. Widely spaced
// markers let the eye acquire the lane first, then make the steering choice.
function warn(model, at, lane, rng) {
  const count = 2 + Math.floor(rng() * 2);
  let i = at;
  for (let c = 0; c < count; c++, i += CONE_INTERVAL) {
    put(model, i, OBSTACLES.cone, lane);
  }
  return i - at + CONE_TO_PAYLOAD;
}

// Yellow/cyan paint is projected as part of the road, but terminates at a
// separate raised sprite. This is a runway leading TO a ramp, not a flat ramp.
function markRampApproach(model, rampAt, lane) {
  const start = Math.max(0, rampAt - RAMP_APPROACH);
  for (let i = start; i < rampAt; i++) {
    const seg = model.segments[i];
    if (!seg) continue;
    seg.launchApproach = {
      offset: lane,
      w: 0.27,
      distanceToRamp: rampAt - i,
    };
  }
}

// --- Payloads -------------------------------------------------------------

function rocksPayload(model, at, lane) {
  let i = at;
  for (let r = 0; r < 3; r++, i += 5) put(model, i, OBSTACLES.rock, lane);
  return i - at;
}

function rampPayload(model, at, lane) {
  markRampApproach(model, at, lane);
  put(model, at, OBSTACLES.ramp, lane);
  return 5;
}

// Ramp with a rock field behind it — commit and fly, or brake and thread.
// Rocks start 6 past the ramp: inside the jump arc even at half speed.
function rampOverRocksPayload(model, at, lane) {
  markRampApproach(model, at, lane);
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

function pickPayload(rng) {
  let r = rng() * TOTAL_WEIGHT;
  for (const p of PAYLOADS) {
    if ((r -= p.weight) <= 0) return p.fn;
  }
  return PAYLOADS[0].fn;
}

function laneEvent(model, at, rng) {
  const lane = LANES[Math.floor(rng() * LANES.length)];
  const payload = pickPayload(rng);

  // Rocks get danger markers. Ramps get an equally early launch runway and
  // no cones, so a player never has to guess whether a warning is a reward.
  if (payload === rocksPayload) {
    const used = warn(model, at, lane, rng);
    return used + payload(model, at + used, lane);
  }

  return RAMP_APPROACH + payload(model, at + RAMP_APPROACH, lane);
}

function rocksLine(model, at, rng) {
  const lane = LANES[Math.floor(rng() * LANES.length)];
  const used = warn(model, at, lane, rng);
  return used + rocksPayload(model, at + used, lane);
}

function rampLine(model, at, rng) {
  const lane = LANES[Math.floor(rng() * LANES.length)];
  return RAMP_APPROACH + rampPayload(model, at + RAMP_APPROACH, lane);
}

function rampRocksLine(model, at, rng) {
  const lane = LANES[Math.floor(rng() * LANES.length)];
  return RAMP_APPROACH + rampOverRocksPayload(model, at + RAMP_APPROACH, lane);
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
  markRampApproach(model, i, laneA);
  put(model, i, OBSTACLES.ramp, laneA);                      // raised launch
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
  for (let c = 0; c < 2; c++, i += CONE_INTERVAL) {
    LANES.forEach((lane, li) => { if (li !== open) put(model, i, OBSTACLES.cone, lane); });
  }
  i += CONE_TO_PAYLOAD;
  LANES.forEach((lane, li) => {
    if (li !== open) { put(model, i, OBSTACLES.rock, lane); put(model, i + 4, OBSTACLES.rock, lane); }
  });
  return i + 8 - at;
}

// One edge closing: cones along the edge, then a rock wall there.
function edgeSqueeze(model, at, rng) {
  const side = rng() < 0.5 ? -1 : 1;
  let i = at;
  for (let c = 0; c < 2; c++, i += CONE_INTERVAL) {
    put(model, i, OBSTACLES.cone, side * 0.8);
  }
  i += CONE_TO_PAYLOAD;
  for (let r = 0; r < 5; r++, i += 4) put(model, i, OBSTACLES.rock, side * 0.82);
  return i - at;
}

// --- Entry point ---------------------------------------------------------

export function stampPattern(
  model,
  at,
  rng = Math.random,
  weights = DEFAULT_PATTERN_WEIGHTS,
  forcedKind = null
) {
  const entries = [
    ['lane', laneEvent],
    ['combo', comboLine],
    ['gate', gate],
    ['edge', edgeSqueeze],
  ];
  const authored = {
    lane: laneEvent,
    rocks: rocksLine,
    ramp: rampLine,
    rampRocks: rampRocksLine,
    combo: comboLine,
    gate,
    edge: edgeSqueeze,
  };
  if (forcedKind && authored[forcedKind]) {
    if (model.segments[at]) model.segments[at].patternKind = forcedKind;
    return authored[forcedKind](model, at, rng);
  }
  if (forcedKind) throw new Error(`Unknown pattern kind: ${forcedKind}`);

  const total = entries.reduce(
    (sum, [key]) => sum + Math.max(0, weights[key] ?? DEFAULT_PATTERN_WEIGHTS[key]),
    0
  );
  let roll = rng() * (total || 1);
  for (const [key, pattern] of entries) {
    roll -= Math.max(0, weights[key] ?? DEFAULT_PATTERN_WEIGHTS[key]);
    if (roll <= 0) {
      if (model.segments[at]) model.segments[at].patternKind = key;
      return pattern(model, at, rng);
    }
  }
  if (model.segments[at]) model.segments[at].patternKind = 'lane';
  return laneEvent(model, at, rng);
}
