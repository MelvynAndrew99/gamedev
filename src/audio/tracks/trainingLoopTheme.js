// trainingLoopTheme.js — "Open Circuit": bright synthwave for a first-time
// driver learning to scan, steer, and settle the car at speed. Its energy arc
// is welcoming runway → confident groove → celebratory final lap, with enough
// space around the hook that instruction and driving never feel frantic.
// Synthetic saws, gated voltage-like pulses, and drum-machine transients carry
// the identity; there are no acoustic-like voices.
//
// Key: A minor, i-VII-VI-VII (Am-G-F-G) — a "pendulum" progression (root,
// down a step, down another, back up to the pivot chord) instead of the
// climbing i-VI-III-VII an earlier draft used in the same key. 128 BPM,
// 24 bars = 45 seconds (GAME_DESIGN.md requires >=30s). Form: 4-bar intro,
// 4-bar build, 8-bar groove, 4-bar subtractive reset, 4-bar payoff/turnaround.
// Every boundary lands on the progression's Am.
 
const A2 = 110;
const A3 = 220;
const A4 = 440;
 
// Am(i) - G(VII) - F(VI) - G(VII); minor tonic with two major borrowed
// chords — the "bright minor" Outrun sound — and G revisited as the pivot
// that keeps pulling back toward Am.
const PROGRESSION = [
  { root: 0, chordTones: [0, 3, 7, 12] },   // Am (i)
  { root: -2, chordTones: [-2, 2, 5, 10] }, // G (VII)
  { root: -4, chordTones: [-4, 0, 3, 8] },  // F (VI)
  { root: -2, chordTones: [-2, 2, 5, 10] }, // G (VII) — pivot back to Am
];
 
const SILENT = new Array(16).fill(null);
 
const SPARSE_BASS = [
  0, null, null, null, null, null, null, null,
  7, null, null, null, null, null, null, null,
];
// The driving pocket deliberately does not copy the four-on-the-floor kick:
// anticipations on 3/5/13 and a final-step pickup make bass + drums groove on
// their own, while the root on 0 and octave on 8 keep a novice-friendly pulse.
const POCKET_BASS = [
  0, null, null, 7, null, 0, null, null,
  12, null, 7, null, null, 10, null, 12,
];
 
// The hook: a spaced-out root-5th-3rd skip mostly on the quarter, with
// rests instead of a running arpeggio — the hook's rhythm stays put while
// the harmony moves under it. (Distinct from Neon Gulch's double-hit-and-
// octave-jump future-funk riff, per GAME_DESIGN.md's no-shared-songwriting
// rule.)
const HOOK_A = [0, null, null, 2, null, 1, null, null, 0, null, 2, null, null, 1, null, null];
// Same shape with a passing run at the end, so the loop's second pass isn't
// a note-for-note repeat of the first.
const HOOK_B = [0, null, null, 2, null, 1, null, null, 0, null, 2, null, 3, 2, 1, null];
// A two-note preview of the hook's opening, used in the intro's last bar
// and echoed on keys through the breakdown, so both arrivals of the main
// drive land as payoffs instead of cold starts.
const HOOK_TEASE = [0, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null];
 
// Fast 16th arp — reserved for the one-bar transitions between sections
// so it reads as a fill, not the main event the hook already owns.
const ARP_FILL = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1];
 
// The gated pulse is an earned lift, not permanent wallpaper. Eighth-note
// holes keep it underneath the hook; it appears late in the build, in the
// varied groove, and in the payoff, then vanishes completely in the reset.
const ARP_LIFT = [0, null, 2, null, 3, null, 2, null, 0, null, 2, null, 3, null, 2, null];
 
const KICK_HALF = [0, 8];
const KICK_FULL = [0, 4, 8, 12];
const SNARE_BACKBEAT = [4, 12];
const SNARE_ROLL = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];
const OPEN_HAT_FULL = [2, 6, 10, 14];
 
function bar(index, section) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    arpRootFreq: A3, // background arp sits an octave under the hook
    padRootFreq: A3,
    bass: section.bass.map((offset) => (offset == null ? null : chord.root + offset)),
    driveBass: section.driveBass,
    bassFM: section.bassFM,
    sidechain: section.sidechain,
    sidechainDepth: section.sidechainDepth,
    bassGain: section.bassGain,
    chordTones: chord.chordTones,
    lead: section.lead,
    leadSynth: section.leadSynth,
    arp: section.arp,
    padStepsHeld: 16,
    padSaw: section.padSaw,
    padCutoff: section.padCutoff,
    padGain: section.padGain,
    kick: section.kick,
    snare: section.snare,
    hat: section.hat,
    openHat: section.openHat,
    kickGain: section.kickGain,
    snareGain: section.snareGain,
    hatGain: section.hatGain,
  };
}
 
