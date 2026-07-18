// EndlessTrack.js — a RoadModel that manufactures road just-in-time.
//
// Strategy: never loop. Keep appending generated pieces so the track always
// extends past the draw distance; the player chases a horizon that's being
// paved as they approach it. Old segments are never trimmed — a segment is
// ~200 bytes, so even a heroic 20-minute run is a few MB. Trimming would
// mean re-indexing everything mid-race; memory is cheaper than that bug.
//
// Difficulty ramps with distance: curves sharpen, pieces shorten (less
// recovery room), straights get rarer. The road itself is the antagonist.

import { RoadModel } from './RoadModel.js';

const RAMP_PIECES = 30; // pieces until full difficulty (~a few minutes of driving)

export class EndlessTrack extends RoadModel {
  constructor(tuning) {
    super(tuning);
    this.piecesGenerated = 0;
    this.addStraight(30); // gentle runway so the ramp starts from zero threat
  }

  // No wrap: clamp instead of modulo. ensureAhead guarantees we never
  // actually hit the clamp during play.
  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength);
    return this.segments[Math.max(0, Math.min(i, this.segments.length - 1))];
  }

  // Call every frame. Keeps trackLength ahead of what the renderer can see,
  // with margin so generation never happens inside the visible window.
  ensureAhead(position) {
    const horizon = position + (this.t.drawDistance + 50) * this.t.segmentLength;
    while (this.trackLength < horizon) this.appendPiece();
  }

  appendPiece() {
    const d = Math.min(1, this.piecesGenerated++ / RAMP_PIECES); // 0 -> 1
    const len = Math.round(30 - d * 16);        // pieces: 30 -> 14 segments
    const minCurve = 1 + d * 2;                 // gentlest curve: 1 -> 3
    const maxCurve = 2 + d * 5;                 // sharpest curve: 2 -> 7
    const straightChance = 0.4 - d * 0.25;      // straights: 40% -> 15%

    const r = Math.random();
    if (r < straightChance) {
      this.addStraight(len);
    } else if (r < 0.9) {
      const curve = rand(minCurve, maxCurve) * (Math.random() < 0.5 ? -1 : 1);
      this.addCurve(len, curve);
    } else {
      this.addSCurves();
    }
  }
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}