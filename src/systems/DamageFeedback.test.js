import assert from 'node:assert/strict';
import test from 'node:test';

import { damageFeedbackState } from './DamageFeedback.js';

test('training becomes critical one hit before the glass is destroyed', () => {
  const state = (trainingHits) => damageFeedbackState({
    training: true,
    trainingHits,
    trainingMax: 4,
  });

  assert.deepEqual(state(2), { stage: 2, critical: false, destroyed: false });
  assert.deepEqual(state(3), { stage: 3, critical: true, destroyed: false });
  assert.deepEqual(state(4), { stage: 4, critical: true, destroyed: true });
  assert.deepEqual(state(8), { stage: 4, critical: true, destroyed: true });
});

test('normal damage becomes critical exactly when the next rock would wreck', () => {
  const state = (health) => damageFeedbackState({
    health,
    maxHealth: 100,
    fatalDamage: 25,
  });

  assert.equal(state(26).critical, false);
  assert.equal(state(25).critical, true);
  assert.equal(state(25).stage, 3);
  assert.deepEqual(state(0), { stage: 4, critical: false, destroyed: true });
});

test('training lessons without authored damage never expose campaign damage', () => {
  assert.deepEqual(
    damageFeedbackState({ training: true, health: 25 }),
    { stage: 0, critical: false, destroyed: false },
  );
});
