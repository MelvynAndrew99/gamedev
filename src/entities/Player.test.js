import assert from 'node:assert/strict';
import test from 'node:test';

import { OBSTACLES } from '../config/obstacles.js';
import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { checkObstacleHit } from '../systems/Collision.js';
import trainingHazardWeave from '../tracks/training-hazard-weave.json' with { type: 'json' };
import trainingAirtime from '../tracks/training-airtime.json' with { type: 'json' };
import trainingFlight from '../tracks/training-flight.json' with { type: 'json' };
import { Player } from './Player.js';

function drive(piece, controls, { startX = 0, speed = 0.9 } = {}) {
  const authored = new RoadModel(TUNING);
  piece(authored);
  const distance = authored.trackLength;
  // Prevent Player's normal lap wrap while retaining the exact authored
  // segment curves and surfaces under the car.
  const model = {
    trackLength: 1_000_000_000,
    findSegment(z) {
      const index = Math.max(0, Math.min(
        authored.segments.length - 1,
        Math.floor((z - TUNING.playerZ) / TUNING.segmentLength),
      ));
      return authored.segments[index];
    },
  };
  const player = new Player(TUNING);
  player.x = startX;
  player.speed = TUNING.maxSpeed * speed;
  let minimumX = startX;
  let maximumX = startX;

  while (player.position < distance) {
    const segment = model.findSegment(player.position + TUNING.playerZ);
    const direction = Math.sign(segment.curve);
    const input = controls(direction, player);
    player.update(1 / 60, {
      steer: 0,
      throttle: 1,
      brake: 0,
      airbrakeL: false,
      airbrakeR: false,
      nitro: false,
      ...input,
    }, model);
    minimumX = Math.min(minimumX, player.x);
    maximumX = Math.max(maximumX, player.x);
  }
  return { minimumX, maximumX };
}

// A stronger adversary than simply holding a direction: this driver waits on
// the advantageous lane and adds ordinary steering only when the curve starts
// taking that lane away.
const optimizedStick = (direction, player) => {
  const target = direction > 0 ? 0.8 : -0.9;
  const correcting = direction > 0 ? player.x < target : player.x > target;
  return { steer: correcting ? direction : 0 };
};

const steerWithShoulder = (direction, player) => {
  const target = direction > 0 ? 0.5 : -0.5;
  const correcting = direction > 0 ? player.x < target : player.x > target;
  return {
    steer: correcting ? direction : 0,
    airbrakeL: correcting && direction < 0,
    airbrakeR: correcting && direction > 0,
  };
};

const holdRightLaneWithLeftShoulder = (_direction, player) => {
  // Aim slightly inside the cone center so the shoulder input counters the
  // hairpin's outward push instead of crossing the road to chase each cone.
  const correcting = player.x > 0.44;
  return {
    steer: correcting ? -1 : 0,
    airbrakeL: correcting,
  };
};

test('Cone Control diagnostic defeats the right-lane stick-only bypass', () => {
  const piece = (road) => road.addCurve(32, 8);
  for (const startX of [0.5, 0.65, 0.85]) {
    for (const speed of [0.8, 1]) {
      const stickOnly = drive(piece, optimizedStick, { startX, speed });
      const withShoulder = drive(piece, steerWithShoulder, { startX, speed });
      assert.ok(
        stickOnly.minimumX < -1,
        `stick-only should fail from x=${startX} at ${speed * 100}% speed`,
      );
      assert.ok(
        withShoulder.minimumX > -1 && withShoulder.maximumX < 1,
        `steering plus R1/X should pass from x=${startX} at ${speed * 100}% speed`,
      );
    }
  }
});

function flatModel() {
  const seg = { curve: 0, surface: 'road', p1: { world: { y: 0 } }, p2: { world: { y: 0 } } };
  return { trackLength: 1e9, findSegment: () => seg };
}

const NEUTRAL_INPUT = {
  steer: 0, glide: 0, throttle: 0, brake: 0,
  airbrakeL: false, airbrakeR: false, nitro: false,
};

function completeJump({
  speed = 1,
  glide = 0,
  boosted = false,
  liftMultiplier = 1,
} = {}) {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed * speed;
  player.launch({ boosted, liftMultiplier });
  let landingEvents = 0;
  for (let frame = 0; frame < 300 && (player.airborne || frame === 0); frame++) {
    player.update(1 / 120, { ...NEUTRAL_INPUT, glide }, flatModel());
    if (player.justLanded) landingEvents++;
  }
  return { player, landingEvents };
}

