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

const LOOKAHEAD_MS = 25;      // how often the scheduler timer fires
const SCHEDULE_AHEAD = 0.12;  // seconds of audio queued per timer tick

function semitoneRatio(semitones) {
  return Math.pow(2, semitones / 12);
}

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.timer = null;
    this.track = null;
    this.volume = 0.32;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoiseBuffer();
  }

  makeNoiseBuffer() {
    const seconds = 1;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  start(track) {
    this.ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.track === track && this.timer) return; // already playing this track

    this.stop();
    this.track = track;
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
      this.playBass(bar.bassRootFreq * semitoneRatio(bassOffset), time, dur * 1.8, bar.driveBass);
    }

    const leadIdx = bar.lead[step];
    if (leadIdx != null) {
      const tone = bar.chordTones[leadIdx % bar.chordTones.length];
      const freq = bar.leadRootFreq * semitoneRatio(tone);
      if (bar.leadSynth === 'keys') this.playKeys(freq, time, dur * 3);
      else this.playLead(freq, time, dur * 1.4);
    }

    if (step === 0) {
      this.playPad(bar.chordTones.map((t) => bar.padRootFreq * semitoneRatio(t)), time, dur * bar.padStepsHeld);
    }

    if (bar.kick.includes(step)) this.playKick(time);
    if (bar.snare.includes(step)) this.playSnare(time);
    if (bar.hat.includes(step)) this.playHat(time, bar.openHat?.includes(step));
  }

  // ---- Instruments ------------------------------------------------------
  // Each synth is a short-lived oscillator/noise graph: build, envelope,
  // schedule stop, let the garbage collector take it. No pooling — at this
  // note rate the churn is trivial next to Phaser's own per-frame allocs.

  playBass(freq, time, dur, drive) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = drive ? 1400 : 900;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.9, time + 0.008); // punchy pluck attack
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

    node.connect(filter).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  driveCurve() {
    if (this._driveCurve) return this._driveCurve;
    const n = 256;
    const curve = new Float32Array(n);
    const amount = 18; // fixed grit amount — one flavor of drive, not a knob
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    this._driveCurve = curve;
    return curve;
  }

  playLead(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.004); // bright bell pluck
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2.2;
    filter.Q.value = 0.8;
    filter.connect(gain).connect(this.master);

    // Two slightly detuned squares = the cheap, unmistakable "chip choir"
    // Rare leaned on for melodic leads — one oscillator alone reads thin.
    [-4, 4].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  // Warm electric-piano comp for the shop theme: a sine fundamental plus a
  // quiet triangle an octave up (the classic cheap-Rhodes trick — a pure
  // fundamental reads as dull, one bright overtone on top reads as warm),
  // slower attack/release than playLead's pluck so it sits back in the mix
  // instead of announcing every hit.
  playKeys(freq, time, dur) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.connect(this.master);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.03);
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

  playPad(freqs, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.25); // slow pad swell
    gain.gain.setValueAtTime(0.1, time + Math.max(0.26, dur - 0.3));
    gain.gain.linearRampToValueAtTime(0, time + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.connect(gain).connect(this.master);

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    });
  }

  playKick(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  playSnare(time) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(time);
    noise.stop(time + 0.13);
  }

  playHat(time, open) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    const dur = open ? 0.14 : 0.035;
    gain.gain.setValueAtTime(open ? 0.3 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }
}

export const MUSIC = new MusicEngine();
