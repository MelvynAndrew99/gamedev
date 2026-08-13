import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAUSE_ACTIONS,
  canPauseRace,
  movePauseSelection,
} from './PauseMenuModel.js';

test('pause is available only during a live finite event', () => {
  assert.equal(canPauseRace({ mode: 'story' }), true);
  assert.equal(canPauseRace({ mode: 'training' }), true);
  assert.equal(canPauseRace({ mode: 'endless' }), false);
  assert.equal(canPauseRace({ mode: 'story', done: true }), false);
  assert.equal(canPauseRace({ mode: 'story', awaitingBriefing: true }), false);
  assert.equal(canPauseRace({ mode: 'training', trainingTutorial: true }), false);
});

test('pause selection wraps across all three actions', () => {
  assert.deepEqual(PAUSE_ACTIONS.map(({ id }) => id), ['resume', 'restart', 'exit']);
  assert.equal(movePauseSelection(0, -1), 2);
  assert.equal(movePauseSelection(2, 1), 0);
  assert.equal(movePauseSelection(1, 1), 2);
});
