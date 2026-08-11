// RivalPack.js — deterministic opponent motion and aggression state.
//
// This module deliberately owns no Phaser objects and never reads Math.random.
// Given the same seed, inputs, and elapsed time it produces the same pack and
// events. A fixed simulation step also keeps the lesson stable across render
// rates; GameScene may update it at 30, 60, or 120 Hz without changing the AI.

export const MAX_RIVALS = 6;
export const RIVAL_FIXED_STEP = 1 / 60;
const MAX_CONTACT_STEPS = 4; // GameScene clamps render dt to 50ms (<=3 steps).

export const DEFAULT_RIVAL_TUNING = Object.freeze({
  maxSpeed: 12000,
  basePace: 1,
  segmentLength: 200,
  localPaceRadiusSegments: 60,
  fullPaceCorrectionSegments: 120,
  catchUpLimit: 0.08,
  slowDownLimit: 0.05,
  speedEase: 2.5,
  laneRate: 0.72,
  attackRangeSegments: 12,
  attackTellSeconds: 0.7,
  attackSeconds: 0.32,
  recoverySeconds: 1.0,
  minimumAttackInterval: 3.2,
  maximumAttackInterval: 8.5,
  attackIntervalJitter: 1.2,
  contactCooldownSeconds: 0.45,
  stagingRadiusSegments: 90,
  stagingBehindRadiusSegments: 24,
  stagingTargetSegments: 24,
  stagingTargetSpacingSegments: 7,
  stagingGraceSeconds: 1,
  staggerSeconds: 0.45,
  wreckSeconds: 0.7,
});

const DEFAULT_CIRCULATION = Object.freeze({
  enabled: false,
  behindMinSegments: 18,
  behindMaxSegments: 28,
  aheadMinSegments: 42,
  aheadMaxSegments: 60,
  catchUpMinMultiplier: 1.055,
  catchUpMaxMultiplier: 1.09,
  catchUpSeconds: 7,
  pursuitStartSegments: 5,
  pursuitMinMultiplier: 1.025,
  pursuitMaxMultiplier: 1.055,
  reentryDelayMinSeconds: 2.2,
  reentryDelayMaxSeconds: 3.4,
  minimumReentryIntervalSeconds: 2.2,
  minimumSpacingSegments: 3.5,
  lanePattern: [-0.62, 0.48, -0.08, 0.68, -0.42, 0.2],
});

export class RivalPack {
  constructor(config = {}, tuning = {}, model = null) {
    this.t = { ...DEFAULT_RIVAL_TUNING, ...tuning };
    this.trackLength = positive(
      model?.trackLength ?? config.trackLength,
      this.t.segmentLength * 100,
    );
    this.seed = uintSeed(config.seed ?? 1);
    this.random = seededRandom(this.seed);
    this.aggression = clamp01(config.aggression ?? 0.3);
    this.recycleWrecks = !!config.recycleWrecks;
    // Circulation is opt-in track data. Rival School uses it to keep three
    // identities orbiting the player; Story can omit it and retain finite,
    // authored opponents with the original staging behavior.
    this.circulation = normalizeCirculation(config.circulation);
    this.maxCount = clampInteger(config.maxCount ?? MAX_RIVALS, 1, MAX_RIVALS);
    this.attackZones = Array.isArray(config.attackZones)
      ? config.attackZones.map(normalizeZone).filter(Boolean)
      : [];
    this.accumulator = 0;
    this.circulationCooldown = 0;
    this.lastStepCount = 0;
    this.elapsed = 0;
    this.attackerId = null;
    this.events = [];
    this.activeViews = [];
    this.stepContext = { player: {} };
    this.stepPlayer = this.stepContext.player;
    this.lastSimulatedPlayer = null;
    this.contactPreviousPlayer = {};
    this.contactPlayer = {};

    const spawns = Array.isArray(config.spawns) ? config.spawns : [];
    this.rivals = Array.from({ length: this.maxCount }, (_, index) =>
      this.createRival(spawns[index], index),
    );
    // Stable, bounded step history lets contact use every 60Hz body interval
    // even when one 30Hz render advances the AI twice. No per-frame records
    // are allocated and 120Hz frames with no step expose zero contacts.
    this.contactSteps = Array.from({ length: MAX_CONTACT_STEPS }, () => ({
      time: 0,
      previousPlayer: {},
      player: {},
      rivalCount: this.maxCount,
      rivals: Array.from({ length: this.maxCount }, () => ({
        id: '', previous: {}, current: {},
      })),
    }));
    this.contactStepCount = 0;
    this.count = 0;
    this.setCount(config.count ?? Math.min(3, this.maxCount));
  }

