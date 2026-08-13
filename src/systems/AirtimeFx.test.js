import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRTIME_COLORS,
  airtimePitchPose,
  airtimeFxFrame,
  airtimeTier,
  carSpriteFrame,
  chaseSteerFrame,
  landingFxColor,
  landingFxStrength,
  nextAirtimePitch,
  nextGlideMode,
  shouldTriggerApex,
} from './AirtimeFx.js';

test('airtime pitch eases toward stick input and returns smoothly on landing', () => {
  const noseUp = nextAirtimePitch(0, { airborne: true, glide: 1, dt: 1 / 60 });
  const noseDown = nextAirtimePitch(0, { airborne: true, glide: -1, dt: 1 / 60 });
  assert.ok(noseUp > 0 && noseUp < 1);
  assert.ok(noseDown < 0 && noseDown > -1);
  assert.equal(noseUp, -noseDown);

  const returning = nextAirtimePitch(0.8, { airborne: false, glide: 1, dt: 1 / 60 });
  assert.ok(returning > 0 && returning < 0.8);
  assert.equal(nextAirtimePitch(0.01, { airborne: false, dt: 0.1 }), 0);
});

test('pitch policy selects authored nose rows without changing steering bucket', () => {
  assert.equal(airtimePitchPose(-0.19), 'neutral');
  assert.equal(airtimePitchPose(-0.2), 'down');
  assert.equal(airtimePitchPose(0.2), 'up');

  // The runtime view is flipped vertically from the source-sheet naming:
  // pushing the nose down must show the lower-row silhouette on screen.
  assert.equal(carSpriteFrame(0, -1), 10);
  assert.equal(carSpriteFrame(4, -1), 14);
  assert.equal(carSpriteFrame(2, 0), 7);
  assert.equal(carSpriteFrame(0, 1), 0);
  assert.equal(carSpriteFrame(4, 1), 4);
  assert.equal(carSpriteFrame(99, 0), 9);
});

test('rear chase steering mirrors the authored viewpoint so movement and pose agree', () => {
  assert.equal(chaseSteerFrame(-1), 4);
  assert.equal(chaseSteerFrame(-0.4), 3);
  assert.equal(chaseSteerFrame(0), 2);
  assert.equal(chaseSteerFrame(0.4), 1);
  assert.equal(chaseSteerFrame(1), 0);
});

test('glide silhouette uses hysteresis instead of flickering around neutral', () => {
  assert.equal(nextGlideMode('neutral', -0.24), 'neutral');
  assert.equal(nextGlideMode('neutral', -0.25), 'short');
  assert.equal(nextGlideMode('short', -0.13), 'short');
  assert.equal(nextGlideMode('short', -0.11), 'neutral');
  assert.equal(nextGlideMode('neutral', 0.25), 'long');
  assert.equal(nextGlideMode('long', 0.13), 'long');
  assert.equal(nextGlideMode('long', 0.11), 'neutral');
});

test('hangtime tiers cross once at the authored training beats', () => {
  assert.deepEqual(airtimeTier(0.49), { level: 0, id: 'launch' });
  assert.deepEqual(airtimeTier(0.5), { level: 1, id: 'hop' });
  assert.deepEqual(airtimeTier(0.85), { level: 2, id: 'flow' });
  assert.deepEqual(airtimeTier(1.15), { level: 3, id: 'soar' });
});

test('apex highlight is a one-shot latch near the middle of the arc', () => {
  assert.equal(shouldTriggerApex({ airborne: true, arc: 0.96 }), false);
  assert.equal(shouldTriggerApex({ airborne: true, arc: 0.98 }), true);
  assert.equal(shouldTriggerApex({ airborne: true, arc: 1, latched: true }), false);
  assert.equal(shouldTriggerApex({ airborne: false, arc: 1 }), false);
});

test('short and long flight have distinct silhouette, color, and trail length', () => {
  const short = airtimeFxFrame({
    airborne: true, arc: 0.7, glideMode: 'short', speedRatio: 1,
  });
  const long = airtimeFxFrame({
    airborne: true, arc: 0.7, glideMode: 'long', speedRatio: 1,
  });
  assert.equal(short.color, AIRTIME_COLORS.short);
  assert.equal(long.color, AIRTIME_COLORS.long);
  assert.ok(short.scaleY > long.scaleY);
  assert.ok(long.scaleX > short.scaleX);
  assert.ok(long.trailLength > short.trailLength);
});

test('boost flight intensifies trails and takeoff/landing preserve squash and kick', () => {
  const normal = airtimeFxFrame({ airborne: true, arc: 0.5, speedRatio: 1 });
  const boosted = airtimeFxFrame({
    airborne: true, arc: 0.5, speedRatio: 1, boosted: true,
  });
  assert.ok(boosted.trailIntensity > normal.trailIntensity);
  assert.ok(boosted.trailLength > normal.trailLength);

  const compressed = airtimeFxFrame({ airborne: true, takeoff: 1 });
  assert.ok(compressed.scaleX > compressed.scaleY);
  const landed = airtimeFxFrame({ landing: 1, landingStrength: 1 });
  assert.ok(landed.scaleX > 1);
  assert.ok(landed.scaleY < 1);
});

test('landing intensity scales with flight and mastery but stays bounded', () => {
  const hop = landingFxStrength({ airtime: 0.4, launchSpeed: 6000, maxSpeed: 12000 });
  const mastery = landingFxStrength({
    airtime: 1.3, launchSpeed: 18000, maxSpeed: 12000, mastery: true,
  });
  assert.ok(mastery > hop);
  assert.equal(mastery, 1.25);
});

test('landing color preserves final control while mastery remains dominant', () => {
  assert.equal(landingFxColor({ glideMode: 'long' }), AIRTIME_COLORS.long);
  assert.equal(landingFxColor({ glideMode: 'short' }), AIRTIME_COLORS.short);
  assert.equal(
    landingFxColor({ mastery: true, miss: true, glideMode: 'short' }),
    AIRTIME_COLORS.mastery,
  );
});
