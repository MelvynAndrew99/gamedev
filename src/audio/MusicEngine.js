// MusicEngine.js — a tracker, not a tape deck. There's no audio file:
// tracks are data (chords + step patterns), and this engine synthesizes
// every note live with the Web Audio API, the same "art-as-code" approach
// tools/gen-car.js uses for sprites. Module-level singleton (see
// RacerState.js) — survives scene restarts, dies on refresh.
//
// Scheduling follows the standard "look-ahead" pattern (Chris Wilson,
// "A Tale of Two Clocks"): a cheap setInterval wakes up often and pushes
// any step whose time has come within the next SCHEDULE_AHEAD seconds
// onto the audio clock, which is sample-accurate. Driving oscillator
// start times off setInterval directly would drift and jitter.

import {
  AIRTIME_TAKEOFF_SWEEP_SECONDS,
  airtimeLandingKind,
  nextAirtimeControl,
  repeatedTakeoffGain,
} from './AirtimeAudio.js';

const LOOKAHEAD_MS = 25;      // how often the scheduler timer fires
const SCHEDULE_AHEAD = 0.12;  // seconds of audio queued per timer tick

function semitoneRatio(semitones) {
  return Math.pow(2, semitones / 12);
}

export function nonRepeatingIndex(previous, count, random = Math.random) {
  if (count <= 1) return 0;
  const rolled = Math.min(count - 1, Math.floor(random() * count));
  return rolled === previous ? (rolled + 1) % count : rolled;
}

const CONE_HIT_VARIATIONS = [
  { body: 90, noiseFreq: 920, q: 0.9, tone: 220, wave: 'triangle', sweep: 0.82, pan: -0.16, level: 0.96 },
  { body: 104, noiseFreq: 1080, q: 1.2, tone: 246.94, wave: 'square', sweep: 0.9, pan: 0.12, level: 1 },
  { body: 118, noiseFreq: 1260, q: 1.45, tone: 261.63, wave: 'triangle', sweep: 1.04, pan: -0.06, level: 0.9 },
  { body: 132, noiseFreq: 1420, q: 1.1, tone: 293.66, wave: 'sine', sweep: 0.86, pan: 0.18, level: 0.94 },
  { body: 98, noiseFreq: 1180, q: 1.35, tone: 329.63, wave: 'square', sweep: 0.96, pan: 0.02, level: 0.88 },
];

// A bright, friendly confirmation chime for collecting a green boost pickup
// — never a crack/impact layer, it's a reward not a hit.
const BOOST_PICKUP_VARIATIONS = [
  { tone: 587.33, sweep: 1.5, wave: 'triangle', pan: -0.14, level: 0.95 },
  { tone: 659.25, sweep: 1.42, wave: 'sine', pan: 0.1, level: 1 },
  { tone: 698.46, sweep: 1.58, wave: 'triangle', pan: -0.04, level: 0.92 },
  { tone: 783.99, sweep: 1.48, wave: 'sine', pan: 0.18, level: 0.98 },
  { tone: 880, sweep: 1.55, wave: 'triangle', pan: 0.0, level: 0.9 },
];

// The moment a boost tap/hold-drain spends a slot: small variations in the
// aerodynamic wash. Keep these broad and unpitched; a boost should read as
// air accelerating around the car, never as a spring or an impact.
const BOOST_APPLY_VARIATIONS = [
  { low: 360, mid: 190, high: 2900, pan: -0.2 },
  { low: 430, mid: 218, high: 3400, pan: 0.16 },
  { low: 320, mid: 174, high: 2600, pan: 0.04 },
  { low: 500, mid: 236, high: 3800, pan: -0.08 },
];

// Rival contact has its own material pool. Variation changes the resonant
// body, metal band, decay, and stereo bias—not only pitch—so repeated pack
// fighting does not turn into one machine-gun sample.
const RIVAL_IMPACT_VARIATIONS = [
  { body: 72, metal: 760, q: 0.8, decay: 0.1, pan: -0.12, wave: 'sine' },
  { body: 84, metal: 980, q: 1.25, decay: 0.13, pan: 0.1, wave: 'triangle' },
  { body: 64, metal: 1280, q: 1.55, decay: 0.09, pan: -0.04, wave: 'sine' },
  { body: 96, metal: 620, q: 0.65, decay: 0.15, pan: 0.16, wave: 'triangle' },
];

const RIVAL_TAKEDOWN_VARIATIONS = [
  { body: 58, metal: 540, chord: [196, 246.94, 329.63], pan: -0.1 },
  { body: 66, metal: 720, chord: [220, 277.18, 369.99], pan: 0.12 },
  { body: 52, metal: 880, chord: [174.61, 261.63, 349.23], pan: 0 },
];

const RIVAL_THREAT_VARIATIONS = [
  { low: 74, start: 340, end: 510, high: 2280, wave: 'square' },
  { low: 82, start: 390, end: 585, high: 2640, wave: 'triangle' },
  { low: 68, start: 310, end: 465, high: 2050, wave: 'sawtooth' },
];

// Clock rewards need to read as added opportunity, not another impact or
// boost pickup. Three short ascending intervals rotate without immediate
// repeats; lap bonuses use a slightly wider second note than clock cones.
const TIME_BONUS_VARIATIONS = [
  { tone: 523.25, ratio: 1.5, wave: 'sine', pan: -0.08 },
  { tone: 587.33, ratio: 1.333, wave: 'triangle', pan: 0.08 },
  { tone: 659.25, ratio: 1.25, wave: 'sine', pan: 0 },
];

// Gameplay SFX use the same production contract as layered studio samples:
// low = weight, mid = material/identity, high = speed/detail. Pools change
// pitch, envelope, filtering, and stereo bias—not merely overall volume.
const GLASS_CRACK_VARIATIONS = [
  { body: 76, mid: 1120, high: 2780, pan: -0.14, decay: 0.11 },
  { body: 88, mid: 1380, high: 3260, pan: 0.12, decay: 0.14 },
  { body: 68, mid: 960, high: 2460, pan: 0.03, decay: 0.12 },
];
const SPEED_LINE_VARIATIONS = [
  { low: 72, mid: 260, air: 3400, pan: -0.16 },
  { low: 80, mid: 292, air: 3900, pan: 0.14 },
  { low: 66, mid: 238, air: 3050, pan: 0.02 },
];
const DAMAGE_VARIATIONS = [
  { low: 52, mid: 620, high: 2380, pan: -0.12, decay: 0.3 },
  { low: 61, mid: 760, high: 2860, pan: 0.14, decay: 0.26 },
  { low: 46, mid: 540, high: 2050, pan: 0.02, decay: 0.34 },
];
const BOOST_HOLD_VARIATIONS = [
  { low: 88, detune: 2.6, mid: 360, high: 2200, pan: -0.08 },
  { low: 96, detune: 3.1, mid: 410, high: 2500, pan: 0.07 },
  { low: 82, detune: 2.2, mid: 330, high: 1950, pan: 0 },
];
const RAMP_VARIATIONS = [
  { low: 58, mid: 340, high: 2900, pan: -0.1 },
  { low: 66, mid: 390, high: 3300, pan: 0.1 },
  { low: 54, mid: 310, high: 2600, pan: 0 },
];
const LANDING_VARIATIONS = [
  { low: 48, mid: 690, high: 2350, pan: -0.1 },
  { low: 55, mid: 820, high: 2780, pan: 0.1 },
  { low: 44, mid: 610, high: 2080, pan: 0 },
];
const GAP_MISS_VARIATIONS = [
  { low: 72, mid: 285, high: 1180, pan: -0.1 },
  { low: 82, mid: 320, high: 1360, pan: 0.1 },
  { low: 66, mid: 250, high: 980, pan: 0 },
];
const CELEBRATION_VARIATIONS = [
  { root: 110, ratio: 1, pan: -0.08 },
  { root: 123.47, ratio: 1.059, pan: 0.08 },
  { root: 98, ratio: 0.944, pan: 0 },
];
const CASH_REWARD_VARIATIONS = [
  { low: 92, mid: 740, high: 1760, ratio: 1.25, pan: -0.08 },
  { low: 104, mid: 820, high: 1960, ratio: 1.333, pan: 0.08 },
  { low: 86, mid: 680, high: 1560, ratio: 1.5, pan: 0 },
];

