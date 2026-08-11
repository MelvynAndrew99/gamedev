// RoadRenderer.js — the projection pipeline. Model in, pixels out.
//
// Per frame: find the segment under the camera, then walk drawDistance
// segments forward. Each segment's two edges are perspective-projected
// (scale = cameraDepth / z — the only real 3D math in the game) and the
// slab between them is drawn as a trapezoid, front to back, keeping a
// clip line (maxY) so far slabs never overdraw near ones.
//
// Curves: while walking, accumulate dx += segment.curve and shift each
// slab sideways by the running total x. A quadratic drift builds up and
// reads as a bend. Nothing is actually curved.

import { getEnvironment } from '../config/environments.js';
import { ParallaxBackground } from './ParallaxBackground.js';
import { TracksideScenery } from './TracksideScenery.js';
import { carSpriteFrame } from '../systems/AirtimeFx.js';

export function rivalRenderAlpha(rival = {}) {
  const telegraphAlpha = rival.state === 'telegraph'
    ? 0.72 + Math.sin((rival.stateTime ?? 0) * 26) * 0.22
    : 1;
  const graceTotal = Math.max(0, Number(rival.stagingGraceTotal) || 0);
  const stagingAlpha = graceTotal > 0
    ? 1 - Math.min(1, Math.max(0, (Number(rival.stagingGrace) || 0) / graceTotal))
    : 1;
  return Math.min(1, Math.max(0, telegraphAlpha * stagingAlpha));
}

// The generated car lives in a deliberately roomy 64x56 steering frame. Its
// straight-on hull occupies about 30 pixels of that width. Treating the whole
// transparent frame as the projected car width made distant rivals collapse
// into two isolated engine pixels — visually similar to two offset sprites.
// Keep the authored frame, but size it from its opaque hull and switch to one
// cohesive world marker before the detailed sprite becomes sub-pixel noise.
const RIVAL_HULL_FRAME_RATIO = 30 / 64;
const RIVAL_FRAME_ASPECT = 56 / 64;
const RIVAL_SPRITE_LOD_WIDTH = 8;

export function rivalSpriteMode(projectedHullWidth) {
  const hullWidth = Math.max(0, Number(projectedHullWidth) || 0);
  return hullWidth < RIVAL_SPRITE_LOD_WIDTH ? 'beacon' : 'sprite';
}

export function rivalSpriteFrameSize(projectedHullWidth) {
  const hullWidth = Math.max(0, Number(projectedHullWidth) || 0);
  return hullWidth / RIVAL_HULL_FRAME_RATIO;
}

export function rivalSteerFrame(steer = 0) {
  return steer < -0.6 ? 0
    : steer < -0.2 ? 1
      : steer <= 0.2 ? 2
        : steer <= 0.6 ? 3 : 4;
}

