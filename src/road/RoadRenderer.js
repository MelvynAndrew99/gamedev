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

export class RoadRenderer {
  constructor(scene, tuning) {
    this.t = tuning;
    this.w = scene.scale.width;
    this.h = scene.scale.height;

    this.sky = scene.add.graphics().setDepth(-2);
    this.g = scene.add.graphics().setDepth(-1);
    // Start/finish gantries: world geometry that rises ABOVE the road, so it
    // lives on its own layer over the asphalt (depth -1) and roadside props
    // (depth 5), but under the car (depth 10) — the car drives beneath it.
    this.gates = scene.add.graphics().setDepth(6);
    // Warp streaks: over the road and props, UNDER the car (depth 10). Radiate
    // from the vanishing point so they read as the world rushing past, not as
    // an overlay pasted on top.
    this.streaks = scene.add.graphics().setDepth(8);
    this.drawSky();

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
  }

  // Static gradient bands, drawn once. (Parallax scroll on curves is a
  // week-3 juice item: shift this by accumulated curve * speed.)
  drawSky() {
    const bands = this.t.colors.skyBands;
    const horizon = this.h / 2;
    const bandH = horizon / bands.length;
    bands.forEach((c, i) => {
      this.sky.fillStyle(c, 1);
      // last band bleeds below the horizon so hills (later) won't show gaps
      const h = i === bands.length - 1 ? bandH + 4 : bandH + 1;
      this.sky.fillRect(0, i * bandH, this.w, h);
    });
  }

  render(model, player, speedPercent = 0, speedBurst = 0) {
    const t = this.t;
    const g = this.g;
    g.clear();

    // Dynamic FOV: widen with speed. VISUAL only — TUNING.cameraDepth and
    // playerZ (used by game logic) stay pinned to the base fov, so handling
    // doesn't change when the lens does.
    const fov = t.fov + t.fovSpeedBoost * speedPercent;
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

      seg.clipped =
        seg.p1.camera.z <= this.frameDepth || // behind the projection plane
        seg.p2.screen.y >= maxY;              // hidden behind nearer road
      if (seg.clipped) continue;

      this.drawSegment(seg, 1 - fog(n / t.drawDistance, t.fogDensity));
      maxY = seg.p2.screen.y;
    }

