// RoadModel.js — the track as pure data. No Phaser, no rendering, no DOM.
// A track is just an array of segments; each segment is a slab of road
// segmentLength deep with a `curve` value. Curves are not geometry — they're
// an instruction to the renderer: "while walking through me, bend the road
// horizontally by this much per segment." Accumulate that while projecting
// and straight slabs *look* curved. That's the entire OutRun trick.

import { ROADSIDE } from '../config/obstacles.js';
import { stampPattern } from './patterns.js';

export class RoadModel {
  constructor(tuning) {
    this.t = tuning;
    this.segments = [];
  }

  get trackLength() {
    return this.segments.length * this.t.segmentLength;
  }

  addSegment(curve) {
    const n = this.segments.length;
    const len = this.t.segmentLength;
    this.segments.push({
      index: n,
      curve,
      // p1 = near edge of the slab, p2 = far edge. world -> camera -> screen
      // are filled in by the renderer every frame; we just allocate them once
      // here so the render loop never allocates (GC pauses are frame drops).
      p1: { world: { x: 0, y: 0, z: n * len },       camera: {}, screen: {} },
      p2: { world: { x: 0, y: 0, z: (n + 1) * len }, camera: {}, screen: {} },
      // Which rumble color band this segment belongs to (the SNES stripes).
      band: Math.floor(n / this.t.rumbleLength) % 2,
      // Things standing on this slab: obstacles ({def, offset}) and
      // roadside decoration ({key, offset}). offset is in road-half units.
      sprites: [],
    });
  }

  // Ease into a curve, hold it, ease out. Slamming from curve=0 to curve=4
  // in one segment looks like the road snapped; easing looks like a bend.
  addRoad(enter, hold, leave, curve) {
    for (let i = 0; i < enter; i++) this.addSegment(easeIn(0, curve, i / enter));
    for (let i = 0; i < hold; i++)  this.addSegment(curve);
    for (let i = 0; i < leave; i++) this.addSegment(easeInOut(curve, 0, i / leave));
  }

  addStraight(n)          { this.addRoad(n, n, n, 0); }
  addCurve(n, curve)      { this.addRoad(n, n, n, curve); }
  addSCurves()            {
    this.addCurve(25,  -2);
    this.addCurve(25,   2);
    this.addCurve(25,  -4);
    this.addCurve(25,   4);
    this.addCurve(25,  -2);
  }

  // Build the track from data (see src/tracks/index.js for the format).
  // The track file IS the level: no code changes to add a course.
  buildFromData(data) {
    this.segments = [];
    for (const piece of data.pieces) {
      const [type, len, curve] = piece;
      if (type === 'straight')     this.addStraight(len ?? 25);
      else if (type === 'curve')   this.addCurve(len ?? 25, curve ?? 2);
      else if (type === 'scurves') this.addSCurves();
      else throw new Error(`Unknown track piece: ${type}`);
    }
    if (this.segments.length === 0) throw new Error('Track has no pieces');
    this.decorate(data.obstacles ?? 0.05);
  }

  // Dress the track: roadside posts (speed perception — the eye reads
  // velocity from things streaming past the edges, not from the road
  // itself) and authored hazard patterns (see patterns.js — cones
  // telegraph, rocks punish; nothing is placed at random positions).
  // `obstacleDensity` sets pattern frequency: higher = shorter gaps.
  decorate(obstacleDensity, from = 0, endMargin = 30) {
    for (let i = from; i < this.segments.length; i++) {
      if (i % 10 === 0) {
        const seg = this.segments[i];
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: -1.25 });
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: 1.25 });
      }
    }
    if (obstacleDensity <= 0) return;

    // Density -> breathing room between patterns. The gap is the "flow"
    // knob: recover, resettle into a lane, then read the next formation.
    const gap = Math.min(130, Math.max(25, Math.round(4 / obstacleDensity)));
    const start = Math.max(from, 30);          // grace zone at the line
    const end = this.segments.length - endMargin - 45; // room for a full pattern
    let i = start + Math.floor(Math.random() * gap * 0.5);
    while (i < end) {
      const consumed = stampPattern(this, i);
      i += consumed + gap + Math.floor(Math.random() * gap * 0.5);
    }
  }

  // Which segment is world-position z inside? (wraps — the track is a loop)
  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength) % this.segments.length;
    return this.segments[(i + this.segments.length) % this.segments.length];
  }
}

// p in [0,1]
function easeIn(a, b, p)    { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }