import assert from 'node:assert/strict';
import test from 'node:test';

import { PROVING_GROUND_THEME } from './provingGroundTheme.js';
import { TRAINING_LOOP_THEME } from './trainingLoopTheme.js';

const theme = PROVING_GROUND_THEME;
const hits = (pattern = []) => pattern.filter((value) => value != null).length;

test('Start Signal gives Proving Ground a full-length Story identity', () => {
  assert.equal(theme.bpm, 144);
  assert.equal(theme.stepsPerBar, 16);
  assert.equal(theme.bars.length, 28);
  assert.ok(theme.swing > 0 && theme.swing < 0.1);
  const seconds = theme.bars.length * 4 * 60 / theme.bpm;
  assert.ok(seconds >= 45 && seconds < 48, `expected about 46.7s, got ${seconds}`);
});

test('Proving Ground does not reuse Race School music or harmonic identity', () => {
  assert.notEqual(theme, TRAINING_LOOP_THEME);
  assert.notEqual(theme.bpm, TRAINING_LOOP_THEME.bpm);
  assert.notEqual(theme.bars[0].bassRootFreq, TRAINING_LOOP_THEME.bars[0].bassRootFreq);
  assert.notEqual(theme.bars[0].leadRootFreq, TRAINING_LOOP_THEME.bars[0].leadRootFreq);
  assert.notDeepEqual(theme.bars[8].lead, TRAINING_LOOP_THEME.bars[8].lead);
});

test('Start Signal is valid, mix-controlled tracker data', () => {
  for (const [index, bar] of theme.bars.entries()) {
    for (const voice of ['bass', 'lead']) {
      assert.equal(bar[voice].length, 16, `bar ${index} ${voice}`);
    }
    if (bar.arp) assert.equal(bar.arp.length, 16, `bar ${index} arp`);
    for (const drums of ['kick', 'snare', 'hat', 'openHat']) {
      assert.ok(bar[drums].every((step) => step >= 0 && step < 16), `bar ${index} ${drums}`);
    }
    for (const gain of ['bassGain', 'leadGain', 'padGain', 'kickGain', 'snareGain', 'hatGain']) {
      assert.ok(bar[gain] > 0 && bar[gain] <= 1.2, `bar ${index} ${gain}`);
    }
    assert.ok(bar.bassCutoff >= 650 && bar.bassCutoff <= 950, `bar ${index} bass band`);
    assert.equal(bar.bassHighpass, 50);
  }
});

test('the campaign hook repeats, clears space, and returns as a larger payoff', () => {
  assert.deepEqual(theme.bars[8].lead, theme.bars[9].lead);
  assert.notDeepEqual(theme.bars[8].lead, theme.bars[12].lead);
  assert.ok(hits(theme.bars[16].bass) < hits(theme.bars[8].bass));
  assert.ok(hits(theme.bars[16].hat) < hits(theme.bars[8].hat));
  assert.equal(theme.bars[16].leadSynth, 'keys');
  assert.equal(theme.bars[20].leadSynth, 'saw');
  assert.ok(hits(theme.bars[20].hat) > hits(theme.bars[8].hat));
  assert.ok(theme.bars[20].padCutoff > theme.bars[8].padCutoff);
});
