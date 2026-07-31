import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
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

test('Cone Control final hairpin requires steering plus the matching shoulder', () => {
  const piece = (road) => road.addCurve(28, -8);
  for (const startX of [0.44, 0.58]) {
    for (const speed of [0.8, 1]) {
      const stickOnly = drive(piece, optimizedStick, { startX, speed });
      const withShoulder = drive(piece, steerWithShoulder, { startX, speed });
      assert.ok(
        stickOnly.maximumX > 1,
        `stick-only should fail from x=${startX} at ${speed * 100}% speed`,
      );
      assert.ok(
        withShoulder.minimumX > -1 && withShoulder.maximumX < 1,
        `left steering plus L1/Z should pass from x=${startX} at ${speed * 100}% speed`,
      );
    }
  }
});
