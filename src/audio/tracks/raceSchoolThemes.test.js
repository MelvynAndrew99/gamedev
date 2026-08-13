import assert from 'node:assert/strict';
import test from 'node:test';

import { TRAINING_LOOP_THEME } from './trainingLoopTheme.js';
import {
  RACE_SCHOOL_THEMES,
  RACE_SCHOOL_VARIANTS,
  raceSchoolThemeForTrack,
} from './raceSchoolThemes.js';

const IDS = [
  'training-loop',
  'training-hazard-weave',
  'training-top-speed',
  'training-airtime',
  'training-rivals',
  'training-flight',
];

test('every Race School course has a distinct tempo, register, and arrangement identity', () => {
  assert.deepEqual(Object.keys(RACE_SCHOOL_THEMES), IDS);
  assert.equal(new Set(IDS.map((id) => RACE_SCHOOL_THEMES[id].bpm)).size, IDS.length);
  assert.equal(new Set(IDS.map((id) => RACE_SCHOOL_THEMES[id].bars[0].leadRootFreq)).size, IDS.length);
  assert.equal(new Set(IDS.map((id) => RACE_SCHOOL_THEMES[id].arrangement)).size, IDS.length);
  for (const id of IDS) {
    const variant = RACE_SCHOOL_VARIANTS[id];
    assert.ok(Math.abs(variant.bpm - TRAINING_LOOP_THEME.bpm) <= 8, `${id} tempo stays subtle`);
    assert.ok(Math.abs(variant.transpose) <= 4, `${id} pitch stays near the school motif`);
  }
});

test('lesson mixes remain full Open Circuit arrangements with valid tracker data', () => {
  for (const id of IDS) {
    const theme = RACE_SCHOOL_THEMES[id];
    assert.equal(theme.stepsPerBar, 16);
    assert.equal(theme.bars.length, TRAINING_LOOP_THEME.bars.length);
    assert.ok(theme.bars.length * 4 * 60 / theme.bpm >= 40);
    for (const [index, bar] of theme.bars.entries()) {
      assert.equal(bar.bass.length, 16, `${id} bar ${index} bass`);
      assert.equal(bar.lead.length, 16, `${id} bar ${index} lead`);
      if (bar.arp) assert.equal(bar.arp.length, 16, `${id} bar ${index} arp`);
    }
  }
});

test('course arrangement fingerprints alter musical behavior, not just metadata', () => {
  const cone = RACE_SCHOOL_THEMES['training-loop'];
  const hazard = RACE_SCHOOL_THEMES['training-hazard-weave'];
  const redline = RACE_SCHOOL_THEMES['training-top-speed'];
  const air = RACE_SCHOOL_THEMES['training-airtime'];
  const rivals = RACE_SCHOOL_THEMES['training-rivals'];
  const flight = RACE_SCHOOL_THEMES['training-flight'];

  assert.ok(hazard.bars[8].padCutoff < cone.bars[8].padCutoff);
  assert.ok(redline.bars[8].arp?.length > 0);
  assert.equal(air.bars[8].leadSynth, 'chip');
  assert.ok(rivals.bars[8].kick.length > cone.bars[8].kick.length);
  assert.ok(flight.bars[8].arp?.length > 0);
});

test('building lesson variants preserves the original Music Player arrangement', () => {
  assert.equal(TRAINING_LOOP_THEME.bpm, 128);
  assert.equal(TRAINING_LOOP_THEME.bars[8].leadSynth, 'saw');
  assert.equal(TRAINING_LOOP_THEME.bars[8].arp, undefined);
  assert.equal(RACE_SCHOOL_VARIANTS['training-loop'].transpose, 0);
  assert.equal(raceSchoolThemeForTrack('missing'), RACE_SCHOOL_THEMES['training-loop']);
});
