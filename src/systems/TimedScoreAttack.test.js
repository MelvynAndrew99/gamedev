import assert from 'node:assert/strict';
import test from 'node:test';

import { TimedScoreAttack } from './TimedScoreAttack.js';

test('fixed score clock starts explicitly and expires at exactly 35 seconds', () => {
  const state = new TimedScoreAttack({ durationSeconds: 35 });
  assert.equal(state.update(10, false), null);
  assert.equal(state.remainingSeconds, 35);
  state.start(12.5);
  assert.equal(state.update(47.499, true), null);
  assert.equal(state.update(47.5, true), 'expired');
  assert.equal(state.elapsedSeconds, 35);
  assert.equal(state.remainingSeconds, 0);
});

test('one stable rival slot scores once per generation', () => {
  const state = new TimedScoreAttack({ durationSeconds: 35 });
  state.start(0);
  assert.equal(state.recordTakedown('cyan', 1, 4), true);
  assert.equal(state.recordTakedown('cyan', 1, 4.1), false);
  assert.equal(state.recordTakedown('cyan', 2, 8), true);
  assert.equal(state.recordTakedown('magenta', 1, 10), true);
  assert.equal(state.takedowns, 3);
});

test('the deadline counts equality but rejects a later fixed step', () => {
  const state = new TimedScoreAttack({ durationSeconds: 35 });
  state.start(5);
  assert.equal(state.recordTakedown('gold', 1, 40), true);
  assert.equal(state.recordTakedown('gold', 2, 40 + 1 / 60), false);
});

test('six clock cones extend the run by two seconds each without exceeding the cap', () => {
  const state = new TimedScoreAttack({
    durationSeconds: 35,
    maximumBonusSeconds: 12,
  });
  state.start(10);
  state.update(20, true);
  for (let index = 0; index < 7; index++) {
    const bonus = state.addTime(2, 20 + index / 60);
    assert.equal(bonus.awarded, index < 6 ? 2 : 0);
  }
  assert.equal(state.bonusSeconds, 12);
  assert.equal(state.totalDurationSeconds, 47);
  assert.equal(state.view.totalTimeAdded, 12);
  assert.equal(state.update(56.999, true), null);
  assert.equal(state.update(57, true), 'expired');
});

test('a clock cone at the deadline rescues the run but a late cone cannot', () => {
  const rescued = new TimedScoreAttack({ durationSeconds: 35, maximumBonusSeconds: 2 });
  rescued.start(5);
  assert.equal(rescued.addTime(2, 40).awarded, 2);
  assert.equal(rescued.recordTakedown('cyan', 1, 42), true);
  assert.equal(rescued.update(42, true), 'expired');

  const late = new TimedScoreAttack({ durationSeconds: 35, maximumBonusSeconds: 2 });
  late.start(5);
  assert.equal(late.addTime(2, 40 + 1 / 60).awarded, 0);
});

test('fixed simulation timestamps agree at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const state = new TimedScoreAttack({ durationSeconds: 35 });
    state.start(0);
    let fixedTime = 0;
    let accumulator = 0;
    while (!state.expired) {
      accumulator += 1 / hz;
      while (accumulator + 1e-10 >= 1 / 60) {
        fixedTime += 1 / 60;
        accumulator -= 1 / 60;
      }
      state.update(fixedTime, true);
    }
    return state.view;
  };
  const thirty = simulate(30);
  assert.deepEqual(simulate(60), thirty);
  assert.deepEqual(simulate(120), thirty);
});
