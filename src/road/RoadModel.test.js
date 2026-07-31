import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import trainingLoop from '../tracks/training-loop.json' with { type: 'json' };
import neonGulch from '../tracks/neon-gulch.json' with { type: 'json' };
import syndicateRun from '../tracks/syndicate-run.json' with { type: 'json' };
import { RoadModel } from './RoadModel.js';

function interactiveLayout(model) {
  return model.segments.flatMap((segment) =>
    segment.sprites
      .filter((sprite) => sprite.def)
      .map((sprite) => [segment.index, sprite.key, sprite.offset])
  );
}

test('campaign decoration is deterministic for a track seed', () => {
  const first = new RoadModel(TUNING);
  const second = new RoadModel(TUNING);

  first.buildFromData(trainingLoop);
  second.buildFromData(trainingLoop);

  assert.deepEqual(interactiveLayout(first), interactiveLayout(second));
  assert.ok(interactiveLayout(first).length > 0);
});

test('lap reset re-arms interactive sprites without changing layout', () => {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingLoop);
  const sprite = model.segments.flatMap((segment) => segment.sprites)
    .find((candidate) => candidate.def);

  sprite.hit = true;
  model.resetLapSprites();

  assert.equal(sprite.hit, false);
});

test('cones never appear to announce ground boosts', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    for (let i = 0; i < model.segments.length; i++) {
      const segment = model.segments[i];
      for (const sprite of segment.sprites) {
        if (sprite.key === 'boost') {
          assert.equal(model.hasConeWarningBehind(i, sprite.offset), false, track.id);
        }
      }
      if (segment.zipper) {
        assert.equal(model.hasConeWarningBehind(i, segment.zipper.offset), false, track.id);
      }
    }
  }
});

test('cones announce rocks, never ramps', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    for (let i = 0; i < model.segments.length; i++) {
      for (const cone of model.segments[i].sprites.filter((s) => s.key === 'cone')) {
        let payload = null;
        for (let j = i + 1; j < Math.min(model.segments.length, i + 70) && !payload; j++) {
          payload = model.segments[j].sprites.find((candidate) =>
            (candidate.key === 'rock' || candidate.key === 'ramp') &&
            Math.abs(candidate.offset - cone.offset) < 0.25
          )?.key ?? null;
        }
        assert.equal(payload, 'rock', `${track.id}: cone at segment ${i}`);
      }
    }
  }
});

test('every ramp remains a raised sprite with a same-lane painted approach', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    for (let i = 0; i < model.segments.length; i++) {
      for (const ramp of model.segments[i].sprites.filter((s) => s.key === 'ramp')) {
        const approach = model.segments
          .slice(Math.max(0, i - 28), i)
          .filter((segment) =>
            segment.launchApproach &&
            Math.abs(segment.launchApproach.offset - ramp.offset) < 0.25
          );

        assert.ok(approach.length > 0, `${track.id}: ramp at segment ${i}`);
        assert.equal(ramp.def.kind, 'launch', `${track.id}: ramp at segment ${i}`);
      }
    }
  }
});

test('zipper paint never overlaps a ramp approach in the same lane', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    for (const segment of model.segments) {
      if (!segment.zipper || !segment.launchApproach) continue;
      const centerDistance = Math.abs(
        segment.zipper.offset - segment.launchApproach.offset
      );
      const combinedHalfWidths =
        segment.zipper.w + segment.launchApproach.w;
      assert.ok(
        centerDistance >= combinedHalfWidths,
        `${track.id}: zipper overlaps ramp runway at segment ${segment.index}`
      );
    }
  }
});

test('every campaign track gets a start/finish gate and painted line', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    // Exactly one gate (the start/finish gantry), on the lap line at index 0.
    const gated = model.segments.filter((segment) => segment.gate);
    assert.equal(gated.length, 1, track.id);
    assert.equal(model.segments[0].gate.label, 'START / FINISH', track.id);

    // The checkered road paint spans the first few segments and starts on the
    // lap line, so it renders under the gantry.
    assert.equal(model.segments[0].startLine, true, track.id);
    const painted = model.segments.filter((segment) => segment.startLine).length;
    assert.ok(painted >= 1 && painted <= 3, track.id);
  }
});

test('campaign tracks stamp their authored precision-driving sequence', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    const actual = model.segments
      .filter((segment) => segment.patternKind)
      .map((segment) => ({ at: segment.index, kind: segment.patternKind }));
    const expected = track.patterns.placements;

    assert.ok(actual.length >= 4, `${track.id}: too few decisions per lap`);
    assert.deepEqual(actual, expected, track.id);
  }
});

test('campaign geometry escalates precision while preserving recovery beats', () => {
  const tracks = [trainingLoop, neonGulch, syndicateRun];
  const expectedMaxCurve = [3, 5, 7];
  const models = tracks.map((track) => {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);
    return model;
  });

  assert.deepEqual(
    models.map((model) => Math.max(...model.segments.map((segment) => Math.abs(segment.curve)))),
    expectedMaxCurve
  );
  assert.ok(
    minimumPlacementGap(trainingLoop) >
    minimumPlacementGap(neonGulch) &&
    minimumPlacementGap(neonGulch) >
    minimumPlacementGap(syndicateRun),
    'decision spacing should tighten through the campaign'
  );

  for (const track of tracks) {
    assert.equal(track.pieces[0][0], 'straight', `${track.id}: opening runway`);
    assert.ok(track.pieces[0][1] >= 25, `${track.id}: opening runway length`);
    assert.equal(track.pieces.at(-1)[0], 'straight', `${track.id}: finish recovery`);
    assert.ok(track.pieces.at(-1)[1] >= 25, `${track.id}: finish recovery length`);

    let consecutiveTechnical = 0;
    for (const [type] of track.pieces) {
      consecutiveTechnical = type === 'straight' || type === 'hill'
        ? 0
        : consecutiveTechnical + 1;
      assert.ok(
        consecutiveTechnical <= 2,
        `${track.id}: more than two technical pieces without a recovery beat`
      );
    }
  }
});

function minimumPlacementGap(track) {
  const ats = track.patterns.placements.map((placement) => placement.at);
  return Math.min(...ats.slice(1).map((at, i) => at - ats[i]));
}
