// patterns.js — authored road formations. The vocabulary, post-pivot:
//
//   CONES ARE BREADCRUMBS. A cone trail marks the profitable line —
//   smash them for fame, and the trail always DELIVERS: it ends in a
//   ramp. Trails never lead into bare rocks; lying signage teaches
//   players to distrust every future promise.
//
//   ROCKS READ BY FORMATION. Lane-anchored clusters, visible for ~3s
//   at full speed before arrival. No escorts, no warnings — the rocks
//   ARE the warning.
//
//   RAMPS ARE THE JACKPOT — and sometimes the skeleton key: in
//   rampOverRocks the launch clears a rock field that cautious drivers
//   must brake and thread. One track, two playstyles, both honest.
//
// Skill = reading formations earlier each run. Everything lane-anchored,
// nothing random within a formation — patterns must be learnable or
// they're just dice.

import { OBSTACLES } from '../config/obstacles.js';

export const LANES = [-0.66, 0, 0.66];

function put(model, i, def, offset) {
  const seg = model.segments[i];
  if (!seg) return;
  seg.sprites.push({ def, key: def.key, view: def.view, offset, hit: false });
}

// A trail of candy down one lane, capped with a ramp. Pure profit for
// anyone willing to commit to the line.
function coneTrail(model, at) {
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  let i = at;
  for (let c = 0; c < 5; c++, i += 3) put(model, i, OBSTACLES.cone, lane);
  i += 2;
  put(model, i, OBSTACLES.ramp, lane);
  i += 4;
  return i - at;
}

// The thesis pattern: breadcrumbs -> ramp -> rock field in the same lane.
// Full commitment launches you clean over the rocks; hesitation means
// braking and lane-dancing through them. The rocks start 6 segments past
// the ramp — inside the jump arc even at half speed (see Player.launch).
function rampOverRocks(model, at) {
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  let i = at;
  for (let c = 0; c < 4; c++, i += 3) put(model, i, OBSTACLES.cone, lane);
  i += 2;
  put(model, i, OBSTACLES.ramp, lane);
  const rockStart = i + 6;
  for (let r = 0; r < 4; r++) put(model, rockStart + r * 4, OBSTACLES.rock, lane);
  i = rockStart + 3 * 4 + 4;
  return i - at;
}

// Rocks close one lane. No escort — read the cluster.
function laneRocks(model, at) {
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  let i = at;
  for (let r = 0; r < 3; r++, i += 5) put(model, i, OBSTACLES.rock, lane);
  return i - at;
}

// Rocks line one edge for a stretch, squeezing the road — nastiest when
// it lands on a curve pushing the same direction.
function edgeSqueeze(model, at) {
  const side = Math.random() < 0.5 ? -1 : 1;
  let i = at;
  for (let r = 0; r < 5; r++, i += 4) put(model, i, OBSTACLES.rock, side * 0.82);
  return i - at;
}

// Two lanes rocked shut, one open. The gap is the read.
function rockGate(model, at) {
  const open = Math.floor(Math.random() * LANES.length);
  let i = at;
  LANES.forEach((lane, li) => {
    if (li !== open) {
      put(model, i, OBSTACLES.rock, lane);
      put(model, i + 4, OBSTACLES.rock, lane);
    }
  });
  i += 8;
  return i - at;
}

// Weights: candy patterns lead — the game should feel generous, with
// hazards as punctuation, not the paragraph.
const PATTERNS = [coneTrail, coneTrail, rampOverRocks, rampOverRocks, laneRocks, edgeSqueeze, rockGate];

export function stampPattern(model, at) {
  const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  return pattern(model, at);
}