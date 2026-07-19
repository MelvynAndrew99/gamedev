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
    const n = this.segments.length;
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
      if (i % 10 === 0) {
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
      i += consumed + gap + Math.floor(Math.random() * gap * 0.5);
    }
  }

  // Steep climbs get boost pads: the terrain states a problem (gravity),
  // the pads are the answer — IF you hold the line they're on. Spaced so
  // a long climb offers several chances; lane is per-pad, so keeping full
  // speed uphill means actively hunting across the road.
  placeBoostPads(from = 0) {
    const t = this.t;
    const lanes = [-0.66, 0, 0.66];
    for (let i = Math.max(from, 20); i < this.segments.length; i += 1) {
      const seg = this.segments[i];
      const slope = (seg.p2.world.y - seg.p1.world.y) / t.segmentLength;
      if (slope > t.minBoostSlope && i % 12 === 0) {
        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        seg.sprites.push({
          def: { key: 'boost', kind: 'boost', pop: 0, damage: 0, slow: 1, w: 0.12, view: 0.28, consumable: false },
          key: 'boost', view: 0.28, offset: lane, hit: false,
        });
      }
    }
  }

  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength) % this.segments.length;
    return this.segments[(i + this.segments.length) % this.segments.length];
  }
}

function easeIn(a, b, p)    { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }