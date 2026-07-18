// RoadModel.js — the track as pure data. No Phaser, no rendering, no DOM.
// A track is just an array of segments; each segment is a slab of road
// segmentLength deep with a `curve` value. Curves are not geometry — they're
// an instruction to the renderer: "while walking through me, bend the road
// horizontally by this much per segment." Accumulate that while projecting
// and straight slabs *look* curved. That's the entire OutRun trick.

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

  // A lap with a bit of everything, enough to feel the handling.
  buildTestTrack() {
    this.segments = [];
    this.addStraight(25);
    this.addSCurves();
    this.addStraight(15);
    this.addCurve(50, 4);      // long sweeping right — feel the centrifugal pull
    this.addStraight(15);
    this.addCurve(50, -4);     // and the mirror left
    this.addSCurves();
    this.addStraight(25);
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