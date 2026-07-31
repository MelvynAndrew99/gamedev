import assert from 'node:assert/strict';
import test from 'node:test';

import { trainingCueDecision } from './TrainingCue.js';

const cue = {
  lap: 1,
  diagnostic: { from: 858, to: 962 },
  at: 962,
};

test('a clean diagnostic bend silently passes adaptive instruction', () => {
  assert.deepEqual(
    trainingCueDecision(cue, {
      lap: 1, segmentIndex: 962, offRoad: false, failed: false,
    }),
    { failed: false, action: 'pass' },
  );
});

test('touching the shoulder schedules assistance on the recovery straight', () => {
  const miss = trainingCueDecision(cue, {
    lap: 1, segmentIndex: 880, offRoad: true, failed: false,
  });
  assert.deepEqual(miss, { failed: true, action: 'none' });
  assert.deepEqual(
    trainingCueDecision(cue, {
      lap: 1, segmentIndex: 962, offRoad: false, failed: miss.failed,
    }),
    { failed: true, action: 'assist' },
  );
});

test('the diagnostic never schedules assistance on later laps', () => {
  assert.deepEqual(
    trainingCueDecision(cue, {
      lap: 2, segmentIndex: 962, offRoad: true, failed: false,
    }),
    { failed: false, action: 'none' },
  );
});
