import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadModel } from '../road/RoadModel.js';
import { TUNING } from '../config/tuning.js';
import {
  appendCustomRoad,
  compileCustomTrack,
  createCustomTrackDraft,
  customBuilderUnlocked,
  customRouteLayout,
  loadCustomTracks,
  placeCustomObject,
  removeLastCustomRoad,
  saveCustomTrack,
  validateCustomTrack,
} from './CustomTracks.js';

function buildDraft() {
  let draft = createCustomTrackDraft(1);
  for (const type of ['straight', 'right', 'straight', 'left', 'hill', 'dirt', 'chicane']) {
    const result = appendCustomRoad(draft, type);
    assert.equal(result.ok, true, result.reason);
    draft = result.draft;
  }
  return draft;
}

test('custom builder unlock ignores score but requires every released event completion', () => {
  const school = Array.from({ length: 5 }, () => ({ completed: true }));
  school.push({ completed: false, comingSoon: true });
  const story = Array.from({ length: 3 }, () => ({
    qualifier: { attempted: true, complete: false },
    rivals: { attempted: true, complete: false },
  }));
  assert.equal(customBuilderUnlocked(school, story), true);
  assert.equal(customBuilderUnlocked(
    school.map((tile, index) => index === 2 ? { ...tile, completed: false } : tile),
    story,
  ), false);
  assert.equal(customBuilderUnlocked(school, [
    ...story.slice(0, 2), {
      qualifier: { attempted: true }, rivals: { attempted: false },
    },
  ]), false);
});

test('top-down route is connected, bounded, and undo removes orphaned props', () => {
  let draft = buildDraft();
  const layout = customRouteLayout(draft.roads);
  assert.equal(layout.valid, true);
  assert.equal(layout.cells.length, draft.roads.length);
  const placed = placeCustomObject(draft, draft.roads.length - 1, 'rock', 1);
  assert.equal(placed.ok, true);
  draft = removeLastCustomRoad(placed.draft);
  assert.equal(draft.objects.length, 0);
});

test('compiled custom track is deterministic and accepted by RoadModel', () => {
  let draft = buildDraft();
  draft = placeCustomObject(draft, 1, 'boost', -1).draft;
  draft = placeCustomObject(draft, 4, 'ramp', 0).draft;
  assert.equal(validateCustomTrack(draft).valid, true);
  const one = compileCustomTrack(draft);
  const two = compileCustomTrack(draft);
  assert.deepEqual(one, two);
  assert.equal(one.laps, 2);
  assert.equal(one.objects.length, 2);
  const model = new RoadModel(TUNING);
  model.buildFromData(one);
  assert.ok(model.segments.length > 300);
  assert.equal(model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.trackObjectId).length, 2);
});

test('custom tracks persist defensively with a six-slot cap', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  for (let index = 1; index <= 6; index++) {
    const result = saveCustomTrack({ ...buildDraft(), id: `track-${index}`, name: `TRACK ${index}` }, storage);
    assert.equal(result.ok, true);
  }
  assert.equal(loadCustomTracks(storage).length, 6);
  const seventh = saveCustomTrack({ ...buildDraft(), id: 'track-7' }, storage);
  assert.equal(seventh.ok, false);
  assert.match(seventh.reason, /SIX TRACK SLOTS/);
});
