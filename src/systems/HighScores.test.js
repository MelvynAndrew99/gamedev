import assert from 'node:assert/strict';
import test from 'node:test';

import { endlessRecordSnapshot, getScore, submitScore } from './HighScores.js';

function installStorage(initial = new Map()) {
  const values = initial;
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return {
    values,
    restore: () => {
      if (original === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = original;
    },
  };
}

test('a clean store starts with no scores', () => {
  const { restore } = installStorage();
  try {
    assert.equal(getScore('endless'), null);
  } finally {
    restore();
  }
});

test('submitScore records a first score and reports it as a new record', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('endless', 1200, 'max'), true);
    assert.equal(getScore('endless'), 1200);
  } finally {
    restore();
  }
});

test('max mode only accepts strictly greater values and never lets records decline', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('endless', 1000, 'max'), true);
    assert.equal(submitScore('endless', 999, 'max'), false, 'a lower distance is not a record');
    assert.equal(getScore('endless'), 1000, 'the record must not decline');
    assert.equal(submitScore('endless', 1000, 'max'), false, 'a tie is not a new record');
    assert.equal(getScore('endless'), 1000);
    assert.equal(submitScore('endless', 1500, 'max'), true);
    assert.equal(getScore('endless'), 1500);
  } finally {
    restore();
  }
});

test('min mode rewards lower values, e.g. lap times', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('track-1', 90.5, 'min'), true);
    assert.equal(submitScore('track-1', 95, 'min'), false, 'a slower time is not a record');
    assert.equal(getScore('track-1'), 90.5);
    assert.equal(submitScore('track-1', 88.2, 'min'), true);
    assert.equal(getScore('track-1'), 88.2);
  } finally {
    restore();
  }
});

test('invalid ids, values, and shapes are rejected and never become records', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('', 100, 'max'), false);
    assert.equal(submitScore(null, 100, 'max'), false);
    assert.equal(submitScore(42, 100, 'max'), false);
    assert.equal(submitScore('endless', NaN, 'max'), false);
    assert.equal(submitScore('endless', Infinity, 'max'), false);
    assert.equal(submitScore('endless', -Infinity, 'max'), false);
    assert.equal(submitScore('endless', -1, 'max'), false);
    assert.equal(submitScore('endless', '1200', 'max'), false);
    assert.equal(submitScore('endless', { value: 1200 }, 'max'), false);
    assert.equal(submitScore('endless', [1200], 'max'), false);
    assert.equal(submitScore('endless', null, 'max'), false);
    assert.equal(submitScore('endless', undefined, 'max'), false);
    assert.equal(getScore('endless'), null, 'nothing invalid should have been stored');
    assert.equal(getScore(''), null);
    assert.equal(getScore(null), null);
    assert.equal(getScore(undefined), null);
  } finally {
    restore();
  }
});

test('unknown modes are rejected while the legacy omitted mode still defaults to max', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('endless', 100, 'max'), true);
    assert.equal(submitScore('endless', 50, 'best'), false, 'an unrecognized mode must not be accepted');
    assert.equal(submitScore('endless', 50, 'MAX'), false, 'mode matching is exact, not case-insensitive');
    assert.equal(submitScore('endless', 50), false, 'the omitted mode defaults to max, so a lower score loses');
    assert.equal(submitScore('endless', 150), true, 'the omitted mode retains the original max behavior');
    assert.equal(getScore('endless'), 150, 'invalid modes must not alter the max record');
  } finally {
    restore();
  }
});

test('prototype-shaped and whitespace-only ids are rejected, real kebab-case track ids still work', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('__proto__', 100, 'max'), false);
    assert.equal(submitScore('constructor', 100, 'max'), false);
    assert.equal(submitScore('prototype', 100, 'max'), false);
    assert.equal(submitScore('   ', 100, 'max'), false, 'whitespace-only ids are not valid');
    assert.equal(submitScore(' endless', 100, 'max'), false, 'leading whitespace is not trimmed silently');
    assert.equal(submitScore('endless ', 100, 'max'), false, 'trailing whitespace is not trimmed silently');
    assert.equal(submitScore('a'.repeat(65), 100, 'max'), false, 'ids are bounded in length');
    assert.equal(submitScore('a'.repeat(64), 100, 'max'), true, 'the maximum allowed length is still valid');
    assert.equal(getScore('__proto__'), null);
    assert.equal(({}).__proto__.hasOwnProperty === Object.prototype.hasOwnProperty, true,
      'the object prototype must be untouched by a rejected __proto__ id');

    // Real ids used elsewhere in the repo (endless distance + kebab-case
    // campaign/training track slugs) must keep working under the tighter policy.
    for (const id of ['endless', 'neon-gulch', 'syndicate-run', 'training-hazard-weave', 'track-1']) {
      assert.equal(submitScore(id, 42, 'max'), true, `${id} should remain a valid id`);
      assert.equal(getScore(id), 42);
    }
  } finally {
    restore();
  }
});

