// RoadModel.js — the track as pure data. No Phaser, no rendering, no DOM.
// A track is an array of segments; each is a slab segmentLength deep with
// a `curve` value (horizontal bend accumulated by the renderer), world
// y heights on its edges (hills — REAL geometry: the projection handles
// elevation natively, and Player turns the gradient into speed), and a
// surface ('road' | 'dirt') that changes grip, drag, and palette.

import { OBSTACLES, ROADSIDE } from '../config/obstacles.js';
import { stampPattern } from './patterns.js';

export class RoadModel {
  constructor(tuning) {
    this.t = tuning;
    this.segments = [];
  }

  get trackLength() {
    return this.segments.length * this.t.segmentLength;
  }

  lastY() {
    const n = this.segments.length;
    return n ? this.segments[n - 1].p2.world.y : 0;
  }

  addSegment(curve, y1, y2, surface) {
    // ABSOLUTE index: array length + everything ever trimmed. Deriving
    // this from array length alone made trimmed endless tracks pave new
    // road at old world coordinates.
    const n = this.segments.length + (this.trimOffset ?? 0);
    const len = this.t.segmentLength;
    this.segments.push({
      index: n,
      curve,
      surface,
      p1: { world: { x: 0, y: y1, z: n * len },       camera: {}, screen: {} },
      p2: { world: { x: 0, y: y2, z: (n + 1) * len }, camera: {}, screen: {} },
      band: Math.floor(n / this.t.rumbleLength) % 2,
      sprites: [],
    });
  }

  // Ease into a curve, hold, ease out — while the whole run of segments
  // also eases from the current height to current + hill*segmentLength.
  // Curves are per-segment (accumulated); height is absolute geometry, so
  // it interpolates across the entire piece.
  addRoad(enter, hold, leave, curve, hill = 0, surface = 'road') {
    const startY = this.lastY();
    const endY = startY + hill * this.t.segmentLength;
    const total = enter + hold + leave;
    let n = 0;
    const yAt = (k) => easeInOut(startY, endY, k / total);
    for (let i = 0; i < enter; i++, n++)
      this.addSegment(easeIn(0, curve, i / enter), yAt(n), yAt(n + 1), surface);
    for (let i = 0; i < hold; i++, n++)
      this.addSegment(curve, yAt(n), yAt(n + 1), surface);
    for (let i = 0; i < leave; i++, n++)
      this.addSegment(easeInOut(curve, 0, i / leave), yAt(n), yAt(n + 1), surface);
  }

  addStraight(n)             { this.addRoad(n, n, n, 0); }
  addCurve(n, curve, hill=0) { this.addRoad(n, n, n, curve, hill); }
  addHill(n, hill)           { this.addRoad(n, n, n, 0, hill); }
  addDirt(n, curve = 0, hill = 0) { this.addRoad(n, n, n, curve, hill, 'dirt'); }
  addSCurves() {
    this.addCurve(25, -2);
    this.addCurve(25, 2);
    this.addCurve(25, -4);
    this.addCurve(25, 4);
    this.addCurve(25, -2);
  }

  // Build from data (see src/tracks/index.js for the format):
  //   ["straight", len]  ["curve", len, curve, hill?]  ["hill", len, hill]
  //   ["dirt", len, curve?, hill?]  ["scurves"]
  buildFromData(data) {
    this.segments = [];
    for (const piece of data.pieces) {
      const [type, len, a, b] = piece;
      if (type === 'straight')     this.addStraight(len ?? 25);
      else if (type === 'curve')   this.addCurve(len ?? 25, a ?? 2, b ?? 0);
      else if (type === 'hill')    this.addHill(len ?? 25, a ?? 2);
      else if (type === 'dirt')    this.addDirt(len ?? 20, a ?? 0, b ?? 0);
      else if (type === 'scurves') this.addSCurves();
      else throw new Error(`Unknown track piece: ${type}`);
    }
    if (this.segments.length === 0) throw new Error('Track has no pieces');

    // Looping tracks must land at their starting height, or the finish
    // line becomes a cliff. Authors don't have to balance their hills —
    // we close the drift with a gentle ramp home.
    const drift = this.lastY();
    if (Math.abs(drift) > 1) {
      this.addRoad(15, 10, 15, 0, -drift / this.t.segmentLength);
    }

    this.decorate(data.obstacles ?? 0.05);
  }

