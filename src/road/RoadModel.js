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
    this.rng = Math.random;
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
  addChicane(n, curve, hill = 0) {
    // One compact left/right precision test. Split elevation between its
    // halves so the authored height change is not accidentally doubled.
    this.addCurve(n, curve, hill * 0.5);
    this.addCurve(n, -curve, hill * 0.5);
  }
  addSCurves() {
    this.addCurve(25, -2);
    this.addCurve(25, 2);
    this.addCurve(25, -4);
    this.addCurve(25, 4);
    this.addCurve(25, -2);
  }

  // Build from data (see src/tracks/index.js for the format):
  //   ["straight", len]  ["curve", len, curve, hill?]  ["hill", len, hill]
  //   ["dirt", len, curve?, hill?]  ["chicane", len, curve, hill?]
  //   ["scurves"] (legacy long-form preset)
  buildFromData(data) {
    this.segments = [];
    // Campaign layouts must be learnable. A stable per-course RNG keeps
    // warnings, payloads, pickups, and zippers in the same places on every
    // retry while EndlessTrack remains unpredictable.
    this.rng = seededRandom(data.seed ?? hashString(data.id ?? 'track'));
    for (const piece of data.pieces) {
      const [type, len, a, b] = piece;
      if (type === 'straight')     this.addStraight(len ?? 25);
      else if (type === 'curve')   this.addCurve(len ?? 25, a ?? 2, b ?? 0);
      else if (type === 'hill')    this.addHill(len ?? 25, a ?? 2);
      else if (type === 'dirt')    this.addDirt(len ?? 20, a ?? 0, b ?? 0);
      else if (type === 'chicane') this.addChicane(len ?? 12, a ?? 3, b ?? 0);
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

    // The start/finish line, as a physical checkered gantry over the road.
    // On a looping circuit this one gate IS the start, every lap line, and
    // the finish — you launch from under it and cross it each lap. Purely
    // visual (the renderer draws it from this flag); lap logic still keys off
    // position 0. Endless Mode has no finish line, so it never sets a gate.
    this.segments[0].gate = { label: 'START / FINISH' };
    for (let k = 0; k < 3 && k < this.segments.length; k++) {
      this.segments[k].startLine = true; // checkered paint across the asphalt
    }

    this.decorate(
      data.obstacles ?? 0.05,
      0,
      30,
      data.patterns,
      data.decoration,
    );
    this.placeAuthoredObjects(data.objects);
  }

  // Roadside posts (speed perception — the eye reads velocity from things
  // streaming past the edges) and authored hazard patterns (patterns.js).
  decorate(
    obstacleDensity,
    from = 0,
    endMargin = 30,
    patternRules = {},
    decoration = {},
  ) {
    for (let i = from; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (
        decoration.roadsidePosts !== false &&
        this.segments[i].index % 10 === 0
      ) { // absolute index: cadence survives trimming
        seg.sprites.push({
          key: ROADSIDE.post.key, view: ROADSIDE.post.view,
          speedMarker: ROADSIDE.post.speedMarker, offset: -1.25,
        });
        seg.sprites.push({
          key: ROADSIDE.post.key, view: ROADSIDE.post.view,
          speedMarker: ROADSIDE.post.speedMarker, offset: 1.25,
        });
      }
    }
    if (decoration.nitro !== false) this.placeBoostPads(from);
    if (obstacleDensity <= 0) return;

    const densityGap = Math.min(130, Math.max(25, Math.round(4 / obstacleDensity)));
    const gapMin = Math.max(20, patternRules.gap?.[0] ?? densityGap);
    const gapMax = Math.max(gapMin, patternRules.gap?.[1] ?? Math.round(gapMin * 1.5));
    const start = Math.max(from, patternRules.startClear ?? 30);
    // The longer high-speed warning language needs enough paved road for the
    // complete approach and payload to exist before a pattern is stamped.
    const finishClear = Math.max(endMargin, patternRules.finishClear ?? endMargin);
    const end = this.segments.length - finishClear - 80;
    if (patternRules.placements?.length) {
      // Campaign races align decisions to authored geometry. Lanes and minor
      // variations remain seeded, but the read/execute/payoff beat lands on
      // the same crest, straight, dirt transition, or corner every lap.
      for (const { at, kind } of patternRules.placements) {
        const placementEnd = this.segments.length - finishClear;
        if (at < start || at >= placementEnd) {
          throw new Error(
            `${kind} pattern at ${at} is outside ${start}..${placementEnd - 1}`
          );
        }
        const consumed = stampPattern(
          this,
          at,
          this.rng,
          patternRules.weights,
          kind
        );
        if (at + consumed > placementEnd) {
          throw new Error(
            `${kind} pattern at ${at} overlaps the finish recovery`
          );
        }
      }
    } else {
      let i = start + Math.floor(this.rng() * gapMin * 0.5);
      let patternIndex = 0;
      while (i < end) {
        const sequence = patternRules.sequence;
        const forcedKind = sequence?.length
          ? sequence[patternIndex % sequence.length]
          : null;
        const consumed = stampPattern(
          this,
          i,
          this.rng,
          patternRules.weights,
          forcedKind
        );
        patternIndex++;
        const breathingRoom =
          gapMin + Math.floor(this.rng() * (gapMax - gapMin + 1));
        i += Math.max(1, (consumed || 0) + breathingRoom);
      }
    }

    // Pickups were scattered before hazard patterns. Move any that ended up
    // directly after same-lane cones, otherwise danger signage appears to
    // point at a reward.
    this.moveBoostsOutOfConeWarnings(from);

    // Zippers LAST, so their hazard-clearance check sees the finished
    // road — paint never goes down where rocks or cone warnings already live.
    if (decoration.zippers !== false) this.placeZippers(from, endMargin);
  }

  // Exact track objects are data, just like exact pattern placements. Stable
  // IDs let objectives remember which targets were hit across lap wraps; the
  // objective link also makes those hits persistent instead of re-arming with
  // ordinary campaign hazards and pickups.
  placeAuthoredObjects(objects = []) {
    const seen = new Set();
    for (const object of objects) {
      const {
        id,
        at,
        kind,
        offset = 0,
        objective = null,
        once = false,
      } = object;
      if (!id || seen.has(id)) throw new Error(`Authored track object needs a unique id: ${id}`);
      if (!Number.isInteger(at) || !this.segments[at]) {
        throw new Error(`${kind} object ${id} is outside the track at segment ${at}`);
      }
      const def = OBSTACLES[kind];
      if (!def) throw new Error(`Unknown authored track object kind: ${kind}`);
      seen.add(id);
      this.segments[at].sprites.push({
        def,
        key: def.key,
        view: def.view,
        offset,
        hit: false,
        trackObjectId: id,
        objectiveId: objective,
        persistentHit: objective != null || once,
      });
    }
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
        def: OBSTACLES.boost,
        key: OBSTACLES.boost.key, view: OBSTACLES.boost.view,
        offset: lanes[Math.floor(this.rng() * lanes.length)], hit: false,
      });
    };
    let next = Math.max(from, 30) + Math.floor(this.rng() * 60);
    for (let i = Math.max(from, 20); i < this.segments.length; i++) {
      if (i >= next) { putNitro(i); next = i + 110 + Math.floor(this.rng() * 60); }
      const seg = this.segments[i];
      const s0 = (seg.p2.world.y - seg.p1.world.y) / t.segmentLength;
      const sPrev = i > 0 ? (this.segments[i-1].p2.world.y - this.segments[i-1].p1.world.y) / t.segmentLength : 0;
      if (s0 > t.minBoostSlope && sPrev <= t.minBoostSlope) putNitro(Math.max(from, i - 12));
    }
  }

  hasConeWarningBehind(at, lane, distance = 60) {
    for (let i = at - 1; i >= Math.max(0, at - distance); i--) {
      const sameLane = this.segments[i].sprites
        .filter((s) => Math.abs(s.offset - lane) < 0.25);
      // Once its rock payload has appeared, the danger warning is resolved
      // and a later boost cannot be mistaken for what the cones announced.
      if (sameLane.some((s) => s.key === 'rock')) return false;
      if (sameLane.some((s) => s.key === 'cone')) return true;
    }
    return false;
  }

  moveBoostsOutOfConeWarnings(from = 0) {
    const lanes = [-0.66, 0, 0.66];
    for (let i = Math.max(from, 0); i < this.segments.length; i++) {
      for (const sprite of this.segments[i].sprites) {
        if (sprite.key !== 'boost' || !this.hasConeWarningBehind(i, sprite.offset)) continue;
        const clearLanes = lanes.filter((lane) => !this.hasConeWarningBehind(i, lane));
        if (clearLanes.length) {
          sprite.offset = clearLanes[Math.floor(this.rng() * clearLanes.length)];
        } else {
          // A rare full-width warning: omit this pickup instead of teaching
          // the wrong cone meaning.
          sprite.removeFromTrack = true;
        }
      }
      this.segments[i].sprites = this.segments[i].sprites
        .filter((sprite) => !sprite.removeFromTrack);
    }
  }

  // Zipper strips: 5-segment lanes of painted speed, every 60-100
  // segments. PERSISTENT — never consumed; they're the skill-expression
  // surface. A strip is skipped if a hazard occupies its lane nearby or a
  // same-lane cone warning precedes it.
  // (What comes AFTER the strip at 150% is your problem.)
  placeZippers(from = 0, endMargin = 30) {
    const lanes = [-0.66, 0, 0.66];
    let i = Math.max(from, 40) + Math.floor(this.rng() * 40);
    const end = this.segments.length - endMargin - 10;
    while (i < end) {
      const lane = lanes[Math.floor(this.rng() * lanes.length)];
      let clear = !this.hasConeWarningBehind(i, lane);
      for (let k = i - 3; k < i + 8 && clear; k++) {
        const seg = this.segments[k];
        if (!seg) continue;
        if (
          seg.launchApproach &&
          Math.abs(seg.launchApproach.offset - lane) < 0.35
        ) {
          clear = false;
          break;
        }
        for (const s of seg.sprites) {
          if (s.key === 'cone' && Math.abs(s.offset - lane) < 0.35) { clear = false; break; }
          if (s.def && s.def.damage > 0 && Math.abs(s.offset - lane) < 0.35) { clear = false; break; }
        }
      }
      if (clear) {
        for (let k = i; k < i + 5 && k < end; k++) {
          this.segments[k].zipper = { offset: lane, w: this.t.zipperW };
        }
      }
      i += 60 + Math.floor(this.rng() * 40);
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

  // Contact flags debounce a sprite while the car crosses its segment.
  // Re-arm the course at the lap line so ramps, hazards, and pickups remain
  // part of the authored rhythm on every lap.
  resetLapSprites() {
    for (const segment of this.segments) {
      for (const sprite of segment.sprites) {
        if (sprite.def && !sprite.persistentHit) sprite.hit = false;
      }
    }
  }
}

function easeIn(a, b, p)    { return a + (b - a) * Math.pow(p, 2); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
