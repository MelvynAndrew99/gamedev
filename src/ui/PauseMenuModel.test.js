import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAUSE_ACTIONS,
  canPauseRace,
  movePauseSelection,
  pauseActionLabel,
} from './PauseMenuModel.js';

test('pause is available only during a live finite event', () => {
  assert.equal(canPauseRace({ mode: 'story' }), true);
  assert.equal(canPauseRace({ mode: 'training' }), true);
  assert.equal(canPauseRace({ mode: 'endless' }), false);
  assert.equal(canPauseRace({ mode: 'story', done: true }), false);
  assert.equal(canPauseRace({ mode: 'story', awaitingBriefing: true }), false);
  assert.equal(canPauseRace({ mode: 'training', trainingTutorial: true }), false);
});

test('pause selection wraps across gameplay and audio actions', () => {
  assert.deepEqual(PAUSE_ACTIONS.map(({ id }) => id), ['resume', 'music', 'sfx', 'restart', 'exit']);
  assert.equal(movePauseSelection(0, -1), 4);
  assert.equal(movePauseSelection(4, 1), 0);
  assert.equal(movePauseSelection(1, 1), 2);
});

test('pause audio labels expose channel state without relying on color', () => {
  assert.equal(pauseActionLabel(PAUSE_ACTIONS[1], { musicEnabled: true }), 'MUSIC    ON');
  assert.equal(pauseActionLabel(PAUSE_ACTIONS[1], { musicEnabled: false }), 'MUSIC    OFF');
  assert.equal(pauseActionLabel(PAUSE_ACTIONS[2], { sfxEnabled: false }), 'SOUND FX    OFF');
});