test('airtime is measured once and nose pitch changes a bounded jump length', () => {
  const short = completeJump({ glide: -1 });
  const neutral = completeJump();
  const long = completeJump({ glide: 1 });

  assert.ok(short.player.lastAirtime < neutral.player.lastAirtime);
  assert.ok(neutral.player.lastAirtime < long.player.lastAirtime);
  assert.ok(long.player.lastAirtime < 2, 'full pull-back must remain a finite glide');
  assert.equal(long.landingEvents, 1);
  assert.equal(long.player.totalAirtime, long.player.lastAirtime);
  assert.equal(long.player.bestAirtime, long.player.lastAirtime);
  assert.equal(long.player.glide, 0, 'landing resets the flight control state');
});

test('a live boost at ramp contact adds lift beyond its speed benefit', () => {
  const normal = completeJump({ speed: 1.15, glide: 1 });
  const boosted = completeJump({ speed: 1.15, glide: 1, boosted: true });
  assert.ok(boosted.player.lastAirtime > normal.player.lastAirtime + 0.2);
  assert.equal(boosted.player.boostedLaunch, true);
  assert.equal(boosted.player.launchSpeed, TUNING.maxSpeed * 1.15);
});

function attemptTrainingGap({ speed, boosted, glide }) {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingAirtime);
  const player = new Player(TUNING);
  const {
    rampSegment,
    rockEndSegment,
    requiredSpeedMultiplier,
  } = trainingAirtime.airtimeTraining.gap;
  player.position = rampSegment * TUNING.segmentLength - TUNING.playerZ;
  player.x = -0.66;
  player.speed = TUNING.maxSpeed * speed;
  player.launch({ boosted });
  let landedAt = null;
  let rockHit = null;

  for (let frame = 0; frame < 400; frame++) {
    const previous = { position: player.position, x: player.x };
    player.update(1 / 120, {
      ...NEUTRAL_INPUT,
      throttle: 1,
      glide,
      boostActive: boosted,
      boostCeiling: boosted ? TUNING.boostTierCeilings[0] : undefined,
    }, model);
    const segment = model.findSegment(player.position + TUNING.playerZ).index;
    if (player.justLanded) {
      landedAt = segment;
      // GameScene latches this at ramp contact and makes the authoritative
      // clear before the landing-frame collision sweep reaches the last row.
      const ready = boosted && speed >= requiredSpeedMultiplier;
      if (ready && landedAt > rockEndSegment) break;
    }
    if (!player.airborne) {
      const contact = checkObstacleHit(player, model, TUNING, previous);
      if (contact?.trackObjectId?.startsWith('air-gap-rock-')) {
        rockHit = contact.trackObjectId;
        break;
      }
    }
    if (landedAt != null && segment > rockEndSegment + 3) break;
  }
  return { landedAt, rockHit };
}

test('Air School rock rows require boosted speed and a long glide', () => {
  const ordinary = attemptTrainingGap({ speed: 1, boosted: false, glide: 1 });
  const boostedTooSlow = attemptTrainingGap({ speed: 0.9, boosted: true, glide: 1 });
  const justUnderSpeed = attemptTrainingGap({ speed: 1.125, boosted: true, glide: 1 });
  const boundaryMiss = attemptTrainingGap({ speed: 1.149, boosted: true, glide: 1 });
  const noseDown = attemptTrainingGap({ speed: 1.15, boosted: true, glide: 0 });
  const mastery = attemptTrainingGap({ speed: 1.15, boosted: true, glide: 1 });
  const end = trainingAirtime.airtimeTraining.gap.rockEndSegment;

  assert.match(ordinary.rockHit, /^air-gap-rock-/);
  assert.ok(boostedTooSlow.landedAt <= end);
  assert.ok(justUnderSpeed.landedAt <= end);
  assert.ok(boundaryMiss.landedAt > end, 'distance alone can cross the last row');
  assert.match(boundaryMiss.rockHit, /^air-gap-rock-/,
    'an unarmed boundary crossing remains a miss at collision resolution');
  assert.ok(noseDown.landedAt <= end);
  assert.equal(mastery.rockHit, null);
  assert.ok(mastery.landedAt > end);
});

