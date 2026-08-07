import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
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

test('Hazard Weave strings rocks into bending lines that force the player to steer', () => {
  assert.deepEqual(trainingHazardWeave.pieces, trainingLoop.pieces);
  assert.equal(trainingHazardWeave.trainingDamage.maxHits, 4);
  assert.equal(trainingHazardWeave.scoring.objective, 'finish');
  assert.ok(trainingHazardWeave.scoring.thresholds.every(
    (threshold) => threshold.minimum === trainingHazardWeave.laps,
  ));

  // Show, don't tell: the intro must be short and never explain the mechanic.
  assert.ok(trainingHazardWeave.intro.length <= 60, trainingHazardWeave.intro);
  assert.ok(!/damage works|windscreen|crack/i.test(trainingHazardWeave.intro));

  const rocks = trainingHazardWeave.objects.filter((object) => object.kind === 'rock');
  const cones = trainingHazardWeave.objects.filter((object) => object.kind === 'cone');
  assert.equal(trainingHazardWeave.objects.length, rocks.length + cones.length);
  assert.ok(rocks.length >= 90, `expected a dense field, got ${rocks.length}`);
  assert.ok(rocks.every((rock) => rock.objective == null));

  // Weaving strands (weave-N / bend-N) sit one behind another — no two ever
  // share a segment. The thread-the-needle corridor (thread-N) is separate.
  const weaveRocks = rocks.filter((rock) => /^(weave|bend)-/.test(rock.id));
  const threadRocks = rocks.filter((rock) => /^thread-/.test(rock.id));
  assert.equal(weaveRocks.length + threadRocks.length, rocks.length);

  const weaveAts = weaveRocks.map((rock) => rock.at);
  assert.equal(new Set(weaveAts).size, weaveAts.length);

  const runs = new Map();
  for (const rock of weaveRocks) {
    const run = rock.id.match(/^([a-z]+-\d+)-/)[1];
    if (!runs.has(run)) runs.set(run, []);
    runs.get(run).push(rock);
  }
  for (const [run, members] of runs) {
    const runAts = members.map((rock) => rock.at);
    assert.deepEqual(runAts, [...runAts].sort((a, b) => a - b), run);

    const offsets = members.map((rock) => rock.offset);
    // Always leaves an open racing line: a single strand never blocks the road.
    assert.ok(offsets.every((offset) => Math.abs(offset) <= 0.6), run);
    // The line bends across the lanes rather than holding one — that is what
    // makes the player steer as they pass.
    const span = Math.max(...offsets) - Math.min(...offsets);
    assert.ok(span >= 0.4, `${run} must weave across lanes (span ${span})`);
    // Each step is gentle enough to follow at speed (no teleporting wall).
    for (let i = 1; i < offsets.length; i++) {
      assert.ok(
        Math.abs(offsets[i] - offsets[i - 1]) <= 0.16,
        `${run} step too sharp between rocks ${i - 1} and ${i}`,
      );
    }
  }

  // Thread-the-needle capstone: parallel rails you follow down a lane. It sits
  // at the end (final straight) and is sized to be fun, not frustrating.
  assert.ok(threadRocks.length >= 8, `expected a corridor, got ${threadRocks.length}`);
  assert.ok(threadRocks.every((rock) => rock.at >= 1278), 'corridor is toward the end');
  const pairs = new Map();
  for (const rock of threadRocks) {
    if (!pairs.has(rock.at)) pairs.set(rock.at, []);
    pairs.get(rock.at).push(rock.offset);
  }
  for (const [at, offsets] of pairs) {
    assert.equal(offsets.length, 2, `corridor pair at ${at}`);
    const [lo, hi] = [...offsets].sort((a, b) => a - b);
    assert.ok(lo < 0 && hi > 0, `corridor straddles center at ${at}`);
    assert.ok(Math.abs(lo) <= 0.55 && hi <= 0.55, `corridor rails on-road at ${at}`);
    const gap = hi - lo;
    // Wide enough that the car (2 * (playerW 0.14 + rockW 0.11) = 0.5) threads
    // with real margin; not so wide it stops being a needle.
    assert.ok(gap >= 0.72 && gap <= 0.88, `corridor gap ${gap} at ${at}`);
  }

  // A few edge cones bait the open racing line exactly where a rock strand
  // bulges to the far edge — Lesson 1's "drive here" cue reused as a lure.
  assert.ok(cones.length >= 3 && cones.length <= 12, `a few cones, got ${cones.length}`);
  assert.ok(cones.every((cone) => cone.objective == null));
  for (const cone of cones) {
    assert.ok(Math.abs(cone.offset) >= 0.6, `edge cone ${cone.id}`);
    const bulge = weaveRocks.some(
      (rock) => Math.abs(rock.at - cone.at) <= 40 &&
        Math.sign(rock.offset) === -Math.sign(cone.offset) &&
        Math.abs(rock.offset) >= 0.45,
    );
    assert.ok(bulge, `cone ${cone.id} should sit opposite a rock bulge`);
  }
});

test('staged speed and airtime lessons preserve the shared loop geometry', () => {
  for (const track of [trainingTopSpeed, trainingAirtime]) {
    assert.equal(track.status, 'placeholder', track.id);
    assert.deepEqual(track.pieces, trainingLoop.pieces, track.id);
  }

  const model = new RoadModel(TUNING);
  model.buildFromData(trainingAirtime);
  const ramps = model.segments.flatMap((segment) => segment.sprites)
    .filter((sprite) => sprite.key === 'ramp');
  assert.equal(ramps.length, 4);
  assert.ok(model.segments.some((segment) => segment.launchApproach));
});

function minimumPlacementGap(track) {
  const ats = track.patterns.placements.map((placement) => placement.at);
  return Math.min(...ats.slice(1).map((at, i) => at - ats[i]));
}
