import assert from 'node:assert/strict';
import test from 'node:test';

import {
  QualifierClock,
  RivalRaceOrder,
  objectivesForStoryPhase,
  remainingStoryOpponents,
} from './StoryEventState.js';

test('Story opponent counter starts at the finite field and reaches zero', () => {
  assert.equal(remainingStoryOpponents(3, 0), 3);
  assert.equal(remainingStoryOpponents(3, 1), 2);
  assert.equal(remainingStoryOpponents(3, 3), 0);
  assert.equal(remainingStoryOpponents(3, 9), 0);
});

test('qualifier clock starts explicitly and expires at its authored target', () => {
  const clock = new QualifierClock(60);
  assert.equal(clock.update(20), null);
  clock.start();
  assert.equal(clock.update(59.5), null);
  assert.equal(clock.update(0.5), 'expired');
  assert.equal(clock.remainingSeconds, 0);
});

test('rival order records finite finish crossings and ignores wrecked cars', () => {
  const rivals = [
    { id: 'a', position: 90 },
    { id: 'b', position: 90 },
  ];
  const order = new RivalRaceOrder({ trackLength: 100, laps: 1, rivals });
  assert.deepEqual(order.update([
    { id: 'a', position: 5 },
    { id: 'b', position: 5, state: 'wrecked' },
  ]), ['a']);
  assert.deepEqual(order.update([{ id: 'a', position: 10 }]), []);
  assert.deepEqual(order.finishOrder, ['a']);
  assert.equal(order.playerPlace(), 2);
});

test('live race order treats the rolling grid as behind the rivals until start', () => {
  const rivals = [{ id: 'a', position: 10 }];
  const order = new RivalRaceOrder({ trackLength: 100, laps: 1, rivals });
  assert.equal(order.livePlace(95, 0, rivals, false), 2);
  assert.equal(order.livePlace(5, 0, rivals, true), 2);
});

test('same-frame rival finishes use interpolated crossing time, not array order', () => {
  const rivals = [
    { id: 'later', position: 80 },
    { id: 'earlier', position: 95 },
  ];
  const order = new RivalRaceOrder({ trackLength: 100, laps: 1, rivals });
  assert.deepEqual(order.update([
    // later crosses 20/25ths through the frame; earlier crosses 5/15ths.
    { id: 'later', position: 5 },
    { id: 'earlier', position: 10 },
  ]), ['earlier', 'later']);
  assert.deepEqual(order.finishOrder, ['earlier', 'later']);
  assert.equal(order.playerPlace(0.2), 1, 'player crossed before both rivals');
  assert.equal(order.playerPlace(0.5), 2, 'only the earlier rival crossed first');
  assert.equal(order.playerPlace(0.9), 3, 'both rivals crossed first');
});

test('qualifier hides rival-only objectives while Rival Race keeps them', () => {
  const objectives = [
    { id: 'cones', event: 'cone_hit' },
    { id: 'rivals', event: 'rival_takedown' },
    { id: 'finish', type: 'complete_laps', value: 1 },
  ];
  assert.deepEqual(
    objectivesForStoryPhase(objectives, 'qualifier').map((objective) => objective.id),
    ['cones', 'finish'],
  );
  const rivalObjectives = objectivesForStoryPhase(objectives, 'rivals', 3);
  assert.deepEqual(rivalObjectives.map((objective) => objective.id), ['cones', 'rivals', 'finish']);
  assert.equal(rivalObjectives.at(-1).value, 3);
});
