import assert from 'node:assert/strict';
import test from 'node:test';

import { TRAINING_LOOP_THEME } from './trainingLoopTheme.js';

const theme = TRAINING_LOOP_THEME;
const hits = (pattern = []) => pattern.filter((value) => value != null).length;

test('Open Circuit is a 45-second, novice-friendly racing loop', () => {
  assert.equal(theme.bpm, 128);
  assert.equal(theme.stepsPerBar, 16);
  assert.equal(theme.bars.length, 24);
  const seconds = theme.bars.length * 4 * 60 / theme.bpm;
  assert.equal(seconds, 45);
});

test('every Open Circuit bar follows the tracker and mix contracts', () => {
  for (const [index, bar] of theme.bars.entries()) {
    for (const voice of ['bass', 'lead']) {
      assert.equal(bar[voice].length, theme.stepsPerBar, `bar ${index} ${voice}`);
    }
    if (bar.arp) assert.equal(bar.arp.length, theme.stepsPerBar, `bar ${index} arp`);
    for (const drum of ['kick', 'snare', 'hat', 'openHat']) {
      assert.ok(bar[drum].every((step) => step >= 0 && step < theme.stepsPerBar));
    }
    for (const gain of ['bassGain', 'kickGain', 'snareGain', 'hatGain']) {
      assert.ok(bar[gain] > 0 && bar[gain] <= 1, `bar ${index} ${gain}`);
    }
    assert.ok(bar.padGain >= 0.11 && bar.padGain <= 0.18, `bar ${index} padGain`);
    assert.equal(bar.guitar, undefined);
    assert.equal(bar.chug, undefined);
  }
});

test('the arrangement builds, clears space, and earns its final lift', () => {
  const intro = theme.bars[0];
  const groove = theme.bars[8];
  const liftedGroove = theme.bars[12];
  const reset = theme.bars[16];
  const payoff = theme.bars[20];

  assert.ok(hits(intro.kick) < hits(groove.kick));
  assert.ok(intro.padCutoff < groove.padCutoff);
  assert.equal(groove.arp, undefined);
  assert.ok(hits(liftedGroove.arp) > 0);
  assert.ok(hits(reset.bass) < hits(groove.bass));
  assert.ok(hits(reset.hat) < hits(groove.hat));
  assert.equal(reset.arp, undefined);
  assert.ok(payoff.padCutoff > liftedGroove.padCutoff);
  assert.ok(hits(payoff.hat) > hits(liftedGroove.hat));
});

test('the hook repeats clearly before its varied answer', () => {
  assert.deepEqual(theme.bars[8].lead, theme.bars[11].lead);
  assert.notDeepEqual(theme.bars[8].lead, theme.bars[12].lead);
});
