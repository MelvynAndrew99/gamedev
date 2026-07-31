// syndicateRunTheme.js — "Controlled Burn," a cyber-metal workout anthem
// shaped to Syndicate Run's actual race pace. It keeps the steel, distorted
// synths, and double-time release of the former cue, but earns that intensity
// through dynamics instead of beginning at its ceiling.
//
// Key: E minor. Progression: Em-G-D-C (i-III-VII-VI), a broad anthemic loop
// distinct from Redline Gauntlet's F#m-D-E pedal assault. 166 BPM is still
// faster than the other campaign cues, but the opening and interlude use a
// half-time feel so the track breathes with the road rather than overrunning
// it. 36 bars = 52 seconds.
//
// Form, in standard arrangement terms:
//   half-time intro (4) -> crescendo / pre-drop build (4) ->
//   double-time main groove (8) -> pre-chorus riser (4) ->
//   climactic chorus/drop (8) -> breakdown interlude (4) ->
//   rebuild / loop turnaround (4).

const E2 = 82.41;
const E3 = 164.81;
const E4 = 329.63;

// chordTones belong to the pad; leadTones add sevenths and ninths for one
// recurring hook contour without muddying the sustained harmony.
const PROGRESSION = [
  {
    root: 0,
    chordTones: [0, 3, 7, 12],
    leadTones: [0, 3, 7, 10, 12, 14],
  }, // Em (i)
  {
    root: 3,
    chordTones: [3, 7, 10, 15],
    leadTones: [3, 7, 10, 14, 15, 17],
  }, // G (III)
  {
    root: -2,
    chordTones: [-2, 2, 5, 10],
    leadTones: [-2, 2, 5, 8, 10, 12],
  }, // D (VII)
  {
    root: -4,
    chordTones: [-4, 0, 3, 8],
    leadTones: [-4, 0, 3, 7, 8, 10],
  }, // C (VI)
];

const SILENT = new Array(16).fill(null);

// The rhythm section grows by subdivision: two root pulses in the intro,
// syncopated eighths in the build, then the full pedal/fifth/octave ostinato.
const BASS_HALF = [
  0, null, null, null, null, null, null, null,
  0, null, null, null, null, null, null, null,
];
const BASS_BUILD = [
  0, null, 0, null, null, null, 7, null,
  0, null, 0, null, 12, null, 7, null,
];
const BASS_DRIVE_A = [
  0, null, 0, null, 0, null, 7, null,
  0, 0, null, 12, 0, null, 7, null,
];
const BASS_DRIVE_B = [
  0, null, 0, 7, null, 0, null, 12,
  0, null, 0, null, 7, 0, 12, null,
];

const CHUG_HALF = [
  0, null, null, null, 0, null, 7, null,
  0, null, null, null, 12, null, 7, null,
];
const CHUG_BUILD = [
  0, null, 0, null, 0, null, 7, null,
  0, null, 0, 12, null, 7, 0, null,
];
const CHUG_DRIVE_A = [
  0, null, 0, null, 0, 7, null, 0,
  null, 0, 12, null, 0, 7, null, 0,
];
const CHUG_DRIVE_B = [
  0, null, 0, 7, null, 0, null, 12,
  0, null, 0, null, 7, 0, 12, null,
];
const CHUG_CLIMAX = [
  0, 0, null, 0, 7, null, 0, 12,
  0, null, 0, 7, 12, 0, 7, null,
];

// The hook is a syncopated call-and-response, not a continuous arpeggio:
// two tonic calls, an upward fifth/octave answer, then a descending tag.
// Its rhythm remains recognizable as harmony changes beneath it.
const HOOK_TEASE = [
  null, null, null, null, null, null, null, null,
  0, null, 0, null, 2, null, 1, null,
];
const HOOK_A = [
  null, 0, null, 0, null, 2, null, 1,
  4, null, null, 3, 2, null, 0, null,
];
const HOOK_B = [
  0, null, 2, null, 4, 4, null, 3,
  null, 2, null, 5, 4, 3, 2, null,
];
const RISER = [
  0, null, 1, null, 2, null, 3, null,
  4, null, 4, 5, 4, 3, 2, 1,
];
const INTERLUDE_HOOK = [
  0, null, null, null, 3, null, null, null,
  2, null, null, null, 1, null, null, null,
];

// Wide guitar-like hits are reserved for the chorus/drop. The FM cyber-chug
// remains the rhythmic identity, in keeping with the futuristic score rule.
const GUITAR_ACCENTS = [
  0, null, null, null, null, null, 0, null,
  12, null, null, null, null, null, 7, null,
];

