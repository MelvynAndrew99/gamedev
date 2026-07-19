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
    this.steer = 0; // visual lean, -1..1
    this.air = 0;      // seconds of airtime remaining
    this.airTotal = 0; // total airtime of the current jump (for the arc)
  }

  get airborne() {
    return this.air > 0;
  }

  // 0 at takeoff/landing, 1 at apex — for the sprite's visual arc.
  get airArc() {
    if (!this.airborne || this.airTotal <= 0) return 0;
    const t = 1 - this.air / this.airTotal;
    return Math.sin(t * Math.PI);
  }

  // Boost pad: a shove toward (and past) max. Pads are reusable — the
  // uphill asks the same question every lap.
  boost() {
    this.speed = Math.min(this.speed + this.t.boostKick, this.t.maxSpeed * this.t.overspeedCap);
  }

  // Hit a ramp. Faster launch = longer flight = more cleared road.
  launch() {
    const speedPercent = this.speed / this.t.maxSpeed;
    this.airTotal = this.t.jumpMinAir + this.t.jumpMaxAir * speedPercent;
    this.air = this.airTotal;
  }

  update(dt, input, model) {
    const t = this.t;
    const seg = model.findSegment(this.position + t.playerZ); // segment under the CAR, not the camera
    const speedPercent = this.speed / t.maxSpeed;

    // Airborne: tick the timer; steering authority drops to a whisper —
    // you committed at the ramp, the air is where commitment lives.
    this.air = Math.max(0, this.air - dt);
    const grip = this.airborne ? 0.25 : 1;

    // Steering authority scales with speed (can't turn a parked hovercar).
    // input.steer is analog (-1..1) — keyboard just supplies ±1. Dirt is
    // a loose surface: less authority, same speed of consequences.
    const surfaceGrip = seg.surface === 'dirt' ? t.dirtSteer : 1;
    const authority = dt * t.steerRate * speedPercent * grip * surfaceGrip;
    let dx = authority * input.steer;

    // Airbrakes (F-Zero shoulder lean / Wipeout airbrake): extra lateral
    // force in the held direction, paid for with a little speed. Holding
    // BOTH cancels the turn but doubles the drag — a deliberate scrub,
    // exactly like tapping both shoulders in F-Zero before a hairpin.
    let ab = 0;
    if (input.airbrakeL) ab -= 1;
    if (input.airbrakeR) ab += 1;
    if (input.airbrakeL || input.airbrakeR) {
      dx += dt * t.airbrakeForce * speedPercent * ab;
      this.speed += t.airbrakeDrag * dt * (input.airbrakeL && input.airbrakeR ? 2 : 1);
    }
    this.x += dx;

    // Centrifugal push scales with speed², so a curve that's trivial at
    // half throttle is a fight at full.
    this.x -= authority * speedPercent * seg.curve * t.centrifugal;

    // Analog throttle/brake; coast when neither. The engine can only
    // push you to maxSpeed — everything beyond that belongs to gravity.
    if (input.throttle > 0 && this.speed < t.maxSpeed)
      this.speed += t.accel * input.throttle * dt;
    else if (input.brake > 0) this.speed += t.braking * dt * input.brake;
    else if (input.throttle <= 0) this.speed += t.decel * dt;

    // Gravity along the road: uphill drains, downhill pays — and downhill
    // can pay PAST maxSpeed (see the clamp), where steering authority and
    // centrifugal force keep scaling. Free speed, expensive hands.
    if (!this.airborne) {
      const slope = (seg.p2.world.y - seg.p1.world.y) / t.segmentLength;
      this.speed -= slope * t.slopeAccel * dt;
    }
    // Above maxSpeed, drag claws you back toward it — hold overspeed only
    // while gravity keeps winning the tug-of-war.
    if (this.speed > t.maxSpeed) this.speed += t.overspeedDecay * dt;

    // Dirt: the surface won't carry more than dirtSpeed of max.
    if (!this.airborne && seg.surface === 'dirt' && this.speed > t.maxSpeed * t.dirtSpeed) {
      this.speed += t.dirtDrag * dt;
    }

    // Visual lean for the sprite: steering plus airbrake attitude.
    this.steer = clamp(input.steer + ab * 0.6, -1, 1);

    // Off the road (|x| > 1): heavy drag down to a crawl. Not while
    // airborne — flight doesn't care what's under you.
    if (!this.airborne && (this.x < -1 || this.x > 1) && this.speed > t.offRoadLimit) {
      this.speed += t.offRoadDecel * dt;
    }

    this.x = clamp(this.x, -2, 2);
    this.speed = clamp(this.speed, 0, t.maxSpeed * t.overspeedCap);

    // Advance along the loop.
    this.position += this.speed * dt;
    while (this.position >= model.trackLength) this.position -= model.trackLength;
    while (this.position < 0) this.position += model.trackLength;

    return seg; // handy for the scene (lean, later: scoring per-segment)
  }
}
// (The old procedural createTexture is gone — art now lives in
// public/assets/car.png, generated by tools/gen-car.js. This file is pure
// handling logic: no Phaser, no DOM, no pixels. Testable in plain Node.)

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}