  createRival(spawn = {}, index) {
    const segmentLength = this.t.segmentLength;
    const position = spawn.position ??
      (spawn.at ?? spawn.segmentsAhead ?? 14 + index * 10) * segmentLength;
    const id = String(spawn.id ?? `rival-${index + 1}`);
    const pace = clamp(spawn.pace ?? 0.96 + index * 0.015, 0.75, 1.1);
    const x = clamp(spawn.offset ?? [-0.55, 0.55, 0][index % 3], -0.95, 0.95);

    return {
      id,
      generation: 1,
      active: false,
      position: wrap(position, this.trackLength),
      previousPosition: wrap(position, this.trackLength),
      x,
      spawnLane: x,
      previousX: x,
      speed: pace * this.t.basePace * this.t.maxSpeed,
      pace,
      state: 'cruise',
      stateTime: 0,
      attackCooldown: 1.5 + index * 0.9,
      contactCooldown: 0,
      targetLane: x,
      steer: 0,
      // Render-only pose. Physics and contact always read position/x above;
      // these fields advance through the unused fraction of the fixed step so
      // 120/144Hz displays do not show a 60Hz rival hopping over a smooth road.
      renderPosition: wrap(position, this.trackLength),
      renderX: x,
      attackSide: 0,
      telegraph: 0,
      airborne: false,
      stagingGrace: 0,
      stagingGraceTotal: 0,
      stagingCount: 0,
      reentryMode: null,
      reentryTime: 0,
      reentryPaceMultiplier: 1,
      pursuitMultiplier: circulationValue(
        this.seed,
        id,
        1,
        47,
        this.circulation.pursuitMinMultiplier,
        this.circulation.pursuitMaxMultiplier,
      ),
      stability: 2,
      lastStaggerSide: 0,
      eliminated: false,
      screen: { x: 0, y: 0, width: 0, visible: false },
    };
  }

  setCount(value) {
    const next = clampInteger(value, 0, this.maxCount);
    this.count = next;
    let remaining = next;
    for (const rival of this.rivals) {
      rival.active = !rival.eliminated && remaining > 0;
      if (rival.active) remaining -= 1;
      if (!rival.active && rival.id === this.attackerId) this.releaseAttack(rival);
    }
    this.refreshViews();
    return this.count;
  }

  setAggression(value) {
    this.aggression = clamp01(value);
    return this.aggression;
  }

  setBasePace(value) {
    this.t.basePace = clamp(Number(value) || 1, 0.5, 1.25);
    return this.t.basePace;
  }

  // A deliberate hit destabilizes a rival but never awards anything here.
  // GameScene owns objective/scoring credit and may call takeDown separately
  // when its authored rules say the hit was decisive.
  stagger(id, { side = 0, force = 1, damage = true } = {}) {
    const rival = this.rivals.find((candidate) => candidate.id === id);
    if (!rival?.active || rival.eliminated || rival.state === 'wrecked') return null;
    if (rival.id === this.attackerId) this.attackerId = null;
    // A clean high-energy ram is intentionally enough for a training
    // takedown. Lower-energy bumps still teach the setup -> finish rhythm.
    const stabilityDamage = damage ? (force >= 1.25 ? 2 : 1) : 0;
    rival.stability = Math.max(0, rival.stability - stabilityDamage);
    rival.lastStaggerSide = Math.sign(side) || rival.lastStaggerSide || 1;
    rival.state = 'staggered';
    rival.stateTime = this.t.staggerSeconds;
    rival.telegraph = 0;
    rival.attackSide = 0;
    rival.attackCooldown = Math.max(rival.attackCooldown, this.t.recoverySeconds);
    rival.contactCooldown = Math.max(rival.contactCooldown, this.t.contactCooldownSeconds);
    rival.targetLane = clamp(
      rival.x + rival.lastStaggerSide * 0.32 * clamp(force, 0.5, 1.5),
      -1.35,
      1.35,
    );
    return { rivalId: rival.id, stability: rival.stability, side: rival.lastStaggerSide };
  }

  // A finite elimination lesson retires this stable ID. A score-attack lesson
  // may recycle the slot only after its generation-safe wreck beat completes.
  takeDown(id, { elapsedSince = 0 } = {}) {
    const rival = this.rivals.find((candidate) => candidate.id === id);
    if (!rival?.active || rival.eliminated || rival.state === 'wrecked') return null;
    if (rival.id === this.attackerId) this.attackerId = null;
    rival.stability = 0;
    rival.state = 'wrecked';
    // Contacts are read from fixed-step traces after the render update. At
    // 30Hz the credited trace may be one 60Hz step old, so age the pause from
    // that authoritative timestamp instead of making low refresh rates wait
    // longer for the same replacement.
    const wreckSeconds = this.circulation.enabled
      ? circulationValue(
        this.seed,
        rival.id,
        rival.generation,
        5,
        this.circulation.reentryDelayMinSeconds,
        this.circulation.reentryDelayMaxSeconds,
      )
      : this.t.wreckSeconds;
    rival.stateTime = Math.max(
      0,
      wreckSeconds - Math.max(0, Number(elapsedSince) || 0),
    );
    rival.telegraph = 0;
    rival.attackSide = 0;
    rival.contactCooldown = Math.max(rival.contactCooldown, this.t.wreckSeconds);
    rival.targetLane = clamp(
      rival.x + (rival.lastStaggerSide || 1) * 1.15,
      -1.75,
      1.75,
    );
    return { rivalId: rival.id, state: rival.state, wreckSeconds: rival.stateTime };
  }