const KICK_HALF = [0, 8];
const KICK_FOUR = [0, 4, 8, 12];
const KICK_DRIVE = [0, 3, 6, 8, 11, 14];
const KICK_CLIMAX = [0, 2, 3, 6, 8, 10, 11, 14];
const SNARE_HALF = [8];
const SNARE_BACKBEAT = [4, 12];
const SNARE_FILL = [4, 12, 13, 14, 15];
const HAT_QUARTER = [0, 4, 8, 12];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];
const OPEN_HAT_CLIMAX = [3, 7, 11, 15];
const STEEL_PULSE = [7, 15];

function bar(index, section) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  const transpose = (pattern) => pattern?.map(
    (offset) => (offset == null ? null : chord.root + offset),
  );

  return {
    bassRootFreq: E2,
    chugRootFreq: E3,
    guitarRootFreq: E3,
    leadRootFreq: E4,
    padRootFreq: E3,
    bass: transpose(section.bass),
    bassFM: section.bassFM ?? true,
    driveBass: section.driveBass ?? true,
    bassGain: section.bassGain ?? 0.84,
    sidechain: section.sidechain ?? true,
    sidechainDepth: section.sidechainDepth ?? 0.5,
    chordTones: chord.chordTones,
    leadTones: chord.leadTones,
    chug: transpose(section.chug),
    guitar: transpose(section.guitar),
    lead: section.lead,
    leadSynth: section.leadSynth ?? 'metal',
    leadGain: section.leadGain,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: section.padCutoff,
    kick: section.kick,
    kickGain: section.kickGain ?? 0.78,
    snare: section.snare,
    snareGain: section.snareGain ?? 0.8,
    hat: section.hat,
    hatGain: section.hatGain ?? 0.68,
    openHat: section.openHat,
    industrial: section.industrial,
    industrialAccent: section.industrialAccent,
  };
}

// Half-time intro: orchestration enters one layer per bar. On later loops it
// also works as a heavy post-riser half-time landing rather than dead air.
const INTRO_OPEN = {
  bass: BASS_HALF, chug: SILENT, lead: SILENT,
  bassFM: false, driveBass: false, sidechain: false,
  kick: KICK_HALF, snare: SNARE_HALF, hat: HAT_QUARTER, openHat: [],
  industrial: [], industrialAccent: [], padCutoff: 420,
  kickGain: 0.54, snareGain: 0.58, hatGain: 0.5,
};
const INTRO_CHUG = {
  ...INTRO_OPEN,
  chug: CHUG_HALF, sidechain: true, industrial: [15], industrialAccent: [15],
};
const INTRO_TEASE = {
  ...INTRO_CHUG,
  lead: HOOK_TEASE, bassFM: true, padCutoff: 520,
};
const INTRO_LIFT = {
  ...INTRO_TEASE,
  bass: BASS_BUILD, hat: HAT_8TH, openHat: [14], padCutoff: 620,
};

// Crescendo / pre-drop: subdivision, brightness, and transient density rise
// together. The last bar's roll is the pickup into the double-time groove.
const BUILD_A = {
  bass: BASS_BUILD, chug: CHUG_BUILD, lead: HOOK_TEASE,
  kick: KICK_FOUR, snare: SNARE_BACKBEAT, hat: HAT_8TH, openHat: OPEN_HAT,
  industrial: [15], industrialAccent: [15], padCutoff: 680,
};
const BUILD_B = { ...BUILD_A, bass: BASS_DRIVE_A, padCutoff: 780 };
const BUILD_RISE = {
  ...BUILD_B,
  chug: CHUG_DRIVE_A, lead: RISER, kick: KICK_DRIVE,
  hat: HAT_16TH, padCutoff: 900,
};
const BUILD_FILL = {
  ...BUILD_RISE,
  snare: SNARE_FILL, openHat: OPEN_HAT_CLIMAX,
  industrial: STEEL_PULSE, industrialAccent: [15], padCutoff: 1020,
};

function drive(lead, alternate = false) {
  return {
    bass: alternate ? BASS_DRIVE_B : BASS_DRIVE_A,
    chug: alternate ? CHUG_DRIVE_B : CHUG_DRIVE_A,
    lead,
    kick: KICK_DRIVE,
    snare: SNARE_BACKBEAT,
    hat: HAT_16TH,
    openHat: OPEN_HAT,
    industrial: STEEL_PULSE,
    industrialAccent: alternate ? [7] : [15],
    padCutoff: 920,
  };
}

