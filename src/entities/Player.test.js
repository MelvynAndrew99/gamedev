import assert from 'node:assert/strict';
import test from 'node:test';

import { OBSTACLES } from '../config/obstacles.js';
import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { checkObstacleHit } from '../systems/Collision.js';
import trainingHazardWeave from '../tracks/training-hazard-weave.json' with { type: 'json' };
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
  steer: 0, throttle: 0, brake: 0, airbrakeL: false, airbrakeR: false, nitro: false,
};

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
  return contacts;
}

test('Hazard Weave +8 exit rewards the learned right-airbrake line', () => {
  const contacts = driveHazardMasterySector({
    from: 858,
    to: 970,
    startX: 0.6,
    controls(player) {
      const correcting = player.x < 0.5;
      return { steer: correcting ? 1 : 0, airbrakeR: correcting };
    },
  });

  assert.deepEqual(contacts, ['mastery-05']);
});

test('Hazard Weave leaves time to recenter from the -8 hold into the rock corridor', () => {
  const contacts = driveHazardMasterySector({
    from: 1194,
    to: 1360,
    startX: 0.58,
    controls(player) {
      const segment = Math.floor(
        (player.position + TUNING.playerZ) / TUNING.segmentLength,
      );
      if (segment < 1278) {
        const correcting = player.x > 0.44;
        return { steer: correcting ? -1 : 0, airbrakeL: correcting };
      }
      return {
        steer: player.x > 0.04 ? -1 : player.x < -0.04 ? 1 : 0,
      };
    },
  });

  assert.deepEqual(contacts, ['mastery-06']);
});