test('a zero-length distance can be a valid, finite score', () => {
  const { restore } = installStorage();
  try {
    assert.equal(submitScore('endless', 0, 'max'), true);
    assert.equal(getScore('endless'), 0);
  } finally {
    restore();
  }
});

test('corrupt JSON in storage never throws and reads as no scores', () => {
  const { values, restore } = installStorage();
  try {
    values.set('destruction-racer.scores.v1', '{not valid json');
    assert.doesNotThrow(() => getScore('endless'));
    assert.equal(getScore('endless'), null);
  } finally {
    restore();
  }
});

test('malformed stored entries (arrays, wrong-shaped objects, bad values) are dropped, not thrown', () => {
  const { values, restore } = installStorage();
  try {
    values.set('destruction-racer.scores.v1', JSON.stringify([1, 2, 3]));
    assert.doesNotThrow(() => getScore('endless'));
    assert.equal(getScore('endless'), null);

    values.set('destruction-racer.scores.v1', JSON.stringify({
      endless: -50,
      'track-1': NaN,
      'track-2': Infinity,
      'track-3': 'ninety',
      '': 10,
      valid: 42,
    }));
    assert.equal(getScore('endless'), null);
    assert.equal(getScore('track-1'), null);
    assert.equal(getScore('track-2'), null);
    assert.equal(getScore('track-3'), null);
    assert.equal(getScore('valid'), 42, 'a validly-shaped sibling entry is still readable');

    // JSON.parse (unlike an object literal) creates '__proto__' as a real
    // own enumerable property, so a corrupted/hostile save file can contain
    // one. It must be dropped like any other invalid id.
    values.set('destruction-racer.scores.v1', '{"__proto__": 999, "valid2": 7}');
    assert.equal(getScore('__proto__'), null);
    assert.equal(getScore('valid2'), 7);
    assert.equal(({}).hasOwnProperty === Object.prototype.hasOwnProperty, true,
      'the object prototype must be untouched by a hostile stored __proto__ entry');
  } finally {
    restore();
  }
});

test('a later valid submit recovers from corrupt JSON by writing a clean map', () => {
  const { values, restore } = installStorage();
  try {
    values.set('destruction-racer.scores.v1', '{ this is not json');
    assert.equal(submitScore('endless', 2500, 'max'), true);

    const stored = JSON.parse(values.get('destruction-racer.scores.v1'));
    assert.deepEqual(stored, { endless: 2500 });
    assert.equal(getScore('endless'), 2500);
  } finally {
    restore();
  }
});

test('throwing/disabled localStorage never throws and degrades to no scores', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => { throw new Error('storage disabled'); },
    setItem: () => { throw new Error('storage disabled'); },
  };
  try {
    assert.doesNotThrow(() => getScore('endless'));
    assert.equal(getScore('endless'), null);
    assert.doesNotThrow(() => submitScore('endless', 100, 'max'));
    assert.equal(submitScore('endless', 100, 'max'), false);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

test('reads reload storage each call instead of trusting a stale module cache', () => {
  const { values, restore } = installStorage();
  try {
    assert.equal(getScore('endless'), null);
    // Simulate another tab / external write happening between calls.
    values.set('destruction-racer.scores.v1', JSON.stringify({ endless: 4321 }));
    assert.equal(getScore('endless'), 4321);
  } finally {
    restore();
  }
});

test('endlessRecordSnapshot reports a fresh no-run state', () => {
  const { restore } = installStorage();
  try {
    assert.deepEqual(endlessRecordSnapshot(), { distanceM: 0, hasRun: false });
  } finally {
    restore();
  }
});

test('endlessRecordSnapshot reflects a saved endless record', () => {
  const { restore } = installStorage();
  try {
    submitScore('endless', 8123, 'max');
    assert.deepEqual(endlessRecordSnapshot(), { distanceM: 8123, hasRun: true });
  } finally {
    restore();
  }
});

test('endlessRecordSnapshot never throws even with a corrupt store', () => {
  const { values, restore } = installStorage();
  try {
    values.set('destruction-racer.scores.v1', 'not json at all');
    assert.doesNotThrow(() => endlessRecordSnapshot());
    assert.deepEqual(endlessRecordSnapshot(), { distanceM: 0, hasRun: false });
  } finally {
    restore();
  }
});
