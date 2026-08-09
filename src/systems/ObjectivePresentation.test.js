import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { TRAINING_TRACKS } from '../tracks/index.js';
import { ObjectiveState } from './ObjectiveState.js';
import {
  OBJECTIVE_HUD_LAYOUT,
  OBJECTIVE_ROW_COLORS,
  objectivePanelLayout,
  objectiveRowView,
} from './ObjectivePresentation.js';

function stateFor(track) {
  const model = new RoadModel(TUNING);
  model.buildFromData(track);
  return { model, state: new ObjectiveState(track.objectives, model) };
}

function completeObjective(state, model, objective) {
  const definition = objective.definition;
  if (definition.type === 'hit_all') {
    const targets = model.segments
      .flatMap((segment) => segment.sprites)
      .filter((sprite) => sprite.objectiveId === definition.id);
    targets.forEach((sprite) => state.record('object_hit', { sprite }));
    return;
  }
  const event = definition.type === 'complete_laps'
    ? 'lap_complete'
    : definition.event;
  state.record(event, { amount: Number(definition.value) });
}

test('persistent objectives stay in the upper-left safe column without trophy height', () => {
  const airSchool = objectivePanelLayout(3);
  assert.deepEqual(airSchool, {
    ...OBJECTIVE_HUD_LAYOUT,
    height: 97,
  });
  assert.ok(airSchool.y >= 68, 'objectives must clear the course ribbon');
  assert.ok(
    airSchool.x + airSchool.width <= 240,
    'objectives must not enter the player/road corridor',
  );
  assert.equal(
    objectivePanelLayout(3).height - objectivePanelLayout(2).height,
    OBJECTIVE_HUD_LAYOUT.rowGap,
    'only authored objective rows may increase persistent HUD height',
  );
});

test('every training objective begins as a white incomplete row', () => {
  for (const track of TRAINING_TRACKS) {
    const { state } = stateFor(track);
    assert.ok(state.views.length > 0, `${track.id} needs a visible objective`);
    for (const objective of state.views) {
      const row = objectiveRowView(objective);
      assert.equal(row.complete, false, `${track.id}/${objective.id}`);
      assert.match(row.text, /^○  /, `${track.id}/${objective.id}`);
      assert.equal(
        row.color,
        OBJECTIVE_ROW_COLORS.incomplete,
        `${track.id}/${objective.id}`,
      );
    }
  }
});

test('training objectives check independently, turn green, and never regress', () => {
  for (const track of TRAINING_TRACKS) {
    track.objectives.forEach((definition, completedIndex) => {
      const { model, state } = stateFor(track);
      const target = state.objectives[completedIndex];
      completeObjective(state, model, target);

      const rows = state.views.map(objectiveRowView);
      rows.forEach((row, index) => {
        if (index === completedIndex) {
          assert.match(row.text, /^✓  /, `${track.id}/${row.id}`);
          assert.equal(
            row.color,
            OBJECTIVE_ROW_COLORS.complete,
            `${track.id}/${row.id}`,
          );
        } else {
          assert.match(row.text, /^○  /, `${track.id}/${row.id}`);
          assert.equal(
            row.color,
            OBJECTIVE_ROW_COLORS.incomplete,
            `${track.id}/${row.id}`,
          );
        }
      });

      // Later unrelated events cannot uncheck a row. A lap transition is
      // intentionally not used here because it may be another row's event.
      state.record('unrelated_event', { amount: 999 });
      const retained = objectiveRowView(
        state.views.find((objective) => objective.id === definition.id),
      );
      assert.equal(retained.complete, true, `${track.id}/${definition.id}`);
      assert.match(retained.text, /^✓  /, `${track.id}/${definition.id}`);
      assert.equal(
        retained.color,
        OBJECTIVE_ROW_COLORS.complete,
        `${track.id}/${definition.id}`,
      );
    });
  }
});

test('a delayed Air School reveal renders progress completed while hidden', () => {
  const trainingAirtime = TRAINING_TRACKS.find(
    (track) => track.id === 'training-airtime',
  );
  assert.ok(trainingAirtime, 'Air School must remain in the training curriculum');
  const { model, state } = stateFor(trainingAirtime);
  const gap = state.objectives.find(
    (objective) => objective.definition.id === 'speed-gap',
  );
  completeObjective(state, model, gap);

  const rowsAtReveal = state.views.map(objectiveRowView);
  assert.deepEqual(
    rowsAtReveal.map(({ id, complete }) => ({ id, complete })),
    [
      { id: 'airtime', complete: false },
      { id: 'speed-gap', complete: true },
      { id: 'finish', complete: false },
    ],
  );
  assert.match(rowsAtReveal[1].text, /^✓  ROCK GAP/);
  assert.equal(rowsAtReveal[1].color, OBJECTIVE_ROW_COLORS.complete);
});
