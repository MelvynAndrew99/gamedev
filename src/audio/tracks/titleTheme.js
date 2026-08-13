// titleTheme.js — "Night Drive," the first sound of Rhythmic Ride.
//
// A short 16-bit synthwave fanfare that settles into a danceable loop while
// the player chooses a mode. The two-bar hook deliberately leaves breathing
// room for menu movement sounds; the final bar answers it and leads cleanly
// back to the opening downbeat. Original tracker data, synthesized live by
// MusicEngine—no audio asset or borrowed melody.

const F2 = 87.31;
const F3 = 174.61;
const F4 = 349.23;

const CHORDS = [
  { root: 0, tones: [0, 3, 7, 10], lead: [0, 3, 7, 10, 12, 15] },
  { root: -4, tones: [-4, 0, 3, 7], lead: [-4, 0, 3, 7, 8, 12] },
  { root: 3, tones: [3, 7, 10, 14], lead: [3, 7, 10, 14, 15, 19] },
  { root: -2, tones: [-2, 2, 5, 9], lead: [-2, 2, 5, 9, 10, 14] },
];

const HOOK = [
  0, null, 1, null, 2, null, 4, null,
  3, null, 2, 1, null, 0, null, null,
];
const HOOK_HIGH = [
  0, null, 2, null, 4, null, 5, null,
  4, 3, null, 2, null, 1, 0, null,
];
const ANSWER = [
  null, null, 2, 1, null, 0, null, 1,
  2, null, 3, null, 2, 1, 0, null,
];
const ARP = [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 3, 2, 1, 2];
const BASS = [0, null, 0, null, 7, null, 12, null, 0, null, 7, null, 10, null, 7, null];

function bar(index, lead, { intro = false, fill = false } = {}) {
  const chord = CHORDS[index % CHORDS.length];
  return {
    bassRootFreq: F2,
    leadRootFreq: F4,
    arpRootFreq: F4,
    padRootFreq: F3,
    bass: BASS.map((tone) => tone == null ? null : tone + chord.root),
    bassFM: true,
    bassGain: 0.7,
    chordTones: chord.tones,
    leadTones: chord.lead,
    lead,
    leadSynth: 'chip',
    leadGain: 1.2,
    arp: intro ? ARP.map((tone, step) => step % 2 === 0 ? tone : null) : ARP,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: intro ? 1250 : 1750,
    sidechain: true,
    sidechainDepth: 0.48,
    kick: intro ? [0, 8] : fill ? [0, 6, 8, 10, 14] : [0, 6, 8, 14],
    kickGain: 0.56,
    snare: fill ? [4, 12, 14, 15] : [4, 12],
    snareGain: 0.54,
    hat: fill
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      : [0, 2, 4, 6, 8, 10, 12, 14],
    hatGain: 0.48,
    openHat: intro ? [] : [6, 14],
  };
}

export const TITLE_THEME = Object.freeze({
  bpm: 128,
  stepsPerBar: 16,
  swing: 0.08,
  bars: Object.freeze([
    bar(0, HOOK, { intro: true }),
    bar(1, ANSWER),
    bar(2, HOOK),
    bar(3, ANSWER),
    bar(0, HOOK_HIGH),
    bar(1, ANSWER),
    bar(2, HOOK_HIGH),
    bar(3, ANSWER, { fill: true }),
  ].map(Object.freeze)),
});