function attemptPrecisionPickup(glide) {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingAirtime);
  const player = new Player(TUNING);
  player.position = 438 * TUNING.segmentLength - TUNING.playerZ;
  player.x = -0.66;
  player.speed = TUNING.maxSpeed;
  player.launch();
  let landedAt = null;
  let collected = false;

  for (let frame = 0; frame < 240; frame++) {
    const previous = { position: player.position, x: player.x };
    player.update(1 / 120, {
      ...NEUTRAL_INPUT, throttle: 1, glide,
    }, model);
    const segment = model.findSegment(player.position + TUNING.playerZ).index;
    if (player.justLanded) landedAt = segment;
    if (!player.airborne) {
      const contact = checkObstacleHit(player, model, TUNING, previous);
      if (contact?.trackObjectId === 'air-boost-1') {
        collected = true;
        break;
      }
    }
    if (segment > 500) break;
  }
  return { landedAt, collected };
}

test('Air School teaches nose-down precision by placing boost after the short landing', () => {
  const short = attemptPrecisionPickup(-1);
  const neutral = attemptPrecisionPickup(0);
  assert.equal(short.landedAt, 478);
  assert.equal(short.collected, true);
  assert.ok(neutral.landedAt > 480);
  assert.equal(neutral.collected, false);
});

test('Flight School course lift extends the same finite controllable jump physics', () => {
  const normal = completeJump({ speed: 1, glide: 0 });
  const lifted = completeJump({
    speed: 1,
    glide: 0,
    liftMultiplier: trainingFlight.flightTraining.liftMultiplier,
  });
  assert.ok(lifted.player.lastAirtime > normal.player.lastAirtime * 2);
  assert.ok(lifted.player.lastAirtime < normal.player.lastAirtime * 3);
  assert.equal(lifted.player.airborne, false, 'course lift must still land');
});

test('boost() gives a capped activation kick instead of teleporting to redline', () => {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed * 0.5;
  player.boost(TUNING.boostTierCeilings[2]);
  assert.equal(player.speed, TUNING.maxSpeed * 0.5 + TUNING.boostKick);
  assert.ok(player.speed < TUNING.maxSpeed * TUNING.boostTierCeilings[2]);
});

test('boost() never lowers speed that is already above the target tier', () => {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed * 2.5;
  player.boost(TUNING.boostTierCeilings[0]);
  assert.equal(player.speed, TUNING.maxSpeed * 2.5);
});

test('update() clamps to overspeedCap without an active boost ceiling', () => {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed * 3;
  player.update(1 / 60, NEUTRAL_INPUT, flatModel());
  assert.equal(player.speed, TUNING.maxSpeed * TUNING.overspeedCap);
});

test('update() honors an elevated input.boostCeiling above overspeedCap', () => {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed * 3;
  player.update(1 / 60, { ...NEUTRAL_INPUT, boostCeiling: 3 }, flatModel());
  assert.ok(
    player.speed > TUNING.maxSpeed * TUNING.overspeedCap,
    'an active boost ceiling should let speed sit above the normal overspeed cap',
  );
});

test('an active boost supplies sustained thrust and holds its overspeed', () => {
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed;
  const ceiling = TUNING.boostTierCeilings[0];

  for (let i = 0; i < 60; i++) {
    player.update(1 / 60, {
      ...NEUTRAL_INPUT,
      boostActive: true,
      boostCeiling: ceiling,
    }, flatModel());
  }

  assert.equal(player.speed, TUNING.maxSpeed * ceiling);
});

test('Cone Control final hairpin requires steering plus the matching shoulder', () => {
  const piece = (road) => road.addCurve(28, -8);
  for (const startX of [0.44, 0.58]) {
    for (const speed of [0.8, 1]) {
      const stickOnly = drive(piece, optimizedStick, { startX, speed });
      const withShoulder = drive(
        piece,
        holdRightLaneWithLeftShoulder,
        { startX, speed },
      );
      const coneCenter = 0.57;
      const collisionHalfWidth = TUNING.playerW + OBSTACLES.cone.w;
      assert.ok(
        stickOnly.maximumX > 1,
        `stick-only should fail from x=${startX} at ${speed * 100}% speed`,
      );
      assert.ok(
        withShoulder.minimumX > coneCenter - collisionHalfWidth &&
          withShoulder.maximumX < coneCenter + collisionHalfWidth,
        `left steering plus L1/Z should hold every right-lane cone from x=${startX} at ${speed * 100}% speed`,
      );
    }
  }
});

