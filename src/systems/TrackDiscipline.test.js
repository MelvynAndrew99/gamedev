import assert from 'node:assert/strict';
import test from 'node:test';

import { createTrackDiscipline, updateTrackDiscipline } from './TrackDiscipline.js';

function run(frames, dt, input) {
  let state = createTrackDiscipline();
  let events = 0;
  for (let i = 0; i < frames; i++) {
    const result = updateTrackDiscipline(state, dt, input);
    state = result.state;
    events += Number(result.justLostCleanLine);
  }
  return { state, events };
}

test('edge chatter shorter than 120ms preserves the clean line', () => {
  const result = run(7, 1 / 60, { x: 1.001 });
  assert.equal(result.events, 0);
  assert.equal(result.state.offTrackEvents, 0);
});

test('one sustained excursion counts once at 30, 60, and 120Hz', () => {
  for (const hz of [30, 60, 120]) {
    const result = run(Math.ceil(0.5 * hz), 1 / hz, { x: -1.2 });
    assert.equal(result.events, 1, `${hz}Hz`);
    assert.equal(result.state.offTrackEvents, 1, `${hz}Hz`);
  }
});

test('returning to the road rearms a later clean-line loss', () => {
  let state = createTrackDiscipline();
  for (let i = 0; i < 10; i++) {
    state = updateTrackDiscipline(state, 1 / 60, { x: 1.2 }).state;
  }
  state = updateTrackDiscipline(state, 1 / 60, { x: 0.9 }).state;
  for (let i = 0; i < 10; i++) {
    state = updateTrackDiscipline(state, 1 / 60, { x: 1.2 }).state;
  }
  assert.equal(state.offTrackEvents, 2);
});

test('airborne lateral travel cannot lose the grounded clean line', () => {
  const result = run(120, 1 / 60, { x: 1.5, airborne: true });
  assert.equal(result.state.offTrackEvents, 0);
});
