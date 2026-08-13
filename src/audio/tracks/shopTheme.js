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

const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];

// "Chrome & Credits — Recharged" keeps the established harmony and repair-bay
// identity but gives it the clearer hierarchy that made Night Drive land:
// faster pulse, a two-bar rhythmic fingerprint, an immediate repeat, a real
// subtractive breakdown, and a final high-register payoff. This is the sole
// shipped version so the library offers only the strongest mix.
const RECHARGED_HOOK = [
  0, null, 2, null, 4, null, 3, 2,
  null, 1, null, 2, null, 0, null, null,
];
const RECHARGED_ANSWER = [
  null, 1, null, 2, 3, null, 4, null,
  5, null, 4, null, 2, 1, null, null,
];
const RECHARGED_HIGH = [
  2, null, 4, null, 5, null, 4, 3,
  null, 2, 3, 4, null, 2, 1, null,
];
const RECHARGED_TEASE = [
  0, null, null, null, 2, null, null, null,
  4, null, null, null, 2, null, null, null,
];
const RECHARGED_FILL = [
  0, 1, 2, null, 3, 4, 5, null,
  4, 3, 2, 1, 2, null, 0, null,
];
const RECHARGED_ARP = [
  0, null, 1, 2, null, 1, 3, null,
  0, null, 2, 1, null, 3, 2, null,
];

function rechargedBass(root, pickup, sparse = false) {
  return sparse
    ? [root, null, null, null, root + 7, null, null, null,
      root + 12, null, null, null, pickup, null, null, null]
    : [root, null, root + 7, null, root + 12, null, root + 7, null,
      root, null, null, root + 12, root + 7, null, pickup, null];
}

function rechargedBar(index, lead, {
  intro = false,
  breakdown = false,
  fill = false,
} = {}) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  return {
    bassRootFreq: C_SHARP2,
    leadRootFreq: C_SHARP4,
    arpRootFreq: C_SHARP4,
    padRootFreq: C_SHARP3,
    bass: rechargedBass(chord.bassRoot, chord.pickup, intro || breakdown),
    bassFM: !breakdown,
    driveBass: false,
    bassGain: breakdown ? 0.58 : 0.76,
    sidechain: true,
    sidechainDepth: breakdown ? 0.62 : 0.46,
    chordTones: chord.chordTones,
    leadTones: chord.leadTones,
    lead,
    leadSynth: 'chip',
    leadGain: breakdown ? 1.05 : 1.34,
    arp: intro || breakdown
      ? RECHARGED_ARP.map((tone, step) => step % 4 === 0 ? tone : null)
      : RECHARGED_ARP,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: breakdown ? 1050 : intro ? 1350 : 2050,
    kick: intro || breakdown ? [0, 8] : fill ? [0, 3, 6, 8, 11, 14] : [0, 3, 8, 11, 14],
    kickGain: breakdown ? 0.45 : 0.58,
    snare: fill ? [4, 12, 14, 15] : [4, 12],
    snareGain: breakdown ? 0.46 : 0.56,
    hat: intro || breakdown
      ? [0, 4, 8, 12]
      : fill
        ? HAT_16TH
        : HAT_8TH,
    hatGain: breakdown ? 0.38 : 0.5,
    openHat: intro || breakdown ? [] : fill ? [3, 7, 11, 15] : OPEN_HAT,
  };
}

export const SHOP_THEME = Object.freeze({
  bpm: 120,
  stepsPerBar: 16,
  swing: 0.1,
  bars: Object.freeze([
    rechargedBar(0, RECHARGED_TEASE, { intro: true }),
    rechargedBar(1, RECHARGED_HOOK),
    rechargedBar(2, RECHARGED_HOOK),
    rechargedBar(3, RECHARGED_ANSWER),
    rechargedBar(0, RECHARGED_HIGH),
    rechargedBar(1, RECHARGED_ANSWER),
    rechargedBar(2, RECHARGED_TEASE, { breakdown: true }),
    rechargedBar(3, RECHARGED_HOOK),
    rechargedBar(0, RECHARGED_HIGH),
    rechargedBar(3, RECHARGED_FILL, { fill: true }),
  ].map(Object.freeze)),
});
