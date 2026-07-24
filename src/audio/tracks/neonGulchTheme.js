// neonGulchTheme.js — Neon Gulch's theme, and the requested Big Blue
// homage. Not a transcription — an original piece built from the same
// ingredients that make Big Blue read as Big Blue: a relentless straight-
// eighth bass pulse standing in for the highway drone, a short rhythmic
// riff that repeats note-for-note while the harmony moves under it (the
// hook stays put; the chord changes come to it), four-on-the-floor kick,
// and a driven/clipped bass tone instead of a clean one. 174 BPM — the
// fastest theme in the game, matching the track's own design brief
// ("pays double for drivers who don't lift").
//
// Key: E minor, i-bVII-bVI-V (Em-D-C-B) — a rock cadence, not the funk-
// Dorian harmony the rest of the score uses elsewhere. That harmonic
// language shift is deliberate: this track should sound like it drove in
// from a different game and the road just happens to connect.

const E2 = 82.41;
const E4 = 329.63;
const E3 = 164.81;

// Straight 8ths, root only, no rests longer than an 8th — the engine-drone
// bass a i-IV-V funk walk would never produce.
const BASS_PATTERN = [
  0, null, 0, null, 0, null, 0, null,
  0, null, 0, null, 0, null, 0, null,
];

// The hook: identical every bar regardless of chord underneath — that's
// what makes it read as a riff instead of an arpeggio.
const RIFF = [0, null, 2, 0, null, 3, null, 2, 0, null, 2, 0, null, 1, null, null];

function bar(root, chordTones) {
  return {
    bassRootFreq: E2,
    leadRootFreq: E4,
    padRootFreq: E3,
    bass: BASS_PATTERN.map((offset) => (offset == null ? null : root + offset)),
    driveBass: true, // clipped, punchy — the analog engine-pulse tone
    chordTones,
    lead: RIFF,
    padStepsHeld: 16,
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    openHat: [6, 14],
  };
}

export const NEON_GULCH_THEME = {
  bpm: 174,
  stepsPerBar: 16,
  bars: [
    bar(0, [0, 3, 7, 12]),     // Em (i)
    bar(-2, [-2, 2, 5, 10]),   // D (bVII)
    bar(-4, [-4, 0, 3, 8]),    // C (bVI)
    bar(-5, [-5, -1, 2, 7]),   // B (V) — pulls back to Em
  ],
};