  // The renderer/integration layer gets stable object identities. It should
  // treat these as read-only; setCount merely hides and restores pool members.
  get views() {
    return this.activeViews;
  }

  get renderViews() {
    this.refreshRenderPoses();
    return this.activeViews;
  }

  refreshRenderPoses() {
    const residual = clamp(this.accumulator, 0, RIVAL_FIXED_STEP);
    for (const rival of this.activeViews) {
      updateRivalRenderPose(
        rival,
        residual,
        this.trackLength,
        this.t.laneRate,
      );
    }
    return this.activeViews;
  }

  refreshViews() {
    this.activeViews.length = 0;
    for (const rival of this.rivals) {
      if (rival.active) this.activeViews.push(rival);
    }
    return this.activeViews;
  }

  consumeEvents() {
    const pending = this.events;
    this.events = [];
    return pending;
  }

  update(dt, context = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return this.views;
    this.lastStepCount = 0;
    this.contactStepCount = 0;
    const frameAccumulator = this.accumulator;
    this.accumulator += dt;
    let stepTime = RIVAL_FIXED_STEP - frameAccumulator;
    while (this.accumulator + 1e-10 >= RIVAL_FIXED_STEP) {
      const fraction = clamp(stepTime / dt, 0, 1);
      copyPlayerContext(
        this.contactPreviousPlayer,
        this.lastSimulatedPlayer ?? context.previousPlayer ?? context.player,
      );
      interpolatePlayerContext(
        this.stepPlayer,
        context.previousPlayer ?? context.player,
        context.player,
        fraction,
        this.trackLength,
      );
      copyPlayerContext(this.contactPlayer, this.stepPlayer);
      const trace = this.contactStepCount < this.contactSteps.length
        ? this.contactSteps[this.contactStepCount]
        : null;
      if (trace) {
        copyPlayerContext(trace.previousPlayer, this.contactPreviousPlayer);
        copyPlayerContext(trace.player, this.contactPlayer);
        for (let index = 0; index < this.rivals.length; index += 1) {
          trace.rivals[index].id = this.rivals[index].id;
          copyRivalContext(trace.rivals[index].previous, this.rivals[index]);
        }
      }
      this.step(RIVAL_FIXED_STEP, this.stepContext);
      this.lastStepCount += 1;
      if (trace) {
        trace.time = this.elapsed;
        for (let index = 0; index < this.rivals.length; index += 1) {
          copyRivalContext(trace.rivals[index].current, this.rivals[index]);
        }
        this.contactStepCount += 1;
      }
      if (!this.lastSimulatedPlayer) this.lastSimulatedPlayer = {};
      copyPlayerContext(this.lastSimulatedPlayer, this.stepPlayer);
      this.accumulator -= RIVAL_FIXED_STEP;
      stepTime += RIVAL_FIXED_STEP;
    }
    if (Math.abs(this.accumulator) < 1e-10) this.accumulator = 0;
    return this.views;
  }

  step(dt, context) {
    this.elapsed += dt;
    this.circulationCooldown = Math.max(0, this.circulationCooldown - dt);
    const player = context.player ?? {};

    for (const rival of this.rivals) {
      // Lab count zero hides the pack but must not freeze a wreck forever.
      // Its one-shot elimination timer continues off-screen.
      if (!rival.active) {
        if (rival.state === 'wrecked') this.updateAttackState(rival, player, dt, 0);
        continue;
      }
      this.advanceRival(rival, player, dt);
    }
  }

