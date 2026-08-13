import assert from 'node:assert/strict';
import test from 'node:test';

import { MUSIC, SFX_VARIANT_COUNTS, nonRepeatingIndex } from './MusicEngine.js';

test('every recurring gameplay SFX family has a real variation pool', () => {
  Object.entries(SFX_VARIANT_COUNTS).forEach(([family, count]) => {
    assert.ok(count >= 3, `${family} needs at least three variants`);
  });
});

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

function fakeAudioParam(value = 0) {
  return {
    value,
    setValueAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next) { this.value = next; },
    cancelScheduledValues() {},
  };
}

function fakeAudioNode(extra = {}) {
  return {
    connect(next) { return next; },
    start() {},
    stop() {},
    ...extra,
  };
}

test('menu navigation cue rate-limits axis chatter instead of queuing stale clicks', () => {
  const previous = {
    ctx: MUSIC.ctx,
    sfxBus: MUSIC.sfxBus,
    lastMenuMoveTime: MUSIC.lastMenuMoveTime,
  };
  const ctx = {
    currentTime: 2,
    createOscillator: () => fakeAudioNode({
      frequency: fakeAudioParam(), type: 'sine',
    }),
    createGain: () => fakeAudioNode({ gain: fakeAudioParam(1) }),
  };
  try {
    MUSIC.ctx = ctx;
    MUSIC.sfxBus = fakeAudioNode();
    MUSIC.lastMenuMoveTime = -Infinity;
    assert.equal(MUSIC.playMenuMove('right'), true);
    assert.equal(MUSIC.playMenuMove('right'), false);
    ctx.currentTime += 0.026;
    assert.equal(MUSIC.playMenuMove('down'), true);
  } finally {
    MUSIC.ctx = previous.ctx;
    MUSIC.sfxBus = previous.sfxBus;
    MUSIC.lastMenuMoveTime = previous.lastMenuMoveTime;
  }
});

test('every layered gameplay SFX builds and schedules a valid audio graph', () => {
  const previous = {
    ctx: MUSIC.ctx,
    sfxBus: MUSIC.sfxBus,
    noiseBuffer: MUSIC.noiseBuffer,
  };
  const ctx = {
    currentTime: 1,
    createOscillator: () => fakeAudioNode({
      frequency: fakeAudioParam(), detune: fakeAudioParam(), type: 'sine',
    }),
    createGain: () => fakeAudioNode({ gain: fakeAudioParam(1) }),
    createStereoPanner: () => fakeAudioNode({ pan: fakeAudioParam() }),
    createBiquadFilter: () => fakeAudioNode({
      frequency: fakeAudioParam(), Q: fakeAudioParam(), type: 'lowpass',
    }),
    createBufferSource: () => fakeAudioNode({ buffer: null, loop: false }),
  };
  try {
    MUSIC.ctx = ctx;
    MUSIC.sfxBus = fakeAudioNode();
    MUSIC.noiseBuffer = {};
    assert.doesNotThrow(() => MUSIC.playConeHit());
    assert.doesNotThrow(() => MUSIC.playBoostPickup());
    assert.doesNotThrow(() => MUSIC.playMenuMove('right'));
    assert.doesNotThrow(() => MUSIC.playBoostApply(2));
    assert.doesNotThrow(() => MUSIC.playSpeedLine());
    assert.doesNotThrow(() => MUSIC.playDamageImpact({ severity: 1.2 }));
    assert.doesNotThrow(() => MUSIC.playRivalThreat());
    assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'rub' }));
    assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'takedown' }));
    assert.doesNotThrow(() => MUSIC.playTimeBonus({ major: true }));
    assert.doesNotThrow(() => MUSIC.playGlassCrack(3));
    const hold = MUSIC.startBoostHold();
    assert.doesNotThrow(() => hold.stop());
    assert.doesNotThrow(() => MUSIC.playRampTakeoff({ boosted: true, speedRatio: 1.2 }));
    assert.doesNotThrow(() => MUSIC.playAirtimeLanding({ seconds: 1.1 }));
    assert.doesNotThrow(() => MUSIC.playAirtimeGapMiss());
    assert.doesNotThrow(() => MUSIC.playAirtimeMasteryClear());
    assert.doesNotThrow(() => MUSIC.playTrainingComplete({ perfect: true, stars: 3 }));
    assert.doesNotThrow(() => MUSIC.playStyleReward('speed_line_chain'));
  } finally {
    MUSIC.ctx = previous.ctx;
    MUSIC.sfxBus = previous.sfxBus;
    MUSIC.noiseBuffer = previous.noiseBuffer;
  }
});

