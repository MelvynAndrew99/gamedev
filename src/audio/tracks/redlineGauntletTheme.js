// redlineGauntletTheme.js — "Urban Danger Zone," a reserved cyber-metal
// sprint for a future level built around unbroken maximum intensity. This was
// Syndicate Run's first score, preserved because its 184 BPM assault has a
// strong identity even though it outruns that campaign track's current pace.
//
// GAME_DESIGN.md makes the score futuristic first. The metal writing is
// therefore carried by an inharmonic FM cyber-chug, clipped synth bass,
// drum-machine double kicks, a metallic synth hook, and industrial impacts.
// The engine's dual-tracked power-chord voice only reinforces selected final
// bars; it is not the identity of the piece.
//
// Key: F# minor. Progression: F#m-D-E-E (i-VI-VII-VII), with the last E bar
// acting as a launch ramp back to the tonic. Its reserved 184 BPM pace is
// faster than the current campaign score. 32 bars = 41.7 seconds, safely
// beyond the 30-second minimum.
//
// Structure: immediate punch-in (4 bars) -> relentless drive (16 bars) ->
// tension bridge (4 bars) -> explosive final section (8 bars).

const F_SHARP2 = 92.5;
const F_SHARP3 = 185;
const F_SHARP4 = 369.99;

// F#m(i) - D(VI) - E(VII) - E(VII). Close voicings keep the dark pad from
// jumping registers while the bass and chug state each chord root bluntly.
const PROGRESSION = [
  { root: 0, chordTones: [0, 3, 7, 12] },     // F#m (i)
  { root: -4, chordTones: [-4, 0, 3, 8] },   // D   (VI)
  { root: -2, chordTones: [-2, 2, 5, 10] },  // E   (VII)
  { root: -2, chordTones: [-2, 2, 5, 10] },  // E   (VII) — hard turnaround
];

const SILENT = new Array(16).fill(null);

// Bass and cyber-chug share rhythmic landmarks but not every hit: the gaps
// keep their distortion layers from becoming a flat wall. Fifths, sevenths,
// and octave jumps turn the palm-muted pedal into a recognizable riff.
const BASS_A = [
  0, null, 0, 0, null, null, 7, null,
  0, null, 0, 0, null, null, 10, null,
];
const BASS_B = [
  0, 0, null, 12, 0, null, 7, null,
  0, 0, null, 10, 0, null, 12, null,
];
const BASS_BRIDGE = [
  0, null, null, null, null, null, null, null,
  0, null, null, null, 1, null, 0, null,
];

const CHUG_A = [
  0, 0, null, 0, null, 7, 0, 0,
  12, null, 0, 0, null, 10, 7, null,
];
const CHUG_B = [
  0, null, 0, 12, 0, 0, null, 7,
  0, 0, 10, null, 0, 12, 7, 0,
];
const CHUG_BRIDGE = [
  0, null, null, null, 0, null, null, 7,
  null, null, 0, null, null, 1, 0, null,
];
const CHUG_FINAL = [
  0, 0, 0, 12, null, 7, 0, 0,
  12, 0, 10, 0, 0, 12, 7, 0,
];

// Chord-tone indices for the metallic synth lead. The hook attacks in short
// sparks around the riff instead of running a constant scale; B answers its
// first-pass descent with an octave-heavy climb for the second drive block.
const HOOK_TEASE = [
  null, null, null, 3, null, null, null, null,
  null, null, 2, null, 1, null, null, null,
];
const HOOK_A = [
  null, null, 3, null, 2, null, null, 1,
  null, null, 3, null, 2, 1, 0, null,
];
const HOOK_B = [
  0, null, null, 2, null, 3, null, 2,
  null, 1, null, 3, 2, null, 3, null,
];
const TENSION_LEAD = [
  3, null, null, null, 2, null, null, null,
  1, null, null, null, 0, null, null, null,
];

// Supporting distorted power chords enter only in the final section. Four
// broad hits leave the synthetic chug and lead audible as the track's core.
const GUITAR_HITS = [
  0, null, null, null, null, 0, null, null,
  12, null, null, null, null, 7, null, null,
];

const KICK_ASSAULT_A = [0, 2, 3, 6, 8, 10, 11, 14];
const KICK_ASSAULT_B = [0, 1, 2, 6, 8, 9, 10, 14, 15];
const KICK_BRIDGE = [0, 3, 8, 11, 14];
const KICK_FINAL = [0, 1, 2, 3, 6, 8, 9, 10, 11, 14, 15];
const SNARE_BACKBEAT = [4, 12];
const SNARE_BRIDGE = [8];
const SNARE_FILL = [4, 12, 13, 14, 15];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [7, 15];
const OPEN_HAT_FINAL = [3, 7, 11, 15];
const STEEL_OFFBEATS = [5, 13];
const STEEL_BRIDGE = [2, 6, 10, 14];