  advanceRival(rival, player, dt) {
    rival.previousPosition = rival.position;
    rival.previousX = rival.x;
    rival.contactCooldown = Math.max(0, rival.contactCooldown - dt);
    rival.attackCooldown = Math.max(0, rival.attackCooldown - dt);
    rival.stagingGrace = Math.max(0, rival.stagingGrace - dt);

    let signedPlayerDistance = wrappedDelta(
      rival.position,
      finite(player.position, rival.position),
      this.trackLength,
    );
    if (this.stageForProximity(rival, player, signedPlayerDistance)) {
      signedPlayerDistance = wrappedDelta(
        rival.position,
        finite(player.position, rival.position),
        this.trackLength,
      );
    }
    const correction = distantPaceCorrection(
      signedPlayerDistance,
      this.t.segmentLength,
      this.t,
    );
    let targetSpeed = this.t.maxSpeed * this.t.basePace * rival.pace * (1 + correction);
    const distanceSegments = signedPlayerDistance / this.t.segmentLength;
    if (
      this.circulation.enabled &&
      !rival.reentryMode &&
      distanceSegments > this.circulation.pursuitStartSegments
    ) {
      // Give a passed racer time to fight back under its own wheels. This
      // modest off-screen pursuit begins well outside collision range and is
      // exhausted before any emergency relocation threshold is reached.
      targetSpeed = Math.max(
        targetSpeed,
        Math.max(0, finite(player.speed, 0)) * rival.pursuitMultiplier,
      );
    }
    if (rival.reentryMode === 'closing') {
      rival.reentryTime = Math.max(0, rival.reentryTime - dt);
      if (distanceSegments <= 1.5 || rival.reentryTime <= 0) {
        rival.reentryMode = null;
      } else {
        // The returning rival is still physically driving, not teleporting
        // into contact. It only receives enough pace while off-screen behind
        // to rejoin the race, and loses the assist before reaching the player.
        targetSpeed = Math.max(
          targetSpeed,
          Math.max(0, finite(player.speed, 0)) * rival.reentryPaceMultiplier,
        );
      }
    }
    const speedBlend = 1 - Math.exp(-this.t.speedEase * dt);
    rival.speed += (targetSpeed - rival.speed) * speedBlend;
    rival.position = wrap(rival.position + rival.speed * dt, this.trackLength);

    this.updateAttackState(rival, player, dt, signedPlayerDistance);
    const laneStep = this.t.laneRate * dt;
    const previousLane = rival.x;
    rival.x = moveToward(rival.x, rival.targetLane, laneStep);
    rival.steer = laneStep > 0
      ? clamp((rival.x - previousLane) / laneStep, -1, 1)
      : 0;
    return rival;
  }

  // Re-stage only opponents that have left the encounter entirely. Nothing
  // inside the large local radius is sped up, slowed down, or teleported, so
  // collision approach and takedown timing remain player-authored. A staged
  // rival is placed ahead in a deterministic chase formation and receives a
  // contact grace window so a long sweep can never turn the relocation into
  // a phantom impact.
  stageForProximity(rival, player, signedPlayerDistance) {
    if (rival.state !== 'cruise' && rival.state !== 'recover') return false;
    const segmentLength = positive(this.t.segmentLength, 200);
    const distanceSegments = Math.abs(signedPlayerDistance) / segmentLength;
    // A passed rival is no longer a useful target even when it is still well
    // inside the broader ahead/behind staging band. Recycle it sooner once the
    // player is clearly ahead, while preserving the larger radius for cars the
    // player is actively chasing.
    const stagingRadius = signedPlayerDistance > 0
      ? positive(this.t.stagingBehindRadiusSegments, 24)
      : positive(this.t.stagingRadiusSegments, 90);
    if (distanceSegments <= stagingRadius) return false;

    if (this.circulation.enabled) {
      // Never teleport a visible leader back toward the player. It remains a
      // real race target and the existing far-only pace easing lets the player
      // reel it in. Only a genuinely lost, behind-camera pursuer may be
      // reintroduced, and even then it remains behind with contact grace.
      if (signedPlayerDistance <= 0 || rival.screen.visible) return false;
      if (this.circulationCooldown > 0) return false;
      this.placeCirculatingRival(
        rival,
        player,
        'behind',
        'distance',
      );
      return true;
    }

    const activeIndex = Math.max(0, this.rivals.indexOf(rival));
    const targetSegments = positive(this.t.stagingTargetSegments, 24) +
      activeIndex * positive(this.t.stagingTargetSpacingSegments, 7);
    const playerPosition = finite(player.position, rival.position);
    rival.position = wrap(playerPosition + targetSegments * segmentLength, this.trackLength);
    rival.previousPosition = rival.position;
    rival.stagingGrace = Math.max(0.25, positive(this.t.stagingGraceSeconds, 1));
    rival.stagingGraceTotal = rival.stagingGrace;
    rival.contactCooldown = Math.max(rival.contactCooldown, rival.stagingGrace);
    rival.stagingCount += 1;
    rival.targetLane = clamp(rival.targetLane, -0.9, 0.9);
    this.events.push({
      type: 'rival_staged',
      rivalId: rival.id,
      targetSegments,
    });
    return true;
  }

