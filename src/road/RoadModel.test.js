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
  assert.equal(trainingHazardWeave.scoring.version, 7);
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

  // Each compact rockfall still closes two lanes, but all four rocks are
  // longitudinally staggered and laterally varied instead of forming a neat
  // 2x2 grid. The open lane remains unmistakable and recovery stays generous.
  const starts = [84, 150, 224, 306, 402, 500, 672, 742, 960, 1034, 1100, 1170];
  const safeSides = ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'R'];
  const closureEnds = [];
  const staggerSignatures = new Set();
  for (let index = 0; index < starts.length; index += 1) {
    const prefix = `closure-${String(index + 1).padStart(2, '0')}-`;
    const closure = rocks.filter((rock) => rock.id.startsWith(prefix));
    assert.equal(closure.length, 4, `${prefix} should remain a dense closure`);
    const ats = closure.map((rock) => rock.at).sort((a, b) => a - b);
    assert.equal(new Set(ats).size, 4, `${prefix} should stagger every rock`);
    assert.equal(ats[0], starts[index]);
    assert.ok(ats[3] - ats[0] <= 12, `${prefix} must remain one readable beat`);
    closureEnds.push(ats[3]);
    staggerSignatures.add(ats.map((at) => at - starts[index]).join(','));

    const edgeRocks = closure.filter((rock) => Math.abs(rock.offset) >= 0.58);
    const centerRocks = closure.filter((rock) => Math.abs(rock.offset) <= 0.08);
    assert.equal(edgeRocks.length, 2, `${prefix} should block one outer lane twice`);
    assert.equal(centerRocks.length, 2, `${prefix} should block the center twice`);
    assert.ok(edgeRocks.every((rock) =>
      safeSides[index] === 'R' ? rock.offset < 0 : rock.offset > 0
    ));
  }
  const recoveryGaps = starts.slice(1).map((at, index) => at - closureEnds[index]);
  assert.ok(recoveryGaps.every((gap) => gap >= 50));
  assert.ok(staggerSignatures.size >= 4, 'debris should not repeat one stamped pattern');
  assert.equal(safeSides.slice(1).filter((side, index) => side !== safeSides[index]).length, 10);

  // Four cones sit directly on ordinary lane-transfer arcs. Only the final
  // two revisit the previously taught +8/-8 airbrake holds.
  assert.deepEqual(
    cones.map((cone) => [cone.at, cone.offset]),
    [[122, 0], [266, 0], [458, 0], [712, 0], [951, 0.5], [1278, 0.46]],
  );
  assert.equal(rocks.filter((rock) => rock.at >= 858 && rock.at <= 953).length, 0);

  // Every cone is a single interstitial pickup, never part of a rock row.
  const rockReach = TUNING.playerW + OBSTACLES.rock.w;
  for (const cone of cones) {
    assert.ok(!rocks.some((rock) => rock.at === cone.at));
    assert.ok(Math.min(...rocks.map((rock) => Math.abs(rock.at - cone.at))) >= 9);
  }

  // Seven recognizable pairs form a gently staggered right-to-center channel.
  // Its center moves monotonically, never reverses, and needs ordinary input.
  const thread = rocks.filter((rock) => rock.id.startsWith('thread-'));
  assert.equal(thread.length, 14);
  const safeWidths = [];
  const centers = [];
  const pairAts = [];
  for (let index = 1; index <= 7; index += 1) {
    const prefix = `thread-${String(index).padStart(2, '0')}-`;
    const pair = thread.filter((rock) => rock.id.startsWith(prefix));
    assert.equal(pair.length, 2);
    const [left, right] = pair.map((rock) => rock.offset).sort((a, b) => a - b);
    const ats = pair.map((rock) => rock.at).sort((a, b) => a - b);
    assert.ok(ats[1] - ats[0] <= 2, `${prefix} should remain a recognizable pair`);
    pairAts.push(ats[0]);
    centers.push(Number(((left + right) / 2).toFixed(2)));
    safeWidths.push(Number((right - left - rockReach * 2).toFixed(2)));
  }
  assert.deepEqual(pairAts, [1298, 1308, 1318, 1329, 1339, 1349, 1359]);
  assert.ok(pairAts.slice(1).every((at, index) => at - pairAts[index] >= 9));
  assert.deepEqual(centers, [0.36, 0.32, 0.27, 0.21, 0.14, 0.07, 0]);
  assert.ok(centers.slice(1).every((center, index) => center <= centers[index]));
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

test('Air School preserves the shared loop and authors a safe speed-gated gap', () => {
  assert.notEqual(trainingAirtime.status, 'placeholder', trainingAirtime.id);
  assert.deepEqual(trainingAirtime.pieces, trainingLoop.pieces, trainingAirtime.id);

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingAirtime);
  const ramps = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.key === 'ramp');
  assert.equal(ramps.length, 4);
  assert.ok(model.segments.some((segment) => segment.launchApproach));
  const boosts = trainingAirtime.objects.filter((object) => object.kind === 'boost');
  const gapRocks = trainingAirtime.objects.filter(
    (object) => object.id.startsWith('air-gap-rock-'),
  );
  const gap = trainingAirtime.airtimeTraining.gap;
  const finalRamp = model.segments[gap.rampSegment].sprites.find(
    (sprite) => sprite.key === 'ramp',
  );
  assert.ok(finalRamp, 'the final lesson ramp must stay at the authored gap gate');
  assert.equal(finalRamp.offset, -0.66);
  assert.equal(boosts.length, 3, 'each advanced ramp gets a recoverable boost setup');
  assert.equal(boosts.at(-1).offset, finalRamp.offset);
  assert.equal(gapRocks.length, 21, 'three dense rows make the gap a real jump');
  assert.equal(gapRocks.at(-1).at, gap.rockEndSegment);
  assert.deepEqual(
    [...new Set(gapRocks.map((rock) => rock.at))],
    [1210, 1224, 1258],
  );
  for (const at of [1210, 1224, 1258]) {
    assert.deepEqual(
      gapRocks.filter((rock) => rock.at === at).map((rock) => rock.offset),
      [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9],
      `rock row ${at} should close the complete road`,
    );
  }
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
