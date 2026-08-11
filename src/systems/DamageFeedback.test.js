import assert from 'node:assert/strict';
import test from 'node:test';

import {
  damageFeedbackState,
  trainingDamageTrophyMessage,
} from './DamageFeedback.js';

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

test('destroyed glass reports the best trophy that damage still permits', () => {
  const hazard = [
    { rank: 'gold', stars: 3, maximumDamageHits: 0 },
    { rank: 'bronze', stars: 1, maximumDamageHits: 3 },
  ];
  const rivals = [
    { rank: 'gold', stars: 3, maximumDamageHits: 1 },
    { rank: 'bronze', stars: 1 },
  ];
  assert.equal(
    trainingDamageTrophyMessage(hazard, 4),
    'TRAINING CONTINUES  •  NO TROPHY',
  );
  assert.equal(
    trainingDamageTrophyMessage(rivals, 4),
    'TRAINING CONTINUES  •  BRONZE STILL LIVE',
  );
});