  updateAttackState(rival, player, dt, signedPlayerDistance) {
    if (rival.state === 'wrecked') {
      rival.stateTime = Math.max(0, rival.stateTime - dt);
      if (rival.stateTime <= 0) {
        if (this.recycleWrecks) {
          if (!this.circulation.enabled || this.circulationCooldown <= 0) {
            this.recycleRival(rival, player);
          }
        } else {
          rival.state = 'eliminated';
          rival.eliminated = true;
          rival.active = false;
          this.refreshViews();
        }
      }
      return;
    }

    if (rival.state === 'staggered') {
      rival.stateTime = Math.max(0, rival.stateTime - dt);
      if (rival.stateTime <= 0) {
        rival.state = 'recover';
        rival.stateTime = this.t.recoverySeconds;
      }
      return;
    }

    if (rival.state === 'eliminated') return;

    if (rival.state === 'telegraph') {
      if (!this.attackStillSafe(rival, player, signedPlayerDistance)) {
        this.cancelAttack(rival);
        return;
      }
      rival.stateTime = Math.max(0, rival.stateTime - dt);
      rival.telegraph = 1 - rival.stateTime / this.t.attackTellSeconds;
      if (rival.stateTime <= 0) {
        rival.state = 'attack';
        rival.stateTime = this.t.attackSeconds;
        rival.telegraph = 1;
        rival.targetLane = clamp(finite(player.x, 0), -0.9, 0.9);
        this.events.push({ type: 'rival_attack', rivalId: rival.id, side: rival.attackSide });
      }
      return;
    }

    if (rival.state === 'attack') {
      rival.stateTime = Math.max(0, rival.stateTime - dt);
      if (rival.stateTime <= 0) {
        rival.state = 'recover';
        rival.stateTime = this.t.recoverySeconds;
        rival.telegraph = 0;
        rival.targetLane = clamp(rival.targetLane - rival.attackSide * 0.35, -0.9, 0.9);
        this.attackerId = null;
      }
      return;
    }

    if (rival.state === 'recover') {
      rival.stateTime = Math.max(0, rival.stateTime - dt);
      if (rival.stateTime <= 0) {
        rival.state = 'cruise';
        rival.attackSide = 0;
        rival.attackCooldown = this.nextAttackInterval();
      }
      return;
    }

    rival.state = 'cruise';
    rival.telegraph = 0;
    if (this.canStartAttack(rival, player, signedPlayerDistance)) {
      this.startAttack(rival, player);
    }
  }

  recycleRival(rival, player = {}) {
    const segmentLength = positive(this.t.segmentLength, 200);
    const slot = Math.max(0, this.rivals.indexOf(rival));
    const targetSegments = positive(this.t.stagingTargetSegments, 24) +
      slot * positive(this.t.stagingTargetSpacingSegments, 7);
    const playerPosition = finite(player.position, rival.position);
    rival.generation += 1;
    rival.eliminated = false;
    rival.active = true;
    rival.state = 'cruise';
    rival.stateTime = 0;
    rival.stability = 2;
    rival.position = wrap(playerPosition + targetSegments * segmentLength, this.trackLength);
    rival.previousPosition = rival.position;
    rival.x = rival.spawnLane;
    rival.previousX = rival.x;
    rival.targetLane = rival.x;
    rival.steer = 0;
    rival.telegraph = 0;
    rival.attackSide = 0;
    if (this.circulation.enabled) {
      // Roughly two lives in three return ahead as reachable quarry, while
      // the third becomes a rear challenger. This preserves Gold opportunity
      // without collapsing the encounter into one repeated chase direction.
      const slot = Math.max(0, this.rivals.indexOf(rival));
      const side = (slot + rival.generation) % 3 === 0 ? 'behind' : 'ahead';
      this.placeCirculatingRival(rival, player, side, 'wreck');
      this.events.push({
        type: 'rival_respawned',
        rivalId: rival.id,
        generation: rival.generation,
        targetSegments: rival.reentryTargetSegments,
        side,
        time: this.elapsed,
      });
      this.refreshViews();
      return rival;
    }
    rival.stagingGrace = Math.max(0.25, positive(this.t.stagingGraceSeconds, 1));
    rival.stagingGraceTotal = rival.stagingGrace;
    rival.contactCooldown = rival.stagingGrace;
    rival.attackCooldown = Math.max(1, this.t.recoverySeconds);
    rival.screen.visible = false;
    rival.stagingCount += 1;
    this.events.push({
      type: 'rival_respawned',
      rivalId: rival.id,
      generation: rival.generation,
      targetSegments,
    });
    this.refreshViews();
    return rival;
  }

