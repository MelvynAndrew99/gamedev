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

    this.master.connect(saturate).connect(subCut).connect(limiter).connect(this.ctx.destination);
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
      this.playBass(
        bar.bassRootFreq * semitoneRatio(bassOffset),
        time,
        dur * 1.8,
        bar.driveBass,
        bar.bassFM,
        bar.bassGain,
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
      if (bar.leadSynth === 'keys') this.playKeys(freq, time, dur * 3);
      else if (bar.leadSynth === 'saw') this.playSawLead(freq, time, dur * 1.4);
      else if (bar.leadSynth === 'metal') this.playMetalLead(freq, time, dur * 1.65);
      else if (bar.leadSynth === 'guitar') this.playGuitar(freq, time, dur * 1.9);
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
      this.playArp((bar.arpRootFreq ?? bar.leadRootFreq) * semitoneRatio(tone), time, dur * 1.05);
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
      this.playCyberChug(freq, time, dur * 0.9);
    }

    // A real power-chord voice remains available as a supporting accent. It
    // is separate from bar.lead so a synthetic hook can stay in front while
    // occasional dual-tracked hits add rock weight underneath it.
    const guitarOffset = bar.guitar?.[step];
    if (guitarOffset != null) {
      const freq = (bar.guitarRootFreq ?? bar.leadRootFreq / 2) * semitoneRatio(guitarOffset);
      this.playGuitar(freq, time, dur * 1.9);
    }

    if (step === 0) {
      this.playPad(
        bar.chordTones.map((t) => bar.padRootFreq * semitoneRatio(t)),
        time,
        dur * bar.padStepsHeld,
        bar.padSaw,
        bar.padCutoff,
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

  playBass(freq, time, dur, drive, fm, level = 1) {
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
    filter.frequency.value = drive ? 1400 : 900;
    filter.Q.value = 1.2;

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

    node.connect(filter).connect(gain).connect(this.duckable);
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
  playSawLead(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.006); // fast, "gated" attack
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
  playGuitar(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.17, time + 0.01);
    gain.gain.setValueAtTime(0.17, time + Math.max(0.011, dur - 0.06));
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
  playCyberChug(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.002);
    gain.gain.setValueAtTime(0.15, time + dur * 0.42);
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
  playMetalLead(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.003);
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
  playArp(freq, time, dur) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.003); // hard gate open
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
  playKeys(freq, time, dur) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.connect(this.duckable);

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

  // Analog-polysynth pad: each chord tone gets a two-voice chorus pair
  // (detuned + panned apart) instead of one oscillator, a shared slow drift
  // LFO for warm wander, and a reverb send for lushness — the triangle-wave
  // sustain everything else in the mix (arps, drums) sits on top of.
  // withSaw (opt-in via bar.padSaw) blends a quiet centered sawtooth per
  // tone under the triangle pairs — the triangle/saw-blend pad brighter
  // synthwave briefs call for, without changing any theme that doesn't ask.
  playPad(freqs, time, dur, withSaw, cutoff = 1400) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.25); // slow pad swell
    gain.gain.setValueAtTime(0.1, time + Math.max(0.26, dur - 0.3));
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
