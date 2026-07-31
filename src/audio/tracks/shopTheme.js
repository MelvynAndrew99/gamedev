// shopTheme.js — "Chrome & Credits," a compact 16-bit future-funk cue for
// the pit garage. Think of an SNES-era composer with only a handful of
// channels making every one count: springy synth bass, crisp drum-machine
// backbeat, a bright square-wave hook, tiny gated-saw "repair bot" glints,
// and warm chord pads behind the counter.
//
// Key: C# minor/Dorian. The C#m9-F#7-Bmaj7-G#7 turnaround behaves like
// i-IV-VII-V: jazzy enough to suggest upgrades and expensive machinery,
// direct enough to dance to, and G#7 pulls decisively back into the loop.
// 112 BPM with light 16th-note swing keeps it moving without borrowing a
// race theme's urgency. Eight bars = 17.1 seconds, inside GAME_DESIGN.md's
// explicit 16-24 second allowance for this short-stay scene.
//
// Form: four-bar hook (A) -> repeated hook with a two-bar breakdown and
// turnaround fill (A'). The repetition makes it catchy; the last two bars
// stop a brief shop visit from hearing exactly the same pass twice.

const C_SHARP2 = 69.3;
const C_SHARP3 = 138.59;
const C_SHARP4 = 277.18;

// leadTones keep the same six-note hook contour useful across minor,
// dominant, and major-seventh chords without adding every color tone to the
// sustained pad. Layout: root, third, fifth, seventh, octave, ninth.
const PROGRESSION = [
  {
    bassRoot: 0,
    pickup: 4,
    chordTones: [0, 3, 7, 10],
    leadTones: [0, 3, 7, 10, 12, 14],
  }, // C#m9 (i)
  {
    bassRoot: 5,
    pickup: 9,
    chordTones: [5, 9, 12, 15],
    leadTones: [5, 9, 12, 15, 17, 19],
  }, // F#7 (IV)
  {
    bassRoot: -2,
    pickup: 6,
    chordTones: [-2, 2, 5, 9],
    // Keep the pad's compact B3 voicing, but place the hook on B4. The old
    // -2 start dropped the melody seven semitones after F#7 and then jumped
    // nine into G#7, which was consonant on paper but sounded like a mistake.
    leadTones: [10, 14, 17, 21, 22, 24],
  }, // Bmaj7 (VII)
  {
    // Bass takes G# upward to stay clear of the engine's sub cut; pad and
    // melody use a close G#7 voicing around the shared C# reference pitch.
    bassRoot: 7,
    pickup: 11,
    chordTones: [-5, -1, 2, 5],
    leadTones: [7, 11, 14, 17, 19, 21],
  }, // G#7 (V/i)
];

function bassLine(root, pickup) {
  return [
    root, null, null, root + 12,
    null, null, root + 7, null,
    root, null, root + 12, null,
    root + 7, null, pickup, null,
  ];
}

// One compact, hummable shape: root-third-fifth-octave, then a seventh-
// fifth-third answer. Repeating the contour over new chord colors is a very
// 16-bit way to make a tiny note budget sound like a composed melody.
const HOOK_A = [
  0, null, null, 1, null, 2, null, 4,
  null, 3, null, 2, null, 1, null, null,
];
const HOOK_B = [
  0, null, 1, null, 2, null, 4, null,
  5, null, 4, null, 3, 2, 1, null,
];
const BREAK_HOOK = [
  0, null, null, null, 2, null, null, null,
  3, null, null, null, 1, null, null, null,
];
const TURNAROUND = [
  2, null, 3, null, 4, null, 5, null,
  4, null, 3, 2, 1, null, 0, null,
];

// Quiet gated-saw answers between hook phrases: little scanner lights and
// pneumatic-tool blips, never a constant racing arp.
const GLINTS_A = [
  null, null, 0, null, null, null, 2, null,
  null, null, 1, null, null, null, 3, null,
];
const GLINTS_B = [
  null, 1, null, null, null, 2, null, null,
  null, 3, null, null, null, 2, null, null,
];

const KICK_GROOVE = [0, 4, 8, 11, 12];
const KICK_BREAK = [0, 8, 11];
const SNARE_BACKBEAT = [4, 12];
const SNARE_FILL = [4, 12, 14, 15];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];

function bar(index, { lead, arp = GLINTS_A, breakBeat = false, fill = false }) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  return {
    bassRootFreq: C_SHARP2,
    leadRootFreq: C_SHARP4,
    arpRootFreq: C_SHARP4,
    padRootFreq: C_SHARP3,
    bass: bassLine(chord.bassRoot, chord.pickup),
    bassFM: true,
    driveBass: false,
    bassGain: 0.72,
    sidechain: true,
    sidechainDepth: 0.5,
    chordTones: chord.chordTones,
    leadTones: chord.leadTones,
    lead,
    leadSynth: 'chip',
    leadGain: 1.28,
    arp,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: breakBeat ? 1250 : 1850,
    kick: breakBeat ? KICK_BREAK : KICK_GROOVE,
    kickGain: 0.56,
    snare: fill ? SNARE_FILL : SNARE_BACKBEAT,
    snareGain: 0.58,
    hat: fill ? HAT_16TH : HAT_8TH,
    hatGain: 0.58,
    openHat: fill ? [3, 7, 11, 15] : OPEN_HAT,
  };
}

export const SHOP_THEME = {
  bpm: 112,
  stepsPerBar: 16,
  // Just enough pocket to dance; far lighter than the former lounge shuffle.
  swing: 0.2,
  bars: [
    bar(0, { lead: HOOK_A }),
    bar(1, { lead: HOOK_A, arp: GLINTS_B }),
    bar(2, { lead: HOOK_B }),
    bar(3, { lead: TURNAROUND, arp: GLINTS_B }),
    bar(4, { lead: HOOK_A, arp: GLINTS_B }),
    bar(5, { lead: HOOK_B }),
    bar(6, { lead: BREAK_HOOK, breakBeat: true, arp: GLINTS_B }),
    bar(7, { lead: TURNAROUND, fill: true }),
  ],
};