  placeCirculatingRival(rival, player = {}, side = 'behind', cause = 'distance') {
    const segmentLength = positive(this.t.segmentLength, 200);
    const playerPosition = finite(player.position, rival.position);
    const sequence = rival.stagingCount + rival.generation;
    let distance = circulationValue(
      this.seed,
      rival.id,
      sequence,
      side === 'behind' ? 11 : 23,
      side === 'behind' ? this.circulation.behindMinSegments : this.circulation.aheadMinSegments,
      side === 'behind' ? this.circulation.behindMaxSegments : this.circulation.aheadMaxSegments,
    );
    const minimum = side === 'behind'
      ? this.circulation.behindMinSegments
      : this.circulation.aheadMinSegments;
    const maximum = side === 'behind'
      ? this.circulation.behindMaxSegments
      : this.circulation.aheadMaxSegments;
    const direction = side === 'behind' ? -1 : 1;
    // Prefer the seeded entry but rotate through the authored range if it
    // would stack on a live opponent. This preserves reproducibility while
    // avoiding the repeated three-abreast wave silhouette.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = wrap(playerPosition + direction * distance * segmentLength, this.trackLength);
      const overlaps = this.rivals.some((other) =>
        other !== rival && other.active && other.state !== 'wrecked' &&
        Math.abs(wrappedDelta(candidate, other.position, this.trackLength)) <
          this.circulation.minimumSpacingSegments * segmentLength,
      );
      if (!overlaps) break;
      const span = Math.max(0.01, maximum - minimum);
      distance = minimum + ((distance - minimum + this.circulation.minimumSpacingSegments) % span);
    }
    const signedSegments = direction * distance;
    const lanePattern = this.circulation.lanePattern;
    const laneIndex = positiveHash(this.seed, rival.id, sequence, 37) % lanePattern.length;
    const lane = lanePattern[laneIndex];

    rival.position = wrap(playerPosition + signedSegments * segmentLength, this.trackLength);
    rival.previousPosition = rival.position;
    rival.x = lane;
    rival.previousX = lane;
    rival.targetLane = lane;
    rival.steer = 0;
    rival.reentryMode = side === 'behind' ? 'closing' : null;
    rival.reentryTime = side === 'behind' ? this.circulation.catchUpSeconds : 0;
    rival.reentryPaceMultiplier = circulationValue(
      this.seed,
      rival.id,
      sequence,
      41,
      this.circulation.catchUpMinMultiplier,
      this.circulation.catchUpMaxMultiplier,
    );
    rival.reentryTargetSegments = signedSegments;
    rival.stagingGrace = Math.max(0.25, positive(this.t.stagingGraceSeconds, 1));
    rival.stagingGraceTotal = rival.stagingGrace;
    rival.contactCooldown = Math.max(rival.contactCooldown, rival.stagingGrace);
    rival.attackCooldown = Math.max(rival.attackCooldown, this.t.recoverySeconds);
    rival.stagingCount += 1;
    this.circulationCooldown = this.circulation.minimumReentryIntervalSeconds;
    rival.screen.visible = false;
    this.events.push({
      type: 'rival_circulated',
      rivalId: rival.id,
      generation: rival.generation,
      cause,
      side,
      targetSegments: signedSegments,
      lane,
      time: this.elapsed,
    });
    return rival;
  }

  canStartAttack(rival, player, signedPlayerDistance) {
    if (this.attackerId || rival.attackCooldown > 0 || rival.contactCooldown > 0) return false;
    if (!this.inAttackZone(player.position)) return false;
    if (player.airborne || player.air > 0 || rival.airborne) return false;
    if (Math.abs(finite(player.x, 0)) > 0.8) return false;
    const range = this.t.attackRangeSegments * this.t.segmentLength;
    // Rivals may threaten from beside the player or while closing from behind,
    // but not from far in front where a red tell would have no readable cause.
    return signedPlayerDistance >= -this.t.segmentLength && signedPlayerDistance <= range;
  }

  attackStillSafe(rival, player, signedPlayerDistance) {
    if (this.attackerId !== rival.id) return false;
    if (player.airborne || player.air > 0 || rival.airborne) return false;
    if (Math.abs(finite(player.x, 0)) > 0.9) return false;
    const range = (this.t.attackRangeSegments + 3) * this.t.segmentLength;
    return this.inAttackZone(player.position) &&
      signedPlayerDistance >= -2 * this.t.segmentLength &&
      signedPlayerDistance <= range;
  }

  startAttack(rival, player) {
    this.attackerId = rival.id;
    rival.state = 'telegraph';
    rival.stateTime = Math.max(0.65, this.t.attackTellSeconds);
    // Freeze this minimum on the instance too, so telegraph progress and all
    // consumers use the same clamped duration even with unsafe lab input.
    this.t.attackTellSeconds = Math.max(0.65, this.t.attackTellSeconds);
    const delta = finite(player.x, 0) - rival.x;
    rival.attackSide = Math.sign(delta) || (this.random() < 0.5 ? -1 : 1);
    rival.targetLane = clamp(finite(player.x, 0) - rival.attackSide * 0.28, -0.9, 0.9);
    rival.telegraph = 0;
    this.events.push({
      type: 'rival_threat',
      rivalId: rival.id,
      side: rival.attackSide,
      tellSeconds: rival.stateTime,
    });
  }

  cancelAttack(rival) {
    rival.state = 'recover';
    rival.stateTime = this.t.recoverySeconds;
    rival.telegraph = 0;
    rival.attackSide = 0;
    rival.attackCooldown = this.nextAttackInterval();
    this.attackerId = null;
    this.events.push({ type: 'rival_attack_cancelled', rivalId: rival.id });
  }

  releaseAttack(rival) {
    rival.state = 'cruise';
    rival.stateTime = 0;
    rival.telegraph = 0;
    rival.attackSide = 0;
    this.attackerId = null;
  }

  nextAttackInterval() {
    // Aggression changes opportunity frequency only. Tell duration, speed,
    // steering rate, contact force, and recovery remain invariant.
    const span = this.t.maximumAttackInterval - this.t.minimumAttackInterval;
    return this.t.maximumAttackInterval - span * this.aggression +
      this.random() * this.t.attackIntervalJitter;
  }

  inAttackZone(position) {
    if (this.attackZones.length === 0) return true;
    const segment = Math.floor(wrap(finite(position, 0), this.trackLength) / this.t.segmentLength);
    return this.attackZones.some(({ from, to }) =>
      from <= to ? segment >= from && segment <= to : segment >= from || segment <= to,
    );
  }
}

