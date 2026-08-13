import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { Player } from '../entities/Player.js';
import provingGround from '../tracks/training-validation.json' with { type: 'json' };
import neonGulch from '../tracks/neon-gulch.json' with { type: 'json' };
import syndicateRun from '../tracks/syndicate-run.json' with { type: 'json' };
import { rivalRaceSpeedBudget } from './StoryBalance.js';

const TRACKS = [provingGround, neonGulch, syndicateRun];

function cleanNoBoostTime(track) {
  const model = new RoadModel(TUNING);
  model.buildFromData(track);
  const player = new Player(TUNING);
  let elapsed = 0;
  while (elapsed < track.qualifier.targetSeconds) {
    const segment = model.findSegment(player.position + TUNING.playerZ);
    const speedPercent = player.speed / TUNING.maxSpeed;
    const requested = segment.curve * speedPercent * TUNING.centrifugal - player.x * 2;
    const steer = Math.max(-1, Math.min(1, requested));
    const shoulder = Math.abs(requested) > 1;
    const previous = player.position;
    player.update(1 / 60, {
      throttle: 1,
      brake: 0,
      steer,
      glide: 0,
      airbrakeL: shoulder && requested < 0,
      airbrakeR: shoulder && requested > 0,
      boostActive: false,
      boostCeiling: TUNING.overspeedCap,
    }, model);
    elapsed += 1 / 60;
    if (player.position < previous) return elapsed;
  }
  return Infinity;
}

test('Story clocks preserve a narrow Gold line and a forgiving qualification line', () => {
  TRACKS.forEach((track) => {
    const clean = cleanNoBoostTime(track);
    const goldMargin = track.qualifier.goldSeconds - clean;
    const silverMargin = track.qualifier.silverSeconds - clean;
    const clearMargin = track.qualifier.targetSeconds - clean;
    assert.ok(goldMargin >= 5 && goldMargin <= 8, `${track.name} Gold margin ${goldMargin}`);
    assert.ok(silverMargin >= 10 && silverMargin <= 15, `${track.name} Silver margin ${silverMargin}`);
    assert.ok(clearMargin >= 15 && clearMargin <= 24, `${track.name} clear margin ${clearMargin}`);
  });
});

test('every Rival Race remains beatable at the authored speed-line ceiling', () => {
  TRACKS.forEach((track) => {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);
    const budget = rivalRaceSpeedBudget(track, TUNING, model.trackLength);
    assert.ok(budget.marginSeconds >= 5, `${track.name} has no usable perfect-run margin`);
    assert.ok(budget.requiredCeilingFraction < 1, `${track.name} requires impossible average speed`);
  });
});

test('Syndicate Run asks for sustained race flow without requiring near-perfect overspeed', () => {
  const model = new RoadModel(TUNING);
  model.buildFromData(syndicateRun);
  const budget = rivalRaceSpeedBudget(syndicateRun, TUNING, model.trackLength);
  assert.ok(budget.fastestRivalSeconds > 177 && budget.fastestRivalSeconds < 179);
  assert.ok(budget.marginSeconds > 25 && budget.marginSeconds < 28);
  assert.ok(budget.requiredBaseSpeedFraction > 1.05);
  assert.ok(budget.requiredBaseSpeedFraction < 1.07);
  assert.ok(budget.requiredCeilingFraction > 0.84);
  assert.ok(budget.requiredCeilingFraction < 0.86);
});

test('every Syndicate attack straight has a nearby bankable takedown boost', () => {
  const boosts = syndicateRun.objects.filter((object) => object.kind === 'boost');
  assert.equal(boosts.length, 14);
  syndicateRun.rivals.attackZones.forEach((zone, index) => {
    const setup = boosts.find((boost) => boost.at < zone.from && boost.at >= zone.from - 55);
    assert.ok(setup, `attack zone ${index + 1} needs a boost within its 55-segment setup`);
  });
});
