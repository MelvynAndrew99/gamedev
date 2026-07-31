// trainingLoopTheme.js — Training Loop's theme, reworked as a synthwave /
// Outrun night-drive cue in the spirit of Neon Wave's Overdrive Serum pack:
// a driven, pumping bass under a gated 16th-note arp, lush held pads, and a
// classic i-VI-III-VII progression (Am-F-C-G) in A natural minor. 128 BPM.
//
// MusicEngine.js grew the voices this track actually wants: a detuned/
// vibrato/panned saw lead (leadSynth: 'saw'), FM-enhanced bass grit
// (bassFM), a real sidechain-style pump on the kick (sidechain), and a
// chorus/drift/reverb-send pad — see MusicEngine.js's playSawLead/playBass/
// duck()/playPad for the implementation. Those additions are opt-in per bar
// so the other four themes render exactly as before.
//
// The 16-bar arrangement is the requested arc — atmospheric intro ->
// rhythmic build -> main drive -> breakdown -> final push — and then loops
// (MusicEngine plays bars on a modulo index), so "final push" falling back
// to "atmospheric intro" reads as a DJ-style break instead of a hard reset.
// The 4-bar Am-F-C-G cycle repeats underneath that arc regardless of section.

const A2 = 110;
const A3 = 220;
const A4 = 440;

// Am - F - C - G (i - VI - III - VII), each a semitone offset from A with
// its triad shape (root, 3rd, 5th, octave) built on the A natural minor scale.
const PROGRESSION = [
  { root: 0, chordTones: [0, 3, 7, 12] },     // Am (i)
  { root: 8, chordTones: [8, 12, 15, 20] },   // F (VI)
  { root: 3, chordTones: [3, 7, 10, 15] },    // C (III)
  { root: 10, chordTones: [10, 14, 17, 22] }, // G (VII) — resolves back to Am
];

// Rolling root-fifth-octave-flat7 pulse — the "driving" motion under the arp.
const DRIVE_BASS = [
  0, null, 7, null, 0, null, 12, null,
  0, null, 7, null, 0, null, 10, null,
];
// Same shape thinned to a two-note pulse for the quiet sections.
const SPARSE_BASS = [
  0, null, null, null, null, null, null, null,
  7, null, null, null, null, null, null, null,
];

// Gated 1/16 up-down arpeggio through the chord — forward momentum.
const ARP_FULL = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1];
// Half-time version of the same shape for the build section.
const ARP_BUILD = [0, null, 2, null, 1, null, 3, null, 0, null, 2, null, 1, null, 0, null];
// Slow root/5th comp ('keys' voice) for the intro and breakdown.
const KEYS_SPARSE = [0, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null];

const FOUR_FLOOR = [0, 4, 8, 12];
const BACKBEAT = [4, 12];
const HATS_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HATS_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function bar(section, chord) {
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    padRootFreq: A3,
    bass: section.bass.map((offset) => (offset == null ? null : chord.root + offset)),
    driveBass: section.driveBass,
    bassFM: section.bassFM,
    sidechain: section.sidechain,
    chordTones: chord.chordTones,
    lead: section.lead,
    leadSynth: section.leadSynth,
    padStepsHeld: 16,
    kick: section.kick,
    snare: section.snare,
    hat: section.hat,
    openHat: section.openHat,
  };
}

// Atmospheric intro: a slow heartbeat kick, one hat tick, sparse keys comp.
const INTRO = {
  bass: SPARSE_BASS, driveBass: false, lead: KEYS_SPARSE, leadSynth: 'keys',
  kick: [0], snare: [], hat: [8], openHat: [],
};
// Rhythmic build: four-on-the-floor arrives, arp enters half-time, one snare hit.
const BUILD = {
  bass: SPARSE_BASS, driveBass: false, lead: ARP_BUILD, leadSynth: undefined,
  kick: FOUR_FLOOR, snare: [12], hat: HATS_8TH, openHat: [],
};
// Main drive: full arrangement — FM-gritty pumping bass, saw-lead gated
// arp, open hat accents, kick-triggered sidechain duck on bass/pad/keys.
const DRIVE = {
  bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: ARP_FULL, leadSynth: 'saw',
  kick: FOUR_FLOOR, snare: BACKBEAT, hat: HATS_16TH, openHat: [6, 14],
};
// Breakdown: drums pull back to almost nothing, pad and keys carry it.
const BREAKDOWN = {
  bass: SPARSE_BASS, driveBass: false, lead: KEYS_SPARSE, leadSynth: 'keys',
  kick: [0, 8], snare: [], hat: HATS_8TH, openHat: [],
};
// Final push: same as the main drive but every off-beat hat opens — the peak.
const FINAL_PUSH = {
  bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: ARP_FULL, leadSynth: 'saw',
  kick: FOUR_FLOOR, snare: BACKBEAT, hat: HATS_16TH, openHat: [2, 6, 10, 14],
};

const ARC = [
  INTRO, INTRO,
  BUILD, BUILD,
  DRIVE, DRIVE, DRIVE, DRIVE, DRIVE, DRIVE,
  BREAKDOWN, BREAKDOWN,
  FINAL_PUSH, FINAL_PUSH, FINAL_PUSH, FINAL_PUSH,
];

export const TRAINING_LOOP_THEME = {
  bpm: 128,
  stepsPerBar: 16,
  bars: ARC.map((section, i) => bar(section, PROGRESSION[i % PROGRESSION.length])),
};
