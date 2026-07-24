// highSpeedTheme.js — the racing BGM. Inspired by David Wise's Rare-era
// scores (Diddy Kong Racing, Donkey Kong Country): a funky syncopated
// bassline underneath a bright plucked-lead arpeggio, built on Dorian
// harmony (the natural-minor-with-a-raised-6th sound that makes the IV
// chord come out major instead of minor — the single biggest reason his
// tracks read as "adventurous" instead of "sad minor-key").
//
// Key: A Dorian (A B C D E F# G). Progression: Am7 - D7 - Gmaj7 - Em7
// (i - IV - bVII - v), all diatonic, IV bright by construction. 156 BPM,
// 16th-note grid, 4 bars looping — fast enough to sit under a racer
// without fighting the engine/wind noise once SFX exist.
//
// All melodic data below is semitone offsets from A. bassRootFreq /
// leadRootFreq / padRootFreq pin each voice to its own octave; the engine
// (MusicEngine.playX) multiplies freq * 2^(semitones/12) at note time.

const A2 = 110;
const A3 = 220;
const A4 = 440;

// Funky 16th-note pattern shared by every bar: root, root, fifth, octave,
// a flat-7 passing tone sliding back into the next bar's root — the
// classic James-Brown-via-Rare "walk-up" that keeps a one-note bassline
// from ever feeling static.
const BASS_PATTERN = [
  0, null, 0, null, 7, null, null, 12,
  null, 0, null, 7, null, 10, 0, null,
];

// Two lead patterns: a rising-then-falling arpeggio for bars 1-3, and a
// descending run on bar 4 that acts as a turnaround fill before the loop
// repeats — without it the phrase feels like it's looping mid-thought.
const ARP_UP = [0, 2, 1, 3, 2, 1, 0, 2, 3, 2, 1, 0, 2, 1, 0, null];
const ARP_DOWN = [3, 2, 1, 0, 2, 1, 3, 2, 1, 0, 3, 2, 1, 0, null, null];

const KICK = [0, 6, 8, 14];
const SNARE = [4, 12];
const HAT = [0, 2, 4, 6, 8, 10, 12, 14];
const OPEN_HAT = [10];

function bar({ root, chordTones, lead }) {
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    padRootFreq: A3,
    bass: BASS_PATTERN.map((offset) => (offset == null ? null : root + offset)),
    chordTones,
    lead,
    padStepsHeld: 16,
    kick: KICK,
    snare: SNARE,
    hat: HAT,
    openHat: OPEN_HAT,
  };
}

export const HIGH_SPEED_THEME = {
  bpm: 156,
  stepsPerBar: 16,
  bars: [
    bar({ root: 0, chordTones: [0, 3, 7, 10], lead: ARP_UP }),   // Am7 (i)
    bar({ root: 5, chordTones: [5, 9, 12, 15], lead: ARP_UP }),  // D7 (IV, major — the Dorian lift)
    bar({ root: 10, chordTones: [10, 14, 17, 21], lead: ARP_UP }), // Gmaj7 (bVII)
    bar({ root: 7, chordTones: [7, 10, 14, 17], lead: ARP_DOWN }), // Em7 (v) — turnaround fill
  ],
};