export class RoadRenderer {
  constructor(scene, tuning, environmentId = 'endless') {
    this.t = tuning;
    this.w = scene.scale.width;
    this.h = scene.scale.height;
    this.environment = getEnvironment(environmentId);
    this.colors = { ...tuning.colors, ...this.environment.colors };

    this.g = scene.add.graphics().setDepth(-1);
    this.background = new ParallaxBackground(
      scene,
      this.w,
      this.h,
      this.environment,
      tuning.segmentLength,
    );
    this.trackside = new TracksideScenery(scene, tuning, this.environment);
    // Start/finish gantries: world geometry that rises ABOVE the road, so it
    // lives on its own layer over the asphalt (depth -1) and roadside props
    // (depth 5), but under the car (depth 10) — the car drives beneath it.
    this.gates = scene.add.graphics().setDepth(6);
    this.gateLabel = scene.add
      .text(0, 0, 'START / FINISH', {
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0a0a14',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);
    // Warp streaks: over the road and props, UNDER the car (depth 10). Radiate
    // from the vanishing point so they read as the world rushing past, not as
    // an overlay pasted on top.
    this.streaks = scene.add.graphics().setDepth(8);

    // Sprite pool for world objects (obstacles, roadside props). Created
    // once, reassigned every frame — the render loop never allocates.
    // All share depth 5; near-over-far ordering comes from assignment
    // order (we assign far->near, and later pool entries draw on top).
    this.pool = [];
    for (let i = 0; i < 120; i++) {
      this.pool.push(
        scene.add.image(0, 0, 'cone').setOrigin(0.5, 1).setDepth(5).setVisible(false)
      );
    }

    // Moving rivals keep stable identity and therefore use a separate fixed
    // pool from consumable road props. Six remains the system cap for future
    // Story races; Rival School activates three without reallocating.
    this.rivalPool = [];
    for (let i = 0; i < 6; i++) {
      this.rivalPool.push(
        scene.add.sprite(0, 0, 'car', carSpriteFrame(2, 0))
          .setOrigin(0.5, 1)
          .setDepth(7)
          .setVisible(false),
      );
    }
    this.rivalMarkers = scene.add.graphics().setDepth(7);
    this.rivalShadows = scene.add.graphics().setDepth(6);
    // Clock cones share the physical cone sprite, but this pooled world layer
    // adds a literal clock ring + hands so the time reward is never encoded by
    // cyan tint alone. One Graphics object is cleared/reused every frame.
    this.timeBonusMarkers = scene.add.graphics().setDepth(6);
  }

  render(
    model,
    player,
    speedPercent = 0,
    speedBurst = 0,
    sceneryDistance = player.position,
    rivals = [],
  ) {
    const t = this.t;
    const g = this.g;
    g.clear();

    // Dynamic FOV: widen with speed. VISUAL only — TUNING.cameraDepth and
    // playerZ (used by game logic) stay pinned to the base fov, so handling
    // doesn't change when the lens does.
    // Keep lens distortion bounded independently of gameplay speed. A FOV at
    // or above 180 degrees makes tan(fov / 2) negative and inverts every road
    // projection; the speed lines carry the extra overspeed drama instead.
    const fov = Math.min(
      t.maxDynamicFov,
      t.fov + t.fovSpeedBoost * Math.max(0, speedPercent),
    );
    this.frameDepth = 1 / Math.tan(((fov / 2) * Math.PI) / 180);
    this.speedPercent = speedPercent;
    this.speedBurst = speedBurst;

    const base = model.findSegment(player.position);
    const basePercent = (player.position % t.segmentLength) / t.segmentLength;

    // Camera rides the terrain: its height is cameraHeight ABOVE THE ROAD
    // at the player, not above sea level — hills move the world, not the
    // car. (Same trick as forward motion: the player never moves, the
    // ground does.)
    const playerSeg = model.findSegment(player.position + t.playerZ);
    const pPercent = ((player.position + t.playerZ) % t.segmentLength) / t.segmentLength;
    const roadY = playerSeg.p1.world.y + (playerSeg.p2.world.y - playerSeg.p1.world.y) * pPercent;
    this.cameraY = t.cameraHeight + roadY;

    // Running curve accumulators. dx starts partially into the base
    // segment's curve so the road doesn't visibly "step" as segments
    // scroll under the camera.
    let x = 0;
    let dx = -(base.curve * basePercent);
    let maxY = this.h; // clip line: nothing draws below (screen-wise, nearer than) this
    let horizonRoadX = this.w / 2;
    let horizonSample = -1;

    for (let n = 0; n < t.drawDistance; n++) {
      const seg = model.segmentAt(base, n);
      // If we wrapped past the finish line, this segment's world z is from
      // the *previous* lap relative to the camera — shift it forward.
      const looped = seg.index < base.index;
      const camZ = player.position - (looped ? model.trackLength : 0);

      // playerX is in road-halves (-1..1 = edge to edge); scale to world.
      const camX = player.x * t.roadWidth;

      this.project(seg.p1, camX - x,      this.cameraY, camZ);
      this.project(seg.p2, camX - x - dx, this.cameraY, camZ);
      x += dx;
      dx += seg.curve;

      const behindCamera = seg.p1.camera.z <= this.frameDepth;
      // Repeated roadside pickets intentionally keep the old same-scanline
      // culling cadence: their horizon wink is a useful speed cue. Gameplay
      // objects and the gantry use strict occlusion so they remain readable.
      seg.speedMarkerClipped =
        behindCamera || seg.p2.screen.y >= maxY;
      seg.clipped =
        behindCamera || seg.p2.screen.y > maxY;
      if (seg.clipped) continue;

      this.drawSegment(seg, 1 - fog(n / t.drawDistance, t.fogDensity));
      maxY = seg.p2.screen.y;
      if (n > horizonSample) {
        horizonSample = n;
        horizonRoadX = seg.p2.screen.x;
      }
    }

    // The projected road supplies the camera's apparent heading. Far scenery
    // follows less than near scenery, so curves reveal depth while straight
    // sections remain visually calm. Smoothing prevents one-pixel projection
    // rounding from making the skyline twitch.
    const rawCurveOffset = clamp(
      horizonRoadX - this.w / 2,
      -this.w * 0.65,
      this.w * 0.65,
    );
    // The farthest projection converges on screen center even on large hills,
    // so it cannot communicate pitch. A weighted near-road grade acts like a
    // cartoon camera tilt: crests and dips arrive early, move visibly, then
    // settle without tying the background to absolute world elevation.
    const rawHorizonOffset = backgroundPitchOffset(
      model,
      base,
      t.segmentLength,
      this.h,
    );
    if (this.backgroundCurveOffset === undefined) {
      this.backgroundCurveOffset = rawCurveOffset;
      this.backgroundHorizonOffset = rawHorizonOffset;
    } else {
      this.backgroundCurveOffset += (rawCurveOffset - this.backgroundCurveOffset) * 0.12;
      this.backgroundHorizonOffset +=
        (rawHorizonOffset - this.backgroundHorizonOffset) * 0.1;
    }
    this.background.render(
      sceneryDistance,
      this.backgroundCurveOffset,
      this.backgroundHorizonOffset,
    );

    this.trackside.render(model, base);
    this.renderGates(model, base);
    this.renderSprites(model, base);
    this.renderRivals(model, base, player, rivals);
    this.drawSpeedLines();
  }

  // Start/finish gantry pass. Far -> near so a nearer gate would draw over a
  // farther one (only one exists per lap line, but the ordering is free). Uses
  // the road edges' already-projected screen coords, so the gate sits exactly
  // on the road in perspective and shrinks with distance like everything else.
  renderGates(model, base) {
    const g = this.gates;
    g.clear();
    this.gateLabel.setVisible(false);
    for (let n = this.t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (!seg.gate || seg.clipped) continue;
      this.drawGate(seg.p1.screen);
    }
  }

  // Neon timing gantry: angular dark-metal pylons, cyan energy cores,
  // checkered endcaps, and a lit nameplate. It borrows the road's magenta/cyan
  // edge language instead of looking like a generic black-and-white banner.
  // Every measurement keys off projected road half-width (`w`), so the whole
  // silhouette remains perspective-correct.
  drawGate({ x, y, w }) {
    if (w < 3) return; // too far to read — skip the sub-pixel clutter
    const c = this.colors;
    const OUT = 0x0a0a14;
    const FRAME = 0x2a2a3a;
    const PANEL = 0x141426;
    const WHITE = 0xffffff;
    const g = this.gates;

    const postW = Math.max(4, w * 0.16);
    // Keep the timing beam below the HUD at the rolling-grid distance. The
    // original 2.35 + 0.58 proportions reached into the top instrument band;
    // this lower, slimmer arch still clears the road without owning the sky.
    const postH = w * 1.55;
    const beamH = Math.max(8, w * 0.38);
    const over = w * 0.2;
    const lx = x - w - over;
    const rx = x + w + over;
    const postTop = y - postH;
    const beamTop = postTop - beamH;
    const beamL = lx - postW * 1.25;
    const beamR = rx + postW * 1.25;
    const beamW = beamR - beamL;
    const ol = Math.max(1, Math.round(w * 0.025));
    const glow = Math.max(2, w * 0.11);
    const cut = Math.min(beamH * 0.3, beamW * 0.04);

    const polygon = (fill, points, alpha = 1) => {
      g.fillStyle(fill, alpha);
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i][0], points[i][1]);
      }
      g.closePath();
      g.fillPath();
    };