// Pre-chorus riser: the harmony still cycles, but one rising melodic cell and
// successively brighter pads suspend the hook's resolution until the drop.
const PRE_A = {
  ...drive(RISER), chug: CHUG_BUILD, kick: KICK_FOUR,
  industrial: [15], industrialAccent: [15], padCutoff: 820,
};
const PRE_B = { ...PRE_A, chug: CHUG_DRIVE_A, kick: KICK_DRIVE, padCutoff: 980 };
const PRE_C = {
  ...PRE_B, bass: BASS_DRIVE_B, hat: HAT_16TH,
  industrial: STEEL_PULSE, padCutoff: 1140,
};
const PRE_FILL = {
  ...PRE_C, kick: KICK_CLIMAX, snare: SNARE_FILL,
  openHat: OPEN_HAT_CLIMAX, industrialAccent: STEEL_PULSE, padCutoff: 1280,
};

function payoff(lead, guitar = false, turnaround = false) {
  return {
    bass: BASS_DRIVE_B,
    chug: CHUG_CLIMAX,
    guitar: guitar ? GUITAR_ACCENTS : undefined,
    lead,
    kick: KICK_CLIMAX,
    kickGain: 0.84,
    snare: turnaround ? SNARE_FILL : SNARE_BACKBEAT,
    snareGain: 0.86,
    hat: HAT_16TH,
    hatGain: 0.72,
    openHat: OPEN_HAT_CLIMAX,
    industrial: STEEL_PULSE,
    industrialAccent: STEEL_PULSE,
    padCutoff: 1360,
  };
}

// Breakdown interlude: the double-time grid falls away, the bass cleans up,
// and a quieter chip-voice reduction of the hook leaves room to recover.
const INTERLUDE_OPEN = {
  bass: BASS_HALF, chug: SILENT, lead: INTERLUDE_HOOK, leadSynth: 'chip', leadGain: 0.95,
  bassFM: false, driveBass: false, bassGain: 0.7, sidechain: false,
  kick: KICK_HALF, kickGain: 0.48, snare: SNARE_HALF, snareGain: 0.52,
  hat: HAT_QUARTER, hatGain: 0.45, openHat: [],
  industrial: [], industrialAccent: [], padCutoff: 390,
};
const INTERLUDE_PULSE = {
  ...INTERLUDE_OPEN,
  chug: CHUG_HALF, sidechain: true, sidechainDepth: 0.62,
  hat: HAT_8TH, openHat: [14], padCutoff: 520,
};

// Rebuild / loop turnaround: restore one rhythmic layer per bar and finish
// with a fill. The loop then lands on INTRO_OPEN as a deliberate half-time
// downshift before the next acceleration arc.
const REBUILD_A = {
  ...INTERLUDE_PULSE,
  bass: BASS_BUILD, lead: HOOK_TEASE, leadSynth: 'metal', bassFM: true,
  kick: KICK_FOUR, snare: SNARE_BACKBEAT, padCutoff: 650,
};
const REBUILD_B = {
  ...BUILD_A, lead: HOOK_A, padCutoff: 780,
};
const REBUILD_C = {
  ...BUILD_RISE, lead: HOOK_B, padCutoff: 960,
};
const REBUILD_FILL = {
  ...BUILD_FILL, lead: RISER, kick: KICK_CLIMAX, padCutoff: 1160,
};

const SECTIONS = [
  INTRO_OPEN, INTRO_CHUG, INTRO_TEASE, INTRO_LIFT,                  // half-time intro
  BUILD_A, BUILD_B, BUILD_RISE, BUILD_FILL,                         // crescendo / pre-drop
  drive(HOOK_A), drive(HOOK_A, true), drive(HOOK_A), drive(HOOK_A, true),
  drive(HOOK_B), drive(HOOK_B, true), drive(HOOK_B), drive(HOOK_B, true), // main groove
  PRE_A, PRE_B, PRE_C, PRE_FILL,                                   // pre-chorus riser
  payoff(HOOK_A), payoff(HOOK_B, true), payoff(HOOK_A), payoff(HOOK_B, true),
  payoff(HOOK_B), payoff(HOOK_A, true), payoff(HOOK_B), payoff(HOOK_A, true, true), // chorus/drop
  INTERLUDE_OPEN, INTERLUDE_OPEN, INTERLUDE_PULSE, INTERLUDE_PULSE, // breakdown
  REBUILD_A, REBUILD_B, REBUILD_C, REBUILD_FILL,                    // loop turnaround
];

export const SYNDICATE_RUN_THEME = {
  bpm: 166,
  stepsPerBar: 16,
  bars: SECTIONS.map((section, index) => bar(index, section)),
};
