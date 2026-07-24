// syndicateRunTheme.js — Syndicate Run's theme: the campaign finale,
// "denser events... the Syndicate is watching" per GAME_DESIGN.md. Built
// on a minor line cliché (i, i^maj7, i7, iv-half-dim — bass A-G#-G-F#
// under a static Am-family chord), the classic film-noir "danger" descent,
// instead of any of the other themes' diatonic loops. Sparse, off-beat lead
// stabs instead of a running arpeggio keep it tense rather than busy, and
// the bass shares Neon Gulch's driven/clipped tone but at a different
// tempo and a minor key, so the two never get confused for each other.

const A2 = 110;
const A4 = 440;
const A3 = 220;

// Syncopated pulses on the (already-moving) bar root, not a walk — the
// chromatic motion happens bar-to-bar, this just keeps each bar restless.
const BASS_PATTERN = [
  0, null, 0, null, null, null, 0, null,
  0, null, null, 0, null, null, 0, null,
];

// Off-beat, sparse, and descending — tension by omission, not motion.
const LEAD = [null, null, 3, null, null, 2, null, null, null, null, 1, null, null, null, 0, null];

function bar(root, chordTones) {
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    padRootFreq: A3,
    bass: BASS_PATTERN.map((offset) => (offset == null ? null : root + offset)),
    driveBass: true,
    chordTones,
    lead: LEAD,
    padStepsHeld: 16,
    kick: [0, 3, 6, 8, 11, 14],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    openHat: [10],
  };
}

export const SYNDICATE_RUN_THEME = {
  bpm: 168,
  stepsPerBar: 16,
  bars: [
    bar(0, [0, 3, 7, 12]),   // Am (i)
    bar(-1, [-1, 3, 7, 12]), // Am(maj7) — G# under the same triad
    bar(-2, [-2, 3, 7, 12]), // Am7 — G under the same triad
    bar(-3, [-3, 0, 3, 7]),  // F#m7b5 — resolves the line, loops to Am
  ],
};