    // Soft two-color bloom gives the structure the same electric silhouette
    // as rumble strips and zippers without softening its pixel-art edges.
    g.fillStyle(c.rumbleA, 0.12);
    g.fillRect(beamL - glow, beamTop - glow, beamW + glow * 2, beamH + glow * 2);
    g.fillStyle(c.rumbleB, 0.14);
    g.fillRect(lx - glow, postTop, glow * 2, postH);
    g.fillRect(rx - glow, postTop, glow * 2, postH);

    // Tapered pylons lean slightly outboard, making a planted racing arch
    // rather than two ordinary fence posts.
    const pillar = (px, side) => {
      const bottomX = px + side * postW * 0.45;
      polygon(OUT, [
        [px - postW * 0.72 - ol, postTop - ol],
        [px + postW * 0.72 + ol, postTop - ol],
        [bottomX + postW * 1.05 + ol, y],
        [bottomX - postW * 1.05 - ol, y],
      ]);
      polygon(FRAME, [
        [px - postW * 0.58, postTop],
        [px + postW * 0.58, postTop],
        [bottomX + postW * 0.86, y - ol],
        [bottomX - postW * 0.86, y - ol],
      ]);

      // Inset black face and cyan power spine.
      polygon(PANEL, [
        [px - postW * 0.27, postTop + ol],
        [px + postW * 0.27, postTop + ol],
        [bottomX + postW * 0.36, y - postW * 0.35],
        [bottomX - postW * 0.36, y - postW * 0.35],
      ]);
      g.lineStyle(Math.max(2, postW * 0.34), c.rumbleB, 0.18);
      g.lineBetween(px, postTop + postW * 0.25, bottomX, y - postW * 0.42);
      g.lineStyle(Math.max(1, postW * 0.12), c.rumbleB, 1);
      g.lineBetween(px, postTop + postW * 0.25, bottomX, y - postW * 0.42);

      // Magenta shoulder fin and a wide, cyan-lit foot.
      polygon(c.rumbleA, [
        [px + side * postW * 0.62, postTop + postW * 0.4],
        [px + side * postW * 1.2, postTop + postW * 0.75],
        [px + side * postW * 0.7, postTop + postW * 1.25],
      ]);
      const footH = Math.max(4, w * 0.16);
      polygon(OUT, [
        [bottomX - postW * 1.55, y],
        [bottomX + postW * 1.55, y],
        [bottomX + postW * 1.12, y - footH - ol],
        [bottomX - postW * 1.12, y - footH - ol],
      ]);
      polygon(c.rumbleB, [
        [bottomX - postW * 1.28, y - ol],
        [bottomX + postW * 1.28, y - ol],
        [bottomX + postW, y - footH],
        [bottomX - postW, y - footH],
      ], 0.9);
    };
    pillar(lx, -1);
    pillar(rx, 1);

