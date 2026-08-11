import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_RIVALS,
  RivalPack,
  distantPaceCorrection,
  wrappedDelta,
} from './RivalPack.js';

const model = { trackLength: 280000 };
const tuning = { maxSpeed: 12000, segmentLength: 200 };
const config = {
  seed: 1505,
  count: 3,
  aggression: 0.4,
  spawns: [
    { id: 'rival-cyan', segmentsAhead: 4, offset: -0.5, pace: 0.97 },
    { id: 'rival-magenta', segmentsAhead: 8, offset: 0.5, pace: 0.99 },
    { id: 'rival-gold', segmentsAhead: 12, offset: 0, pace: 1.01 },
  ],
};

function snapshot(pack) {
  return pack.views.map(({ id, position, x, speed, state, telegraph }) => ({
    id,
    position: Number(position.toFixed(6)),
    x: Number(x.toFixed(6)),
    speed: Number(speed.toFixed(6)),
    state,
    telegraph: Number(telegraph.toFixed(6)),
  }));
}

test('pack simulation is seeded, stable-ID, and does not read Math.random', () => {
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('gameplay randomness leaked'); };
  try {
    const first = new RivalPack(config, tuning, model);
    const second = new RivalPack(config, tuning, model);
    const context = { player: { position: 2400, x: 0.1, speed: 12000 } };
    for (let frame = 0; frame < 600; frame += 1) {
      first.update(1 / 60, context);
      second.update(1 / 60, context);
    }
    assert.deepEqual(snapshot(first), snapshot(second));
    assert.deepEqual(first.consumeEvents(), second.consumeEvents());
    assert.deepEqual(first.views.map((rival) => rival.id), [
      'rival-cyan', 'rival-magenta', 'rival-gold',
    ]);
  } finally {
    Math.random = originalRandom;
  }
});

test('system caps at six while a lesson may author a lower pack cap', () => {
  const system = new RivalPack({ count: 99, maxCount: 99 }, tuning, model);
  const stableView = system.views;
  assert.equal(system.maxCount, MAX_RIVALS);
  assert.equal(system.views.length, 6);
  system.setCount(2);
  const ids = system.views.map((rival) => rival.id);
  system.setCount(6);
  assert.equal(system.views, stableView, 'render-facing view storage stays pooled');
  assert.deepEqual(system.views.slice(0, 2).map((rival) => rival.id), ids);
  assert.equal(system.setCount(0), 0);
  assert.equal(system.views.length, 0);

  const lesson = new RivalPack({ count: 3, maxCount: 3 }, tuning, model);
  assert.equal(lesson.setCount(6), 3);
  assert.equal(lesson.views.length, 3);
});

test('base pace scales authored profiles without changing their relative order', () => {
  const normal = new RivalPack(config, tuning, model);
  const slower = new RivalPack(config, { ...tuning, basePace: 0.9 }, model);
  assert.deepEqual(
    slower.views.map((rival) => rival.speed),
    normal.views.map((rival) => rival.speed * 0.9),
  );
  assert.equal(slower.setBasePace(1.1), 1.1);
});

test('fixed stepping produces equivalent state for different render dt', () => {
  const sixty = new RivalPack(config, tuning, model);
  const ten = new RivalPack(config, tuning, model);
  const one = new RivalPack(config, tuning, model);
  const context = { player: { position: 2500, x: -0.2, speed: 11000 } };
  for (let i = 0; i < 60; i += 1) sixty.update(1 / 60, context);
  for (let i = 0; i < 10; i += 1) ten.update(0.1, context);
  one.update(1, context);
  assert.deepEqual(snapshot(sixty), snapshot(ten));
  assert.deepEqual(snapshot(sixty), snapshot(one));
  assert.deepEqual(sixty.consumeEvents(), ten.consumeEvents());
  assert.deepEqual(ten.consumeEvents(), one.consumeEvents());
});

test('timed rival simulation agrees at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const pack = new RivalPack(config, tuning, model);
    const context = { player: { position: 2500, x: -0.2, speed: 11000 } };
    for (let frame = 0; frame < hz * 12; frame += 1) pack.update(1 / hz, context);
    return { state: snapshot(pack), events: pack.consumeEvents() };
  };
  assert.deepEqual(simulate(30), simulate(60));
  assert.deepEqual(simulate(60), simulate(120));
});

