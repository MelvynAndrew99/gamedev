import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { checkObstacleHit, crossedRoadSegments } from './Collision.js';

function straightModel(segments = 20) {
  const model = new RoadModel(TUNING);
  model.addStraight(Math.ceil(segments / 3));
  return model;
}

test('overspeed contact sweeps pickups skipped between frame endpoints', () => {
  const model = straightModel();
  const pickup = {
    def: { kind: 'pickup', w: 0.1 },
    offset: 0,
    hit: false,
  };
  model.segments[3].sprites.push(pickup);
  const player = {
    position: TUNING.segmentLength * 4.2 - TUNING.playerZ,
    x: 0,
  };
  const previous = {
    position: TUNING.segmentLength * 2.2 - TUNING.playerZ,
    x: 0,
  };

  assert.equal(checkObstacleHit(player, model, TUNING, previous), pickup);
  assert.equal(pickup.hit, true);
});

test('same-segment contact uses the current lateral position', () => {
  const model = straightModel();
  const pickup = {
    def: { kind: 'pickup', w: 0.1 },
    offset: 0.5,
    hit: false,
  };
  const position = TUNING.segmentLength * 2.2 - TUNING.playerZ;
  model.segments[2].sprites.push(pickup);

  const player = { position: position + 20, x: 0.5 };
  const previous = { position, x: -0.5 };

  assert.equal(checkObstacleHit(player, model, TUNING, previous), pickup);
});

test('swept road traversal includes segments across a lap wrap', () => {
  const model = straightModel();
  const tuning = { ...TUNING, playerZ: 0 };
  const previous = { position: model.trackLength - 250, x: -0.5 };
  const player = { position: 350, x: 0.5 };

  const indices = crossedRoadSegments(player, model, tuning, previous)
    .map(({ segment }) => segment.index);

  assert.ok(indices.includes(model.segments.at(-1).index));
  assert.ok(indices.includes(0));
  assert.ok(indices.includes(1));
});