  // Roadside posts (speed perception — the eye reads velocity from things
  // streaming past the edges) and authored hazard patterns (patterns.js).
  decorate(obstacleDensity, from = 0, endMargin = 30) {
    for (let i = from; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (this.segments[i].index % 10 === 0) { // absolute index: cadence survives trimming
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: -1.25 });
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: 1.25 });
      }
    }
    this.placeBoostPads(from);
    if (obstacleDensity <= 0) return;

    const gap = Math.min(130, Math.max(25, Math.round(4 / obstacleDensity)));
    const start = Math.max(from, 30);
    const end = this.segments.length - endMargin - 45;
    let i = start + Math.floor(Math.random() * gap * 0.5);
    while (i < end) {
      const consumed = stampPattern(this, i);
      i += Math.max(1, (consumed || 0) + gap + Math.floor(Math.random() * gap * 0.5));
    }

    // Zippers LAST, so their hazard-clearance check sees the finished
    // road — paint never goes down where rocks already live.
    this.placeZippers(from, endMargin);
  }

  // Nitro pickups: a consumable, not a pad. The track scatters them every
  // 35-65 segments (random lane), plus a guaranteed one shortly before
  // each sustained climb — the game hands you the tool just before the
  // problem, but YOU decide when to burn it. (Kept the method name so
  // existing call sites don't care that pads became pickups.)
  placeBoostPads(from = 0) {
    const t = this.t;
    const lanes = [-0.66, 0, 0.66];
    const putNitro = (i) => {
      const seg = this.segments[i];
      if (!seg) return;
      seg.sprites.push({
        def: { key: 'boost', kind: 'pickup', pop: 0, damage: 0, slow: 1, w: 0.1, view: 0.15 },
        key: 'boost', view: 0.15,
        offset: lanes[Math.floor(Math.random() * lanes.length)], hit: false,
      });
    };
    let next = Math.max(from, 30) + Math.floor(Math.random() * 60);
    for (let i = Math.max(from, 20); i < this.segments.length; i++) {
      if (i >= next) { putNitro(i); next = i + 110 + Math.floor(Math.random() * 60); }
      const seg = this.segments[i];
      const s0 = (seg.p2.world.y - seg.p1.world.y) / t.segmentLength;
      const sPrev = i > 0 ? (this.segments[i-1].p2.world.y - this.segments[i-1].p1.world.y) / t.segmentLength : 0;
      if (s0 > t.minBoostSlope && sPrev <= t.minBoostSlope) putNitro(Math.max(from, i - 12));
    }
  }

  // Zipper strips: 5-segment lanes of painted speed, every 60-100
  // segments. PERSISTENT — never consumed; they're the skill-expression
  // surface. A strip is skipped if a hazard occupies its lane nearby, so
  // the paint never lies about being a good idea... on its own segment.
  // (What comes AFTER the strip at 150% is your problem.)
  placeZippers(from = 0, endMargin = 30) {
    const lanes = [-0.66, 0, 0.66];
    let i = Math.max(from, 40) + Math.floor(Math.random() * 40);
    const end = this.segments.length - endMargin - 10;
    while (i < end) {
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      let clear = true;
      for (let k = i - 3; k < i + 8 && clear; k++) {
        const seg = this.segments[k];
        if (!seg) continue;
        for (const s of seg.sprites) {
          if (s.def && s.def.damage > 0 && Math.abs(s.offset - lane) < 0.35) { clear = false; break; }
        }
      }
      if (clear) {
        for (let k = i; k < i + 5 && k < end; k++) {
          this.segments[k].zipper = { offset: lane, w: this.t.zipperW };
        }
      }
      i += 60 + Math.floor(Math.random() * 40);
    }
  }

  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength) % this.segments.length;
    return this.segments[(i + this.segments.length) % this.segments.length];
  }

  // Renderer indirection: "the segment n slabs past base". Looping tracks
  // wrap; EndlessTrack overrides this to account for trimmed history.
  segmentAt(base, n) {
    return this.segments[(base.index + n) % this.segments.length];
  }
}

function easeIn(a, b, p)    { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }