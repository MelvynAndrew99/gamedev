import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attackIntent,
  classifyRivalContact,
  qualifiesRivalTakedown,
  rivalHitResolution,
  rivalContactTraceEligible,
  rivalDamagePolicy,
  resolveRivalContact,
  sweptRivalContact,
} from './RivalContact.js';
import { RivalPack } from '../entities/RivalPack.js';
import rivalSchool from '../tracks/training-rivals.json' with { type: 'json' };

const trackLength = 10000;

function body(position, x = 0, extra = {}) {
  return { position, x, ...extra };
}

test('swept toroidal contact catches an overspeed pass across the lap line', () => {
  const contact = sweptRivalContact(
    body(9850, 0), body(250, 0),
    body(40, 0.05), body(140, 0.05),
    { trackLength, dt: 0.05, longitudinalRadius: 80 },
  );
  assert.ok(contact);
  assert.ok(Math.abs(contact.longitudinalDistance) <= 80);
  assert.ok(contact.relativeSpeed > 0);
});

test('the same pass is detected at 30, 60, and 120Hz without tunneling', () => {
  for (const hz of [30, 60, 120]) {
    const dt = 1 / hz;
    let player = body(1000, -0.1, { speed: 12000 });
    let rival = body(1450, -0.05, { speed: 9600 });
    let found = null;
    for (let frame = 0; frame < hz && !found; frame++) {
      const nextPlayer = body((player.position + 12000 * dt) % trackLength, -0.1);
      const nextRival = body((rival.position + 9600 * dt) % trackLength, -0.05);
      found = sweptRivalContact(player, nextPlayer, rival, nextRival, {
        trackLength, dt, longitudinalRadius: 80,
      });
      player = nextPlayer;
      rival = nextRival;
    }
    assert.ok(found, `${hz}Hz`);
  }
});

function fixedPackContact(hz, { playerSpeed, rivalPace }) {
  const dt = 1 / hz;
  const pack = new RivalPack({
    count: 1,
    maxCount: 1,
    aggression: 0,
    spawns: [{ id: 'pace-rival', position: 1010, offset: 0.1, pace: rivalPace }],
  }, {
    maxSpeed: 12000,
    basePace: 1,
    segmentLength: 200,
  }, { trackLength });
  const rivalBefore = {
    position: pack.views[0].position,
    x: pack.views[0].x,
    speed: pack.views[0].speed,
  };
  const playerBefore = { position: 1000, x: 0, speed: playerSpeed };
  const player = {
    position: (playerBefore.position + playerSpeed * dt) % trackLength,
    x: 0,
    speed: playerSpeed,
  };
  pack.update(dt, { player });
  const rival = pack.views[0];
  const contact = sweptRivalContact(playerBefore, player, rivalBefore, rival, {
    trackLength,
    dt,
    longitudinalRadius: 120,
  });
  return classifyRivalContact(contact, {
    lowRelativeSpeed: 960,
    highRelativeSpeed: 1440,
  });
}

test('RivalPack contact strength is identical at 30, 60, and 120Hz', () => {
  for (const hz of [30, 60, 120]) {
    const equal = fixedPackContact(hz, { playerSpeed: 12000, rivalPace: 1 });
    assert.equal(equal.kind, 'rub', `${hz}Hz equal pace kind`);
    assert.equal(equal.scores, false, `${hz}Hz equal pace score`);

    const advantage = fixedPackContact(hz, { playerSpeed: 12000, rivalPace: 0.8 });
    assert.equal(advantage.kind, 'rear_ram', `${hz}Hz speed-edge kind`);
    assert.equal(advantage.scores, true, `${hz}Hz speed-edge score`);
    assert.equal(advantage.takedownForce, true, `${hz}Hz speed-edge force`);
  }
});

test('only a boosted deliberate hit qualifies as a Rival School takedown', () => {
  const ram = { deliberate: true, takedownForce: true };
  assert.equal(qualifiesRivalTakedown(ram, false), false);
  assert.equal(qualifiesRivalTakedown(ram, true), true);
  assert.equal(qualifiesRivalTakedown({ deliberate: false, takedownForce: true }, true), false);
  assert.equal(qualifiesRivalTakedown(null, true), false);
});

test('two committed non-boost side hits defeat a rival while rear bumps do not stack', () => {
  const sidePush = {
    kind: 'side_push', deliberate: true, takedownForce: true,
  };
  assert.deepEqual(rivalHitResolution(sidePush, false, 2), {
    takedown: false,
    stabilityDamage: 1,
    sideDamage: true,
    boostedTakedown: false,
  });
  assert.deepEqual(rivalHitResolution(sidePush, false, 1), {
    takedown: true,
    stabilityDamage: 1,
    sideDamage: true,
    boostedTakedown: false,
  });

  const rearRam = {
    kind: 'rear_ram', deliberate: true, takedownForce: true,
  };
  assert.deepEqual(rivalHitResolution(rearRam, false, 1), {
    takedown: false,
    stabilityDamage: 0,
    sideDamage: false,
    boostedTakedown: false,
  });
  assert.equal(rivalHitResolution(rearRam, true, 2).takedown, true);
});

