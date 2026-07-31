import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import trainingLoop from '../tracks/training-loop.json' with { type: 'json' };
import trainingHazardWeave from '../tracks/training-hazard-weave.json' with { type: 'json' };
import trainingTopSpeed from '../tracks/training-top-speed.json' with { type: 'json' };
import trainingAirtime from '../tracks/training-airtime.json' with { type: 'json' };
import trainingValidation from '../tracks/training-validation.json' with { type: 'json' };
import neonGulch from '../tracks/neon-gulch.json' with { type: 'json' };
import syndicateRun from '../tracks/syndicate-run.json' with { type: 'json' };
import { ObjectiveState } from './ObjectiveState.js';

function target(id, objectiveId = 'cone-sweep', key = 'cone') {
  return { trackObjectId: id, objectiveId, key };
}

test('hit-all objectives count each authored target once', () => {
  const first = target('first');
  const second = target('second');
  const state = new ObjectiveState([
    { id: 'cone-sweep', type: 'hit_all', target: 'cone', label: 'HIT EVERY CONE' },
  ], { segments: [{ sprites: [first, second] }] });

  assert.equal(state.primary.progress, 0);
  assert.equal(state.record('object_hit', { sprite: first }).changes[0].progress, 1);
  assert.equal(state.record('object_hit', { sprite: first }), null);
  assert.equal(state.complete, false);

  const result = state.record('object_hit', { sprite: second });
  assert.equal(result.newlyCompleted[0].complete, true);
  assert.equal(result.allComplete, true);
  assert.equal(state.complete, true);
});

test('event and lap objectives provide a global objective list and score', () => {
  const state = new ObjectiveState([
    { id: 'finish', type: 'complete_laps', value: 3, label: 'FINISH 3 LAPS', points: 1000 },
    { id: 'ramps', type: 'count_event', event: 'ramp_hit', value: 2, label: 'HIT 2 RAMPS', points: 500 },
  ], { segments: [] });

  state.record('lap_complete');
  state.record('ramp_hit');
  state.record('ramp_hit');
  assert.deepEqual(
    state.views.map(({ progress, total, complete }) => ({ progress, total, complete })),
    [
      { progress: 1, total: 3, complete: false },
      { progress: 2, total: 2, complete: true },
    ],
  );
  assert.equal(state.completedCount, 1);
  assert.equal(state.score, 500);
  assert.equal(state.pointsAvailable, 1500);
});

test('per-unit objectives score partial progress without marking mastery complete', () => {
  const first = target('first');
  const second = target('second');
  const state = new ObjectiveState([
    {
      id: 'cone-sweep', type: 'hit_all', target: 'cone',
      label: 'HIT EVERY CONE', pointsPerUnit: 100,
    },
  ], { segments: [{ sprites: [first, second] }] });

  state.record('object_hit', { sprite: first });
  assert.equal(state.score, 100);
  assert.equal(state.pointsAvailable, 200);
  assert.equal(state.primary.earnedPoints, 100);
  assert.equal(state.primary.points, 200);
  assert.equal(state.primary.unitPoints, 100);
  assert.equal(state.primary.complete, false);
});

test('unrelated contacts do not change objective progress', () => {
  const cone = target('first');
  const state = new ObjectiveState([
    { id: 'cone-sweep', type: 'hit_all', target: 'cone', label: 'HIT EVERY CONE' },
  ], { segments: [{ sprites: [cone] }] });

  assert.equal(state.record('zip', {}), null);
  assert.equal(state.record('object_hit', { sprite: target('other', 'other-goal') }), null);
  assert.equal(state.primary.progress, 0);
});

test('invalid objective data fails while building the course', () => {
  assert.throws(
    () => new ObjectiveState([
      { id: 'cone-sweep', type: 'hit_all', target: 'cone' },
    ], { segments: [{ sprites: [] }] }),
    /no authored targets/,
  );
});

test('every authored course builds a valid objective stack with points', () => {
  for (const track of [
    trainingLoop,
    trainingHazardWeave,
    trainingTopSpeed,
    trainingAirtime,
    trainingValidation,
    neonGulch,
    syndicateRun,
  ]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);
    const state = new ObjectiveState(track.objectives, model);
    assert.ok(state.active, track.id);
    assert.ok(state.views.every((objective) => objective.points > 0), track.id);
    assert.ok(state.pointsAvailable >= 1000, track.id);
  }
});
