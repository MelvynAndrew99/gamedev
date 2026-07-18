// Player.js — the machine. State + arcade handling, plus a one-time
// procedurally drawn texture (no art assets needed yet).
//
// Handling model (deliberately fake, tuned for feel):
//   - position: distance along the track loop (world units)
//   - x: lateral position in road-halves: -1 = left edge, +1 = right edge
//   - steering authority scales with speed (can't turn a parked hovercar)
//   - curves apply an outward centrifugal push scaled by speed² — this is
//     the seed of the whole risk/reward design: speed through a curve is a
//     *decision*, not a free win.

export class Player {
  constructor(tuning) {
    this.t = tuning;
    this.position = 0;
    this.x = 0;
    this.speed = 0;
    this.steer = 0; // -1 | 0 | +1, for sprite lean
  }

  update(dt, input, model) {
    const t = this.t;
    const seg = model.findSegment(this.position + t.playerZ); // segment under the CAR, not the camera
    const speedPercent = this.speed / t.maxSpeed;

    // Steering. `2` = full road-widths per second at max speed.
    const dx = dt * 2 * speedPercent;
    if (input.left)       { this.x -= dx; this.steer = -1; }
    else if (input.right) { this.x += dx; this.steer =  1; }
    else                  { this.steer = 0; }

    // Centrifugal push: dx * speedPercent makes it scale with speed²,
    // so a curve that's trivial at half throttle is a fight at full.
    this.x -= dx * speedPercent * seg.curve * t.centrifugal;

    // Throttle / brake / coast.
    if (input.up)        this.speed += t.accel * dt;
    else if (input.down) this.speed += t.braking * dt;
    else                 this.speed += t.decel * dt;

    // Off the road (|x| > 1): heavy drag down to a crawl.
    if ((this.x < -1 || this.x > 1) && this.speed > t.offRoadLimit) {
      this.speed += t.offRoadDecel * dt;
    }

    this.x = clamp(this.x, -2, 2);
    this.speed = clamp(this.speed, 0, t.maxSpeed);

    // Advance along the loop.
    this.position += this.speed * dt;
    while (this.position >= model.trackLength) this.position -= model.trackLength;
    while (this.position < 0) this.position += model.trackLength;

    return seg; // handy for the scene (lean, later: scoring per-segment)
  }

  // Draw the F-Zero-ish machine once into a texture. Swap for real art
  // later without touching anything else — the key is just 'player-car'.
  static createTexture(scene) {
    if (scene.textures.exists('player-car')) return;
    const g = scene.make.graphics({ add: false });

    // side pods (magenta, to match the rumble neon)
    g.fillStyle(0xd81b7f, 1);
    g.fillRoundedRect(0, 26, 12, 30, 4);
    g.fillRoundedRect(36, 26, 12, 30, 4);

    // hull
    g.fillStyle(0x2255ee, 1);
    g.fillRoundedRect(10, 8, 28, 52, 8);
    g.fillTriangle(10, 14, 38, 14, 24, 0); // nose

    // hull highlight
    g.fillStyle(0x4d7dff, 1);
    g.fillRoundedRect(14, 16, 20, 40, 6);

    // cockpit
    g.fillStyle(0x0a0a1a, 1);
    g.fillRoundedRect(18, 22, 12, 16, 5);
    g.fillStyle(0x9be8ff, 0.9);
    g.fillRoundedRect(19, 23, 10, 8, 4);

    // engines (cyan glow)
    g.fillStyle(0x00e5ff, 1);
    g.fillRect(13, 58, 8, 5);
    g.fillRect(27, 58, 8, 5);

    g.generateTexture('player-car', 48, 64);
    g.destroy();
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}