test('a later stored trace cannot contact a rival wrecked earlier in the render frame', () => {
  const traced = {
    current: { active: true, eliminated: false, state: 'cruise', generation: 2 },
  };
  assert.equal(rivalContactTraceEligible(traced, {
    active: true, eliminated: false, state: 'cruise', generation: 2,
  }), true);
  assert.equal(rivalContactTraceEligible(traced, {
    active: true, eliminated: false, state: 'wrecked', generation: 2,
  }), false);
  assert.equal(rivalContactTraceEligible(traced, {
    active: true, eliminated: false, state: 'cruise', generation: 3,
  }), false);
});

test('moving-player rear-ram timing uses matched fixed-step samples at every refresh rate', () => {
  const simulate = (hz) => {
    const length = 279600;
    const dt = 1 / hz;
    const pack = new RivalPack({
      count: 1,
      maxCount: 1,
      aggression: 0,
      spawns: [{ id: 'target', segmentsAhead: 10, offset: 0, pace: 1 }],
    }, {
      maxSpeed: 12000,
      basePace: 0.96,
      segmentLength: 200,
      localPaceRadiusSegments: 18,
      fullPaceCorrectionSegments: 40,
      catchUpLimit: 0.12,
      slowDownLimit: 0.08,
    }, { trackLength: length });
    let player = { position: 0, x: 0, speed: 12000, airborne: false };
    for (let frame = 0; frame < hz * 10; frame += 1) {
      const previousPlayer = { ...player };
      player = {
        ...player,
        position: (player.position + player.speed * dt) % length,
      };
      pack.update(dt, { previousPlayer, player });
      if (pack.lastStepCount === 0) continue;
      for (let index = 0; index < pack.contactStepCount; index += 1) {
        const step = pack.contactSteps[index];
        const rival = step.rivals[0];
        const contact = sweptRivalContact(
          step.previousPlayer,
          step.player,
          rival.previous,
          rival.current,
          { trackLength: length, dt: 1 / 60, longitudinalRadius: 144 },
        );
        const outcome = classifyRivalContact(contact, {
          lowRelativeSpeed: 480,
          highRelativeSpeed: 1200,
        });
        if (outcome?.kind === 'rear_ram') return Number(step.time.toFixed(6));
      }
    }
    return null;
  };
  assert.equal(simulate(30), 4.15);
  assert.equal(simulate(60), simulate(30));
  assert.equal(simulate(120), simulate(30));
});

test('airborne bodies pass over rivals without contact', () => {
  assert.equal(sweptRivalContact(
    body(100, 0), body(300, 0, { airborne: true }),
    body(200, 0), body(210, 0),
    { trackLength, dt: 1 / 60 },
  ), null);
});

test('attack intent is a rising-edge, one-sided shoulder press', () => {
  assert.equal(attackIntent({ airbrakeL: true }, {}), -1);
  assert.equal(attackIntent({ airbrakeR: true }, {}), 1);
  assert.equal(attackIntent({ airbrakeL: true }, { airbrakeL: true }), 0);
  assert.equal(attackIntent({ airbrakeL: true, airbrakeR: true }, {}), 0);
});

test('passive equal-speed contact and wrong-direction presses never score', () => {
  const contact = {
    side: 1,
    relativeSpeed: 1000,
    closingSpeed: 1000,
    playerCatching: false,
  };
  const passive = classifyRivalContact(contact);
  const wrong = classifyRivalContact(contact, { attackDirection: -1 });
  assert.equal(passive.kind, 'rub');
  assert.equal(passive.scores, false);
  assert.equal(wrong.scores, false);
  assert.equal(wrong.deliberate, false);
});

test('incoming attacks require the rival to be moving toward the contact side', () => {
  const leftRival = { side: -1, relativeSpeed: 700, playerCatching: false };
  const incoming = classifyRivalContact(leftRival, {
    rivalAttacking: true,
    rivalAttackSide: 1,
  });
  const movingAway = classifyRivalContact(leftRival, {
    rivalAttacking: true,
    rivalAttackSide: -1,
  });
  assert.equal(incoming.kind, 'incoming_attack');
  assert.equal(incoming.scores, false);
  assert.equal(movingAway.kind, 'rub');
});