    this.renderGates(model, base);
    this.renderSprites(model, base);
    this.drawSpeedLines();
  }

  // Start/finish gantry pass. Far -> near so a nearer gate would draw over a
  // farther one (only one exists per lap line, but the ordering is free). Uses
  // the road edges' already-projected screen coords, so the gate sits exactly
  // on the road in perspective and shrinks with distance like everything else.
  renderGates(model, base) {
    const g = this.gates;
    g.clear();
    for (let n = this.t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (!seg.gate || seg.clipped) continue;
      this.drawGate(seg.p1.screen);
    }
  }

  // A checkered gantry arched over the road: two chunky pillars at the edges
  // and a checkered banner beam between them — the universal start/finish
  // signal. Built to the game's pixel-art language: hard dark outlines, the
  // roadside posts' pole gray + cyan lamp accent, and a magenta/cyan neon glow.
  // All sizes are proportional to the projected road half-width (`w`), so the
  // structure scales naturally as the camera nears the line.
  drawGate({ x, y, w }) {
    if (w < 3) return; // too far to read — skip the sub-pixel clutter
    const c = this.t.colors;
    const OUT = 0x0a0a14;     // sprite outline color (K)
    const PILLAR = 0x2a2a3a;  // roadside post pole color (P)
    const WHITE = 0xffffff;
    const g = this.gates;

    const postW = Math.max(4, w * 0.15);   // chunky, not spindly
    const postH = w * 2.3;                  // pillar height above the road
    const beamH = Math.max(8, w * 0.62);    // banner thickness
    const over = w * 0.16;                  // pillars stand just past the rumble
    const lx = x - w - over;                // left pillar centerline
    const rx = x + w + over;                // right pillar centerline
    const postTop = y - postH;
    const beamTop = postTop - beamH;
    const beamL = lx - postW;
    const beamR = rx + postW;
    const beamW = beamR - beamL;
    const ol = Math.max(1, Math.round(w * 0.03)); // outline thickness
    const glow = Math.max(2, w * 0.10);

    // Hard-outlined filled box — the pixel-art border every sprite has.
    const box = (bx, by, bw, bh, fill) => {
      g.fillStyle(OUT, 1);
      g.fillRect(bx - ol, by - ol, bw + ol * 2, bh + ol * 2);
      g.fillStyle(fill, 1);
      g.fillRect(bx, by, bw, bh);
    };

    // Neon bloom behind everything (cyan haze, like the rumble glow).
    g.fillStyle(c.rumbleB, 0.16);
    g.fillRect(lx - postW / 2 - glow, postTop, postW + glow * 2, postH);
    g.fillRect(rx - postW / 2 - glow, postTop, postW + glow * 2, postH);
    g.fillRect(beamL - glow, beamTop - glow, beamW + glow * 2, beamH + glow * 2);

    // Pillars: outlined pole, a cyan neon strip down the face (echoing the
    // roadside posts' lamp), and a wider foot so they plant on the ground.
    const pillar = (px) => {
      box(px - postW / 2, postTop, postW, postH, PILLAR);
      g.fillStyle(c.rumbleB, 1);
      g.fillRect(px - postW * 0.16, postTop + ol, Math.max(1, postW * 0.32), postH - ol);
      box(px - postW * 0.9, y - Math.max(4, w * 0.16), postW * 1.8, Math.max(4, w * 0.16), PILLAR);
    };
    pillar(lx);
    pillar(rx);

    // Banner: outlined frame, checkered cloth, magenta/cyan neon trim lines.
    g.fillStyle(OUT, 1);
    g.fillRect(beamL - ol, beamTop - ol, beamW + ol * 2, beamH + ol * 2);
    const cols = 16;
    const cell = beamW / cols;
    const rows = Math.max(2, Math.round(beamH / cell));
    const ch = beamH / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        g.fillStyle((r + col) % 2 === 0 ? WHITE : OUT, 1);
        g.fillRect(beamL + col * cell, beamTop + r * ch, Math.ceil(cell), Math.ceil(ch));
      }
    }
    g.lineStyle(ol, c.rumbleA, 1); // magenta above
    g.lineBetween(beamL - ol, beamTop - ol, beamR + ol, beamTop - ol);
    g.lineStyle(ol, c.rumbleB, 1); // cyan below
    g.lineBetween(beamL - ol, beamTop + beamH + ol, beamR + ol, beamTop + beamH + ol);
  }

  // The start/finish line painted across the asphalt: a checkerboard filling
  // the gate segment's trapezoid, drawn cell-by-cell in perspective (each cell
  // is a little quad between two depth rows and two width columns). Row parity
  // keys off the absolute segment index so the pattern stays continuous across
  // the few segments the line spans.
  drawStartLine(seg) {
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
      const aL = lerp(x1 - w1, x2 - w2, ta), aR = lerp(x1 + w1, x2 + w2, ta), aY = lerp(y1, y2, ta);
      const bL = lerp(x1 - w1, x2 - w2, tb), bR = lerp(x1 + w1, x2 + w2, tb), bY = lerp(y1, y2, tb);
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
    const passive = (sp - t.speedLineFloor) / (1 - t.speedLineFloor);
    const intensity = Math.max(passive, burst);
    if (intensity <= 0) return;

    const cx = this.w / 2;
    const cy = this.h * 0.46; // vanishing point, just under the horizon
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const over = Math.max(0, sp - 1) + burst * 0.7; // overspeed AND the burst add reach + glow
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
    let poolI = 0;
    for (let n = t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (seg.clipped || seg.sprites.length === 0) continue;
      const { x, y, scale } = seg.p1.screen;
      for (const s of seg.sprites) {
        if (s.hit || poolI >= this.pool.length) continue;
        const img = this.pool[poolI++];
        img.setTexture(s.key);
        // Lateral placement: same projection term as the road edges.
        img.x = x + scale * (s.offset * t.roadWidth) * (this.w / 2);
        img.y = y;
        // Width in road-half units -> pixels, aspect preserved.
        const dw = s.view * scale * t.roadWidth * (this.w / 2);
        img.setDisplaySize(dw, dw * (img.height / img.width));
        img.setVisible(true);
      }
    }
    for (let i = poolI; i < this.pool.length; i++) this.pool[i].setVisible(false);
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
    const c = this.t.colors;
    const g = this.g;
    const { x: x1, y: y1, w: w1 } = seg.p1.screen;
    const { x: x2, y: y2, w: w2 } = seg.p2.screen;
    const light = seg.band === 0;

    // Ground: full-width band behind the road slab.
    g.fillStyle(light ? c.groundLight : c.groundDark, 1);
    g.fillRect(0, y2, this.w, y1 - y2);

    // Rumble strips: 1/6th of road width each side. Neon on asphalt;
    // dusty berms on dirt — the glow dies where the pavement does, which
    // is also how you READ the surface change from three seconds out.
    const isDirt = seg.surface === 'dirt';
    const rumble = isDirt ? (light ? c.dirtEdgeA : c.dirtEdgeB)
                          : (light ? c.rumbleA : c.rumbleB);
    const r1 = w1 / 6, r2 = w2 / 6;
    this.quad(g, rumble,
      x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    this.quad(g, rumble,
      x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);

    // Road surface. Dirt drops the asphalt grays for dusty umber.
    const dirt = seg.surface === 'dirt';
    const roadColor = dirt
      ? (light ? c.dirtLight : c.dirtDark)
      : (light ? c.roadLight : c.roadDark);
    this.quad(g, roadColor,
      x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);

    // Zipper paint: part of the ROAD, not an object on it — drawn in the
    // road pass so perspective is exact and it can never float. Band
    // alternation scrolls the two greens as the road moves: free animation.
    if (seg.zipper) {
      const zc = light ? c.zipperA : c.zipperB;
      const zo = seg.zipper.offset, zw = seg.zipper.w;
      const zx1 = x1 + zo * w1, zW1 = zw * w1;
      const zx2 = x2 + zo * w2, zW2 = zw * w2;
      this.quad(g, zc, zx1 - zW1, y1, zx1 + zW1, y1, zx2 + zW2, y2, zx2 - zW2, y2);
      // center glow stripe — the aiming line
      this.quad(g, c.zipperGlow, zx1 - zW1 * 0.12, y1, zx1 + zW1 * 0.12, y1, zx2 + zW2 * 0.12, y2, zx2 - zW2 * 0.12, y2);
    }

    // Lane lines, dashed by drawing only on light bands.
    if (light && this.t.lanes > 1 && seg.surface !== 'dirt') {
      const l1 = w1 / 32, l2 = w2 / 32;
      const laneW1 = (w1 * 2) / this.t.lanes;
      const laneW2 = (w2 * 2) / this.t.lanes;
      let lx1 = x1 - w1 + laneW1;
      let lx2 = x2 - w2 + laneW2;
      for (let lane = 1; lane < this.t.lanes; lane++) {
        this.quad(g, c.lane, lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2);
        lx1 += laneW1;
        lx2 += laneW2;
      }
    }

    // Start/finish line: checkered paint across the asphalt, drawn like the
    // zippers (part of the ROAD pass so its perspective is exact and it can
    // never float). On top of the lane lines, under the fog.
    if (seg.startLine) this.drawStartLine(seg);

    // Fog: translucent wash of the horizon color over the whole band.
    // Cheap depth cue + hides the pop-in at drawDistance.
    if (fogAmount > 0.01) {
      g.fillStyle(c.fog, fogAmount);
      g.fillRect(0, y2, this.w, y1 - y2);
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

// Exponential fog, 0 (near, clear) -> approaching 1 (far, soup).
function fog(dist, density) {
  return 1 / Math.exp(dist * dist * density);
}