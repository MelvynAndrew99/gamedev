import assert from 'node:assert/strict';
import test from 'node:test';

import {
  achievementViews,
  createPlayerStatEvent,
  getPlayerProfile,
  HeldBoostAccumulator,
  sanitizePlayerProfile,
  submitPlayerStatEvent,
} from './PlayerStats.js';
import { createGameplayEvent } from './GameplayEvents.js';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('lifetime stats accept each stable event ID exactly once', () => {
  globalThis.localStorage = storage();
  const event = createPlayerStatEvent('run', 1, 'conesSmashed', 5, 1000);
  assert.equal(submitPlayerStatEvent(event).accepted, true);
  assert.equal(submitPlayerStatEvent(event).accepted, false);
  assert.equal(getPlayerProfile().totals.conesSmashed, 5);
});

test('corrupt and wrong-version profiles sanitize to finite nonnegative totals', () => {
  assert.equal(sanitizePlayerProfile(null).totals.airtimeSeconds, 0);
  assert.equal(sanitizePlayerProfile({ version: 99 }).totals.conesSmashed, 0);
  const profile = sanitizePlayerProfile({
    version: 1,
    totals: { conesSmashed: -4, airtimeSeconds: Infinity, rivalWins: 3 },
  });
  assert.equal(profile.totals.conesSmashed, 0);
  assert.equal(profile.totals.airtimeSeconds, 0);
  assert.equal(profile.totals.rivalWins, 3);
});

test('achievements unlock once with stable progress and earned timestamp', () => {
  globalThis.localStorage = storage();
  submitPlayerStatEvent(createPlayerStatEvent('run', 1, 'conesSmashed', 49, 1000));
  assert.equal(achievementViews().find((item) => item.id === 'cone-killer').earned, false);
  const result = submitPlayerStatEvent(
    createPlayerStatEvent('run', 2, 'conesSmashed', 1, 2000),
  );
  assert.deepEqual(result.unlocked, ['cone-killer']);
  const earned = achievementViews().find((item) => item.id === 'cone-killer');
  assert.equal(earned.earned, true);
  assert.equal(earned.earnedAt, 2000);
  submitPlayerStatEvent(createPlayerStatEvent('run', 3, 'conesSmashed', 20, 3000));
  assert.equal(
    achievementViews().find((item) => item.id === 'cone-killer').earnedAt,
    2000,
  );
});

test('invalid stats and amounts cannot mutate the profile', () => {
  globalThis.localStorage = storage();
  assert.equal(submitPlayerStatEvent(
    createPlayerStatEvent('run', 1, 'notAStat', 5),
  ).accepted, false);
  assert.equal(submitPlayerStatEvent(
    createPlayerStatEvent('run', 2, 'conesSmashed', -1),
  ).accepted, false);
  assert.equal(getPlayerProfile().totals.conesSmashed, 0);
});

test('stat dedupe survives more than 256 events and a storage reload', () => {
  globalThis.localStorage = storage();
  for (let sequence = 1; sequence <= 257; sequence++) {
    assert.equal(submitPlayerStatEvent(
      createPlayerStatEvent('longrun', sequence, 'conesSmashed', 1),
    ).accepted, true);
  }
  assert.equal(getPlayerProfile().totals.conesSmashed, 257);
  assert.equal(submitPlayerStatEvent(
    createPlayerStatEvent('longrun', 1, 'conesSmashed', 1),
  ).accepted, false);
  assert.equal(getPlayerProfile().totals.conesSmashed, 257);
});

test('legacy processed IDs migrate to ranges and opponent stats are rejected', () => {
  globalThis.localStorage = storage({
    'rhythmic-ride.player-stats.v1': JSON.stringify({
      version: 1,
      totals: { conesSmashed: 1 },
      processedEventIds: ['oldrun:stat:1'],
    }),
  });
  assert.equal(submitPlayerStatEvent(
    createPlayerStatEvent('oldrun', 1, 'conesSmashed', 5),
  ).accepted, false);
  const opponentEvent = createGameplayEvent({
    eventId: 'opponent:stat:1',
    type: 'stat_increment',
    source: 'opponent',
    target: 'local',
    payload: { stat: 'conesSmashed', amount: 10 },
  });
  assert.equal(submitPlayerStatEvent(opponentEvent).accepted, false);
  assert.equal(getPlayerProfile().totals.conesSmashed, 1);
});

test('collision breaks the lifetime Long Burn segment', () => {
  for (const hz of [30, 60, 120]) {
    const hold = new HeldBoostAccumulator(1.05);
    for (let frame = 0; frame < Math.floor(0.8 * hz); frame++) {
      assert.equal(hold.update(1 / hz, true).longBurn, false);
    }
    const beforeCrash = hold.breakSegment();
    assert.ok(beforeCrash.completedSeconds < 1.05);
    for (let frame = 0; frame < Math.floor(0.4 * hz); frame++) {
      assert.equal(hold.update(1 / hz, true).longBurn, false);
    }
  }
});
