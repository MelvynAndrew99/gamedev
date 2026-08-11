import assert from 'node:assert/strict';
import test from 'node:test';

import { TimedElimination } from './TimedElimination.js';

test('clock spends only while the event is running and expires once', () => {
  const state = new TimedElimination({ initialSeconds: 5 }, ['a', 'b', 'c']);
  assert.equal(state.update(2, false), null);
  assert.equal(state.remainingSeconds, 5);
  assert.equal(state.update(4.9, true), null);
  assert.equal(state.update(0.1, true), 'expired');
  assert.equal(state.update(1, true), null);
  assert.equal(state.remainingSeconds, 0);
  assert.equal(state.elapsedSeconds, 5);
});

test('lap and cone bonuses are explicit and capped', () => {
  const state = new TimedElimination({
    initialSeconds: 10,
    maximumSeconds: 20,
    lapBonusSeconds: 8,
    coneBonusSeconds: 3,
  }, ['a']);
  state.update(5);
  assert.equal(state.elapsedSeconds, 5, 'bonuses never rewrite mastery time');
  assert.deepEqual(state.addConeBonus(), { reason: 'cone', awarded: 3 });
  assert.deepEqual(state.addLapBonus(), { reason: 'lap', awarded: 8 });
  assert.deepEqual(state.addLapBonus(), { reason: 'lap', awarded: 4 });
  assert.equal(state.remainingSeconds, 20);
  assert.equal(state.totalTimeAdded, 15);
});

test('five stable rival IDs can be eliminated exactly once', () => {
  const state = new TimedElimination({}, ['cyan', 'magenta', 'gold', 'green', 'violet']);
  assert.equal(state.eliminate('cyan'), true);
  assert.equal(state.eliminate('cyan'), false);
  assert.equal(state.carsRemaining, 4);
  assert.equal(state.eliminate('unknown'), false);
  assert.equal(state.eliminate('magenta'), true);
  assert.equal(state.eliminate('gold'), true);
  assert.equal(state.eliminate('green'), true);
  assert.equal(state.eliminate('violet'), true);
  assert.equal(state.complete, true);
  assert.equal(state.carsRemaining, 0);
  assert.deepEqual(state.addLapBonus(), { reason: 'lap', awarded: 0 });
});

test('expiry time is exact and rate-independent at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const state = new TimedElimination({ initialSeconds: 35 }, ['a']);
    while (!state.expired) state.update(1 / hz, true);
    return {
      elapsed: Number(state.elapsedSeconds.toFixed(9)),
      remaining: state.remainingSeconds,
    };
  };
  assert.deepEqual(simulate(30), { elapsed: 35, remaining: 0 });
  assert.deepEqual(simulate(60), simulate(30));
  assert.deepEqual(simulate(120), simulate(30));
});
