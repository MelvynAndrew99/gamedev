import assert from 'node:assert/strict';
import test from 'node:test';

import { SHOP_THEME } from './shopTheme.js';

const theme = SHOP_THEME;
const hits = (pattern) => pattern.filter((value) => value != null).length;

test('the garage cue is a compact, mid-tempo dance loop', () => {
  assert.equal(theme.bpm, 112);
  assert.equal(theme.stepsPerBar, 16);
  assert.equal(theme.bars.length, 8);
  assert.ok(theme.swing > 0 && theme.swing < 0.3);

  const loopSeconds = theme.bars.length * theme.stepsPerBar * (60 / theme.bpm / 4);
  assert.ok(loopSeconds >= 16 && loopSeconds <= 24, `expected 16-24s, got ${loopSeconds.toFixed(2)}s`);
});

test('every shop bar has valid 16-bit future-funk tracker data', () => {
  for (const [index, bar] of theme.bars.entries()) {
    for (const voice of ['bass', 'lead', 'arp']) {
      assert.equal(bar[voice].length, theme.stepsPerBar, `bar ${index} ${voice}`);
    }
    for (const drums of ['kick', 'snare', 'hat', 'openHat']) {
      assert.ok(bar[drums].every((step) => step >= 0 && step < theme.stepsPerBar), `bar ${index} ${drums}`);
    }
    assert.equal(bar.leadSynth, 'chip');
    assert.equal(bar.bassFM, true);
    assert.equal(bar.sidechain, true);
    assert.equal(bar.padSaw, true);
    assert.equal(bar.leadTones.length, 6);
    assert.ok(bar.leadGain > 1);
    assert.ok(bar.bassGain < 1);
    assert.ok(bar.kickGain < 1);
    assert.ok(bar.snareGain < 1);
    assert.ok(bar.hatGain < 1);
  }
});

test('the hook uses consonant color tones with smooth chord-to-chord registers', () => {
  const firstPass = theme.bars.slice(0, 4);
  const leadRoots = firstPass.map((bar) => bar.leadTones[0]);
  assert.deepEqual(leadRoots, [0, 5, 10, 7]);

  // Root movement now stays within a perfect fifth instead of dropping the
  // Bmaj7 phrase below the hook and leaping back up on G#7.
  for (let index = 1; index < leadRoots.length; index++) {
    assert.ok(Math.abs(leadRoots[index] - leadRoots[index - 1]) <= 5);
  }

  for (const bar of firstPass) {
    const chordClasses = new Set(bar.chordTones.map((tone) => ((tone % 12) + 12) % 12));
    // The first five palette entries are chord tones; the sixth is the
    // deliberate ninth color used at the hook's peak.
    for (const tone of bar.leadTones.slice(0, 5)) {
      assert.ok(chordClasses.has(((tone % 12) + 12) % 12));
    }
  }
});

test('the short form includes a hook variation, breakdown, and loop fill', () => {
  assert.notDeepEqual(theme.bars[0].lead, theme.bars[2].lead);

  const breakdown = theme.bars[6];
  assert.ok(hits(breakdown.kick) < hits(theme.bars[5].kick));
  assert.ok(hits(breakdown.lead) < hits(theme.bars[5].lead));
  assert.ok(breakdown.padCutoff < theme.bars[5].padCutoff);

  const turnaround = theme.bars[7];
  assert.ok(hits(turnaround.snare) > hits(breakdown.snare));
  assert.ok(hits(turnaround.hat) > hits(breakdown.hat));
});