    // Angular beam frame with clipped corners.
    polygon(OUT, [
      [beamL + cut, beamTop - ol],
      [beamR - cut, beamTop - ol],
      [beamR + ol, beamTop + cut],
      [beamR + ol, beamTop + beamH - cut],
      [beamR - cut, beamTop + beamH + ol],
      [beamL + cut, beamTop + beamH + ol],
      [beamL - ol, beamTop + beamH - cut],
      [beamL - ol, beamTop + cut],
    ]);
    polygon(FRAME, [
      [beamL + cut, beamTop],
      [beamR - cut, beamTop],
      [beamR, beamTop + cut],
      [beamR, beamTop + beamH - cut],
      [beamR - cut, beamTop + beamH],
      [beamL + cut, beamTop + beamH],
      [beamL, beamTop + beamH - cut],
      [beamL, beamTop + cut],
    ]);

    // Compact checkerboards at the endcaps keep the racing signal clear while
    // leaving the center calm enough for the course nameplate to read.
    const capW = beamW * 0.2;
    const capPad = ol * 1.5;
    const capTop = beamTop + capPad;
    const capH = beamH - capPad * 2;
    const drawCheckers = (startX) => {
      const cols = 4;
      const rows = 2;
      const cw = capW / cols;
      const ch = capH / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          g.fillStyle((row + col) % 2 === 0 ? WHITE : OUT, 1);
          g.fillRect(
            startX + col * cw,
            capTop + row * ch,
            Math.ceil(cw),
            Math.ceil(ch)
          );
        }
      }
    };
    drawCheckers(beamL + cut);
    drawCheckers(beamR - cut - capW);

    // Recessed central nameplate, framed by inward-pointing speed chevrons.
    const panelL = beamL + beamW * 0.23;
    const panelR = beamR - beamW * 0.23;
    const panelTop = beamTop + beamH * 0.18;
    const panelBottom = beamTop + beamH * 0.82;
    polygon(PANEL, [
      [panelL + cut * 0.5, panelTop],
      [panelR - cut * 0.5, panelTop],
      [panelR, (panelTop + panelBottom) / 2],
      [panelR - cut * 0.5, panelBottom],
      [panelL + cut * 0.5, panelBottom],
      [panelL, (panelTop + panelBottom) / 2],
    ]);
    const chevronW = Math.max(2, beamW * 0.025);
    g.fillStyle(c.rumbleA, 1);
    g.fillTriangle(panelL, panelTop, panelL + chevronW, (panelTop + panelBottom) / 2, panelL, panelBottom);
    g.fillStyle(c.rumbleB, 1);
    g.fillTriangle(panelR, panelTop, panelR - chevronW, (panelTop + panelBottom) / 2, panelR, panelBottom);

    // Hot edges: magenta announces the top silhouette against the sunset,
    // cyan anchors the underside against the asphalt.
    g.lineStyle(Math.max(1, ol), c.rumbleA, 1);
    g.lineBetween(beamL - ol, beamTop - ol, beamR + ol, beamTop - ol);
    g.lineStyle(Math.max(1, ol), c.rumbleB, 1);
    g.lineBetween(beamL - ol, beamTop + beamH + ol, beamR + ol, beamTop + beamH + ol);

    // The text remains a scene object so it stays sharp instead of being
    // rebuilt into a texture every frame. Scale it into the projected panel.
    if (w >= 12) {
      const label = this.gateLabel;
      const labelScale = Math.min(
        (panelR - panelL) * 0.78 / label.width,
        (panelBottom - panelTop) * 0.62 / label.height
      );
      label
        .setPosition(x, (panelTop + panelBottom) / 2)
        .setScale(labelScale)
        .setVisible(true);
    }
  }

  // The start/finish line painted across the asphalt: a checkerboard filling
  // the gate segment's trapezoid, drawn cell-by-cell in perspective (each cell
  // is a little quad between two depth rows and two width columns). Row parity
  // keys off the absolute segment index so the pattern stays continuous across
  // the few segments the line spans.
  drawStartLine(seg, nearY = seg.p1.screen.y) {
    const g = this.g;
    const OUT = 0x0a0a14;
    const WHITE = 0xffffff;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    const lerp = (a, b, t) => a + (b - a) * t;
    const cols = 12;
    const rows = 2;
    for (let r = 0; r < rows; r++) {
      const ta = r / rows, tb = (r + 1) / rows;
      const aL = lerp(x1 - w1, x2 - w2, ta), aR = lerp(x1 + w1, x2 + w2, ta), aY = lerp(nearY, y2, ta);
      const bL = lerp(x1 - w1, x2 - w2, tb), bR = lerp(x1 + w1, x2 + w2, tb), bY = lerp(nearY, y2, tb);
      for (let col = 0; col < cols; col++) {
        const t0 = col / cols, t1 = (col + 1) / cols;
        const nx0 = lerp(aL, aR, t0), nx1 = lerp(aL, aR, t1);
        const fx0 = lerp(bL, bR, t0), fx1 = lerp(bL, bR, t1);
        const white = (seg.index + r + col) % 2 === 0;
        this.quad(g, white ? WHITE : OUT, nx0, aY, nx1, aY, fx1, bY, fx0, bY);
      }
    }
  }

  // Warp streaks — the cheapest, loudest "sense of speed" there is. Rays fly
  // OUTWARD from the vanishing point; each one's length and brightness scale
  // with speed, and past maxSpeed (speedPercent > 1) they run longer and
  // brighter so overspeed reads on-screen, not just on the HUD. The center
  // lane is kept clear (|dirX| gate) so the streaks frame the action instead
  // of smearing across the road you're trying to read.
  //
  // A ramp/boost fires a `speedBurst` (0..1, decayed by the scene). The burst
  // both LIGHTS the streaks below the passive speed floor AND reads like
  // overspeed — extra length, brightness, and scroll rate — so a well-hit ramp
  // or a nitro pop always looks like a speed reward, teaching route optimization.
  drawSpeedLines() {
    const s = this.streaks;
    s.clear();
    const t = this.t;
    const sp = this.speedPercent;
    const burst = this.speedBurst;
    // Ramp 0->1 from the floor up to maxSpeed; the burst floors it independently.
    const passive = clamp(
      (sp - t.speedLineFloor) / (1 - t.speedLineFloor),
      0,
      1,
    );
    const intensity = Math.max(passive, burst);
    if (intensity <= 0) return;

    const cx = this.w / 2;
    const cy = this.h * 0.46; // vanishing point, just under the horizon
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const maxBoost = t.boostTierCeilings.at(-1);
    const over = Math.min(maxBoost - 1, Math.max(0, sp - 1)) + burst * 0.7;
    const count = 16;

    s.lineStyle(2, t.speedLineColor, Math.min(0.65, 0.15 + intensity * 0.35 + over * 0.6));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const dirX = Math.cos(a);
      const dirY = Math.sin(a);
      if (Math.abs(dirX) < 0.4) continue; // keep the driving lane clear
      // Phase scrolls outward with speed; the burst accelerates it for a "surge" whoosh.
      const phase = (now * (2 + sp * 4 + burst * 5) + i * 0.41) % 1;
      const near = 90 + phase * this.w * 0.7;
      const len = (30 + intensity * 140 + over * 120) * (0.5 + phase * 0.8);
      s.lineBetween(
        cx + dirX * near,        cy + dirY * near,
        cx + dirX * (near + len), cy + dirY * (near + len)
      );
    }
  }

  // Second pass, far -> near, so close sprites draw over distant ones.
  // Only segments the road pass projected this frame have valid screen
  // coords; clipped segments are skipped along with their sprites.
  renderSprites(model, base) {
    const t = this.t;
    this.timeBonusMarkers.clear();
    let poolI = 0;
    for (let n = t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (seg.clipped || seg.sprites.length === 0) continue;
      const { x, y, scale } = seg.p1.screen;
      for (const s of seg.sprites) {
        if (
          s.hit ||
          (s.speedMarker && seg.speedMarkerClipped) ||
          poolI >= this.pool.length
        ) continue;
        const img = this.pool[poolI++];
        img.setTexture(s.key);
        if (s.timeBonusSeconds > 0) img.setTint(0x2ee56b);
        else img.clearTint();
        // Lateral placement: same projection term as the road edges.
        img.x = x + scale * (s.offset * t.roadWidth) * (this.w / 2);
        img.y = y;
        // Width in road-half units -> pixels, aspect preserved.
        const dw = s.view * scale * t.roadWidth * (this.w / 2);
        img.setDisplaySize(dw, dw * (img.height / img.width));
        img.setVisible(true);
        if (s.timeBonusSeconds > 0) {
          const radius = Math.max(3, Math.min(11, dw * 0.32));
          const clockX = img.x;
          const clockY = img.y - dw * (img.height / img.width) - radius * 0.8;
          // Dark keyline then bright face: recognizable by ring/hands even in
          // grayscale and legible against both road and sky bands.
          this.timeBonusMarkers.lineStyle(Math.max(3, radius * 0.42), 0x080812, 0.9);
          this.timeBonusMarkers.strokeCircle(clockX, clockY, radius);
          this.timeBonusMarkers.lineBetween(clockX, clockY, clockX, clockY - radius * 0.52);
          this.timeBonusMarkers.lineBetween(clockX, clockY, clockX + radius * 0.45, clockY);
          this.timeBonusMarkers.lineStyle(Math.max(1, radius * 0.18), 0xffffff, 1);
          this.timeBonusMarkers.strokeCircle(clockX, clockY, radius);
          this.timeBonusMarkers.lineBetween(clockX, clockY, clockX, clockY - radius * 0.52);
          this.timeBonusMarkers.lineBetween(clockX, clockY, clockX + radius * 0.45, clockY);
        }
      }
    }
    for (let i = poolI; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }

  renderRivals(model, base, player, rivals = []) {
    this.rivalMarkers.clear();
    this.rivalShadows.clear();
    this.rivalPool.forEach((sprite) => sprite.setVisible(false));
    if (!rivals?.length) return;
    rivals.forEach((rival) => {
      if (rival?.screen) rival.screen.visible = false;
    });

    const t = this.t;
    // Use the road's already-projected segment endpoints, walking far→near so
    // the same depth ordering contract as static props is preserved.
    for (let n = t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (seg.clipped) continue;
      for (let i = 0; i < rivals.length && i < this.rivalPool.length; i++) {
        const rival = rivals[i];
        if (!rival?.active || rival.state === 'wrecked') continue;
        const rivalSeg = model.findSegment(rival.position);
        if (rivalSeg.index !== seg.index) continue;

        const local = ((rival.position % t.segmentLength) + t.segmentLength) %
          t.segmentLength / t.segmentLength;
        const lerp = (a, b) => a + (b - a) * local;
        const scale = lerp(seg.p1.screen.scale, seg.p2.screen.scale);
        const roadX = lerp(seg.p1.screen.x, seg.p2.screen.x);
        const roadY = lerp(seg.p1.screen.y, seg.p2.screen.y);
        const roadHalfW = lerp(seg.p1.screen.w, seg.p2.screen.w);
        const x = roadX + rival.x * roadHalfW;
        const projectedHullW = Math.max(
          0,
          0.28 * scale * t.roadWidth * (this.w / 2),
        );
        const spriteMode = rivalSpriteMode(projectedHullW);
        const sprite = this.rivalPool[i];
        const steerFrame = rivalSteerFrame(rival.steer);
        const alpha = rivalRenderAlpha(rival);
        const drawX = x;
        if (spriteMode === 'sprite') {
          const frameWidth = rivalSpriteFrameSize(projectedHullW);
          sprite
            .setFrame(carSpriteFrame(steerFrame, 0))
            .setPosition(Math.round(drawX), Math.round(roadY))
            .setDisplaySize(
              frameWidth,
              frameWidth * RIVAL_FRAME_ASPECT,
            )
            .setTint(rival.color ?? 0xff6b6b)
            .setAlpha(alpha)
            .setVisible(true);
        } else {
          // One filled, outlined hover-car wedge replaces unreadable 2–7px
          // engine fragments. It is world-linked and uses the same identity
          // color, but its silhouette remains one object in grayscale.
          const size = Math.max(2, projectedHullW * 0.5);
          this.rivalMarkers.lineStyle(1, 0x080812, alpha);
          this.rivalMarkers.fillStyle(rival.color ?? 0xff6b6b, alpha);
          this.rivalMarkers.fillTriangle(
            drawX, roadY - size * 1.2,
            drawX - size * 1.45, roadY,
            drawX + size * 1.45, roadY,
          );
          this.rivalMarkers.strokeTriangle(
            drawX, roadY - size * 1.2,
            drawX - size * 1.45, roadY,
            drawX + size * 1.45, roadY,
          );
        }

        rival.screen.x = drawX;
        rival.screen.y = roadY;
        rival.screen.width = Math.max(2, projectedHullW);
        rival.screen.visible = true;
        this.rivalShadows.fillStyle(0x05050a, 0.42);
        this.rivalShadows.fillEllipse(
          drawX,
          roadY - Math.max(1, projectedHullW * 0.03),
          Math.max(3, projectedHullW * 0.92),
          Math.max(2, projectedHullW * 0.18),
        );

        if (rival.state === 'telegraph' || rival.state === 'attack') {
          const markerY = roadY - Math.max(8, projectedHullW * 1.04);
          const size = Math.max(3, projectedHullW * 0.16);
          const color = rival.state === 'attack' ? 0xff2d55 : 0xffcf3f;
          // Downward warning diamond plus a directional chevron: readable by
          // shape and motion even without its yellow→red color transition.
          this.rivalMarkers.fillStyle(color, 1);
          this.rivalMarkers.fillTriangle(
            drawX, markerY + size,
            drawX - size, markerY - size,
            drawX + size, markerY - size,
          );
          const side = rival.attackSide || 1;
          this.rivalMarkers.lineStyle(Math.max(1, size * 0.22), 0xffffff, 0.95);
          this.rivalMarkers.lineBetween(
            drawX - side * size * 1.5, markerY,
            drawX - side * size * 0.4, markerY,
          );
          this.rivalMarkers.lineBetween(
            drawX - side * size * 0.4, markerY,
            drawX - side * size * 0.9, markerY - size * 0.45,
          );
        }
      }
    }

    // Threats may begin just behind the projection camera. Keep their side
    // readable with a world-layer edge chevron instead of adding HUD prose.
    for (const rival of rivals) {
      if (!rival?.active || rival.screen?.visible ||
          (rival.state !== 'telegraph' && rival.state !== 'attack')) continue;
      const left = rival.x < (player?.x ?? 0);
      const x = left ? 34 : this.w - 34;
      const y = this.h - 130;
      const color = rival.state === 'attack' ? 0xff2d55 : 0xffcf3f;
      this.rivalMarkers.fillStyle(color, 0.95);
      this.rivalMarkers.fillTriangle(
        x + (left ? -9 : 9), y,
        x + (left ? 8 : -8), y - 10,
        x + (left ? 8 : -8), y + 10,
      );
      this.rivalMarkers.lineStyle(2, 0xffffff, 0.9);
      this.rivalMarkers.lineBetween(
        x + (left ? 12 : -12), y - 11,
        x + (left ? 12 : -12), y + 11,
      );
    }
  }

  // World -> camera -> screen. THE projection:
  //   scale = cameraDepth / camera.z   (similar triangles, nothing more)
  project(p, cameraX, cameraY, cameraZ) {
    const t = this.t;
    p.camera.x = p.world.x - cameraX;
    p.camera.y = p.world.y - cameraY;
    p.camera.z = p.world.z - cameraZ;
    const scale = this.frameDepth / p.camera.z;
    p.screen.scale = scale;
    p.screen.x = Math.round(this.w / 2 + (scale * p.camera.x * this.w) / 2);
    p.screen.y = Math.round(this.h / 2 - (scale * p.camera.y * this.h) / 2);
    p.screen.w = Math.round((scale * t.roadWidth * this.w) / 2);
  }

  drawSegment(seg, fogAmount) {
    const c = this.colors;
    const g = this.g;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    const light = seg.band === 0;

    // Phaser 4's WebGL renderer can leave a one-pixel rasterization crack
    // where adjacent polygons share an exact edge. Farther segments are drawn
    // after nearer ones, so extend this segment's near edge down one pixel.
    // The opaque ground, rumble, and road fills then cover the shared edge
    // without changing any projected geometry used by gameplay or sprites.
    const nearY = y1 + 1;

    // Ground: full-width band behind the road slab.
    g.fillStyle(light ? c.groundLight : c.groundDark, 1);
    g.fillRect(0, y2, this.w, Math.max(1, nearY - y2));

    // Rumble strips: 1/6th of road width each side. Neon on asphalt;
    // dusty berms on dirt — the glow dies where the pavement does, which
    // is also how you READ the surface change from three seconds out.
    const isDirt = seg.surface === 'dirt';
    const rumble = isDirt ? (light ? c.dirtEdgeA : c.dirtEdgeB)
                          : (light ? c.rumbleA : c.rumbleB);
    const r1 = w1 / 6, r2 = w2 / 6;
    this.quad(g, rumble,
      x1 - w1 - r1, nearY, x1 - w1, nearY, x2 - w2, y2, x2 - w2 - r2, y2);
    this.quad(g, rumble,
      x1 + w1 + r1, nearY, x1 + w1, nearY, x2 + w2, y2, x2 + w2 + r2, y2);

    // Road surface. Dirt drops the asphalt grays for dusty umber.
    const dirt = seg.surface === 'dirt';
    const roadColor = dirt
      ? (light ? c.dirtLight : c.dirtDark)
      : (light ? c.roadLight : c.roadDark);
    this.quad(g, roadColor,
      x1 - w1, nearY, x1 + w1, nearY, x2 + w2, y2, x2 - w2, y2);

    // Ramp runway: projected paint that leads to, but never replaces, the
    // raised ramp sprite. Wide alternating gold slabs acquire the correct
    // lane at distance; cyan edge rails connect visually to the ramp beacons.
    if (seg.launchApproach) {
      const a = seg.launchApproach;
      const ax1 = x1 + a.offset * w1, aw1 = a.w * w1;
      const ax2 = x2 + a.offset * w2, aw2 = a.w * w2;
      const panel = Math.floor(a.distanceToRamp / 2) % 2 === 0
        ? c.launchA
        : c.launchB;
      this.quad(g, panel,
        ax1 - aw1, nearY, ax1 + aw1, nearY,
        ax2 + aw2, y2, ax2 - aw2, y2);

      const ew1 = Math.max(1, aw1 * 0.08);
      const ew2 = Math.max(1, aw2 * 0.08);
      this.quad(g, c.launchEdge,
        ax1 - aw1, nearY, ax1 - aw1 + ew1, nearY,
        ax2 - aw2 + ew2, y2, ax2 - aw2, y2);
      this.quad(g, c.launchEdge,
        ax1 + aw1 - ew1, nearY, ax1 + aw1, nearY,
        ax2 + aw2, y2, ax2 + aw2 - ew2, y2);
    }

    // Zipper paint: part of the ROAD, not an object on it — drawn in the
    // road pass so perspective is exact and it can never float. Band
    // alternation scrolls the two greens as the road moves: free animation.
    if (seg.zipper) {
      const zc = light ? c.zipperA : c.zipperB;
      const zo = seg.zipper.offset, zw = seg.zipper.w;
      const zx1 = x1 + zo * w1, zW1 = zw * w1;
      const zx2 = x2 + zo * w2, zW2 = zw * w2;
      this.quad(g, zc, zx1 - zW1, nearY, zx1 + zW1, nearY, zx2 + zW2, y2, zx2 - zW2, y2);
      // center glow stripe — the aiming line
      this.quad(g, c.zipperGlow, zx1 - zW1 * 0.12, nearY, zx1 + zW1 * 0.12, nearY, zx2 + zW2 * 0.12, y2, zx2 - zW2 * 0.12, y2);
    }

    // Lane lines, dashed by drawing only on light bands.
    if (light && this.t.lanes > 1 && seg.surface !== 'dirt') {
      const l1 = w1 / 32, l2 = w2 / 32;
      const laneW1 = (w1 * 2) / this.t.lanes;
      const laneW2 = (w2 * 2) / this.t.lanes;
      let lx1 = x1 - w1 + laneW1;
      let lx2 = x2 - w2 + laneW2;
      for (let lane = 1; lane < this.t.lanes; lane++) {
        this.quad(g, c.lane, lx1 - l1 / 2, nearY, lx1 + l1 / 2, nearY, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2);
        lx1 += laneW1;
        lx2 += laneW2;
      }
    }

    // Start/finish line: checkered paint across the asphalt, drawn like the
    // zippers (part of the ROAD pass so its perspective is exact and it can
    // never float). On top of the lane lines, under the fog.
    if (seg.startLine) this.drawStartLine(seg, nearY);

    // Fog: translucent wash of the horizon color over the whole band.
    // Cheap depth cue + hides the pop-in at drawDistance.
    if (fogAmount > 0.01) {
      g.fillStyle(c.fog, fogAmount);
      g.fillRect(0, y2, this.w, Math.max(1, nearY - y2));
    }
  }

  quad(g, color, x1, y1, x2, y2, x3, y3, x4, y4) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineTo(x3, y3);
    g.lineTo(x4, y4);
    g.closePath();
    g.fillPath();
  }
}

// Sample the road players are actively reading rather than the mathematical
// infinity point. Positive world grade means the camera looks uphill, so a
// fixed panorama moves down the screen; downhill mirrors it upward.
export function backgroundPitchOffset(model, base, segmentLength, screenHeight) {
  const first = 4;
  const last = 28;
  const middle = (first + last) / 2;
  let weightedGrade = 0;
  let totalWeight = 0;

  for (let n = first; n <= last; n++) {
    const segment = model.segmentAt(base, n);
    const grade = (segment.p2.world.y - segment.p1.world.y) / segmentLength;
    const weight = 1 - Math.abs(n - middle) / (middle - first + 1);
    weightedGrade += grade * weight;
    totalWeight += weight;
  }

  const averageGrade = totalWeight > 0 ? weightedGrade / totalWeight : 0;
  return clamp(
    averageGrade * screenHeight * 0.9,
    -screenHeight * 0.14,
    screenHeight * 0.14,
  );
}

// Exponential fog, 0 (near, clear) -> approaching 1 (far, soup).
function fog(dist, density) {
  return 1 / Math.exp(dist * dist * density);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