test('relative-speed thresholds distinguish rub, scored push, and takedown force', () => {
  const contact = { side: 1, playerCatching: false };
  const low = classifyRivalContact(
    { ...contact, relativeSpeed: 300, closingSpeed: 300 },
    { attackDirection: 1 },
  );
  const medium = classifyRivalContact(
    { ...contact, relativeSpeed: 900, closingSpeed: 900 },
    { attackDirection: 1 },
  );
  const high = classifyRivalContact(
    { ...contact, relativeSpeed: 1800, closingSpeed: 1800 },
    { attackDirection: 1 },
  );
  assert.deepEqual([low.kind, low.scores], ['rub', false]);
  assert.deepEqual([medium.kind, medium.scores, medium.takedownForce], ['side_push', true, false]);
  assert.deepEqual([high.kind, high.scores, high.takedownForce], ['side_push', true, true]);
});

test('boost raises a valid shoulder slam to takedown force but cannot make passive contact score', () => {
  const contact = {
    side: -1, relativeSpeed: 800, closingSpeed: 800, playerCatching: false,
  };
  const active = classifyRivalContact(contact, { attackDirection: -1, boostActive: true });
  const passive = classifyRivalContact(contact, { boostActive: true });
  assert.equal(active.takedownForce, true);
  assert.equal(active.scores, true);
  assert.equal(passive.scores, false);
});

test('an aligned rear ram scores without an attack button while an offset scrape does not', () => {
  const aligned = classifyRivalContact({
    side: 1,
    lateralDistance: 0.1,
    relativeSpeed: 900,
    closingSpeed: 900,
    playerCatching: true,
  });
  const offset = classifyRivalContact({
    side: 1,
    lateralDistance: 0.24,
    relativeSpeed: 900,
    closingSpeed: 900,
    playerCatching: true,
  });
  assert.deepEqual(
    [aligned.kind, aligned.deliberate, aligned.scores, aligned.takedownForce],
    ['rear_ram', true, true, true],
  );
  assert.deepEqual([offset.kind, offset.scores], ['shunt', false]);
});

test('a committed side push moves a near-edge rival outward without passive kill force', () => {
  const contact = {
    side: 1,
    lateralDistance: 0.2,
    rivalX: 0.8,
    relativeSpeed: 0,
    closingSpeed: 0,
    playerCatching: false,
  };
  const push = classifyRivalContact(contact, {
    lateralIntent: 1,
    lateralCommitment: 0.8,
  });
  assert.equal(push.kind, 'side_push');
  assert.equal(push.scores, true);
  assert.equal(push.takedownForce, true, 'an outward push across the edge is decisive');

  const player = { x: 0.35 };
  const rival = { x: 0.8, contactCooldown: 0 };
  const result = resolveRivalContact(player, rival, push);
  assert.ok(result.rivalX >= 1.03, 'the authored push physically crosses the road edge');

  const passive = classifyRivalContact({
    ...contact,
    rivalX: 0,
  });
  assert.equal(passive.kind, 'rub');
  assert.equal(passive.takedownForce, false);
});

test('staging grace blocks relocation sweeps from becoming phantom contacts', () => {
  const contact = sweptRivalContact(
    body(1000, 0, { speed: 12000 }),
    body(1200, 0, { speed: 12000 }),
    body(8000, 0.05, { speed: 9600 }),
    body(1250, 0.05, { speed: 9600, stagingGrace: 1 }),
    { trackLength, dt: 1 / 60 },
  );
  assert.equal(contact, null);
});

test('contact cooldown rejects repeats and resolution separates both cars', () => {
  const contact = {
    side: 1, relativeSpeed: 900, closingSpeed: 900, playerCatching: false,
  };
  assert.equal(classifyRivalContact(contact, { attackDirection: 1, contactCooldown: 0.2 }), null);

  const player = { x: 0 };
  const rival = { x: 0.1, contactCooldown: 0 };
  const classified = classifyRivalContact(contact, { attackDirection: 1 });
  const result = resolveRivalContact(player, rival, classified);
  assert.ok(Math.abs(rival.x - player.x) >= 0.3 - 1e-10);
  assert.equal(result.contactCooldown, 0.45);
  assert.equal(rival.contactCooldown, 0.45);
});

test('a faster rival cannot turn the player shoulder tap into credited speed advantage', () => {
  const caughtByRival = classifyRivalContact({
    side: 1,
    relativeSpeed: 1800,
    closingSpeed: -1800,
    playerCatching: false,
  }, { attackDirection: 1, boostActive: true });
  assert.equal(caughtByRival.scores, false);
  assert.equal(caughtByRival.deliberate, false);
});