test('moving-player context is interpolated identically at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const pack = new RivalPack({ ...config, aggression: 0 }, tuning, model);
    const dt = 1 / hz;
    let player = { position: 2500, x: -0.2, speed: 12000, airborne: false };
    for (let frame = 0; frame < hz * 45; frame += 1) {
      const previousPlayer = { ...player };
      player = {
        ...player,
        position: (player.position + player.speed * dt) % model.trackLength,
      };
      pack.update(dt, { previousPlayer, player });
    }
    return { state: snapshot(pack), events: pack.consumeEvents() };
  };
  assert.deepEqual(simulate(30), simulate(60));
  assert.deepEqual(simulate(60), simulate(120));
});

test('only one rival owns the attack token and every tell is at least 650ms', () => {
  const pack = new RivalPack({
    ...config,
    aggression: 1,
  }, {
    ...tuning,
    attackTellSeconds: 0.2,
    minimumAttackInterval: 0,
    maximumAttackInterval: 0,
    attackIntervalJitter: 0,
  }, model);
  for (const rival of pack.rivals) rival.attackCooldown = 0;
  pack.update(1 / 60, { player: { position: 3000, x: 0, speed: 12000 } });
  const threats = pack.consumeEvents().filter((event) => event.type === 'rival_threat');
  assert.equal(threats.length, 1);
  assert.ok(threats[0].tellSeconds >= 0.65);
  assert.equal(pack.views.filter((rival) => rival.state === 'telegraph').length, 1);
});

test('aggression changes attack frequency only, not pace or physical tuning', () => {
  const calm = new RivalPack({ ...config, aggression: 0 }, tuning, model);
  const fierce = new RivalPack({ ...config, aggression: 1 }, tuning, model);
  assert.ok(calm.nextAttackInterval() > fierce.nextAttackInterval());
  assert.deepEqual(
    calm.views.map(({ pace, speed }) => ({ pace, speed })),
    fierce.views.map(({ pace, speed }) => ({ pace, speed })),
  );
  assert.equal(calm.t.attackTellSeconds, fierce.t.attackTellSeconds);
  assert.equal(calm.t.laneRate, fierce.t.laneRate);
  assert.equal(calm.t.recoverySeconds, fierce.t.recoverySeconds);
});

test('pace is unmodified locally and distant correction eases within strict bounds', () => {
  assert.equal(distantPaceCorrection(60 * 200, 200), 0);
  assert.equal(distantPaceCorrection(-60 * 200, 200), 0);
  const catchUp = distantPaceCorrection(90 * 200, 200);
  const slowDown = distantPaceCorrection(-90 * 200, 200);
  assert.ok(catchUp > 0 && catchUp < 0.08);
  assert.ok(slowDown < 0 && slowDown > -0.05);
  assert.equal(distantPaceCorrection(200 * 200, 200), 0.08);
  assert.equal(distantPaceCorrection(-200 * 200, 200), -0.05);
});

test('stagger and takedown keep stable identity and eliminate each rival once', () => {
  const pack = new RivalPack(config, tuning, model);
  const id = pack.views[0].id;
  assert.deepEqual(pack.stagger(id, { side: -1, force: 1 }), {
    rivalId: id, stability: 1, side: -1,
  });
  assert.equal(pack.consumeEvents().length, 0, 'core must not award or emit score events');

  const takedown = pack.takeDown(id);
  assert.equal(takedown.rivalId, id);
  assert.equal(takedown.state, 'wrecked');
  assert.ok(takedown.wreckSeconds >= 0.7);
  assert.equal(pack.views.find((rival) => rival.id === id).state, 'wrecked');
  assert.equal(pack.takeDown(id), null, 'a wreck cannot be credited twice');

  pack.setCount(0);
  pack.update(0.69, { player: { position: 0, x: 0 } });
  pack.setCount(3);
  assert.equal(pack.views.some((rival) => rival.id === id), true);
  pack.update(0.02, { player: { position: 0, x: 0 } });
  assert.equal(pack.views.some((rival) => rival.id === id), false);
  assert.equal(pack.rivals.find((rival) => rival.id === id).eliminated, true);
  assert.equal(pack.stagger(id, { side: 1 }), null);
  pack.setCount(0);
  pack.setCount(3);
  assert.equal(pack.views.some((rival) => rival.id === id), false, 'Lab count cannot resurrect it');
});

