import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NEON_GULCH_ORIGINAL_THEME,
  NEON_GULCH_THEME,
} from './neonGulchTheme.js';

const hits = (pattern = []) => pattern.filter((value) => value != null).length;

test('Neon Gulch keeps its 36-second future-funk identity', () => {
  assert.equal(NEON_GULCH_THEME.bpm, 160);
  assert.equal(NEON_GULCH_THEME.stepsPerBar, 16);
  assert.equal(NEON_GULCH_THEME.bars.length, 24);
  assert.equal(NEON_GULCH_THEME.swing, 0.12);
  assert.equal(NEON_GULCH_THEME.bars.length * 4 * 60 / NEON_GULCH_THEME.bpm, 36);
});

test('the Open Road mix exposes its hook before restoring speed texture', () => {
  assert.equal(NEON_GULCH_THEME.bars[4].arp, undefined);
  assert.equal(NEON_GULCH_THEME.bars[5].arp, undefined);
  assert.ok(hits(NEON_GULCH_THEME.bars[6].arp) > 0);
  assert.deepEqual(NEON_GULCH_THEME.bars[4].lead, NEON_GULCH_THEME.bars[7].lead);
  assert.notDeepEqual(NEON_GULCH_THEME.bars[4].lead, NEON_GULCH_THEME.bars[8].lead);
});

test('bass and high motion sit below the produced melody in every busy section', () => {
  for (const [index, bar] of NEON_GULCH_THEME.bars.entries()) {
    assert.ok(bar.bassGain <= 0.76, `bar ${index} bass`);
    assert.ok(bar.bassCutoff <= 1040, `bar ${index} bass low-mid carve`);
    assert.equal(bar.bassHighpass, 49, `bar ${index} sub trim`);
    assert.ok(bar.hatGain <= 0.48, `bar ${index} hats`);
    assert.ok(bar.arpGain <= 0.52, `bar ${index} arp`);
    if (index >= 4 && index !== 12 && index !== 13 && index !== 14 && index !== 15) {
      assert.ok(bar.leadGain >= 1.12, `bar ${index} hook`);
    }
  }
});

test('the original tracker arrangement remains unchanged for the Music Player', () => {
  assert.ok(hits(NEON_GULCH_ORIGINAL_THEME.bars[4].arp) > 0);
  assert.equal(NEON_GULCH_ORIGINAL_THEME.bars[4].bassGain, undefined);
  assert.deepEqual(NEON_GULCH_ORIGINAL_THEME.bars[4].lead, NEON_GULCH_THEME.bars[4].lead);
});
