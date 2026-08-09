import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import { OBSTACLES } from '../config/obstacles.js';
import trainingLoop from '../tracks/training-loop.json' with { type: 'json' };
import trainingHazardWeave from '../tracks/training-hazard-weave.json' with { type: 'json' };
import trainingTopSpeed from '../tracks/training-top-speed.json' with { type: 'json' };
import trainingAirtime from '../tracks/training-airtime.json' with { type: 'json' };
import trainingValidation from '../tracks/training-validation.json' with { type: 'json' };
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
  model.buildFromData(trainingValidation);
  const sprite = model.segments.flatMap((segment) => segment.sprites)
    .find((candidate) => candidate.def);

  sprite.hit = true;
  model.resetLapSprites();

  assert.equal(sprite.hit, false);
});

test('cones never appear to announce ground boosts', () => {
  for (const track of [trainingLoop, trainingValidation, neonGulch, syndicateRun]) {
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
  for (const track of [trainingValidation, neonGulch, syndicateRun]) {
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
  for (const track of [trainingValidation, neonGulch, syndicateRun]) {
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
  for (const track of [trainingValidation, neonGulch, syndicateRun]) {
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
  for (const track of [trainingLoop, trainingValidation, neonGulch, syndicateRun]) {
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
  for (const track of [trainingValidation, neonGulch, syndicateRun]) {
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

test('campaign geometry preserves recovery beats around authored skill checks', () => {
  const tracks = [trainingValidation, neonGulch, syndicateRun];
  // Proving Ground repeats Training's isolated shoulder-button gate. Its
  // single +8 hairpin is sharper than later races' individual bends; those
  // races escalate through tighter decision spacing and compound pressure.
  const expectedMaxCurve = [8, 5, 7];
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
    minimumPlacementGap(trainingValidation) >
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

test('training is the longer cone-only version of the story proving ground', () => {
  assert.deepEqual(trainingLoop.pieces, trainingValidation.pieces);
  assert.equal(trainingLoop.laps, 2);
  assert.equal(trainingLoop.finish, 'laps');
  assert.equal(trainingLoop.objects.length, 60);

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingLoop);
  assert.ok(model.segments.length >= 1100, 'training lap should have room to settle between reads');

  const interactive = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.def);
  assert.equal(interactive.length, trainingLoop.objects.length);
  assert.ok(interactive.every((sprite) => sprite.key === 'cone'));
  assert.ok(interactive.every((sprite) => sprite.objectiveId === 'cone-sweep'));
  assert.ok(model.segments.every((segment) => !segment.zipper && !segment.launchApproach));
});

test('Cone Control separates its diagnostic from the cone-lined final hairpin', () => {
  assert.deepEqual(trainingLoop.pieces.slice(-6), [
    ['curve', 32, 8],
    ['straight', 32],
    ['curve', 30, -3],
    ['straight', 18],
    ['curve', 28, -8],
    ['straight', 40],
  ]);
  assert.deepEqual(trainingLoop.trainingCues, [
    {
      id: 'airbrake-hairpin',
      kind: 'airbrake-rehearsal',
      lap: 1,
      diagnostic: { from: 858, to: 962 },
      at: 962,
    },
  ]);

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingLoop);
  const diagnostic = model.segments.slice(858, 954);
  const challenge = model.segments.slice(1194, 1278);
  assert.equal(Math.max(...diagnostic.map((segment) => segment.curve)), 8);
  assert.equal(Math.min(...challenge.map((segment) => segment.curve)), -8);
  assert.equal(
    trainingLoop.objects.filter(
      (object) => object.at >= 858 && object.at <= 981,
    ).length,
    0,
    'diagnostic and recovery need clean road',
  );
  assert.ok(trainingLoop.trainingCues[0].at < 982, 'assist needs recovery road');
  const setup = trainingLoop.objects.filter((object) => object.id.startsWith('setup-'));
  const hairpin = trainingLoop.objects.filter((object) => object.id.startsWith('hairpin-'));
  assert.equal(setup.length, 12);
  assert.equal(hairpin.length, 12);
  assert.ok(setup.every((object) => object.at > 962 && object.at < 1194));
  assert.ok(hairpin.every((object) => object.at >= 1194 && object.at < 1278));
  assert.ok(setup.at(-1).offset > 0.5, 'setup line should stage the outside lane');
  assert.ok(
    hairpin.every((object) => object.offset === 0.57),
    'hairpin cones should hold one collectible right-lane line',
  );
});

test('training uses varied cone lines and preserves missed targets for lap two', () => {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingLoop);
  assert.equal(new Set(trainingLoop.objects.map((object) => object.at)).size, 59);
  assert.deepEqual(
    ['straight-', 'taper-', 'corridor-', 'fork-', 'transfer-', 'setup-', 'hairpin-'].map(
      (prefix) => trainingLoop.objects.filter((object) => object.id.startsWith(prefix)).length,
    ),
    [8, 8, 8, 3, 9, 12, 12],
  );

  const fork = trainingLoop.objects.filter((object) => object.id.startsWith('fork-'));
  assert.equal(fork[0].offset, 0, 'fork should show one readable entry cone');
  assert.deepEqual(
    fork.slice(1).map((object) => [object.at, object.offset]),
    [[548, -0.55], [548, 0.55]],
    'the split should leave one unreachable same-segment cone for lap two',
  );

  const corridor = trainingLoop.objects.filter((object) => object.id.startsWith('corridor-'));
  assert.ok(corridor.slice(1).every((object, index) => object.at - corridor[index].at === 7));
  assert.ok(corridor.slice(1).every(
    (object, index) => Math.sign(object.offset) !== Math.sign(corridor[index].offset),
  ));

  for (const prefix of ['straight-', 'taper-', 'setup-']) {
    const line = trainingLoop.objects.filter((object) => object.id.startsWith(prefix));
    assert.ok(line.slice(1).every(
      (object, index) => Math.abs(object.offset - line[index].offset) <= 0.151,
    ), `${prefix} should be a gentle steering line`);
  }

  const cones = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.objectiveId === 'cone-sweep');
  cones.filter((cone) => !['taper-03', 'hairpin-04'].includes(cone.trackObjectId))
    .forEach((cone) => { cone.hit = true; });
  model.resetLapSprites();
  assert.equal(cones.filter((cone) => cone.hit).length, 58);
  assert.deepEqual(
    cones.filter((cone) => !cone.hit).map((cone) => cone.trackObjectId),
    ['taper-03', 'hairpin-04'],
  );
});

test('Hazard Weave forces readable lane changes before a sustained center needle', () => {
  assert.deepEqual(trainingHazardWeave.pieces, trainingLoop.pieces);
  assert.equal(trainingHazardWeave.trainingDamage.maxHits, 4);
  assert.equal(trainingHazardWeave.scoring.objective, 'finish');
  assert.equal(trainingHazardWeave.trainingCones.scoreAcrossLaps, 'unique');

  const rocks = trainingHazardWeave.objects.filter((object) => object.kind === 'rock');
  const cones = trainingHazardWeave.objects.filter((object) => object.kind === 'cone');
  assert.equal(rocks.length, 62, 'the lesson should retain its dense rockfall spectacle');
  assert.equal(cones.length, 6, 'selected open lanes should offer mastery rewards');
  assert.equal(trainingHazardWeave.objects.length, rocks.length + cones.length);
  assert.ok(cones.every((cone) => cone.objective === 'mastery-cones'));

  const thresholds = Object.fromEntries(
    trainingHazardWeave.scoring.thresholds.map((threshold) => [threshold.rank, threshold]),
  );
  assert.equal(thresholds.gold.maximumDamageHits, 0);
  assert.equal(thresholds.gold.maximumConesMissed, 0);
  assert.equal(thresholds.silver.maximumDamageHits, 1);
  assert.equal(thresholds.silver.maximumConesMissed, undefined);
  assert.equal(thresholds.bronze.maximumDamageHits, 3);

  // Each compact rockfall closes two lanes over two rows. The open lane moves
  // repeatedly across the road, while at least 58 segments of recovery follow
  // one closure before the next begins.
  const starts = [84, 150, 224, 306, 402, 500, 672, 742, 960, 1034, 1100, 1170];
  const safeSides = ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'R'];
  const safeR = [[-0.68, 0], [-0.62, -0.04]];
  const safeL = [[0, 0.68], [0.04, 0.62]];
  for (let index = 0; index < starts.length; index += 1) {
    const prefix = `closure-${String(index + 1).padStart(2, '0')}-`;
    const closure = rocks.filter((rock) => rock.id.startsWith(prefix));
    assert.equal(closure.length, 4, `${prefix} should be a dense two-row closure`);
    const rows = [...new Set(closure.map((rock) => rock.at))].sort((a, b) => a - b);
    assert.deepEqual(rows, [starts[index], starts[index] + 8]);
    assert.deepEqual(
      rows.map((at) => closure.filter((rock) => rock.at === at)
        .map((rock) => rock.offset).sort((a, b) => a - b)),
      safeSides[index] === 'R' ? safeR : safeL,
    );
  }
  const startGaps = starts.slice(1).map((at, index) => at - starts[index]);
  assert.ok(startGaps.every((gap) => gap >= 66));
  assert.equal(safeSides.slice(1).filter((side, index) => side !== safeSides[index]).length, 10);

  // The +8 hold and apex stay clean. Its right-lane reward waits until the
  // straight exit, where the learned airbrake line has settled.
  assert.equal(rocks.filter((rock) => rock.at >= 858 && rock.at <= 953).length, 0);
  assert.deepEqual(
    trainingHazardWeave.objects
      .filter((object) => object.at === 968)
      .map((object) => [object.kind, object.offset]),
    [['rock', -0.62], ['rock', -0.04], ['cone', 0.62]],
  );

  // Hitting a mastery cone can never overlap a rock's collision interval.
  // The final centered cone is precise, but its gate retains real clearance.
  const coneReach = TUNING.playerW + OBSTACLES.cone.w;
  const rockReach = TUNING.playerW + OBSTACLES.rock.w;
  for (const cone of cones) {
    const sameSegmentRocks = rocks.filter((rock) => rock.at === cone.at);
    assert.ok(sameSegmentRocks.length > 0, `${cone.id} should mark a visible safe lane`);
    for (const rock of sameSegmentRocks) {
      assert.ok(
        Math.abs(cone.offset - rock.offset) >= coneReach + rockReach,
        `${cone.id} overlaps ${rock.id}`,
      );
    }
  }

  // Seven consecutive pairs taper, hold, and release a real center corridor.
  // This is a sustained thread-the-needle finish, not another lane-choice gate.
  const thread = rocks.filter((rock) => rock.id.startsWith('thread-'));
  assert.equal(thread.length, 14);
  const threadSegments = [...new Set(thread.map((rock) => rock.at))].sort((a, b) => a - b);
  assert.deepEqual(threadSegments, [1298, 1308, 1318, 1328, 1338, 1348, 1358]);
  assert.ok(threadSegments.slice(1).every((at, index) => at - threadSegments[index] === 10));
  const safeWidths = [];
  for (const at of threadSegments) {
    const offsets = thread.filter((rock) => rock.at === at).map((rock) => rock.offset);
    assert.equal(offsets.length, 2);
    const [left, right] = [...offsets].sort((a, b) => a - b);
    safeWidths.push(Number((right - left - rockReach * 2).toFixed(2)));
  }
  assert.deepEqual(
    safeWidths,
    [0.78, 0.7, 0.62, 0.54, 0.5, 0.54, 0.62],
  );

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingHazardWeave);
  const masterySprites = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.objectiveId === 'mastery-cones');
  masterySprites[0].hit = true;
  model.resetLapSprites();
  assert.equal(masterySprites[0].hit, true, 'claimed mastery cones persist across both laps');
  assert.ok(masterySprites.slice(1).every((sprite) => sprite.hit === false));
});

test('the staged airtime lesson preserves the shared loop geometry', () => {
  assert.equal(trainingAirtime.status, 'placeholder', trainingAirtime.id);
  assert.deepEqual(trainingAirtime.pieces, trainingLoop.pieces, trainingAirtime.id);

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingAirtime);
  const ramps = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.key === 'ramp');
  assert.equal(ramps.length, 4);
  assert.ok(model.segments.some((segment) => segment.launchApproach));
});

