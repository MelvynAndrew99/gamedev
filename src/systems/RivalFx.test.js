import assert from 'node:assert/strict';
import test from 'node:test';

import { rivalFxSpec } from './RivalFx.js';

test('combat FX has a strict readable hierarchy and safe caps', () => {
  const rub = rivalFxSpec('rub');
  const slam = rivalFxSpec('slam');
  const takedown = rivalFxSpec('takedown', true);
  assert.ok(rub.particles < slam.particles);
  assert.ok(slam.particles < takedown.particles);
  assert.equal(rub.shake, 0);
  assert.equal(takedown.ghost, true);
  assert.ok(takedown.flash <= 0.12);
  assert.ok(takedown.particles <= 24);
});

test('unknown contact degrades safely to a quiet rub', () => {
  assert.deepEqual(rivalFxSpec('mystery'), rivalFxSpec('rub'));
});
