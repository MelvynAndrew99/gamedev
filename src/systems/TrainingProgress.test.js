import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTrainingResult,
  highestUnlockedTrainingIndex,
  submitTrainingResult,
  totalTrainingStars,
  trainingConeScore,
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
      { rank: 'gold', minimum: 2, maximumDamageHits: 0, stars: 3 },
      { rank: 'silver', minimum: 2, maximumDamageHits: 1, stars: 2 },
      { rank: 'bronze', minimum: 2, maximumDamageHits: 3, stars: 1 },
    ],
  };

  assert.equal(trophyFor(damageScoring, 1, { damageHits: 0 }), null);
  assert.equal(trophyFor(damageScoring, 2, { damageHits: 4 }), null);
  assert.equal(trophyFor(damageScoring, 2, { damageHits: 2 }).rank, 'bronze');
  assert.equal(trophyFor(damageScoring, 2, { damageHits: 1 }).rank, 'silver');
  assert.equal(trophyFor(damageScoring, 2, { damageHits: 0 }).rank, 'gold');
});

test('gold can require a full cone sweep while lower trophies do not', () => {
  const coneGatedScoring = {
    thresholds: [
      { rank: 'gold', minimum: 2, maximumDamageHits: 0, maximumConesMissed: 0, stars: 3 },
      { rank: 'silver', minimum: 2, maximumDamageHits: 1, stars: 2 },
      { rank: 'bronze', minimum: 2, maximumDamageHits: 3, stars: 1 },
    ],
  };

  // A clean run that misses a cone drops from gold to silver, never to nothing.
  const missed = trophyFor(coneGatedScoring, 2, { damageHits: 0, conesMissed: 1 });
  assert.equal(missed.rank, 'silver');
  // The full sweep with no cracks earns gold and echoes the requirement back.
  const swept = trophyFor(coneGatedScoring, 2, { damageHits: 0, conesMissed: 0 });
  assert.equal(swept.rank, 'gold');
  assert.equal(swept.maximumConesMissed, 0);
  // Silver/bronze ignore cones entirely.
  assert.equal(trophyFor(coneGatedScoring, 2, { damageHits: 1, conesMissed: 5 }).rank, 'silver');
});

test('timed rival trophies preserve Bronze while Gold demands a clean full clear', () => {
  const scoring = {
    thresholds: [
      { rank: 'bronze', stars: 1, minimum: 1 },
      {
        rank: 'silver', stars: 2, minimum: 3,
        maximumDamageHits: 3,
      },
      {
        rank: 'gold', stars: 3, minimum: 3,
        maximumDamageHits: 1, maximumOffTrackEvents: 0,
        maximumTime: 45,
      },
    ],
  };
  const gold = trophyFor(scoring, 3, {
    damageHits: 1, offTrackEvents: 0, time: 44.9,
  });
  assert.equal(gold.rank, 'gold');
  assert.equal(trophyFor(scoring, 3, {
    damageHits: 1, offTrackEvents: 1, time: 44,
  }).rank, 'silver', 'one material excursion must specifically remove Gold');
  assert.equal(trophyFor(scoring, 3, {
    damageHits: 1, offTrackEvents: 0, time: 45.1,
  }).rank, 'silver', 'a safe full clear remains Silver after the Gold time');
  assert.equal(trophyFor(scoring, 1, {
    damageHits: 4, offTrackEvents: 2, time: 80,
  }).rank, 'bronze', 'one wreck survives timeout and preserves novice progress');
});

test('all-lap mastery cones score both laps as one continuous course', () => {
  const track = {
    laps: 2,
    trainingCones: { scoreAcrossLaps: true },
    objects: [
      { kind: 'cone' },
      { kind: 'rock' },
      { kind: 'cone' },
    ],
  };

  assert.deepEqual(
    trainingConeScore(track, { allHits: 3, lastLapHits: 2 }),
    { hits: 3, target: 4, missed: 1 },
  );
  assert.deepEqual(
    trainingConeScore(track, { allHits: 4, lastLapHits: 2 }),
    { hits: 4, target: 4, missed: 0 },
  );
});

test('persistent mastery cones can be recovered across either lap', () => {
  const track = {
    laps: 2,
    trainingCones: { scoreAcrossLaps: 'unique' },
    objects: [
      { kind: 'cone' },
      { kind: 'rock' },
      { kind: 'cone' },
    ],
  };

  assert.deepEqual(
    trainingConeScore(track, { allHits: 1, lastLapHits: 0 }),
    { hits: 1, target: 2, missed: 1 },
  );
  assert.deepEqual(
    trainingConeScore(track, { allHits: 2, lastLapHits: 0 }),
    { hits: 2, target: 2, missed: 0 },
  );
});

test('destroyed training glass loses the trophy but still completes and unlocks progression', () => {
  const values = new Map();
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const track = {
    id: 'hazard-training-test',
    scoring: {
      version: 1,
      thresholds: [
        { rank: 'gold', minimum: 2, maximumDamageHits: 0, stars: 3 },
        { rank: 'silver', minimum: 2, maximumDamageHits: 1, stars: 2 },
        { rank: 'bronze', minimum: 2, maximumDamageHits: 3, stars: 1 },
      ],
    },
  };

  try {
    const result = submitTrainingResult(track, 2, 100, { damageHits: 4 });
    assert.equal(result.trophy, null);
    assert.equal(result.best.completed, true);
    assert.equal(result.best.stars, 0);
    assert.equal(highestUnlockedTrainingIndex([track, { id: 'next' }]), 1);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
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
      conesMissed: 0,
      offTrackEvents: 0,
      boostedTakedowns: 0,
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
