// trainingLoopTheme.js — Training Loop's theme. GAME_DESIGN.md's role for
// this track is "lowest event density, generous recovery, teach one thing
// at a time" — so the music teaches the same lesson: a plain I-IV-V-I in
// A major, root-and-fifth bass with no syncopation, a melody that only
// ever steps to the next chord tone, straight 8th hats, no swing, no
// distortion. Every trick the other themes use (funk syncopation, chromatic
// walk, swing, drive) is deliberately absent here — this is the "before"
// picture the rest of the soundtrack gets to break away from.

const A2 = 110;
const A4 = 440;
const A3 = 220;

// Root-fifth "oom-pah" on the beat — the simplest bass a track can walk.
const BASS_PATTERN = [
  0, null, null, null,
  7, null, null, null,
  0, null, null, null,
  7, null, null, null,
];

// Never leaves stepwise motion between adjacent chord tones (indices 0-3
// are root/3rd/5th/octave, so 0->1->2->1->0 never skips).
const MELODY = [0, null, 1, null, 2, null, 1, null, 0, null, null, null, 2, null, 1, null];

function bar(root, chordTones) {
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    padRootFreq: A3,
    bass: BASS_PATTERN.map((offset) => (offset == null ? null : root + offset)),
    chordTones,
    lead: MELODY,
    leadSynth: 'keys',
    padStepsHeld: 16,
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    openHat: [],
  };
}

export const TRAINING_LOOP_THEME = {
  bpm: 132,
  stepsPerBar: 16,
  bars: [
    bar(0, [0, 4, 7, 12]),   // A (I)
    bar(5, [5, 9, 12, 17]),  // D (IV)
    bar(7, [7, 11, 14, 19]), // E (V)
    bar(0, [0, 4, 7, 12]),   // A (I) — resolves every four bars, never wanders
  ],
};
