import assert from 'node:assert/strict';
import test from 'node:test';

import { REDLINE_GAUNTLET_THEME } from './redlineGauntletTheme.js';

const theme = REDLINE_GAUNTLET_THEME;
const hitCount = (pattern = []) => pattern.filter((step) => step != null).length;

test('Redline Gauntlet preserves the 184 BPM maximum-intensity arrangement', () => {
  assert.equal(theme.bpm, 184);
  assert.ok(theme.bpm >= 168 && theme.bpm <= 190);
  assert.equal(theme.stepsPerBar, 16);
  assert.equal(theme.bars.length, 32);

  const loopSeconds = theme.bars.length * theme.stepsPerBar * (60 / theme.bpm / 4);
  assert.ok(loopSeconds >= 30, `expected a 30s loop, got ${loopSeconds.toFixed(2)}s`);
});

test('every Redline Gauntlet bar is valid tracker data', () => {
  for (const [index, bar] of theme.bars.entries()) {
    for (const voice of ['bass', 'chug', 'lead']) {
      assert.equal(bar[voice].length, theme.stepsPerBar, `bar ${index} ${voice}`);
    }
    if (bar.guitar) assert.equal(bar.guitar.length, theme.stepsPerBar, `bar ${index} guitar`);

    for (const drum of ['kick', 'snare', 'hat', 'openHat', 'industrial', 'industrialAccent']) {
      assert.ok(bar[drum].every((step) => step >= 0 && step < theme.stepsPerBar), `bar ${index} ${drum}`);
    }

    assert.equal(bar.leadSynth, 'metal');
    assert.equal(bar.driveBass, true);
    assert.equal(bar.bassFM, true);
    assert.equal(bar.sidechain, true);
  }
});

test('the arrangement moves from assault through tension to a layered final push', () => {
  // It punches in immediately with a dense kick/chug grid and industrial steel.
  assert.ok(hitCount(theme.bars[0].kick) >= 8);
  assert.ok(hitCount(theme.bars[0].chug) >= 10);
  assert.ok(theme.bars[0].industrial.length > 0);

  // Bars 21-23 are the half-time tension bridge; bar 24 is the relaunch fill.
  for (const bar of theme.bars.slice(20, 23)) {
    assert.deepEqual(bar.snare, [8]);
    assert.ok(hitCount(bar.hat) < hitCount(theme.bars[0].hat));
    assert.ok(bar.padCutoff < theme.bars[0].padCutoff);
  }
  assert.ok(hitCount(theme.bars[23].snare) > hitCount(theme.bars[22].snare));

  // The final eight bars contain the densest double-kick grid. Acoustic-like
  // power chords are supporting accents and never replace the cyber-chug.
  const finale = theme.bars.slice(24);
  assert.ok(finale.some((bar) => hitCount(bar.kick) >= 11));
  assert.ok(finale.some((bar) => bar.guitar));
  assert.ok(theme.bars.slice(0, 24).every((bar) => !bar.guitar));
  assert.ok(finale.every((bar) => hitCount(bar.chug) > hitCount(bar.guitar)));
});
