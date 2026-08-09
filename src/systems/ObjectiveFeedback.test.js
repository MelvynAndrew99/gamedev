import assert from 'node:assert/strict';
import test from 'node:test';

import { nextObjectiveFeedback, objectiveFeedbackEvent } from './ObjectiveFeedback.js';

test('same-frame objective completions remain ordered instead of overwriting', () => {
  const events = [
    objectiveFeedbackEvent(1, { id: 'airtime', hudLabel: 'AIRTIME' }),
    objectiveFeedbackEvent(2, { id: 'speed-gap', hudLabel: 'ROCK GAP' }),
  ];
  assert.equal(nextObjectiveFeedback(events, 0).id, 'airtime');
  assert.equal(nextObjectiveFeedback(events, 1).id, 'speed-gap');
  assert.equal(nextObjectiveFeedback(events, 2), null);
});

test('finish completion uses the same visible check event contract', () => {
  const finish = objectiveFeedbackEvent(3, {
    id: 'finish', label: 'FINISH 2 LAPS', hudLabel: 'FINISH',
  });
  assert.deepEqual(finish, {
    sequence: 3,
    id: 'finish',
    label: 'FINISH 2 LAPS',
    hudLabel: 'FINISH',
  });
});
