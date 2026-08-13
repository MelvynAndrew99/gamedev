import assert from 'node:assert/strict';
import test from 'node:test';

import { TITLE_THEME } from './titleTheme.js';

test('title theme is a compact original menu loop with a repeated hook and payoff', () => {
  assert.equal(TITLE_THEME.bpm, 128);
  assert.equal(TITLE_THEME.stepsPerBar, 16);
  assert.equal(TITLE_THEME.bars.length, 8);
  assert.deepEqual(TITLE_THEME.bars[0].lead, TITLE_THEME.bars[2].lead);
  assert.notDeepEqual(TITLE_THEME.bars[0].lead, TITLE_THEME.bars[4].lead);
  const seconds = TITLE_THEME.bars.length * 4 * 60 / TITLE_THEME.bpm;
  assert.ok(seconds >= 14 && seconds <= 18);
});

test('every title bar supplies valid tracker voices and drum steps', () => {
  for (const [index, bar] of TITLE_THEME.bars.entries()) {
    for (const voice of ['bass', 'lead', 'arp']) {
      assert.equal(bar[voice].length, 16, `bar ${index} ${voice}`);
    }
    for (const voice of ['kick', 'snare', 'hat', 'openHat']) {
      assert.ok(bar[voice].every((step) => step >= 0 && step < 16));
    }
    assert.equal(bar.sidechain, true);
    assert.equal(bar.padSaw, true);
  }
});
