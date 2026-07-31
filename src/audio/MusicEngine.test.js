import assert from 'node:assert/strict';
import test from 'node:test';

import { MUSIC, nonRepeatingIndex } from './MusicEngine.js';

test('impact variation selection never immediately repeats the previous sound', () => {
  for (let previous = 0; previous < 5; previous++) {
    const repeatedRoll = (previous + 0.01) / 5;
    const next = nonRepeatingIndex(previous, 5, () => repeatedRoll);
    assert.notEqual(next, previous);
    assert.ok(next >= 0 && next < 5);
  }
});

test('single-variant pools remain valid', () => {
  assert.equal(nonRepeatingIndex(0, 1, () => 0.9), 0);
});

test('music and gameplay feedback retain independent live volume settings', () => {
  const previousMusic = MUSIC.volume;
  const previousSfx = MUSIC.sfxVolume;
  try {
    MUSIC.setVolume(0.21);
    MUSIC.setSfxVolume(0.57);
    assert.equal(MUSIC.volume, 0.21);
    assert.equal(MUSIC.sfxVolume, 0.57);
  } finally {
    MUSIC.setVolume(previousMusic);
    MUSIC.setSfxVolume(previousSfx);
  }
});