function driveHazardMasterySector({ from, to, startX, controls }) {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingHazardWeave);
  const player = new Player(TUNING);
  player.position = from * TUNING.segmentLength - TUNING.playerZ;
  player.x = startX;
  player.speed = TUNING.maxSpeed;
  const contacts = [];

  while (model.findSegment(player.position + TUNING.playerZ).index <= to) {
    const previous = { position: player.position, x: player.x };
    player.update(1 / 60, {
      ...NEUTRAL_INPUT,
      throttle: 1,
      ...controls(player),
    }, model);
    const contact = checkObstacleHit(player, model, TUNING, previous);
    if (contact) contacts.push(contact.trackObjectId);
  }
  return { contacts, endX: player.x };
}

test('Hazard Weave +8 exit rewards the learned right-airbrake line', () => {
  const { contacts } = driveHazardMasterySector({
    from: 858,
    to: 953,
    startX: 0.6,
    controls(player) {
      const correcting = player.x < 0.5;
      return { steer: correcting ? 1 : 0, airbrakeR: correcting };
    },
  });

  assert.deepEqual(contacts, ['mastery-05']);
});

test('Hazard Weave airbrake mastery cones are missed with ordinary steering alone', () => {
  const rightBend = driveHazardMasterySector({
    from: 858,
    to: 953,
    startX: 0.6,
    controls(player) {
      return { steer: player.x < 0.5 ? 1 : 0 };
    },
  });
  const leftBend = driveHazardMasterySector({
    from: 1194,
    to: 1279,
    startX: 0.58,
    controls(player) {
      return { steer: player.x > 0.44 ? -1 : 0 };
    },
  });

  assert.deepEqual(rightBend.contacts, []);
  assert.deepEqual(leftBend.contacts, []);
});

test('Hazard Weave follows the -8 mastery line into a right-to-center corridor', () => {
  const { contacts, endX } = driveHazardMasterySector({
    from: 1194,
    to: 1362,
    startX: 0.58,
    controls(player) {
      const segment = Math.floor(
        (player.position + TUNING.playerZ) / TUNING.segmentLength,
      );
      if (segment < 1278) {
        const correcting = player.x > 0.44;
        return { steer: correcting ? -1 : 0, airbrakeL: correcting };
      }
      const target = segment < 1298
        ? 0.36
        : Math.max(0, 0.36 * (1359 - segment) / (1359 - 1298));
      return {
        steer: player.x > target + 0.025 ? -1 : player.x < target - 0.025 ? 1 : 0,
      };
    },
  });

  assert.deepEqual(contacts, ['mastery-06']);
  assert.ok(Math.abs(endX) <= 0.05, `corridor should settle at center, got ${endX}`);
});

test('Hazard Weave full mastery flow collects six cones and no rocks at max speed', () => {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingHazardWeave);
  const player = new Player(TUNING);
  player.position = 40 * TUNING.segmentLength - TUNING.playerZ;
  player.speed = TUNING.maxSpeed;
  const goals = [
    [95, 0.62], [122, 0], [161, -0.62], [235, 0.62], [266, 0],
    [318, -0.62], [413, 0.62], [458, 0], [512, -0.62],
    [683, 0.62], [712, 0], [754, -0.62], [951, 0.5], [972, 0.62],
    [1046, -0.62], [1112, 0.62], [1182, 0.62], [1278, 0.46], [1362, 0],
  ];
  let goalIndex = 0;
  const contacts = [];

  while (model.findSegment(player.position + TUNING.playerZ).index <= 1362) {
    const segment = model.findSegment(player.position + TUNING.playerZ).index;
    while (goalIndex < goals.length - 1 && segment > goals[goalIndex][0]) goalIndex++;
    let target = goals[goalIndex][1];
    if (segment >= 1298) {
      target = Math.max(0, 0.36 * (1359 - segment) / (1359 - 1298));
    }
    const steer = player.x < target - 0.025 ? 1 : player.x > target + 0.025 ? -1 : 0;
    const previous = { position: player.position, x: player.x };
    player.update(1 / 60, {
      ...NEUTRAL_INPUT,
      throttle: 1,
      steer,
      airbrakeR: segment >= 858 && segment <= 953 && steer > 0,
      airbrakeL: segment >= 1194 && segment <= 1278 && steer < 0,
    }, model);
    const contact = checkObstacleHit(player, model, TUNING, previous);
    if (contact) contacts.push(contact.trackObjectId);
  }

  assert.deepEqual(contacts, [
    'mastery-01', 'mastery-02', 'mastery-03',
    'mastery-04', 'mastery-05', 'mastery-06',
  ]);
  assert.ok(Math.abs(player.x) <= 0.05);
});