// Zero correction in the local battle is the fairness rule. Only a pack that
// is more than 60 segments separated may ease toward the player; the maximum
// correction is reached at 120 segments and can never exceed +8% / -5%.
export function distantPaceCorrection(signedPlayerDistance, segmentLength, tuning = {}) {
  const t = { ...DEFAULT_RIVAL_TUNING, ...tuning };
  const distanceSegments = signedPlayerDistance / positive(segmentLength, t.segmentLength);
  const local = t.localPaceRadiusSegments;
  if (Math.abs(distanceSegments) <= local) return 0;
  const reach = Math.max(local + 1, t.fullPaceCorrectionSegments);
  const amount = smoothstep(clamp01((Math.abs(distanceSegments) - local) / (reach - local)));
  return distanceSegments > 0
    ? amount * t.catchUpLimit
    : -amount * t.slowDownLimit;
}

// Extrapolate only across the unspent portion of one fixed simulation step.
// This is deliberately presentation-only: collision, AI, timers, and scoring
// continue to consume position/x. Respawns and circulation set their physical
// position directly, so there is no interpolation path across a teleport.
export function updateRivalRenderPose(
  rival,
  residualSeconds,
  trackLength,
  laneRate = DEFAULT_RIVAL_TUNING.laneRate,
) {
  const residual = clamp(finite(residualSeconds, 0), 0, RIVAL_FIXED_STEP);
  rival.renderPosition = wrap(
    finite(rival.position, 0) + Math.max(0, finite(rival.speed, 0)) * residual,
    positive(trackLength, DEFAULT_RIVAL_TUNING.segmentLength * 100),
  );
  rival.renderX = clamp(
    finite(rival.x, 0) +
      clamp(finite(rival.steer, 0), -1, 1) *
      positive(laneRate, DEFAULT_RIVAL_TUNING.laneRate) * residual,
    -1.75,
    1.75,
  );
  return rival;
}