export const SFX_VARIANT_COUNTS = Object.freeze({
  cone: CONE_HIT_VARIATIONS.length,
  boostPickup: BOOST_PICKUP_VARIATIONS.length,
  boostApply: BOOST_APPLY_VARIATIONS.length,
  boostHold: BOOST_HOLD_VARIATIONS.length,
  speedLine: SPEED_LINE_VARIATIONS.length,
  rivalThreat: RIVAL_THREAT_VARIATIONS.length,
  rivalImpact: RIVAL_IMPACT_VARIATIONS.length,
  rivalTakedown: RIVAL_TAKEDOWN_VARIATIONS.length,
  timeBonus: TIME_BONUS_VARIATIONS.length,
  glass: GLASS_CRACK_VARIATIONS.length,
  damage: DAMAGE_VARIATIONS.length,
  ramp: RAMP_VARIATIONS.length,
  landing: LANDING_VARIATIONS.length,
  gapMiss: GAP_MISS_VARIATIONS.length,
  celebration: CELEBRATION_VARIATIONS.length,
  cashReward: CASH_REWARD_VARIATIONS.length,
});

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null; // music bus (kept as master for existing voice routing)
    this.sfxBus = null;
    this.mixBus = null;
    this.noiseBuffer = null;
    this.timer = null;
    this.track = null;
    this.volume = 0.16;
    this.sfxVolume = 1.0;
    this.musicMuted = false;
    this.sfxMuted = false;
    this.lastConeVariation = -1;
    this.lastBoostPickupVariation = -1;
    this.lastBoostApplyVariation = -1;
    this.lastRivalImpactVariation = -1;
    this.lastRivalTakedownVariation = -1;
    this.lastRivalThreatVariation = -1;
    this.lastTimeBonusVariation = -1;
    this.lastGlassVariation = -1;
    this.lastSpeedLineVariation = -1;
    this.lastDamageVariation = -1;
    this.lastBoostHoldVariation = -1;
    this.lastRampVariation = -1;
    this.lastLandingVariation = -1;
    this.lastGapMissVariation = -1;
    this.lastMasteryVariation = -1;
    this.lastTrainingCompleteVariation = -1;
    this.lastStyleRewardVariation = -1;
    this.lastCashRewardVariation = -1;
    this.lastTakeoffTime = -Infinity;
    this.lastMenuMoveTime = -Infinity;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.musicMuted ? 0 : this.volume;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
    this.mixBus = this.ctx.createGain();
    this.mixBus.gain.value = 1;

    // Sidechain-style pump bus. Sustained/harmonic voices (bass, keys, pad)
    // connect here instead of straight to master; kick/snare/hat and the
    // lead voices bypass it and go straight to master so the pump doesn't
    // duck the very drum causing it. When no track calls duck() this sits
    // at gain 1 and is transparent — every existing theme sounds identical
    // whether or not it opts into bar.sidechain.
    this.duckable = this.ctx.createGain();
    this.duckable.gain.value = 1;
    this.duckable.connect(this.master);

    // Algorithmic reverb send (no IR file — a synthesized decaying-noise
    // impulse, same "generate it, don't ship an asset" approach as
    // makeNoiseBuffer/tools/gen-*.js). Pad and the saw lead feed a portion
    // in for the "lush reverb" / cinematic-tail texture; everything else
    // stays dry so drums keep their transient punch.
    this.reverbBus = this.ctx.createGain();
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeReverbImpulse();
    const reverbReturn = this.ctx.createGain();
    reverbReturn.gain.value = 0.5; // overall wet trim, on top of each voice's own send level
    this.reverbBus.connect(this.reverb).connect(reverbReturn).connect(this.master);

    // Safety + color chain, master -> destination. Individual voices are
    // tuned to sound right in isolation, but a strong downbeat can stack
    // kick + bass + pad + lead at once; without a ceiling that sum clips at
    // the DAC — the harsh "blown speaker" distortion, not a volume/EQ
    // complaint.
    //   saturate: gentle tanh drive well below the limiter's threshold —
    //             tape-style warmth/glue on the whole mix, not audible
    //             grit on its own (that's driveBass's job at the source).
    //   subCut:   laptop speakers can't reproduce ~50Hz and below; driving
    //             them there doesn't add bass, it adds rattle. Removing it
    //             costs nothing audible on real speakers/headphones either.
    //   limiter:  a fast brickwall on whatever peak survives saturation, so
    //             no combination of simultaneous voices can exceed 0dBFS.
    const saturate = this.ctx.createWaveShaper();
    saturate.curve = this.satCurve();
    saturate.oversample = '2x';

    const subCut = this.ctx.createBiquadFilter();
    subCut.type = 'highpass';
    subCut.frequency.value = 48;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;

    // Music and gameplay feedback share the safety/color chain but have
    // independent trims. This keeps repeated targets audible without making
    // the catchy score quieter or pushing the final mix past the limiter.
    this.master.connect(this.mixBus);
    this.sfxBus.connect(this.mixBus);
    this.mixBus.connect(saturate).connect(subCut).connect(limiter).connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoiseBuffer();
  }

  makeNoiseBuffer() {
    const seconds = 1;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Exponentially-decaying stereo noise burst used as a convolution impulse
  // response — a cheap synthesized "room" instead of a shipped IR sample.
  makeReverbImpulse(seconds = 2.2, decay = 3.2) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // Mild tape-style saturation curve — much gentler than driveCurve's bass
  // grit, meant to be inaudible as "distortion" and just glue/warm the sum.
  satCurve() {
    if (this._satCurve) return this._satCurve;
    const n = 256;
    const curve = new Float32Array(n);
    const amount = 1.6;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    this._satCurve = curve;
    return curve;
  }

  // Sidechain-style pump: a quick dip and analog-ish recovery on the
  // duckable bus, timed to a kick hit. setTargetAtTime (not a hard ramp +
  // cancel) so overlapping kicks layer smoothly instead of clicking.
  duck(time, depth = 0.4) {
    const g = this.duckable.gain;
    const attack = 0.015;
    const release = 0.16;
    g.setTargetAtTime(depth, time, attack);
    g.setTargetAtTime(1, time + attack, release);
  }

  setVolume(v) {
    this.volume = v;
    const target = this.musicMuted ? 0 : v;
    if (this.master) this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  setMusicMuted(muted) {
    this.musicMuted = !!muted;
    const target = this.musicMuted ? 0 : this.volume;
    if (this.master) this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.025);
  }

  // Scene transitions can duck the score without changing the player's saved
  // volume. The next theme fades into the same mix level instead of cutting
  // across a phrase at full volume.
  fadeMusicTo(v, seconds = 0.65) {
    if (!this.master || !this.ctx) return false;
    const target = this.musicMuted ? 0 : Math.max(0.0001, Number(v) || 0.0001);
    const duration = Math.max(0.01, Number(seconds) || 0.65);
    const gain = this.master.gain;
    const time = this.ctx.currentTime;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(Math.max(0.0001, gain.value), time);
    gain.linearRampToValueAtTime(target, time + duration);
    return true;
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    const target = this.sfxMuted ? 0 : v;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  setSfxMuted(muted) {
    this.sfxMuted = !!muted;
    const target = this.sfxMuted ? 0 : this.sfxVolume;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.025);
  }

  start(track) {
    this.ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.track === track && this.timer) return; // already playing this track

    this.stop();
    this.track = track;
    this.lastTakeoffTime = -Infinity; // every run's first ramp gets full weight
    this.stepIndex = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.secondsPerStep = 60 / track.bpm / 4; // 16th notes
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  pausePlayback() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.ctx.suspend) {
      return Promise.resolve(false);
    }
    return this.ctx.suspend().then(() => true).catch(() => false);
  }

  resumePlayback() {
    if (!this.ctx || this.ctx.state !== 'suspended' || !this.ctx.resume) {
      return Promise.resolve(false);
    }
    return this.ctx.resume().then(() => true).catch(() => false);
  }

  scheduler() {
    const track = this.track;
    if (!track) return;
    const totalSteps = track.bars.length * track.stepsPerBar;
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      const step = this.stepIndex % totalSteps;
      const barIndex = Math.floor(step / track.stepsPerBar);
      const stepInBar = step % track.stepsPerBar;

      // Swing: push the "and" of each beat (the 3rd 16th in every group of
      // four) late by a fraction of a step. Only that position moves — the
      // downbeats stay put — which is what turns a straight grid into a
      // laid-back shuffle instead of just slower music. Unset on a track
      // (the racing theme), this is 0 and every step lands exactly on grid.
      const swingLate = track.swing && stepInBar % 4 === 2 ? track.swing * this.secondsPerStep : 0;
      this.scheduleStep(track.bars[barIndex], stepInBar, this.nextStepTime + swingLate);

      this.nextStepTime += this.secondsPerStep;
      this.stepIndex++;
    }
  }

  scheduleStep(bar, step, time) {
    const dur = this.secondsPerStep;

    const bassOffset = bar.bass[step];
    if (bassOffset != null) {
      this.playBass(
        bar.bassRootFreq * semitoneRatio(bassOffset),
        time,
        dur * 1.8,
        bar.driveBass,
        bar.bassFM,
        bar.bassGain,
        bar.bassCutoff,
        bar.bassHighpass,
      );
    }

    const leadIdx = bar.lead[step];
    if (leadIdx != null) {
      // A lead can opt into its own chord/color-tone palette while the pad
      // keeps the actual harmony. This lets compact themes repeat one catchy
      // contour across different chord qualities without forcing those extra
      // melody notes into the sustained chord voicing.
      const leadTones = bar.leadTones ?? bar.chordTones;
      const tone = leadTones[leadIdx % leadTones.length];
      const freq = bar.leadRootFreq * semitoneRatio(tone);
      if (bar.leadSynth === 'keys') this.playKeys(freq, time, dur * 3, bar.leadGain);
      else if (bar.leadSynth === 'saw') this.playSawLead(freq, time, dur * 1.4, bar.leadGain);
      else if (bar.leadSynth === 'metal') this.playMetalLead(freq, time, dur * 1.65, bar.leadGain);
      else if (bar.leadSynth === 'guitar') this.playGuitar(freq, time, dur * 1.9, bar.leadGain);
      else this.playLead(freq, time, dur * 1.4, bar.leadGain);
    }

    // Optional second melodic voice: a quiet gated 16th arpeggio running
    // underneath the lead. Kept separate from bar.lead so a theme can have
    // a hook *and* forward-momentum arps at once — the classic synthwave
    // layering one lead line can't do. Opt-in per bar; themes without
    // bar.arp are untouched.
    const arpIdx = bar.arp?.[step];
    if (arpIdx != null) {
      const tone = bar.chordTones[arpIdx % bar.chordTones.length];
      this.playArp(
        (bar.arpRootFreq ?? bar.leadRootFreq) * semitoneRatio(tone),
        time,
        dur * 1.05,
        bar.arpGain,
      );
    }

    // Optional cyber-metal rhythm layer. Unlike the chord-tone-indexed lead,
    // these patterns hold semitone offsets directly, which lets a track write
    // pedal-tone chugs and octave jumps without distorting its pad voicing.
    // The voice is an inharmonic FM/distortion synth rather than a sampled or
    // modeled guitar, keeping the score futuristic even when its rhythm comes
    // from metal.
    const chugOffset = bar.chug?.[step];
    if (chugOffset != null) {
      const freq = (bar.chugRootFreq ?? bar.bassRootFreq * 2) * semitoneRatio(chugOffset);
      this.playCyberChug(freq, time, dur * 0.9, bar.chugGain);
    }

    // A real power-chord voice remains available as a supporting accent. It
    // is separate from bar.lead so a synthetic hook can stay in front while
    // occasional dual-tracked hits add rock weight underneath it.
    const guitarOffset = bar.guitar?.[step];
    if (guitarOffset != null) {
      const freq = (bar.guitarRootFreq ?? bar.leadRootFreq / 2) * semitoneRatio(guitarOffset);
      this.playGuitar(freq, time, dur * 1.9, bar.guitarGain);
    }

    if (step === 0) {
      this.playPad(
        bar.chordTones.map((t) => bar.padRootFreq * semitoneRatio(t)),
        time,
        dur * bar.padStepsHeld,
        bar.padSaw,
        bar.padCutoff,
        bar.padGain,
      );
    }

    if (bar.kick.includes(step)) {
      this.playKick(time, bar.kickGain);
      if (bar.sidechain) this.duck(time, bar.sidechainDepth); // opt-in per bar — off by default
    }
    if (bar.snare.includes(step)) this.playSnare(time, bar.punkSnare, bar.snareGain);
    if (bar.hat.includes(step)) this.playHat(time, bar.openHat?.includes(step), bar.hatGain);
    if (bar.industrial?.includes(step)) {
      this.playIndustrialHit(time, bar.industrialAccent?.includes(step));
    }
  }

  // ---- Instruments ------------------------------------------------------
  // Each synth is a short-lived oscillator/noise graph: build, envelope,
  // schedule stop, let the garbage collector take it. No pooling — at this
  // note rate the churn is trivial next to Phaser's own per-frame allocs.

  playBass(
    freq,
    time,
    dur,
    drive,
    fm,
    level = 1,
    cutoff = null,
    highpassFrequency = null,
  ) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    // FM grit: a sine modulator into the carrier's own frequency, ratio
    // just off a whole number so it doesn't lock into a static harmonic —
    // the buzzy "analog engine" edge on top of (not instead of) the
    // waveshaper clip below. Depth scales with pitch so it doesn't overwhelm
    // low notes or vanish on high ones.
    let modOsc = null;
    if (fm) {
      modOsc = ctx.createOscillator();
      modOsc.type = 'sine';
      modOsc.frequency.value = freq * 3.01;
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 0.8;
      modOsc.connect(modGain).connect(osc.frequency);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff ?? (drive ? 1400 : 900);
    filter.Q.value = 1.2;

    // Per-theme bass EQ. The master already removes unusable sub-48Hz
    // energy; this optional second high-pass lets a mix trim the steepest
    // speaker-moving octave without thinning every song, while bassCutoff
    // prevents the saw/FM edge from masking hooks in the low mids.
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = highpassFrequency ?? 32;
    highpass.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.75 * (level ?? 1), time + 0.008); // headroom for the limiter
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    // Gritty engine-pulse bass (F-Zero's punchy analog low end) instead of
    // the clean funk bass elsewhere — a waveshaper clips the saw into a
    // harder edge before it hits the filter.
    let node = osc;
    if (drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.driveCurve();
      osc.connect(shaper);
      node = shaper;
    }

    node.connect(filter).connect(highpass).connect(gain).connect(this.duckable);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    if (modOsc) {
      modOsc.start(time);
      modOsc.stop(time + dur + 0.02);
    }
  }

  driveCurve() {
    if (this._driveCurve) return this._driveCurve;
    const n = 256;
    const curve = new Float32Array(n);
    const amount = 6; // was 18 — that was closer to a hard square-wave clip than grit
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    this._driveCurve = curve;
    return curve;
  }

  playLead(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22 * (level ?? 1), time + 0.004); // bright bell pluck
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2.2;
    filter.Q.value = 0.8;
    filter.connect(gain).connect(this.master);

    // Two slightly detuned squares = the cheap, unmistakable "chip choir"
    // Rare leaned on for melodic leads — one oscillator alone reads thin.
    // Panned apart (before the shared filter, so stereo survives it) for
    // width instead of collapsing the detune to a single mono point.
    [-4, 4].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      const pan = ctx.createStereoPanner();
      pan.pan.value = cents < 0 ? -0.3 : 0.3;
      osc.connect(pan).connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  // Synthwave saw lead: three detuned sawtooths (wide) panned across the
  // stereo field, a shared vibrato LFO for analog pitch drift, and a
  // resonant lowpass with a fast-open envelope for the "gated" pluck this
  // genre's arps live on. Opt-in via bar.leadSynth === 'saw' — the other
  // themes keep using playLead's chip-choir.
  playSawLead(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2 * (level ?? 1), time + 0.006); // fast, "gated" attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 5;
    filter.Q.value = 1.4;
    filter.connect(gain);
    gain.connect(this.master);

    const wet = ctx.createGain();
    wet.gain.value = 0.22; // reverb send — subtle tail, not a wash
    gain.connect(wet).connect(this.reverbBus);

    // One slow LFO shared by all three voices' detune params — cheaper than
    // three independent LFOs and reads the same, since real analog drift is
    // correlated across oscillators sharing the same warm room anyway.
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 5.5;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 6; // cents
    vibrato.connect(vibratoDepth);
    vibrato.start(time);
    vibrato.stop(time + dur + 0.05);

    [-9, 0, 9].forEach((cents, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      vibratoDepth.connect(osc.detune);
      const pan = ctx.createStereoPanner();
      pan.pan.value = [-0.35, 0, 0.35][i];
      osc.connect(pan).connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  // Hybrid synth-guitar power chord (opt-in via bar.leadSynth === 'guitar'):
  // root + fifth, each as a detuned/panned saw pair (the chorus), summed
  // *before* a shared waveshaper so the intervals intermodulate — that
  // interaction, not any single voice's tone, is what reads as "overdriven
  // guitar" instead of "loud saws." A lowpass rolls off the fizz, and the
  // envelope is a chug: fast attack, sustains most of its length, no pluck.
  // Deliberately reuses driveCurve's gentle grit (a production technique,
  // shared per GAME_DESIGN.md) rather than adding a hotter curve the mix
  // bus would have to fight.
  playGuitar(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    const peak = 0.17 * (level ?? 1);
    gain.gain.linearRampToValueAtTime(peak, time + 0.01);
    gain.gain.setValueAtTime(peak, time + Math.max(0.011, dur - 0.06));
    gain.gain.linearRampToValueAtTime(0.001, time + dur);

    const drive = ctx.createWaveShaper();
    drive.curve = this.driveCurve();
    drive.oversample = '2x';

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    tone.Q.value = 0.7;

    const pre = ctx.createGain();
    pre.gain.value = 0.55; // headroom into the shaper — grit, not buzzsaw
    pre.connect(drive).connect(tone).connect(gain).connect(this.duckable);

    const wet = ctx.createGain();
    wet.gain.value = 0.1; // touch of room so chugs don't feel pasted on
    gain.connect(wet).connect(this.reverbBus);

    [0, 7].forEach((interval) => {
      const voiceFreq = freq * semitoneRatio(interval);
      [-8, 8].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = voiceFreq;
        osc.detune.value = cents;
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.3 : 0.3;
        osc.connect(pan).connect(pre);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      });
    });
  }

  // Palm-muted rhythm translated into overtly synthetic sound design:
  // two stereo "tracks" each carry a root/fifth saw pair, while one
  // inharmonic FM oscillator roughens every carrier before a fast-closing
  // filter and waveshaper. The result has a power-chord silhouette and the
  // hard gaps of a metal chug, but its metallic sidebands belong to a neon
  // machine rather than an amp in a garage.
  playCyberChug(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    const peak = 0.15 * (level ?? 1);
    gain.gain.linearRampToValueAtTime(peak, time + 0.002);
    gain.gain.setValueAtTime(peak, time + dur * 0.42);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const drive = ctx.createWaveShaper();
    drive.curve = this.driveCurve();
    drive.oversample = '2x';

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 105;

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(3400, time);
    tone.frequency.exponentialRampToValueAtTime(620, time + dur);
    tone.Q.value = 1.8;

    const pre = ctx.createGain();
    pre.gain.value = 0.42;
    pre.connect(drive).connect(highpass).connect(tone).connect(gain).connect(this.duckable);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * 2.73;
    const modDepth = ctx.createGain();
    modDepth.gain.value = freq * 0.34;
    mod.connect(modDepth);

    [-11, 11].forEach((cents) => {
      [0, 7].forEach((interval) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * semitoneRatio(interval);
        osc.detune.value = cents;
        modDepth.connect(osc.frequency);
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.52 : 0.52;
        osc.connect(pan).connect(pre);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      });
    });

    mod.start(time);
    mod.stop(time + dur + 0.02);
  }

  // Inharmonic square/saw lead used for chrome-edged hooks. The 2.41:1 FM
  // ratio keeps the overtones deliberately non-acoustic, and a narrow
  // bandpass gives it the cutting "metallic lead" register without adding
  // more low-mid energy on top of bass and chugs.
  playMetalLead(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16 * (level ?? 1), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(freq * 3.4, 7200);
    filter.Q.value = 1.3;
    filter.connect(gain).connect(this.master);

    const wet = ctx.createGain();
    wet.gain.value = 0.08;
    gain.connect(wet).connect(this.reverbBus);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * 2.41;
    const modDepth = ctx.createGain();
    modDepth.gain.value = freq * 0.22;
    mod.connect(modDepth);

    ['square', 'sawtooth'].forEach((type, i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = i === 0 ? -6 : 6;
      modDepth.connect(osc.frequency);
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = i === 0 ? 0.62 : 0.38;
      const pan = ctx.createStereoPanner();
      pan.pan.value = i === 0 ? -0.22 : 0.22;
      osc.connect(voiceGain).connect(pan).connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });

    mod.start(time);
    mod.stop(time + dur + 0.02);
  }

  // Gated 16th-note arp voice: a detuned saw pair with a hard gate — near-
  // instant attack, short decay, done well before the next 16th so the gaps
  // *are* the rhythm (that silence-between-notes is what "gated arp" means
  // in this genre; a legato version just reads as a busy lead). Deliberately
  // quiet and routed through the duckable bus so the kick pumps it — the
  // arp is texture and momentum under the hook, never competition for it.
  playArp(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11 * (level ?? 1), time + 0.003); // hard gate open
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.7); // closed before next step

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 4;
    filter.Q.value = 1.1;
    filter.connect(gain).connect(this.duckable);

    const wet = ctx.createGain();
    wet.gain.value = 0.12; // faint tail — shimmer, not wash
    gain.connect(wet).connect(this.reverbBus);

    [-5, 5].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      const pan = ctx.createStereoPanner();
      pan.pan.value = cents < 0 ? -0.25 : 0.25;
      osc.connect(pan).connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  // Warm electric-piano comp for the shop theme: a sine fundamental plus a
  // quiet triangle an octave up (the classic cheap-Rhodes trick — a pure
  // fundamental reads as dull, one bright overtone on top reads as warm),
  // slower attack/release than playLead's pluck so it sits back in the mix
  // instead of announcing every hit.
  playKeys(freq, time, dur, level = 1) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.connect(this.duckable);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.24 * (level ?? 1), time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    gain.connect(filter);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = freq;
    fundamental.connect(gain);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.35;
    overtoneGain.connect(gain);
    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.value = freq * 2;
    overtone.connect(overtoneGain);

    fundamental.start(time);
    overtone.start(time);
    fundamental.stop(time + dur + 0.05);
    overtone.stop(time + dur + 0.05);
  }

  // Analog-polysynth pad: each chord tone gets a two-voice chorus pair
  // (detuned + panned apart) instead of one oscillator, a shared slow drift
  // LFO for warm wander, and a reverb send for lushness — the triangle-wave
  // sustain everything else in the mix (arps, drums) sits on top of.
  // withSaw (opt-in via bar.padSaw) blends a quiet centered sawtooth per
  // tone under the triangle pairs — the triangle/saw-blend pad brighter
  // synthwave briefs call for, without changing any theme that doesn't ask.
  playPad(freqs, time, dur, withSaw, cutoff = 1400, level = 1) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    const peak = 0.1 * (level ?? 1);
    gain.gain.linearRampToValueAtTime(peak, time + 0.25); // slow pad swell
    gain.gain.setValueAtTime(peak, time + Math.max(0.26, dur - 0.3));
    gain.gain.linearRampToValueAtTime(0, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff ?? 1400;
    filter.connect(gain);
    gain.connect(this.duckable);

    const wet = ctx.createGain();
    wet.gain.value = 0.3; // reverb send — the "lush" in lush pad
    gain.connect(wet).connect(this.reverbBus);

    // Slow shared drift LFO — analog polysynths never sit perfectly in
    // tune; a few cents of slow wander reads as "warm," not "out of tune."
    const drift = ctx.createOscillator();
    drift.type = 'sine';
    drift.frequency.value = 0.18;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 4; // cents
    drift.connect(driftDepth);
    drift.start(time);
    drift.stop(time + dur + 0.1);

    freqs.forEach((freq) => {
      [-6, 6].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        driftDepth.connect(osc.detune);
        const pan = ctx.createStereoPanner();
        pan.pan.value = cents < 0 ? -0.5 : 0.5;
        osc.connect(pan).connect(filter);
        osc.start(time);
        osc.stop(time + dur + 0.05);
      });
      if (withSaw) {
        // One quiet centered saw per tone; its harmonics land above the
        // triangles' and the shared lowpass tames them, so the blend adds
        // presence rather than buzz. Attenuated well below the pairs.
        const sawGain = ctx.createGain();
        sawGain.gain.value = 0.35;
        sawGain.connect(filter);
        const saw = ctx.createOscillator();
        saw.type = 'sawtooth';
        saw.frequency.value = freq;
        driftDepth.connect(saw.detune);
        saw.connect(sawGain);
        saw.start(time);
        saw.stop(time + dur + 0.05);
      }
    });
  }

  // Each cone contact is one composite impact: low body thump, mid plastic
  // knock, and a restrained high crack. Like a footstep/gunshot pool, five
  // layer balances rotate without immediate repeats. Milestones add harmony.
  playConeHit({ milestone = false, complete = false } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastConeVariation,
      CONE_HIT_VARIATIONS.length,
    );
    this.lastConeVariation = variationIndex;
    const variation = CONE_HIT_VARIATIONS[variationIndex];

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = complete ? 1500 : variation.noiseFreq;
    filter.Q.value = variation.q;
    const impact = ctx.createGain();
    impact.gain.setValueAtTime(
      (complete ? 0.105 : milestone ? 0.085 : 0.065) * variation.level,
      time,
    );
    impact.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    const impactPan = ctx.createStereoPanner();
    impactPan.pan.value = variation.pan;
    noise.connect(filter).connect(impact).connect(impactPan).connect(this.sfxBus);
    noise.start(time);
    noise.stop(time + 0.065);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(variation.body * 1.55, time);
    body.frequency.exponentialRampToValueAtTime(variation.body, time + 0.085);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(
      (complete ? 0.105 : milestone ? 0.09 : 0.075) * variation.level,
      time,
    );
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.11);

    const notes = complete
      ? [220, 261.63, 329.63, 440] // A3-C4-E4-A4: broad, grounded fanfare
      : milestone
        ? [variation.tone, variation.tone * 1.5]
        : [variation.tone];
    notes.forEach((frequency, index) => {
      const start = time + index * 0.045;
      const osc = ctx.createOscillator();
      osc.type = index === 0 && !complete ? variation.wave : 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(
        frequency * (complete ? 1.08 : variation.sweep),
        start + 0.07,
      );
      const chirp = ctx.createGain();
      chirp.gain.setValueAtTime(0.0001, start);
      chirp.gain.exponentialRampToValueAtTime(complete ? 0.07 : 0.05, start + 0.006);
      chirp.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
      const chirpPan = ctx.createStereoPanner();
      chirpPan.pan.value = variation.pan * 0.65;
      osc.connect(chirp).connect(chirpPan).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  playRivalThreat({ pan = 0 } = {}) {
    if (!this.ctx || !this.sfxBus) return;
    const index = nonRepeatingIndex(
      this.lastRivalThreatVariation,
      RIVAL_THREAT_VARIATIONS.length,
    );
    this.lastRivalThreatVariation = index;
    const v = RIVAL_THREAT_VARIATIONS[index];
    const time = this.ctx.currentTime;
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.low, time);
    body.frequency.exponentialRampToValueAtTime(v.low * 0.82, time + 0.16);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.026, time + 0.018);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.18);

    const osc = this.ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.start, time);
    osc.frequency.exponentialRampToValueAtTime(v.end, time + 0.11);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.035, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    osc.connect(gain).connect(panner).connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + 0.15);

    if (this.noiseBuffer) {
      const air = this.ctx.createBufferSource();
      air.buffer = this.noiseBuffer;
      const high = this.ctx.createBiquadFilter();
      high.type = 'bandpass';
      high.frequency.value = v.high;
      high.Q.value = 1.2;
      const airGain = this.ctx.createGain();
      airGain.gain.setValueAtTime(0.018, time);
      airGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      air.connect(high).connect(airGain).connect(panner);
      air.start(time);
      air.stop(time + 0.1);
    }
  }

  playTimeBonus({ major = false } = {}) {
    if (!this.ctx || !this.sfxBus) return;
    const index = nonRepeatingIndex(
      this.lastTimeBonusVariation,
      TIME_BONUS_VARIATIONS.length,
    );
    this.lastTimeBonusVariation = index;
    const v = TIME_BONUS_VARIATIONS[index];
    const time = this.ctx.currentTime;
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.tone / 6, time);
    body.frequency.exponentialRampToValueAtTime(v.tone / 5, time + 0.16);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(major ? 0.045 : 0.032, time + 0.015);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.21);

    const mid = this.ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.value = v.tone / 2;
    const midGain = this.ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, time);
    midGain.gain.exponentialRampToValueAtTime(0.034, time + 0.01);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    mid.connect(midGain).connect(this.sfxBus);
    mid.start(time);
    mid.stop(time + 0.19);
    [1, major ? v.ratio * 1.125 : v.ratio].forEach((ratio, noteIndex) => {
      const start = time + noteIndex * 0.055;
      const osc = this.ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.value = v.tone * ratio;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(major ? 0.065 : 0.048, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = v.pan;
      osc.connect(gain).connect(pan).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  playRivalImpact({ kind = 'rub', pan = 0, strength = 1 } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const takedown = kind === 'takedown';
    const pool = takedown ? RIVAL_TAKEDOWN_VARIATIONS : RIVAL_IMPACT_VARIATIONS;
    const previous = takedown
      ? this.lastRivalTakedownVariation
      : this.lastRivalImpactVariation;
    const index = nonRepeatingIndex(previous, pool.length);
    if (takedown) this.lastRivalTakedownVariation = index;
    else this.lastRivalImpactVariation = index;
    const v = pool[index];
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const level = Math.max(0.5, Math.min(1.25, strength));
    const contactLevel = kind === 'rub' ? 0.48 : kind === 'incoming' ? 0.82 : 1;

    const body = ctx.createOscillator();
    body.type = v.wave ?? 'sine';
    body.frequency.setValueAtTime(v.body * 1.8, time);
    body.frequency.exponentialRampToValueAtTime(v.body, time + (takedown ? 0.2 : 0.09));
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.11 * level * contactLevel, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + (takedown ? 0.25 : 0.12));
    const bodyPan = ctx.createStereoPanner();
    bodyPan.pan.value = Math.max(-1, Math.min(1, pan + v.pan));
    body.connect(bodyGain).connect(bodyPan).connect(this.sfxBus);
    body.start(time);
    body.stop(time + (takedown ? 0.27 : 0.14));

    const metal = ctx.createBufferSource();
    metal.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = takedown ? 'lowpass' : 'bandpass';
    filter.frequency.value = v.metal;
    filter.Q.value = v.q ?? 0.75;
    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(0.07 * level * contactLevel, time);
    metalGain.gain.exponentialRampToValueAtTime(
      0.001,
      time + (takedown ? 0.32 : v.decay),
    );
    metal.connect(filter).connect(metalGain).connect(bodyPan);
    metal.start(time);
    metal.stop(time + (takedown ? 0.34 : v.decay + 0.02));

    if (takedown) {
      v.chord.forEach((frequency, chordIndex) => {
        const start = time + 0.045 + chordIndex * 0.045;
        const note = ctx.createOscillator();
        note.type = 'triangle';
        note.frequency.value = frequency;
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.0001, start);
        noteGain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
        noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        note.connect(noteGain).connect(this.sfxBus);
        note.start(start);
        note.stop(start + 0.22);
      });
    } else {
      const detail = ctx.createBufferSource();
      detail.buffer = this.noiseBuffer;
      const high = ctx.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = Math.max(1900, v.metal * 2.4);
      const detailGain = ctx.createGain();
      detailGain.gain.setValueAtTime(0.022 * level * contactLevel, time);
      detailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
      detail.connect(high).connect(detailGain).connect(bodyPan);
      detail.start(time);
      detail.stop(time + 0.065);
    }
  }

  playGlassCrack(stage = 1) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastGlassVariation,
      GLASS_CRACK_VARIATIONS.length,
    );
    this.lastGlassVariation = variationIndex;
    const v = GLASS_CRACK_VARIATIONS[variationIndex];

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.body * 1.35, time);
    body.frequency.exponentialRampToValueAtTime(v.body, time + 0.1);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.045 + stage * 0.008, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    const crackPan = ctx.createStereoPanner();
    crackPan.pan.value = v.pan;
    body.connect(bodyGain).connect(crackPan).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.14);

    const mid = ctx.createBufferSource();
    mid.buffer = this.noiseBuffer;
    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.value = v.mid + stage * 90;
    midFilter.Q.value = 1.15;
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.055 + stage * 0.006, time);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + v.decay);
    mid.connect(midFilter).connect(midGain).connect(crackPan);
    mid.start(time);
    mid.stop(time + v.decay + 0.02);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = v.high + stage * 220;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 + stage * 0.008, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.connect(high).connect(gain).connect(this.sfxBus);
    noise.start(time);
    noise.stop(time + 0.13);

    for (let i = 0; i < Math.min(4, stage + 1); i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const start = time + i * 0.012;
      const freq = 1500 + stage * 170 + i * 420;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.68, start + 0.08);
      const shard = ctx.createGain();
      shard.gain.setValueAtTime(0.035, start);
      shard.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(shard).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  // A bright, friendly confirmation for collecting a green boost pickup —
  // two quick ascending notes, no impact/crack layer, it's a reward not a
  // hit. Variation pool keeps a dense pickup run from sounding identical.
  playBoostPickup() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastBoostPickupVariation,
      BOOST_PICKUP_VARIATIONS.length,
    );
    this.lastBoostPickupVariation = variationIndex;
    const v = BOOST_PICKUP_VARIATIONS[variationIndex];

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.tone / 7, time);
    body.frequency.exponentialRampToValueAtTime(v.tone / 5.5, time + 0.17);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.035 * v.level, time + 0.018);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.2);

    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(v.tone / 2, time);
    mid.frequency.exponentialRampToValueAtTime(v.tone / 2 * v.sweep, time + 0.14);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, time);
    midGain.gain.exponentialRampToValueAtTime(0.038 * v.level, time + 0.012);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    mid.connect(midGain).connect(this.sfxBus);
    mid.start(time);
    mid.stop(time + 0.19);

    [1, v.sweep].forEach((ratio, i) => {
      const start = time + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.tone * ratio, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07 * v.level, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      const pan = ctx.createStereoPanner();
      pan.pan.value = v.pan;
      osc.connect(gain).connect(pan).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  // A 55ms three-band cursor cue. The cooldown prevents rapid d-pad/axis
  // chatter from scheduling a backlog that keeps clicking after navigation
  // has stopped; each accepted move replaces silence immediately.
  playMenuMove(direction = 'right') {
    if (!this.ctx || !this.sfxBus) return false;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    if (time - this.lastMenuMoveTime < 0.025) return false;
    this.lastMenuMoveTime = time;
    const lower = direction === 'left' || direction === 'down';
    const ratio = lower ? 0.89 : 1;
    const layers = [
      { frequency: 110 * ratio, type: 'sine', gain: 0.035, duration: 0.055 },
      { frequency: 440 * ratio, type: 'square', gain: 0.025, duration: 0.04 },
      { frequency: 880 * ratio, type: 'triangle', gain: 0.018, duration: 0.025 },
    ];
    layers.forEach((layer) => {
      const osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(layer.frequency, time);
      osc.frequency.exponentialRampToValueAtTime(
        layer.frequency * (lower ? 0.94 : 1.06),
        time + layer.duration,
      );
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(layer.gain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + layer.duration);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(time);
      osc.stop(time + layer.duration + 0.01);
    });
    return true;
  }

  // A boost is a long aerodynamic onset: filtered wind rises around the car
  // while a quiet engine bed climbs underneath it. There is deliberately no
  // zero-time transient, falling pitch, or stacked oscillator chord—the three
  // ingredients that made the old cue read as a smack/spring.
  playBoostApply(tier = 1, { extend = false } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastBoostApplyVariation,
      BOOST_APPLY_VARIATIONS.length,
    );
    this.lastBoostApplyVariation = variationIndex;
    const v = BOOST_APPLY_VARIATIONS[variationIndex];
    const levelMul = extend ? 0.42 : 1;
    const duration = extend ? 0.3 : 0.58;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(v.low, time);
    highpass.frequency.exponentialRampToValueAtTime(
      v.high + tier * 180,
      time + duration * 0.78,
    );
    highpass.Q.value = 0.45;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(5200 + tier * 500, time);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(
      (0.055 + tier * 0.012) * levelMul,
      time + 0.055,
    );
    noiseGain.gain.setValueAtTime(
      (0.05 + tier * 0.01) * levelMul,
      time + duration * 0.62,
    );
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(v.pan, time);
    pan.pan.linearRampToValueAtTime(-v.pan * 0.7, time + duration);
    noise.connect(highpass).connect(lowpass).connect(noiseGain).connect(pan).connect(this.sfxBus);
    noise.start(time);
    noise.stop(time + duration + 0.02);

    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(72 + tier * 7, time);
    engine.frequency.exponentialRampToValueAtTime(112 + tier * 10, time + duration);
    const engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0.0001, time);
    engineGain.gain.exponentialRampToValueAtTime(0.018 * levelMul, time + 0.08);
    engineGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    engine.connect(engineGain).connect(this.sfxBus);
    engine.start(time);
    engine.stop(time + duration + 0.02);

    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(v.mid, time);
    mid.frequency.exponentialRampToValueAtTime(v.mid * 1.55, time + duration);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, time);
    midGain.gain.exponentialRampToValueAtTime(0.021 * levelMul, time + 0.065);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    mid.connect(midGain).connect(pan);
    mid.start(time);
    mid.stop(time + duration + 0.02);
  }

  // Painted speed lines are immediate propulsion, not an inventory pickup.
  // Use a quicker version of the same wind language as manual boost so the
  // pad has a distinct onset without sounding like a collision.
  playSpeedLine() {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastSpeedLineVariation,
      SPEED_LINE_VARIATIONS.length,
    );
    this.lastSpeedLineVariation = variationIndex;
    const v = SPEED_LINE_VARIATIONS[variationIndex];
    const body = ctx.createOscillator();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(v.low, time);
    body.frequency.exponentialRampToValueAtTime(v.low * 1.75, time + 0.38);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.025, time + 0.045);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.42);

    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(v.mid, time);
    mid.frequency.exponentialRampToValueAtTime(v.mid * 1.7, time + 0.36);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, time);
    midGain.gain.exponentialRampToValueAtTime(0.026, time + 0.05);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    const speedPan = ctx.createStereoPanner();
    speedPan.pan.setValueAtTime(v.pan, time);
    speedPan.pan.linearRampToValueAtTime(-v.pan, time + 0.4);
    mid.connect(midGain).connect(speedPan).connect(this.sfxBus);
    mid.start(time);
    mid.stop(time + 0.42);

    const rush = ctx.createBufferSource();
    rush.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(v.air, time + 0.34);
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.085, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    rush.connect(filter).connect(gain).connect(speedPan);
    rush.start(time);
    rush.stop(time + 0.42);
  }

  playDamageImpact({ severity = 1 } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastDamageVariation,
      DAMAGE_VARIATIONS.length,
    );
    this.lastDamageVariation = variationIndex;
    const v = DAMAGE_VARIATIONS[variationIndex];
    const level = Math.max(0.5, Math.min(1.5, Number(severity) || 1));
    const body = ctx.createOscillator();
    body.type = 'square';
    body.frequency.setValueAtTime(v.low * 1.8, time);
    body.frequency.exponentialRampToValueAtTime(v.low, time + 0.16);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.14 * level, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.22);

    const crash = ctx.createBufferSource();
    crash.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = v.mid + level * 120;
    filter.Q.value = 0.55;
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.13 * level, time);
    crashGain.gain.exponentialRampToValueAtTime(0.001, time + v.decay);
    const damagePan = ctx.createStereoPanner();
    damagePan.pan.value = v.pan;
    crash.connect(filter).connect(crashGain).connect(damagePan).connect(this.sfxBus);
    crash.start(time);
    crash.stop(time + v.decay + 0.02);

    const debris = ctx.createBufferSource();
    debris.buffer = this.noiseBuffer;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = v.high;
    const debrisGain = ctx.createGain();
    debrisGain.gain.setValueAtTime(0.045 * level, time + 0.012);
    debrisGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    debris.connect(high).connect(debrisGain).connect(damagePan);
    debris.start(time + 0.012);
    debris.stop(time + 0.14);
  }

  // Genuinely new idiom for this file: every other SFX method is
  // fire-and-forget with a fixed stop time. A held boost has no natural end
  // until the player releases (or runs out of slots), so this builds a
  // sustained drone with a soft attack and returns a handle whose stop()
  // ramps the gain down and schedules the real node stop. GameScene holds
  // the handle for as long as Boost.holding stays true.
  startBoostHold() {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return { stop() {} };
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastBoostHoldVariation,
      BOOST_HOLD_VARIATIONS.length,
    );
    this.lastBoostHoldVariation = variationIndex;
    const v = BOOST_HOLD_VARIATIONS[variationIndex];

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(v.low, time);
    const detune = ctx.createOscillator();
    detune.type = 'sawtooth';
    detune.frequency.setValueAtTime(v.low + v.detune, time);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(v.mid, time);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.05, time + 0.12);

    const pan = ctx.createStereoPanner();
    pan.pan.value = v.pan;
    osc.connect(gain);
    detune.connect(gain);
    noise.connect(filter).connect(gain);
    gain.connect(pan).connect(this.sfxBus);

    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highpass';
    airFilter.frequency.value = v.high;
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, time);
    airGain.gain.exponentialRampToValueAtTime(0.012, time + 0.16);
    air.connect(airFilter).connect(airGain).connect(pan);

    osc.start(time);
    detune.start(time);
    noise.start(time);
    air.start(time);

    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const stopTime = ctx.currentTime;
        gain.gain.cancelScheduledValues(stopTime);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), stopTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.12);
        airGain.gain.cancelScheduledValues(stopTime);
        airGain.gain.setValueAtTime(Math.max(airGain.gain.value, 0.0001), stopTime);
        airGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.12);
        osc.stop(stopTime + 0.14);
        detune.stop(stopTime + 0.14);
        noise.stop(stopTime + 0.14);
        air.stop(stopTime + 0.14);
      },
    };
  }

  // Ramp contact and launch are one gesture: a restrained chassis tap gives
  // the ramp weight, immediately answered by a short filtered-air sweep.
  // There is deliberately no held jet tone here; the landing owns the weight.
  playRampTakeoff({ boosted = false, speedRatio = 0 } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const repeatGain = repeatedTakeoffGain(time - this.lastTakeoffTime);
    this.lastTakeoffTime = time;
    const variationIndex = nonRepeatingIndex(
      this.lastRampVariation,
      RAMP_VARIATIONS.length,
    );
    this.lastRampVariation = variationIndex;
    const v = RAMP_VARIATIONS[variationIndex];
    const speed = Math.max(0, Math.min(1.35, speedRatio));

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.low * 1.9 + speed * 18, time);
    body.frequency.exponentialRampToValueAtTime(v.low, time + 0.11);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.078 * repeatGain, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.14);

    const chassis = ctx.createOscillator();
    chassis.type = 'triangle';
    chassis.frequency.setValueAtTime(v.mid, time);
    chassis.frequency.exponentialRampToValueAtTime(v.mid * 0.72, time + 0.12);
    const chassisGain = ctx.createGain();
    chassisGain.gain.setValueAtTime(0.04 * repeatGain, time);
    chassisGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    const rampPan = ctx.createStereoPanner();
    rampPan.pan.value = v.pan;
    chassis.connect(chassisGain).connect(rampPan).connect(this.sfxBus);
    chassis.start(time);
    chassis.stop(time + 0.15);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = boosted ? 0.7 : 1;
    filter.frequency.setValueAtTime(520 + speed * 260, time);
    filter.frequency.exponentialRampToValueAtTime(
      boosted ? v.high * 1.25 : v.high,
      time + AIRTIME_TAKEOFF_SWEEP_SECONDS,
    );
    const rush = ctx.createGain();
    rush.gain.setValueAtTime(0.0001, time);
    rush.gain.exponentialRampToValueAtTime((boosted ? 0.075 : 0.055) * repeatGain, time + 0.035);
    rush.gain.exponentialRampToValueAtTime(
      0.001,
      time + AIRTIME_TAKEOFF_SWEEP_SECONDS - 0.01,
    );
    noise.connect(filter).connect(rush).connect(rampPan);
    noise.start(time);
    noise.stop(time + AIRTIME_TAKEOFF_SWEEP_SECONDS);
  }

  // The flight handle is intentionally state-only. Earlier versions held a
  // filtered-noise loop and then replaced it with input/apex/tier accents;
  // both competed with the contact beat in these sub-second arcade jumps.
  // The car, trails, and HUD show live control. Audio stays landing-led while
  // this handle remembers the final arc choice for the landing timbre.
  startAirtimeFlight() {
    let stopped = false;
    let previousControl = 'neutral';
    return {
      update({
        glide = 0,
      } = {}) {
        if (stopped) return;
        previousControl = nextAirtimeControl(previousControl, glide);
      },
      getControl() { return previousControl; },
      stop() {
        if (stopped) return;
        stopped = true;
      },
    };
  }

  playAirtimeLanding({ seconds = 0, boosted = false, control = 'neutral' } = {}) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const kind = airtimeLandingKind(seconds, boosted, control);
    const level = kind === 'heavy' ? 1 : kind === 'medium' ? 0.78 : 0.58;
    const variationIndex = nonRepeatingIndex(
      this.lastLandingVariation,
      LANDING_VARIATIONS.length,
    );
    this.lastLandingVariation = variationIndex;
    const v = LANDING_VARIATIONS[variationIndex];

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.low * (kind === 'heavy' ? 2.2 : 2.6), time);
    body.frequency.exponentialRampToValueAtTime(v.low, time + 0.15);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.13 * level, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.19);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = v.mid * (kind === 'heavy' ? 1 : 1.25);
    filter.Q.value = 0.8;
    const skid = ctx.createGain();
    skid.gain.setValueAtTime(0.07 * level, time);
    skid.gain.exponentialRampToValueAtTime(0.001, time + (kind === 'heavy' ? 0.2 : 0.11));
    const landingPan = ctx.createStereoPanner();
    landingPan.pan.value = v.pan;
    noise.connect(filter).connect(skid).connect(landingPan).connect(this.sfxBus);
    noise.start(time);
    noise.stop(time + 0.21);

    const grit = ctx.createBufferSource();
    grit.buffer = this.noiseBuffer;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = v.high;
    const gritGain = ctx.createGain();
    gritGain.gain.setValueAtTime(0.026 * level, time + 0.008);
    gritGain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);
    grit.connect(high).connect(gritGain).connect(landingPan);
    grit.start(time + 0.008);
    grit.stop(time + 0.085);

    // A deliberate nose-down placement gets a short, descending tire chirp;
    // clean/neutral landings keep only the chassis contact and road hiss.
    if (control === 'short') {
      const chirp = ctx.createOscillator();
      chirp.type = 'triangle';
      chirp.frequency.setValueAtTime(510, time + 0.018);
      chirp.frequency.exponentialRampToValueAtTime(260, time + 0.12);
      const chirpGain = ctx.createGain();
      chirpGain.gain.setValueAtTime(0.03, time + 0.018);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      chirp.connect(chirpGain).connect(this.sfxBus);
      chirp.start(time + 0.018);
      chirp.stop(time + 0.14);
    }
  }

  // A forgiving failure cue: low, brief, and downward. It communicates that
  // the rocks caught the trajectory without borrowing the glass/damage crack
  // or the triumphant weight of a committed clean landing.
  playAirtimeGapMiss() {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastGapMissVariation,
      GAP_MISS_VARIATIONS.length,
    );
    this.lastGapMissVariation = variationIndex;
    const v = GAP_MISS_VARIATIONS[variationIndex];

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.low * 1.4, time);
    body.frequency.exponentialRampToValueAtTime(v.low, time + 0.19);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.04, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.21);
    const missPan = ctx.createStereoPanner();
    missPan.pan.value = v.pan;
    body.connect(bodyGain).connect(missPan).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.22);

    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(v.mid, time);
    tone.frequency.exponentialRampToValueAtTime(v.mid * 0.48, time + 0.17);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.048, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
    tone.connect(toneGain).connect(missPan);
    tone.start(time);
    tone.stop(time + 0.2);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(v.high, time);
    filter.frequency.exponentialRampToValueAtTime(v.mid * 1.25, time + 0.14);
    const scrape = ctx.createGain();
    scrape.gain.setValueAtTime(0.038, time);
    scrape.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    noise.connect(filter).connect(scrape).connect(missPan);
    noise.start(time);
    noise.stop(time + 0.17);
  }

  // Kept separate from the generic training-complete fanfare: this cue is
  // immediate confirmation that speed + boost + glide cleared the rock gap.
  playAirtimeMasteryClear() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const contactTime = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastMasteryVariation,
      CELEBRATION_VARIATIONS.length,
    );
    this.lastMasteryVariation = variationIndex;
    const v = CELEBRATION_VARIATIONS[variationIndex];
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.root, contactTime);
    body.frequency.exponentialRampToValueAtTime(v.root * 0.48, contactTime + 0.13);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.11, contactTime);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, contactTime + 0.15);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(contactTime);
    body.stop(contactTime + 0.16);

    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(v.root * 2, contactTime + 0.055);
    mid.frequency.exponentialRampToValueAtTime(v.root * 2.5, contactTime + 0.24);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, contactTime + 0.055);
    midGain.gain.exponentialRampToValueAtTime(0.042, contactTime + 0.07);
    midGain.gain.exponentialRampToValueAtTime(0.001, contactTime + 0.26);
    mid.connect(midGain).connect(this.sfxBus);
    mid.start(contactTime + 0.055);
    mid.stop(contactTime + 0.27);

    const time = contactTime + 0.1; // let the folded-in landing transient read
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const start = time + index * 0.055;
      const osc = ctx.createOscillator();
      osc.type = index < 2 ? 'triangle' : 'sine';
      osc.frequency.value = frequency * v.ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.052, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.23);
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, -0.3 + index * 0.2 + v.pan));
      osc.connect(gain).connect(pan).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  playTrainingComplete({ perfect = false, stars = 0 } = {}) {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const variationIndex = nonRepeatingIndex(
      this.lastTrainingCompleteVariation,
      CELEBRATION_VARIATIONS.length,
    );
    this.lastTrainingCompleteVariation = variationIndex;
    const v = CELEBRATION_VARIATIONS[variationIndex];
    const notes = perfect
      ? [440, 523.25, 659.25, 880, 1046.5]
      : [440, 523.25, 659.25].slice(0, Math.max(2, stars + 1));

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(v.root, time);
    body.frequency.exponentialRampToValueAtTime(v.root * 1.25, time + 0.34);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(perfect ? 0.055 : 0.04, time + 0.025);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.44);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.45);

    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(v.root * 2, time);
    mid.frequency.exponentialRampToValueAtTime(v.root * 3, time + 0.32);
    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.0001, time);
    midGain.gain.exponentialRampToValueAtTime(0.038, time + 0.02);
    midGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    mid.connect(midGain).connect(this.sfxBus);
    mid.start(time);
    mid.stop(time + 0.42);

    notes.forEach((frequency, index) => {
      const start = time + index * 0.085;
      const osc = ctx.createOscillator();
      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = frequency * v.ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(perfect ? 0.085 : 0.065, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  playStyleReward(styleId = 'cone_chain') {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const roots = {
      cone_chain: 110,
      speed_line_chain: 123.47,
      boosted_hangtime: 130.81,
      triple_boost: 146.83,
      long_burn: 98,
    };
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const index = nonRepeatingIndex(
      this.lastStyleRewardVariation,
      CELEBRATION_VARIATIONS.length,
    );
    this.lastStyleRewardVariation = index;
    const v = CELEBRATION_VARIATIONS[index];
    const root = (roots[styleId] ?? 110) * v.ratio;

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(root, time);
    body.frequency.exponentialRampToValueAtTime(root * 0.58, time + 0.24);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.065, time + 0.018);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    body.connect(bodyGain).connect(this.sfxBus);
    body.start(time);
    body.stop(time + 0.3);

    [2, 2.5, 3].forEach((ratio, noteIndex) => {
      const start = time + 0.035 + noteIndex * 0.052;
      const note = ctx.createOscillator();
      note.type = noteIndex === 1 ? 'square' : 'triangle';
      note.frequency.setValueAtTime(root * ratio, start);
      note.frequency.exponentialRampToValueAtTime(root * ratio * 1.08, start + 0.16);
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.04, start + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, v.pan + (noteIndex - 1) * 0.18));
      note.connect(noteGain).connect(pan).connect(this.sfxBus);
      note.start(start);
      note.stop(start + 0.22);
    });

    const sparkle = ctx.createBufferSource();
    sparkle.buffer = this.noiseBuffer;
    const high = ctx.createBiquadFilter();
    high.type = 'bandpass';
    high.frequency.value = 2600 + index * 420;
    high.Q.value = 1.2;
    const sparkleGain = ctx.createGain();
    sparkleGain.gain.setValueAtTime(0.032, time + 0.08);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    sparkle.connect(high).connect(sparkleGain).connect(this.sfxBus);
    sparkle.start(time + 0.08);
    sparkle.stop(time + 0.31);
  }

  // Original register gesture: coin/body weight, a midrange drawer snap, then
  // two bright confirmation notes. It is layered, subtly varied, and only
  // called for a style reward that still has bankable cash attached.
  playCashReward() {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const time = ctx.currentTime;
    const index = nonRepeatingIndex(
      this.lastCashRewardVariation,
      CASH_REWARD_VARIATIONS.length,
    );
    this.lastCashRewardVariation = index;
    const v = CASH_REWARD_VARIATIONS[index];
    const pan = ctx.createStereoPanner();
    pan.pan.value = v.pan;
    pan.connect(this.sfxBus);

    const coin = ctx.createOscillator();
    coin.type = 'sine';
    coin.frequency.setValueAtTime(v.low * 1.8, time);
    coin.frequency.exponentialRampToValueAtTime(v.low, time + 0.1);
    const coinGain = ctx.createGain();
    coinGain.gain.setValueAtTime(0.055, time);
    coinGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    coin.connect(coinGain).connect(pan);
    coin.start(time);
    coin.stop(time + 0.13);

    const snap = ctx.createBufferSource();
    snap.buffer = this.noiseBuffer;
    const mid = ctx.createBiquadFilter();
    mid.type = 'bandpass';
    mid.frequency.value = v.mid;
    mid.Q.value = 1.6;
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.035, time + 0.025);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.105);
    snap.connect(mid).connect(snapGain).connect(pan);
    snap.start(time + 0.025);
    snap.stop(time + 0.11);

    [1, v.ratio].forEach((ratio, noteIndex) => {
      const start = time + 0.055 + noteIndex * 0.075;
      const note = ctx.createOscillator();
      note.type = noteIndex ? 'sine' : 'triangle';
      note.frequency.value = v.high * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      note.connect(gain).connect(pan);
      note.start(start);
      note.stop(start + 0.17);
    });
  }

  playKick(time, level = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(58, time + 0.12); // was 45 — below the master highpass anyway

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85 * (level ?? 1), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  // punk (opt-in via bar.punkSnare): layers a short low "body" thump under
  // a wider, longer noise burst — the acoustic pop-punk snare character
  // (drum *kit*, not drum *machine*) versus the default's tight electronic
  // crack. The default path is bit-identical to before.
  playSnare(time, punk, level = 1) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = punk ? 2100 : 1800;
    if (punk) filter.Q.value = 0.5; // wider band — more "shhk," less "tick"
    const gain = ctx.createGain();
    const dur = punk ? 0.17 : 0.12;
    gain.gain.setValueAtTime(0.7 * (level ?? 1), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(time);
    noise.stop(time + dur + 0.01);

    if (punk) {
      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(150, time + 0.06);
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.5 * (level ?? 1), time);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      body.connect(bodyGain).connect(this.master);
      body.start(time);
      body.stop(time + 0.09);
    }
  }

  playHat(time, open, level = 1) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    const dur = open ? 0.14 : 0.035;
    gain.gain.setValueAtTime((open ? 0.3 : 0.22) * (level ?? 1), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  // Short inharmonic impact for urban/industrial accents: a filtered noise
  // strike supplies the attack while three unrelated partials ring for a
  // few milliseconds. Kept centered and brief so it reads as trackside
  // steel without smearing the double-kick rhythm.
  playIndustrialHit(time, accent) {
    const ctx = this.ctx;
    const level = accent ? 0.28 : 0.18;
    const dur = accent ? 0.11 : 0.075;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = accent ? 3600 : 2900;
    noiseFilter.Q.value = 1.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(level, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.master);
    noise.start(time);
    noise.stop(time + dur + 0.01);

    [487, 733, 1091].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 1 ? 'square' : 'sine';
      osc.frequency.value = frequency;
      const partialGain = ctx.createGain();
      partialGain.gain.setValueAtTime(level * (0.3 - i * 0.06), time);
      partialGain.gain.exponentialRampToValueAtTime(0.001, time + dur * (0.7 + i * 0.15));
      osc.connect(partialGain).connect(this.master);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    });
  }
}

export const MUSIC = new MusicEngine();
