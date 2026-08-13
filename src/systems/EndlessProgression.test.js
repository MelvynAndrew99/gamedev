import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENDLESS_SPEED_LINE_TIERS,
  endlessDifficultyForDistance,
  endlessSpeedLineTier,
  endlessStageForDistance,
} from './EndlessProgression.js';

test('Endless advances through the three campaign environments at course-length boundaries', () => {
  assert.equal(endlessStageForDistance(0).id, 'proving-ground');
  assert.equal(endlessStageForDistance(6499).id, 'proving-ground');
  assert.equal(endlessStageForDistance(6500).id, 'neon-gulch');
  assert.equal(endlessStageForDistance(13499).id, 'neon-gulch');
  assert.equal(endlessStageForDistance(13500).id, 'syndicate-run');
});

test('Endless pressure grows monotonically across and within level transitions', () => {
  const samples = [0, 3000, 6499, 6500, 10000, 13499, 13500, 17000, 20500, 50000]
    .map(endlessDifficultyForDistance);
  assert.ok(samples.every((value) => value >= 0 && value <= 1));
  assert.ok(samples.slice(1).every((value, index) => value >= samples[index]));
  assert.equal(samples.at(-1), 1);
});

test('speed-line announcer escalates at authored thresholds and every five beyond maximum', () => {
  assert.deepEqual(
    ENDLESS_SPEED_LINE_TIERS.map(({ count }) => count),
    [3, 5, 7, 10, 15],
  );
  assert.equal(endlessSpeedLineTier(2), null);
  assert.equal(endlessSpeedLineTier(3).title, 'SPEED DEMON!');
  assert.equal(endlessSpeedLineTier(10).title, 'UNSTOPPABLE!');
  assert.equal(endlessSpeedLineTier(16), null);
  assert.equal(endlessSpeedLineTier(20).title, 'MAXIMUM VELOCITY!');
});