export function wrappedDelta(from, to, length) {
  const size = positive(length, 1);
  let delta = wrap(to, size) - wrap(from, size);
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function normalizeCirculation(config = {}) {
  const behindMinSegments = positive(
    config.behindMinSegments,
    DEFAULT_CIRCULATION.behindMinSegments,
  );
  const aheadMinSegments = positive(
    config.aheadMinSegments,
    DEFAULT_CIRCULATION.aheadMinSegments,
  );
  const reentryDelayMinSeconds = positive(
    config.reentryDelayMinSeconds,
    DEFAULT_CIRCULATION.reentryDelayMinSeconds,
  );
  const catchUpMinMultiplier = positive(
    config.catchUpMinMultiplier,
    DEFAULT_CIRCULATION.catchUpMinMultiplier,
  );
  const authoredLanes = Array.isArray(config.lanePattern)
    ? config.lanePattern
      .map((lane) => Number(lane))
      .filter(Number.isFinite)
      .map((lane) => clamp(lane, -0.85, 0.85))
    : [];
  return {
    enabled: !!config.enabled,
    behindMinSegments,
    behindMaxSegments: Math.max(
      behindMinSegments,
      positive(config.behindMaxSegments, DEFAULT_CIRCULATION.behindMaxSegments),
    ),
    aheadMinSegments,
    aheadMaxSegments: Math.max(
      aheadMinSegments,
      positive(config.aheadMaxSegments, DEFAULT_CIRCULATION.aheadMaxSegments),
    ),
    catchUpMinMultiplier,
    catchUpMaxMultiplier: Math.max(
      catchUpMinMultiplier,
      positive(config.catchUpMaxMultiplier, DEFAULT_CIRCULATION.catchUpMaxMultiplier),
    ),
    catchUpSeconds: positive(config.catchUpSeconds, DEFAULT_CIRCULATION.catchUpSeconds),
    pursuitStartSegments: positive(
      config.pursuitStartSegments,
      DEFAULT_CIRCULATION.pursuitStartSegments,
    ),
    pursuitMinMultiplier: positive(
      config.pursuitMinMultiplier,
      DEFAULT_CIRCULATION.pursuitMinMultiplier,
    ),
    pursuitMaxMultiplier: Math.max(
      positive(config.pursuitMinMultiplier, DEFAULT_CIRCULATION.pursuitMinMultiplier),
      positive(config.pursuitMaxMultiplier, DEFAULT_CIRCULATION.pursuitMaxMultiplier),
    ),
    reentryDelayMinSeconds,
    reentryDelayMaxSeconds: Math.max(
      reentryDelayMinSeconds,
      positive(
        config.reentryDelayMaxSeconds,
        DEFAULT_CIRCULATION.reentryDelayMaxSeconds,
      ),
    ),
    minimumReentryIntervalSeconds: positive(
      config.minimumReentryIntervalSeconds,
      DEFAULT_CIRCULATION.minimumReentryIntervalSeconds,
    ),
    minimumSpacingSegments: positive(
      config.minimumSpacingSegments,
      DEFAULT_CIRCULATION.minimumSpacingSegments,
    ),
    lanePattern: authoredLanes.length > 0
      ? authoredLanes
      : [...DEFAULT_CIRCULATION.lanePattern],
  };
}

function circulationValue(seed, id, sequence, salt, low, high) {
  const amount = positiveHash(seed, id, sequence, salt) / 0xffffffff;
  return low + (high - low) * amount;
}

function positiveHash(seed, id, sequence, salt) {
  let hash = (uintSeed(seed) ^ uintSeed(sequence) ^ uintSeed(salt)) >>> 0;
  const text = String(id);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function normalizeZone(zone) {
  const from = Number(zone?.from);
  const to = Number(zone?.to);
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
}

function moveToward(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return value;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function seededRandom(seed) {
  let state = uintSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function uintSeed(value) {
  const number = Number(value);
  return (Number.isFinite(number) ? number : 1) >>> 0;
}

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clampInteger(value, low, high) {
  const number = Number(value);
  return Math.round(clamp(Number.isFinite(number) ? number : low, low, high));
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function interpolatePlayerContext(target, previous = {}, current = {}, amount, trackLength) {
  const fromPosition = finite(previous.position, finite(current.position, 0));
  const toPosition = finite(current.position, fromPosition);
  const travel = forwardDistance(fromPosition, toPosition, trackLength);
  target.position = wrap(fromPosition + travel * amount, trackLength);
  target.x = lerp(finite(previous.x, current.x), finite(current.x, previous.x), amount);
  target.speed = lerp(
    finite(previous.speed, current.speed),
    finite(current.speed, previous.speed),
    amount,
  );
  target.airborne = amount < 1 ? !!previous.airborne : !!current.airborne;
  target.air = amount < 1 ? finite(previous.air, 0) : finite(current.air, 0);
  return target;
}

function copyPlayerContext(target, source = {}) {
  target.position = finite(source.position, 0);
  target.x = finite(source.x, 0);
  target.speed = finite(source.speed, 0);
  target.airborne = !!source.airborne;
  target.air = finite(source.air, 0);
  return target;
}

function copyRivalContext(target, source = {}) {
  target.generation = Math.max(1, Math.floor(finite(source.generation, 1)));
  target.position = finite(source.position, 0);
  target.x = finite(source.x, 0);
  target.speed = finite(source.speed, 0);
  target.airborne = !!source.airborne;
  target.air = finite(source.air, 0);
  target.state = source.state;
  target.attackSide = finite(source.attackSide, 0);
  target.contactCooldown = finite(source.contactCooldown, 0);
  target.stagingGrace = finite(source.stagingGrace, 0);
  target.active = !!source.active;
  target.eliminated = !!source.eliminated;
  return target;
}

function forwardDistance(from, to, length) {
  let distance = wrap(to, length) - wrap(from, length);
  if (distance < 0) distance += length;
  return distance;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function wrap(value, length) {
  return ((value % length) + length) % length;
}