function bar(index, section) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  const transpose = (pattern) => pattern?.map(
    (offset) => (offset == null ? null : chord.root + offset),
  );

  return {
    bassRootFreq: F_SHARP2,
    chugRootFreq: F_SHARP3,
    guitarRootFreq: F_SHARP3,
    leadRootFreq: F_SHARP4,
    padRootFreq: F_SHARP3,
    bass: transpose(section.bass),
    driveBass: true,
    bassFM: true,
    sidechain: true,
    chordTones: chord.chordTones,
    chug: transpose(section.chug),
    guitar: transpose(section.guitar),
    lead: section.lead,
    leadSynth: 'metal',
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: section.padCutoff,
    kick: section.kick,
    snare: section.snare,
    hat: section.hat,
    openHat: section.openHat,
    industrial: section.industrial,
    industrialAccent: section.industrialAccent,
  };
}

// No atmospheric pre-roll: even the first bar is a complete impact. The
// hook is only teased until bar three so the riff gets a clean first read.
const PUNCH_A = {
  bass: BASS_A, chug: CHUG_A, lead: HOOK_TEASE,
  kick: KICK_ASSAULT_A, snare: SNARE_BACKBEAT,
  hat: HAT_16TH, openHat: OPEN_HAT,
  industrial: STEEL_OFFBEATS, industrialAccent: [13], padCutoff: 720,
};
const PUNCH_B = {
  ...PUNCH_A,
  bass: BASS_B, chug: CHUG_B, lead: HOOK_A, kick: KICK_ASSAULT_B,
};

function drive(lead, alternate = false) {
  return {
    bass: alternate ? BASS_B : BASS_A,
    chug: alternate ? CHUG_B : CHUG_A,
    lead,
    kick: alternate ? KICK_ASSAULT_B : KICK_ASSAULT_A,
    snare: SNARE_BACKBEAT,
    hat: HAT_16TH,
    openHat: OPEN_HAT,
    industrial: STEEL_OFFBEATS,
    industrialAccent: alternate ? [5] : [13],
    padCutoff: 820,
  };
}

// The bridge drops to a half-time snare and a low, descending lead while
// steel hits mark every eighth note. The fourth bar starts rebuilding the
// double-time grid so the final section feels launched, not merely resumed.
const BRIDGE = {
  bass: BASS_BRIDGE, chug: CHUG_BRIDGE, lead: TENSION_LEAD,
  kick: KICK_BRIDGE, snare: SNARE_BRIDGE,
  hat: HAT_8TH, openHat: [14],
  industrial: STEEL_BRIDGE, industrialAccent: [6, 14], padCutoff: 480,
};
const BRIDGE_FILL = {
  ...BRIDGE,
  bass: BASS_B, chug: CHUG_B, lead: SILENT,
  kick: KICK_FINAL, snare: SNARE_FILL,
  hat: HAT_16TH, openHat: OPEN_HAT_FINAL, padCutoff: 680,
};

function final(lead, guitar = false, turnaround = false) {
  return {
    bass: BASS_B,
    chug: CHUG_FINAL,
    guitar: guitar ? GUITAR_HITS : undefined,
    lead,
    kick: KICK_FINAL,
    snare: turnaround ? SNARE_FILL : SNARE_BACKBEAT,
    hat: HAT_16TH,
    openHat: OPEN_HAT_FINAL,
    industrial: STEEL_OFFBEATS,
    industrialAccent: [5, 13],
    padCutoff: 1050,
  };
}

const SECTIONS = [
  PUNCH_A, PUNCH_B, PUNCH_A, PUNCH_B,                              // immediate punch-in
  drive(HOOK_A), drive(HOOK_A, true), drive(HOOK_A), drive(HOOK_A, true),
  drive(HOOK_A), drive(HOOK_A, true), drive(HOOK_A), drive(HOOK_A, true),
  drive(HOOK_B), drive(HOOK_B, true), drive(HOOK_B), drive(HOOK_B, true),
  drive(HOOK_B), drive(HOOK_B, true), drive(HOOK_B), drive(HOOK_B, true), // relentless drive
  BRIDGE, BRIDGE, BRIDGE, BRIDGE_FILL,                              // tension bridge
  final(HOOK_A), final(HOOK_B, true), final(HOOK_A), final(HOOK_B, true),
  final(HOOK_B, true), final(HOOK_A, true), final(HOOK_B, true),
  final(HOOK_A, true, true),                                        // explosive finish / turnaround
];

export const REDLINE_GAUNTLET_THEME = {
  bpm: 184,
  stepsPerBar: 16,
  bars: SECTIONS.map((section, index) => bar(index, section)),
};
