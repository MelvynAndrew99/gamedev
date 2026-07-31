import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTrainingResult,
  highestUnlockedTrainingIndex,
  submitTrainingResult,
  totalTrainingStars,
  trophyFor,
} from './TrainingProgress.js';

const scoring = {
  thresholds: [
    { rank: 'gold', minimum: 30, stars: 3 },
    { rank: 'silver', minimum: 26, stars: 2 },
    { rank: 'bronze', minimum: 20, stars: 1 },
  ],
};

test('training trophies reward cone mastery at authored thresholds', () => {
  assert.equal(trophyFor(scoring, 19), null);
  assert.deepEqual(trophyFor(scoring, 20), { rank: 'bronze', stars: 1, minimum: 20 });
  assert.deepEqual(trophyFor(scoring, 27), { rank: 'silver', stars: 2, minimum: 26 });
  assert.deepEqual(trophyFor(scoring, 30), { rank: 'gold', stars: 3, minimum: 30 });
});

test('damage-limited trophies use cracks as mastery criteria without failing the run', () => {
  const damageScoring = {
    thresholds: [
      { rank: 'gold', minimum: 24, maximumDamageHits: 0, stars: 3 },
      { rank: 'silver', minimum: 20, maximumDamageHits: 1, stars: 2 },
      { rank: 'bronze', minimum: 16, maximumDamageHits: 3, stars: 1 },
    ],
  };

  assert.equal(trophyFor(damageScoring, 24, { damageHits: 4 }), null);
  assert.equal(trophyFor(damageScoring, 24, { damageHits: 2 }).rank, 'bronze');
  assert.equal(trophyFor(damageScoring, 24, { damageHits: 1 }).rank, 'silver');
  assert.equal(trophyFor(damageScoring, 24, { damageHits: 0 }).rank, 'gold');
});

test('training persistence keeps only the best lesson result and does not farm stars', () => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const track = { id: 'test-loop', objects: Array(30), scoring: { ...scoring, version: 1 } };
    const first = submitTrainingResult(track, 26, 90);
    const replay = submitTrainingResult(track, 20, 80);

    assert.equal(first.newBest, true);
    assert.equal(replay.newBest, false);
    assert.deepEqual(getTrainingResult(track.id), {
      version: 1,
      completed: true,
      bestProgress: 26,
      total: 30,
      bestTime: 90,
      damageHits: 0,
      trophy: 'silver',
      stars: 2,
    });
    assert.equal(totalTrainingStars(), 2);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('completed lessons unlock the next training index in sequence', () => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const tracks = [
      { id: 'lesson-1', objects: Array(30), scoring: { ...scoring, version: 1 } },
      { id: 'lesson-2', objects: Array(24), scoring: { ...scoring, version: 1 } },
    ];
    assert.equal(highestUnlockedTrainingIndex(tracks), 0);
    submitTrainingResult(tracks[0], 10, 100);
    assert.equal(highestUnlockedTrainingIndex(tracks), 1);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('a staged placeholder is visible in the curriculum but remains locked', () => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const tracks = [
      { id: 'lesson-1', objects: Array(30), scoring: { ...scoring, version: 1 } },
      {
        id: 'lesson-2',
        status: 'placeholder',
        objects: [],
        scoring: { ...scoring, version: 1 },
      },
    ];
    submitTrainingResult(tracks[0], 30, 90);
    assert.equal(highestUnlockedTrainingIndex(tracks), 0);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
