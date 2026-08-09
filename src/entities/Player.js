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
    this.hitRecovery = 0; // post-impact engine surge countdown
    this.airTotal = 0; // total airtime of the current jump (for the arc)
    this.jumpElapsed = 0; // measured wall-clock airtime for the live jump
    this.lastAirtime = 0;
    this.bestAirtime = 0;
    this.totalAirtime = 0;
    this.justLanded = false; // one update-frame event for scoring/feedback
    this.glide = 0; // -1 nose-down/shorter, +1 nose-up/longer
    this.launchSpeed = 0;
    this.boostedLaunch = false;
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
  // Zipper crossing: same shove as nitro but free and repeatable — the
  // road pays skill directly. Capped at the overspeed ceiling like all
  // speed income.
  zip() {
    this.speed = Math.min(this.speed + this.t.maxSpeed * this.t.zipperKick, this.t.maxSpeed * this.t.overspeedCap);
  }

  // A spent boost slot gives an immediate punch, capped by the active tier.
  // Sustained acceleration toward that ceiling happens in update(), so a
  // boost feels forceful without teleporting a slow car straight to redline.
  boost(multiplier) {
    const target = this.t.maxSpeed * multiplier;
    this.speed = Math.max(
      this.speed,
      Math.min(this.speed + this.t.boostKick, target),
    );
  }

  // Hit a ramp. Faster launch = longer flight = more cleared road.
  launch({ boosted = false } = {}) {
    const speedPercent = Math.max(0, this.speed / this.t.maxSpeed);
    this.launchSpeed = this.speed;
    this.boostedLaunch = boosted;
    this.jumpElapsed = 0;
    this.justLanded = false;
    this.glide = 0;
    this.airTotal = this.t.jumpMinAir + this.t.jumpMaxAir * speedPercent +
      (boosted ? this.t.jumpBoostAir : 0);
    this.air = this.airTotal;
  }

  update(dt, input, model) {
    const t = this.t;
    const seg = model.findSegment(this.position + t.playerZ); // segment under the CAR, not the camera
    const speedPercent = this.speed / t.maxSpeed;

    // Airborne pitch borrows the readable snowboard/skateboard convention:
    // push forward to put the nose down and land sooner; pull back to hold a
    // longer glide. This only changes how fast the finite timer burns, so a
    // held stick can never create an infinite hover. Measured airtime is real
    // elapsed time (not timer units), which keeps trophies honest.
    this.justLanded = false;
    if (this.airborne) {
      this.glide = clamp(input.glide ?? 0, -1, 1);
      const timerRate = this.glide < 0
        ? 1 + (this.t.glideShortenRate - 1) * -this.glide
        : 1 - (1 - this.t.glideExtendRate) * this.glide;
      const airborneDt = Math.min(dt, this.air / timerRate);
      this.jumpElapsed += airborneDt;
      this.air = Math.max(0, this.air - dt * timerRate);
      if (!this.airborne) {
        this.lastAirtime = this.jumpElapsed;
        this.bestAirtime = Math.max(this.bestAirtime, this.lastAirtime);
        this.totalAirtime += this.lastAirtime;
        this.justLanded = true;
        this.glide = 0;
      }
    } else {
      this.glide = 0;
    }
    // Steering authority drops to a whisper — you committed at the ramp,
    // and pitch controls distance while ordinary steering chooses the line.
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

    // Engine with a torque curve: strong off the line, tapering toward
    // maxSpeed. This is most of what "the car has weight" means — launch
    // shoves, top end grinds. It can only push you to maxSpeed;
    // everything beyond that belongs to gravity.
    // Hit recovery: for a short window after an impact the engine surges
    // hard enough to out-pull ANY grade. Without this, a rock on a hill
    // drops you below the grade's equilibrium and the climb floor becomes
    // a 30-second penalty box. The mistake costs momentum ONCE; the
    // recovery hands the flow back.
    this.hitRecovery = Math.max(0, this.hitRecovery - dt);
    const surge = this.hitRecovery > 0 ? t.hitRecoveryAccel : 1;

    const torque = t.torqueLow + (t.torqueHigh - t.torqueLow) * Math.min(1, speedPercent);
    if (input.throttle > 0 && this.speed < t.maxSpeed)
      this.speed += t.accel * torque * surge * input.throttle * dt;
    else if (input.brake > 0) this.speed += t.braking * dt * input.brake;
    else if (input.throttle <= 0) this.speed += t.decel * dt;

    // Burnout-style thrust: while the boost is burning it actively pulls the
    // car toward the tier ceiling. Tapping raises that destination; holding
    // keeps the same destination alive for another full slot duration.
    const boostCeiling = Math.max(t.overspeedCap, input.boostCeiling ?? 0);
    if (input.boostActive && this.speed < t.maxSpeed * boostCeiling) {
      this.speed += t.boostAccel * dt;
    }

    // Gravity along the road: uphill drains, downhill pays — and downhill
    // can pay PAST maxSpeed (see the clamp), where steering authority and
    // centrifugal force keep scaling. Free speed, expensive hands.
    let slope = 0;
    if (!this.airborne) {
      slope = (seg.p2.world.y - seg.p1.world.y) / t.segmentLength;
      // Recovery shields against gravity too, not just the accel boost —
      // a bounce that fades before the grade does just becomes a sag.
      const gravityMul = this.hitRecovery > 0 ? t.hitRecoveryShield : 1;
      this.speed -= slope * t.slopeAccel * gravityMul * dt;
    }

    // Climb floor — the softlock guarantee. Gravity is speed-independent
    // and so was the engine, so any grade steeper than the engine could
    // hold would decay the car to zero FOREVER. Under throttle on a
    // grade, first gear always grinds you forward at a crawl: hills tax
    // speed, they never confiscate motion.
    const floor = t.maxSpeed * t.climbFloor;
    if (input.throttle > 0 && slope > 0.02 && this.speed < floor) {
      // Grind at accel*3 (was *2): even on the steepest authored grade, where
      // gravity cancels the whole engine, a dead-stop start reaches crawl speed
      // in under half a second. That's the difference between "first gear bites"
      // and "the car is stuck" — the launch has to FEEL decided, not tentative.
      this.speed = Math.min(floor, this.speed + t.accel * 3 * dt);
    }
    // Above maxSpeed, drag claws you back toward it — hold overspeed only
    // while gravity keeps winning the tug-of-war.
    if (this.speed > t.maxSpeed && !input.boostActive) {
      this.speed += t.overspeedDecay * dt;
    }

    // Dirt: the surface won't carry more than dirtSpeed of max.
    if (!this.airborne && seg.surface === 'dirt' && this.speed > t.maxSpeed * t.dirtSpeed) {
      this.speed += t.dirtDrag * dt;
    }

    // Visual lean for the sprite: the airbrake alone reaches the "hard
    // turn" frames at the edges of the sheet — plain steering (keyboard,
    // d-pad, or a full-deflection stick) is capped below that threshold
    // so it can only ever show the "slight turn" frames. Blending the two
    // by magnitude (as this used to) meant a hard stick push and a light
    // one both looked identical once digital keyboard input saturated to
    // ±1, and a full-deflection stick could cross the hard threshold on
    // its own with no airbrake held at all.
    this.steer = ab !== 0 ? ab : clamp(input.steer * 0.5, -0.5, 0.5);

    // Off the road (|x| > 1): heavy drag down to a crawl. Not while
    // airborne — flight doesn't care what's under you.
    if (!this.airborne && (this.x < -1 || this.x > 1) && this.speed > t.offRoadLimit) {
      this.speed += t.offRoadDecel * dt;
    }

    this.x = clamp(this.x, -2, 2);
    // A live boost (see Boost.js) temporarily raises this ceiling above the
    // normal overspeedCap; when it eases back down after the burn ends, this
    // same clamp rides existing speed back down with it — that IS the boost
    // decay, no separate deceleration needed.
    this.speed = clamp(this.speed, 0, t.maxSpeed * boostCeiling);

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
