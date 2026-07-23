// EndlessTrack.js — a RoadModel that manufactures road just-in-time.
//
// Strategy: never loop. Keep appending generated pieces so the track always
// extends past the draw distance; the player chases a horizon that's being
// paved as they approach it. Road BEHIND the player is trimmed (keeping a
// margin) — the original "never trim, memory is cheap" plan was wrong:
// unbounded heap means unbounded GC pauses, which froze long runs. Trimming
// without re-indexing chaos works because segment.index is ABSOLUTE (it
// never changes); trimOffset maps absolute index -> array position.
//
// Difficulty ramps with distance: curves sharpen, pieces shorten (less
// recovery room), straights get rarer. The road itself is the antagonist.

import { RoadModel } from './RoadModel.js';
import { stampPattern } from './patterns.js';

const RAMP_PIECES = 30; // pieces until full difficulty (~a few minutes of driving)

export class EndlessTrack extends RoadModel {
  constructor(tuning) {
    super(tuning);
    this.piecesGenerated = 0;
    this.addStraight(30); // gentle runway so the ramp starts from zero threat
    this.decorate(0, 0);  // posts only — the runway stays hazard-free
    this.nextPatternAt = 90; // hazards begin after the runway (absolute index)
    this.trimOffset = 0;     // segments dropped behind us; absolute idx - trimOffset = array idx
  }

  // Absolute far-edge z, not array length — Player's lap-wrap must never
  // fire in endless, and trimming shrinks the array without moving the world.
  get trackLength() {
    return (this.trimOffset + this.segments.length) * this.t.segmentLength;
  }

  segmentAt(base, n) {
    const i = base.index - this.trimOffset + n;
    return this.segments[Math.max(0, Math.min(i, this.segments.length - 1))];
  }

  // No wrap: clamp instead of modulo. ensureAhead guarantees we never
  // actually hit the clamp during play.
  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength) - this.trimOffset;
    return this.segments[Math.max(0, Math.min(i, this.segments.length - 1))];
  }

  // Call every frame. Keeps trackLength ahead of what the renderer can see,
  // with margin so generation never happens inside the visible window.
  ensureAhead(position) {
    const horizon = position + (this.t.drawDistance + 50) * this.t.segmentLength;
    while (this.trackLength < horizon) this.appendPiece();
    this.stampPatterns();
    this.trimBehind(position);
  }

  // Drop road we can never see again, keeping a 150-segment tail margin.
  // Heap stays bounded -> GC pauses stay bounded -> no more mid-run freeze.
  trimBehind(position) {
    const keepFrom = Math.floor(position / this.t.segmentLength) - 150;
    let drop = keepFrom - this.trimOffset;
    if (drop > 0) {
      this.segments.splice(0, drop);
      this.trimOffset += drop;
    }
  }

  // Patterns use a persistent cursor, decoupled from piece boundaries —
  // a pattern is only stamped once ALL the road it needs exists, so the
  // cone telegraph can never point at rocks that were never built.
  stampPatterns() {
    const d = Math.min(1, this.piecesGenerated / RAMP_PIECES);
    const gap = Math.round(80 - d * 50); // breathing room shrinks: 80 -> 30
    // nextPatternAt is ABSOLUTE; convert to array space for stamping.
    // Math.max(1, ...) guard: the cursor must always advance — a stalled
    // cursor here is an infinite loop wearing a trench coat.
    while (this.nextPatternAt - this.trimOffset < this.segments.length - 60) {
      const consumed = stampPattern(this, this.nextPatternAt - this.trimOffset, this.rng);
      this.nextPatternAt +=
        Math.max(1, (consumed || 0) + gap + Math.floor(Math.random() * gap * 0.5));
    }
  }

  appendPiece() {
    const d = Math.min(1, this.piecesGenerated++ / RAMP_PIECES); // 0 -> 1
    const len = Math.round(30 - d * 16);        // pieces: 30 -> 14 segments
    const minCurve = 1 + d * 2;                 // gentlest curve: 1 -> 3
    const maxCurve = 2 + d * 5;                 // sharpest curve: 2 -> 7
    const straightChance = 0.4 - d * 0.25;      // straights: 40% -> 15%

    const before = this.segments.length;
    // Hills random-walk but with a homeward bias — unbounded drift would
    // slowly push the horizon out of frame. When high, downhills get
    // likelier; when low, uphills. Terrain that breathes but stays home.
    const homeBias = -Math.sign(this.lastY()) * Math.min(0.35, Math.abs(this.lastY()) / 40000);
    const rollHill = () =>
      Math.random() < 0.45
        ? rand(1, 3 + d * 2) * (Math.random() < 0.5 + homeBias ? 1 : -1) * -1
        : 0;

    const r = Math.random();
    if (r < straightChance) {
      this.addStraight(len);
    } else if (r < 0.72) {
      const curve = rand(minCurve, maxCurve) * (Math.random() < 0.5 ? -1 : 1);
      this.addCurve(len, curve, rollHill());
    } else if (r < 0.86) {
      // Exaggerated terrain: these are the speed traps and slingshots.
      this.addHill(len, rand(3, 6 + d * 3) * (Math.random() < 0.5 + homeBias ? 1 : -1));
    } else if (r < 0.93) {
      this.addSCurves();
    } else {
      this.addDirt(Math.max(14, len - 4), rand(0, minCurve) * (Math.random() < 0.5 ? -1 : 1));
    }
    // Posts only here — hazard patterns are stamped by stampPatterns(),
    // which runs on its own cursor so formations never straddle the edge
    // of the paved world.
    this.decorate(0, before);
  }
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}
