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

test('rival feedback remains safe before browser audio is unlocked', () => {
  assert.doesNotThrow(() => MUSIC.playRivalThreat({ pan: -1 }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'rub' }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'slam', strength: 1.2 }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'takedown', pan: 1 }));
  assert.doesNotThrow(() => MUSIC.playTimeBonus());
  assert.doesNotThrow(() => MUSIC.playTimeBonus({ major: true }));
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

test('airtime audio exposes a safe lifecycle before browser audio is unlocked', () => {
  const handle = MUSIC.startAirtimeFlight({ boosted: true, speedRatio: 1.2 });
  assert.equal(typeof handle.update, 'function');
  assert.equal(typeof handle.stop, 'function');
  assert.doesNotThrow(() => handle.update({ progress: 0.5, glide: 1, elapsed: 0.6 }));
  assert.equal(handle.getControl(), 'long', 'state-only handle still captures the landing arc');
  assert.doesNotThrow(() => handle.stop());
  assert.doesNotThrow(() => handle.stop(), 'terminal cleanup is idempotent');
  assert.doesNotThrow(() => MUSIC.playRampTakeoff());
  assert.doesNotThrow(() => MUSIC.playAirtimeLanding());
  assert.doesNotThrow(() => MUSIC.playAirtimeGapMiss());
  assert.doesNotThrow(() => MUSIC.playAirtimeMasteryClear());
});

test('held or changing glide schedules no in-flight sound and only records the landing pose', () => {
  const previousContext = MUSIC.ctx;
  try {
    MUSIC.ctx = new Proxy({}, {
      get() {
        throw new Error('in-flight updates must not touch the audio graph');
      },
    });
    const handle = MUSIC.startAirtimeFlight({ boosted: true, speedRatio: 1.2 });
    for (let frame = 0; frame < 90; frame++) {
      assert.doesNotThrow(() => handle.update({
        progress: frame / 89,
        glide: frame < 30 ? -1 : 1,
        elapsed: frame / 60,
        currentSpeedRatio: 1.2,
      }));
    }
    assert.equal(handle.getControl(), 'long');
    handle.stop();
  } finally {
    MUSIC.ctx = previousContext;
  }
});