// Atmospheric intro: kick already present but half-time, pad wash, no hook
// yet — the "notable intro" before the song commits to its groove.
const INTRO = {
  bass: SPARSE_BASS, driveBass: false, lead: SILENT, leadSynth: 'keys',
  padSaw: false, padCutoff: 650, padGain: 0.18, bassGain: 0.72,
  kick: KICK_HALF, snare: [], hat: [8], openHat: [],
  kickGain: 0.72, snareGain: 0.7, hatGain: 0.48,
};
const INTRO_TEASE = { ...INTRO, lead: HOOK_TEASE };
 
// Rhythmic build: four-on-the-floor arrives over a still-sparse top end;
// BUILD_B then adds the gated lift, backbeat, FM grit, and brighter pad.
const BUILD_A = {
  bass: POCKET_BASS, driveBass: true, sidechain: true, sidechainDepth: 0.68,
  lead: SILENT, leadSynth: 'saw',
  padSaw: true, padCutoff: 1050, padGain: 0.15, bassGain: 0.82,
  kick: KICK_FULL, snare: [], hat: HAT_8TH, openHat: [],
  kickGain: 0.78, snareGain: 0.72, hatGain: 0.54,
};
const BUILD_B = {
  bass: POCKET_BASS, driveBass: true, bassFM: true,
  sidechain: true, sidechainDepth: 0.62,
  lead: SILENT, leadSynth: 'saw', arp: ARP_LIFT,
  padSaw: true, padCutoff: 1400, padGain: 0.14, bassGain: 0.86,
  kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_8TH, openHat: OPEN_HAT,
  kickGain: 0.82, snareGain: 0.76, hatGain: 0.56,
};
 
// Main drive: the independent bass pocket, controlled eighth-note hats, and
// saw hook are the danceable core. The gated lift waits until the varied pass.
function main(lead, withLift = false) {
  return {
    bass: POCKET_BASS, driveBass: true, bassFM: true,
    sidechain: true, sidechainDepth: 0.62,
    lead, leadSynth: 'saw', arp: withLift ? ARP_LIFT : undefined,
    padSaw: true, padCutoff: withLift ? 1800 : 1600,
    padGain: withLift ? 0.11 : 0.12, bassGain: 0.88,
    kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_8TH, openHat: OPEN_HAT,
    kickGain: 0.84, snareGain: 0.78, hatGain: 0.58,
  };
}
 
// One-bar transition: a snare roll and fast lead burst over 16th hats. Only
// selected hats open, and bar.arp stays absent so the fill remains legible.
const FILL = {
  bass: POCKET_BASS, driveBass: true, bassFM: true,
  sidechain: true, sidechainDepth: 0.58,
  lead: ARP_FILL, leadSynth: 'saw',
  padSaw: true, padCutoff: 1950, padGain: 0.12, bassGain: 0.88,
  kick: KICK_FULL, snare: SNARE_ROLL, hat: HAT_16TH, openHat: OPEN_HAT_FULL,
  kickGain: 0.86, snareGain: 0.84, hatGain: 0.58,
};
 
// Breakdown: drums thin back to the intro's half-time kick, the driven bass
// drops to the sparse clean one, the saw pad becomes a dark triangle, and the
// hook shrinks to its keys tease. The gated pulse disappears completely.
const BREAK = {
  bass: SPARSE_BASS, driveBass: false, lead: HOOK_TEASE, leadSynth: 'keys',
  padSaw: false, padCutoff: 620, padGain: 0.16, bassGain: 0.7,
  kick: KICK_HALF, snare: [], hat: [4, 12], openHat: [],
  kickGain: 0.68, snareGain: 0.68, hatGain: 0.44,
};
 
// Final push: 16th hats, stronger pump, brightest pad, and the gated lift
// create the earned celebration; the last snare roll turns into the intro.
function final(lead, isLast) {
  return {
    bass: POCKET_BASS, driveBass: true, bassFM: true,
    sidechain: true, sidechainDepth: 0.54,
    lead, leadSynth: 'saw', arp: ARP_LIFT,
    padSaw: true, padCutoff: 2200, padGain: 0.11, bassGain: 0.92,
    kick: KICK_FULL, snare: isLast ? SNARE_ROLL : SNARE_BACKBEAT,
    hat: HAT_16TH, openHat: OPEN_HAT_FULL,
    kickGain: 0.88, snareGain: 0.82, hatGain: 0.6,
  };
}
 
const SECTIONS = [
  INTRO, INTRO, INTRO, INTRO_TEASE,                                     // atmospheric intro
  BUILD_A, BUILD_A, BUILD_B, FILL,                                      // rhythmic build
  main(HOOK_A), main(HOOK_A), main(HOOK_A), main(HOOK_A),               // main drive, first pass
  main(HOOK_B, true), main(HOOK_B, true), main(HOOK_B, true), main(HOOK_B, true), // varied lift
  BREAK, BREAK, BREAK, FILL,                                            // breakdown + relaunch
  final(HOOK_B, false), final(HOOK_B, false), final(HOOK_B, false), final(HOOK_B, true), // final push
];
 
export const TRAINING_LOOP_THEME = {
  bpm: 128,
  stepsPerBar: 16,
  bars: SECTIONS.map((section, i) => bar(i, section)),
};