test('a high-energy ram removes two stability while a normal bump needs a finish', () => {
  const normal = new RivalPack(config, tuning, model);
  const decisive = new RivalPack(config, tuning, model);
  assert.equal(normal.stagger(normal.views[0].id, { force: 1 }).stability, 1);
  assert.equal(decisive.stagger(decisive.views[0].id, { force: 1.35 }).stability, 0);
});

test('a steering shove can move a rival without secretly draining ram stability', () => {
  const pack = new RivalPack(config, tuning, model);
  const rival = pack.views[0];
  const startLane = rival.targetLane;
  const result = pack.stagger(rival.id, { side: 1, force: 1, damage: false });
  assert.equal(result.stability, 2);
  assert.ok(rival.targetLane > startLane);
});

test('far rivals stage into a deterministic chase formation with contact grace', () => {
  const pack = new RivalPack({
    count: 3,
    maxCount: 3,
    aggression: 0,
    spawns: [
      { id: 'one', position: 0, offset: -0.5, pace: 0.96 },
      { id: 'two', position: 200, offset: 0.5, pace: 0.98 },
      { id: 'three', position: 400, offset: 0, pace: 1 },
    ],
  }, tuning, { trackLength: 100000 });
  const player = { position: 40000, x: 0, speed: 0 };
  pack.update(1 / 60, { player });

  const staged = pack.consumeEvents().filter((event) => event.type === 'rival_staged');
  assert.deepEqual(staged.map(({ rivalId, targetSegments }) => ({ rivalId, targetSegments })), [
    { rivalId: 'one', targetSegments: 24 },
    { rivalId: 'two', targetSegments: 31 },
    { rivalId: 'three', targetSegments: 38 },
  ]);
  for (const rival of pack.views) {
    assert.equal(rival.stagingCount, 1);
    assert.ok(rival.stagingGrace > 0.9);
    assert.ok(rival.contactCooldown > 0.9);
  }
});

test('proximity staging stays bounded and rate-independent at 30, 60, and 120Hz', () => {
  const simulate = (hz) => {
    const pack = new RivalPack({
      count: 1,
      maxCount: 1,
      aggression: 0,
      spawns: [{ id: 'wanderer', segmentsAhead: 24, pace: 1 }],
    }, tuning, { trackLength: 100000 });
    const player = { position: 0, x: 0, speed: 0 };
    let maximumDistance = 0;
    for (let frame = 0; frame < hz * 40; frame += 1) {
      pack.update(1 / hz, { player });
      maximumDistance = Math.max(
        maximumDistance,
        Math.abs(wrappedDelta(player.position, pack.views[0].position, 100000)) / 200,
      );
    }
    return {
      maximumDistance: Number(maximumDistance.toFixed(6)),
      state: snapshot(pack),
      stagingCount: pack.views[0].stagingCount,
      events: pack.consumeEvents(),
    };
  };
  const thirty = simulate(30);
  const sixty = simulate(60);
  const oneTwenty = simulate(120);
  assert.deepEqual(thirty.state, sixty.state);
  assert.deepEqual(sixty.state, oneTwenty.state);
  assert.equal(thirty.stagingCount, sixty.stagingCount);
  assert.equal(sixty.stagingCount, oneTwenty.stagingCount);
  assert.deepEqual(thirty.events, sixty.events);
  assert.deepEqual(sixty.events, oneTwenty.events);
  for (const result of [thirty, sixty, oneTwenty]) {
    // Render-rate sampling sees a slightly different peak between fixed
    // simulation ticks, but every rate stays within one segment of the gate.
    assert.ok(result.maximumDistance < 91, 'a rival never escapes the authored staging band');
  }
  assert.ok(thirty.stagingCount >= 1);
});

test('local rivals are never re-staged or pace-corrected', () => {
  const pack = new RivalPack({
    count: 1,
    maxCount: 1,
    aggression: 0,
    spawns: [{ id: 'local', segmentsAhead: 50, pace: 1 }],
  }, tuning, { trackLength: 100000 });
  const initialSpeed = pack.views[0].speed;
  pack.update(1 / 60, { player: { position: 0, x: 0, speed: 12000 } });
  assert.equal(pack.views[0].stagingCount, 0);
  assert.equal(pack.views[0].speed, initialSpeed);
  assert.equal(pack.consumeEvents().some((event) => event.type === 'rival_staged'), false);
});
