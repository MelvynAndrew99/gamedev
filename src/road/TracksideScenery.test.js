import test from 'node:test';
import assert from 'node:assert/strict';

import { ENVIRONMENT_IDS, getEnvironment } from '../config/environments.js';
import { tracksideObjectForSegment } from './TracksideScenery.js';

test('trackside landmarks are deterministic and course-specific', () => {
  const seenKinds = new Map();

  for (const id of ENVIRONMENT_IDS) {
    const environment = getEnvironment(id);
    const objects = [];
    for (let segment = 0; segment < 2000; segment++) {
      const object = tracksideObjectForSegment(environment, segment);
      if (object) objects.push(object);
    }

    assert.ok(objects.length > 20, `${id} should place recurring landmarks`);
    assert.deepEqual(
      objects,
      Array.from({ length: 2000 }, (_, segment) =>
        tracksideObjectForSegment(environment, segment)
      ).filter(Boolean),
      `${id} landmarks should be stable across repeated passes`,
    );
    assert.ok(
      objects.every((object) => environment.trackside.kinds.includes(object.kind)),
      `${id} should only use its own landmark vocabulary`,
    );
    assert.ok(
      objects.every((object) => Math.abs(object.offset) >= environment.trackside.offset[0]),
      `${id} landmarks should remain outside the road`,
    );
    seenKinds.set(id, new Set(objects.map((object) => object.kind)));
  }

  assert.notDeepEqual(seenKinds.get('training-loop'), seenKinds.get('neon-gulch'));
  assert.notDeepEqual(seenKinds.get('neon-gulch'), seenKinds.get('syndicate-run'));
});

test('absolute segment indices preserve scenery cadence after Endless trimming', () => {
  const environment = getEnvironment('endless');
  const before = [];
  const after = [];

  for (let segment = 10000; segment < 11000; segment++) {
    const object = tracksideObjectForSegment(environment, segment);
    if (object) before.push([segment, object]);
  }
  for (let retainedIndex = 0; retainedIndex < 1000; retainedIndex++) {
    const absoluteSegment = retainedIndex + 10000;
    const object = tracksideObjectForSegment(environment, absoluteSegment);
    if (object) after.push([absoluteSegment, object]);
  }

  assert.deepEqual(after, before);
});

test('each world mixes speed-scale roadside detail with rarer signature landmarks', () => {
  for (const id of ENVIRONMENT_IDS) {
    const environment = getEnvironment(id);
    const objects = Array.from({ length: 4000 }, (_, segment) =>
      tracksideObjectForSegment(environment, segment)
    ).filter(Boolean);
    const signatures = objects.filter((object) => object.signature);
    const roadside = objects.filter((object) => !object.signature);
    assert.ok(signatures.length >= 4, `${id} needs recurring memorable landmarks`);
    assert.ok(roadside.length > signatures.length * 4, `${id} keeps denser speed detail`);
    assert.ok(
      signatures.every((object) => object.size >= 1.4),
      `${id} signature silhouettes must read above ordinary roadside scale`,
    );
  }
});
