import assert from 'node:assert/strict';
import test from 'node:test';

import { SYNDICATE_RUN_THEME } from './syndicateRunTheme.js';

const theme = SYNDICATE_RUN_THEME;
const hits = (pattern = []) => pattern.filter((value) => value != null).length;

test('Syndicate Run is a paced 52-second intensity arc', () => {
  assert.equal(theme.bpm, 166);
  assert.equal(theme.stepsPerBar, 16);
  assert.equal(theme.bars.length, 36);

  const loopSeconds = theme.bars.length * theme.stepsPerBar * (60 / theme.bpm / 4);
  assert.ok(loopSeconds >= 50 && loopSeconds < 55, `expected about 52s, got ${loopSeconds.toFixed(2)}s`);
});

test('every Syndicate Run section is valid tracker data', () => {
  for (const [index, bar] of theme.bars.entries()) {
    for (const voice of ['bass', 'chug', 'lead']) {
      assert.equal(bar[voice].length, theme.stepsPerBar, `bar ${index} ${voice}`);
    }
    if (bar.guitar) assert.equal(bar.guitar.length, theme.stepsPerBar, `bar ${index} guitar`);

    for (const drums of ['kick', 'snare', 'hat', 'openHat', 'industrial', 'industrialAccent']) {
      assert.ok(bar[drums].every((step) => step >= 0 && step < theme.stepsPerBar), `bar ${index} ${drums}`);
    }
    assert.equal(bar.leadTones.length, 6);
    assert.ok(bar.kickGain <= 1);
    assert.ok(bar.snareGain <= 1);
    assert.ok(bar.hatGain <= 1);
  }
});

test('the arrangement grows, pays off, falls away, and rebuilds', () => {
  const intro = theme.bars[0];
  const mainGroove = theme.bars[8];
  const payoff = theme.bars[21];
  const interlude = theme.bars[28];

  assert.ok(hits(intro.kick) < hits(mainGroove.kick));
  assert.ok(hits(intro.hat) < hits(mainGroove.hat));
  assert.ok(hits(intro.chug) < hits(mainGroove.chug));

  assert.ok(hits(payoff.kick) > hits(mainGroove.kick));
  assert.ok(hits(payoff.chug) > hits(mainGroove.chug));
  assert.ok(payoff.guitar);

  assert.ok(hits(interlude.kick) < hits(payoff.kick));
  assert.equal(hits(interlude.chug), 0);
  assert.equal(interlude.leadSynth, 'chip');
  assert.ok(interlude.padCutoff < payoff.padCutoff);

  const rebuild = theme.bars.slice(32, 36);
  for (let index = 1; index < rebuild.length; index++) {
    assert.ok(rebuild[index].padCutoff > rebuild[index - 1].padCutoff);
  }
  assert.ok(hits(rebuild[3].kick) > hits(rebuild[0].kick));
  assert.ok(hits(rebuild[3].chug) > hits(rebuild[0].chug));
});

test('the main groove repeats one hook before varying it', () => {
  assert.deepEqual(theme.bars[8].lead, theme.bars[10].lead);
  assert.notDeepEqual(theme.bars[8].lead, theme.bars[12].lead);
});