test('Redline preserves the shared loop geometry and is no longer a placeholder', () => {
  assert.notEqual(trainingTopSpeed.status, 'placeholder', trainingTopSpeed.id);
  assert.deepEqual(trainingTopSpeed.pieces, trainingLoop.pieces, trainingTopSpeed.id);

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingTopSpeed);
  const boosts = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.key === 'boost');
  assert.equal(boosts.length, trainingTopSpeed.objects.length);
  assert.equal(boosts.length, 3, 'lap one should bank exactly one full boost gauge');
  assert.deepEqual(
    trainingTopSpeed.objects.map(({ at, offset }) => [at, offset]),
    [[260, 0], [540, -0.52], [920, 0.52]],
    'the pickup line should revisit center, medium-bend, and airbrake skills',
  );
  assert.ok(trainingTopSpeed.objects.every((object) => object.once === true));

  const collected = boosts[0];
  collected.hit = true;
  model.resetLapSprites();
  assert.equal(collected.hit, true, 'banked lap-one boosts stay gone on lap two');
  assert.ok(boosts.slice(1).every((boost) => boost.hit === false), 'missed boosts remain recoverable');

  const ranks = trainingTopSpeed.scoring.thresholds.map((threshold) => threshold.rank).sort();
  assert.deepEqual(ranks, ['bronze', 'gold', 'silver']);
});

function minimumPlacementGap(track) {
  const ats = track.patterns.placements.map((placement) => placement.at);
  return Math.min(...ats.slice(1).map((at, i) => at - ats[i]));
}
