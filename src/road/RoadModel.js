// RoadModel.js — the track as pure data. No Phaser, no rendering, no DOM.
// A track is an array of segments; each is a slab segmentLength deep with
// a `curve` value (horizontal bend accumulated by the renderer) and world
// y heights on its edges (hills — REAL geometry, unlike curves: the
// projection handles elevation natively). Tunnels are a per-segment flag
// the renderer dresses with walls and a ceiling.

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

  lastY() {
    const n = this.segments.length;
    return n ? this.segments[n - 1].p2.world.y : 0;
  }

  addSegment(curve, y1, y2, tunnel) {
    const n = this.segments.length;
    const len = this.t.segmentLength;
    this.segments.push({
      index: n,
      curve,
      tunnel,
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
  addRoad(enter, hold, leave, curve, hill = 0, tunnel = false) {
    const startY = this.lastY();
    const endY = startY + hill * this.t.segmentLength;
    const total = enter + hold + leave;
    let n = 0;
    const yAt = (k) => easeInOut(startY, endY, k / total);
    for (let i = 0; i < enter; i++, n++)
      this.addSegment(easeIn(0, curve, i / enter), yAt(n), yAt(n + 1), tunnel);
    for (let i = 0; i < hold; i++, n++)
      this.addSegment(curve, yAt(n), yAt(n + 1), tunnel);
    for (let i = 0; i < leave; i++, n++)
      this.addSegment(easeInOut(curve, 0, i / leave), yAt(n), yAt(n + 1), tunnel);
  }

  addStraight(n)             { this.addRoad(n, n, n, 0); }
  addCurve(n, curve, hill=0) { this.addRoad(n, n, n, curve, hill); }
  addHill(n, hill)           { this.addRoad(n, n, n, 0, hill); }
  addTunnel(n, curve = 0)    { this.addRoad(n, n, n, curve, 0, true); }
  addSCurves() {
    this.addCurve(25, -2);
    this.addCurve(25, 2);
    this.addCurve(25, -4);
    this.addCurve(25, 4);
    this.addCurve(25, -2);
  }

  // Build from data (see src/tracks/index.js for the format):
  //   ["straight", len]  ["curve", len, curve, hill?]  ["hill", len, hill]
  //   ["tunnel", len, curve?]  ["scurves"]
  buildFromData(data) {
    this.segments = [];
    for (const piece of data.pieces) {
      const [type, len, a, b] = piece;
      if (type === 'straight')     this.addStraight(len ?? 25);
      else if (type === 'curve')   this.addCurve(len ?? 25, a ?? 2, b ?? 0);
      else if (type === 'hill')    this.addHill(len ?? 25, a ?? 2);
      else if (type === 'tunnel')  this.addTunnel(len ?? 20, a ?? 0);
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
      if (i % 10 === 0 && !seg.tunnel) { // no posts inside tunnels
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: -1.25 });
        seg.sprites.push({ key: ROADSIDE.post.key, view: ROADSIDE.post.view, offset: 1.25 });
      }
    }
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

  findSegment(z) {
    const i = Math.floor(z / this.t.segmentLength) % this.segments.length;
    return this.segments[(i + this.segments.length) % this.segments.length];
  }
}

function easeIn(a, b, p)    { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }