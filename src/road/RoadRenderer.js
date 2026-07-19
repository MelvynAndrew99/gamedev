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

  render(model, player, speedPercent = 0) {
    const t = this.t;
    const g = this.g;
    g.clear();

    // Dynamic FOV: widen with speed. VISUAL only — TUNING.cameraDepth and
    // playerZ (used by game logic) stay pinned to the base fov, so handling
    // doesn't change when the lens does.
    const fov = t.fov + t.fovSpeedBoost * speedPercent;
    this.frameDepth = 1 / Math.tan(((fov / 2) * Math.PI) / 180);

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
      const seg = model.segments[(base.index + n) % model.segments.length];
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

    this.renderTunnels(model, base);
    this.renderSprites(model, base);
  }

  // Tunnels, drawn BACK to front (opposite of the road pass) so near
  // geometry paints over far. Philosophy fix from the first attempt: a
  // tunnel interior is not strips around the road — it's EVERYTHING
  // EXCEPT THE ROAD OPENING, filled dark. Side fills run to the screen
  // edges, the ceiling band runs full width, and the mouth segment draws
  // a portal face. No sky can leak inside.
  renderTunnels(model, base) {
    const t = this.t;
    const c = t.colors;
    const g = this.g;
    const halfH = this.h / 2;

    // PRE-PASS — the depth void. The interior tiles (ceiling from the
    // top, road from the bottom) converge toward the horizon but never
    // meet; without this, raw sky shows through the gap (the pink-stripe
    // bug). Fill the whole convergence region behind the DEEPEST visible
    // tunnel segment with near-black first; everything else paints over
    // it, and whatever they don't reach reads as depth, not sky.
    // (Known simplification: two tunnels visible at once with open road
    // between them would share one void — rare and brief, accepted.)
    let far = null, inRun = false, exitVisible = false;
    for (let n = 1; n < t.drawDistance; n++) {
      const seg = model.segments[(base.index + n) % model.segments.length];
      if (seg.clipped) continue;
      if (seg.tunnel) { far = seg; inRun = true; }
      else if (inRun) { exitVisible = true; break; } // first run only
    }
    if (far) {
      const farCeil = far.p2.screen.y - far.p2.screen.scale * t.tunnelHeight * halfH;
      g.fillStyle(c.tunnelDeep, 1);
      g.fillRect(0, farCeil, this.w, Math.max(1, far.p2.screen.y - farCeil));

      // Light at the end: if the exit is in view, paint the far opening
      // with the horizon color. The darkness must read as passage, not
      // wall — the exit glow is the tunnel keeping its promise.
      if (exitVisible) {
        const { x: fx, y: fy, w: fw, scale: fs } = far.p2.screen;
        const fCeil = fy - fs * t.tunnelHeight * halfH;
        const FW = fw * 1.18;
        g.fillStyle(c.fog, 1);
        g.fillRect(fx - FW, fCeil, FW * 2, Math.max(1, fy - fCeil));
      }
    }

    for (let n = t.drawDistance - 1; n >= 1; n--) {
      const idx = (base.index + n) % model.segments.length;
      const seg = model.segments[idx];
      if (seg.clipped || !seg.tunnel) continue;
      const { x: x1, y: y1, w: w1, scale: s1 } = seg.p1.screen;
      const { x: x2, y: y2, w: w2, scale: s2 } = seg.p2.screen;
      // Ceiling line = road line lifted by tunnelHeight through the same
      // projection (screen-y shifts by scale * height * h/2).
      const ceil1 = y1 - s1 * t.tunnelHeight * halfH;
      const ceil2 = y2 - s2 * t.tunnelHeight * halfH;
      const W1 = w1 * 1.18, W2 = w2 * 1.18; // opening sits past the rumble

      // Ceiling: full-width band between this segment's ceiling lines.
      g.fillStyle(c.tunnelCeil, 1);
      g.fillRect(0, Math.min(ceil1, ceil2), this.w, Math.abs(ceil2 - ceil1) + 1);
      // Side fills: road edge to the screen edge, for this road band.
      this.quad(g, c.tunnelWall, 0, y1, x1 - W1, y1, x2 - W2, y2, 0, y2);
      this.quad(g, c.tunnelWall, this.w, y1, x1 + W1, y1, x2 + W2, y2, this.w, y2);

      // Portal face at the mouth (first tunnel segment after open road):
      // solid wall from ceiling to road on both sides of the opening.
      const prev = model.segments[(idx - 1 + model.segments.length) % model.segments.length];
      if (!prev.tunnel) {
        g.fillStyle(c.tunnelWall, 1);
        g.fillRect(0, ceil1, Math.max(0, x1 - W1), y1 - ceil1);
        g.fillRect(Math.min(this.w, x1 + W1), ceil1, this.w - (x1 + W1), y1 - ceil1);
        // neon lip over the opening — the brand says hello at the door
        g.fillStyle(c.rumbleB, 1);
        g.fillRect(Math.max(0, x1 - W1), ceil1, Math.min(this.w, W1 * 2), 4);
      }
    }
  }

  // Second pass, far -> near, so close sprites draw over distant ones.
  // Only segments the road pass projected this frame have valid screen
  // coords; clipped segments are skipped along with their sprites.
  renderSprites(model, base) {
    const t = this.t;
    let poolI = 0;
    for (let n = t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segments[(base.index + n) % model.segments.length];
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

    // Rumble strips: 1/6th of road width each side. Neon = Wipeout.
    const r1 = w1 / 6, r2 = w2 / 6;
    this.quad(g, light ? c.rumbleA : c.rumbleB,
      x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    this.quad(g, light ? c.rumbleA : c.rumbleB,
      x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);

    // Road surface (dimmed inside tunnels — headlights not included).
    const roadColor = seg.tunnel
      ? (light ? c.tunnelRoadLight : c.tunnelRoadDark)
      : (light ? c.roadLight : c.roadDark);
    this.quad(g, roadColor,
      x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);

    // Lane lines, dashed by drawing only on light bands.
    if (light && this.t.lanes > 1) {
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