test('rival feedback remains safe before browser audio is unlocked', () => {
  assert.doesNotThrow(() => MUSIC.playRivalThreat({ pan: -1 }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'rub' }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'slam', strength: 1.2 }));
  assert.doesNotThrow(() => MUSIC.playRivalImpact({ kind: 'takedown', pan: 1 }));
  assert.doesNotThrow(() => MUSIC.playTimeBonus());
  assert.doesNotThrow(() => MUSIC.playTimeBonus({ major: true }));
  assert.doesNotThrow(() => MUSIC.playSpeedLine());
  assert.doesNotThrow(() => MUSIC.playMenuMove('left'));
  assert.doesNotThrow(() => MUSIC.playDamageImpact({ severity: 1.25 }));
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

test('temporary music fades preserve the player volume setting', () => {
  const previous = { ctx: MUSIC.ctx, master: MUSIC.master, volume: MUSIC.volume };
  const gain = fakeAudioParam(0.2);
  try {
    MUSIC.ctx = { currentTime: 4 };
    MUSIC.master = fakeAudioNode({ gain });
    MUSIC.volume = 0.2;
    assert.equal(MUSIC.fadeMusicTo(0.01, 0.8), true);
    assert.equal(gain.value, 0.01);
    assert.equal(MUSIC.volume, 0.2, 'a transition duck is not a settings change');
  } finally {
    MUSIC.ctx = previous.ctx;
    MUSIC.master = previous.master;
    MUSIC.volume = previous.volume;
  }
});

test('story mixes can band-limit bass independently of the master bus', () => {
  const previous = { ctx: MUSIC.ctx, duckable: MUSIC.duckable };
  const filters = [];
  const ctx = {
    createOscillator: () => fakeAudioNode({
      frequency: fakeAudioParam(), type: 'sine',
    }),
    createGain: () => fakeAudioNode({ gain: fakeAudioParam(1) }),
    createBiquadFilter: () => {
      const filter = fakeAudioNode({
        frequency: fakeAudioParam(), Q: fakeAudioParam(), type: 'lowpass',
      });
      filters.push(filter);
      return filter;
    },
  };
  try {
    MUSIC.ctx = ctx;
    MUSIC.duckable = fakeAudioNode();
    MUSIC.playBass(110, 1, 0.2, false, false, 0.7, 740, 52);
    assert.deepEqual(
      filters.map((filter) => [filter.type, filter.frequency.value]),
      [['lowpass', 740], ['highpass', 52]],
    );
  } finally {
    MUSIC.ctx = previous.ctx;
    MUSIC.duckable = previous.duckable;
  }
});

test('pause and resume freeze the shared audio clock without restarting the track', async () => {
  const previousContext = MUSIC.ctx;
  const previousTrack = MUSIC.track;
  let suspended = 0;
  let resumed = 0;
  const ctx = {
    state: 'running',
    suspend() {
      suspended += 1;
      this.state = 'suspended';
      return Promise.resolve();
    },
    resume() {
      resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    },
  };
  const track = { id: 'still-playing' };
  try {
    MUSIC.ctx = ctx;
    MUSIC.track = track;
    assert.equal(await MUSIC.pausePlayback(), true);
    assert.equal(await MUSIC.pausePlayback(), false, 'a paused context is not suspended twice');
    assert.equal(MUSIC.track, track, 'pause does not reset arrangement state');
    assert.equal(await MUSIC.resumePlayback(), true);
    assert.equal(await MUSIC.resumePlayback(), false, 'a running context is not resumed twice');
    assert.equal(suspended, 1);
    assert.equal(resumed, 1);
  } finally {
    MUSIC.ctx = previousContext;
    MUSIC.track = previousTrack;
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