test('a faster rival cannot donate an edge boot through ordinary steering', () => {
  const caughtAtEdge = classifyRivalContact({
    side: 1,
    lateralDistance: 0.1,
    rivalX: 0.8,
    relativeSpeed: 1800,
    closingSpeed: -1800,
    playerCatching: false,
  }, {
    steeringDirection: 1,
    lateralCommitment: 0.8,
    boostActive: true,
  });
  assert.equal(caughtAtEdge.kind, 'rub');
  assert.equal(caughtAtEdge.scores, false);
  assert.equal(caughtAtEdge.takedownForce, false);
});

test('training contact is local while future Story rivals damage campaign hull', () => {
  assert.deepEqual(rivalDamagePolicy('training', 10), {
    trainingHits: 1,
    persistentHullDamage: 0,
  });
  assert.deepEqual(rivalDamagePolicy('story', 10), {
    trainingHits: 0,
    persistentHullDamage: 10,
  });
});

test('delayed boosted wreck opportunities are identical at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const config = structuredClone(rivalSchool.rivals);
    const length = 279600;
    const pack = new RivalPack(config, {
      maxSpeed: 12000,
      basePace: 0.96,
      segmentLength: 200,
      catchUpLimit: 0.12,
      slowDownLimit: 0.08,
      localPaceRadiusSegments: 18,
      fullPaceCorrectionSegments: 40,
      stagingRadiusSegments: 44,
      stagingBehindRadiusSegments: 12,
      stagingTargetSegments: rivalSchool.rivals.policy.stagingTargetSegments,
      stagingTargetSpacingSegments: rivalSchool.rivals.policy.stagingTargetSpacingSegments,
      stagingGraceSeconds: rivalSchool.rivals.policy.stagingGraceSeconds,
      wreckSeconds: rivalSchool.rivals.policy.wreckSeconds,
    }, { trackLength: length });
    let player = { position: 0, x: 0, speed: 16200, airborne: false };
    const kills = [];

    for (let frame = 0; frame < 35 * hz; frame += 1) {
      const previousPlayer = { ...player };
      const target = pack.rivals
        .filter((rival) => rival.active && rival.state !== 'wrecked')
        .map((rival) => ({
          rival,
          distance: ((rival.position - player.position) % length + length) % length,
        }))
        .filter(({ distance }) => distance < length / 2)
        .sort((a, b) => a.distance - b.distance)[0]?.rival;
      const targetX = target?.x ?? player.x;
      player = {
        ...player,
        position: (player.position + player.speed / hz) % length,
        // This is the ideal veteran ceiling, not a novice model: perfect line
        // acquisition isolates whether the director offers eight legal cars.
        x: targetX,
      };
      pack.update(1 / hz, { previousPlayer, player });

      for (let stepIndex = 0; stepIndex < pack.contactStepCount; stepIndex += 1) {
        const step = pack.contactSteps[stepIndex];
        for (const traced of step.rivals) {
          if (!traced.current.active || traced.current.state === 'wrecked') continue;
          const live = pack.rivals.find((rival) => rival.id === traced.id);
          if (traced.current.generation !== live.generation) continue;
          const contact = sweptRivalContact(
            step.previousPlayer,
            step.player,
            traced.previous,
            traced.current,
            { trackLength: length, dt: 1 / 60, longitudinalRadius: 144 },
          );
          const outcome = classifyRivalContact(contact, {
            steeringDirection: 0,
            lateralCommitment: 0,
            boostActive: true,
            contactCooldown: traced.current.contactCooldown,
            lowRelativeSpeed: 240,
            highRelativeSpeed: 1200,
          });
          if (outcome?.kind !== 'rear_ram') continue;

          pack.stagger(live.id, { side: outcome.side, force: 1.35, damage: true });
          if (!pack.takeDown(live.id, {
            elapsedSince: Math.max(0, pack.elapsed - step.time),
          })) continue;
          kills.push({
            time: Number(step.time.toFixed(6)),
            id: live.id,
            generation: traced.current.generation,
          });
          break;
        }
      }
    }
    return kills;
  };

  const thirty = simulate(30);
  const sixty = simulate(60);
  const oneTwenty = simulate(120);
  assert.ok(
    thirty.length >= 8,
    `the clean boosted benchmark can still earn Gold (got ${thirty.length})`,
  );
  assert.deepEqual(
    thirty.map(({ id, generation }) => ({ id, generation })),
    sixty.map(({ id, generation }) => ({ id, generation })),
  );
  assert.deepEqual(
    sixty.map(({ id, generation }) => ({ id, generation })),
    oneTwenty.map(({ id, generation }) => ({ id, generation })),
  );
  for (let index = 0; index < thirty.length; index += 1) {
    assert.ok(Math.abs(thirty[index].time - sixty[index].time) <= 0.051);
    assert.ok(Math.abs(sixty[index].time - oneTwenty[index].time) <= 0.018);
  }
});
