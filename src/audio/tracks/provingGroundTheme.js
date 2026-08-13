// provingGroundTheme.js — "Start Signal," the first Story-mode statement.
// Race School's Open Circuit is patient and instructional; this cue answers
// the first campaign green light with a tighter electro-breakbeat pocket,
// a clean chip/saw call-and-response, and an earned high-register payoff.
//
// Key: D Dorian. Progression: Dm7-G7-Cmaj7-Am7 (i-IV-bVII-v). The raised
// sixth in G7 supplies optimism without borrowing Open Circuit's A-minor
// pendulum or Neon Gulch's E-major pop cadence. 144 BPM, 28 bars = 46.7s.
// Form: signal intro (4) -> launch build (4) -> main hook (8) -> pit-lane
// reset (4) -> full-grid payoff and turnaround (8).

const D2 = 73.42;
const D3 = 146.83;
const D4 = 293.66;

const PROGRESSION = [
  { root: 0, chordTones: [0, 3, 7, 10], leadTones: [0, 3, 5, 7, 10, 12] },
  { root: 5, chordTones: [5, 9, 12, 15], leadTones: [5, 7, 9, 12, 15, 17] },
  { root: -2, chordTones: [-2, 2, 5, 9], leadTones: [-2, 0, 2, 5, 9, 10] },
  { root: 7, chordTones: [7, 10, 14, 17], leadTones: [7, 10, 12, 14, 17, 19] },
];

const SILENT = new Array(16).fill(null);
const BASS_SIGNAL = [
  0, null, null, null, 7, null, null, null,
  0, null, null, null, 10, null, null, null,
];
const BASS_POCKET = [
  0, null, null, 7, null, 0, null, 12,
  null, 0, null, 7, null, 10, null, 12,
];
const BASS_BREAK = [
  0, null, null, null, null, null, 7, null,
  0, null, null, null, null, 10, null, null,
];

// The rhythmic fingerprint is short-short / rest / leap, then a descending
// answer. It can be tapped on one note and stays recognizable when the final
// section moves it from chip voice to the wider saw stack.
const HOOK_TEASE = [
  null, null, null, null, null, null, null, null,
  0, 0, null, 3, null, null, null, null,
];
const HOOK_A = [
  0, 0, null, 3, null, 2, null, null,
  4, null, 3, null, 2, 1, null, null,
];
const HOOK_B = [
  0, 0, null, 3, null, 4, null, 5,
  null, 4, 3, null, 2, null, 1, null,
];
const RESET_ANSWER = [
  0, null, null, null, 2, null, null, null,
  3, null, null, null, 1, null, null, null,
];
const TURNAROUND = [
  0, null, 1, null, 2, 3, null, 4,
  5, null, 4, 3, 2, null, 1, null,
];
const GRID_PULSE = [
  0, null, 1, null, 2, null, 1, null,
  0, null, 2, null, 3, null, 2, null,
];

const KICK_HALF = [0, 8];
const KICK_BREAKBEAT = [0, 3, 6, 8, 11, 14];
const KICK_PAYOFF = [0, 3, 6, 8, 10, 11, 14];
const SNARE_HALF = [8];
const SNARE_BACKBEAT = [4, 12];
const SNARE_FILL = [4, 12, 13, 14, 15];
const HAT_QUARTER = [0, 4, 8, 12];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];

function bar(index, section) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  return {
    bassRootFreq: D2,
    leadRootFreq: D4,
    arpRootFreq: D3,
    padRootFreq: D3,
    bass: section.bass.map((tone) => tone == null ? null : tone + chord.root),
    bassFM: section.bassFM,
    driveBass: section.driveBass,
    bassGain: section.bassGain,
    bassCutoff: section.driveBass ? 920 : 680,
    bassHighpass: 50,
    chordTones: chord.chordTones,
    leadTones: chord.leadTones,
    lead: section.lead,
    leadSynth: section.leadSynth,
    leadGain: section.leadGain,
    arp: section.arp,
    arpGain: section.arpGain,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: section.padCutoff,
    padGain: section.padGain,
    sidechain: section.sidechain,
    sidechainDepth: section.sidechainDepth,
    kick: section.kick,
    kickGain: section.kickGain,
    snare: section.snare,
    snareGain: section.snareGain,
    hat: section.hat,
    hatGain: section.hatGain,
    openHat: section.openHat,
  };
}

const INTRO = {
  bass: BASS_SIGNAL, bassFM: false, driveBass: false, bassGain: 0.68,
  lead: SILENT, leadSynth: 'chip', leadGain: 1.08,
  padCutoff: 620, padGain: 0.42, sidechain: false, sidechainDepth: 0.65,
  kick: KICK_HALF, kickGain: 0.58, snare: SNARE_HALF, snareGain: 0.54,
  hat: HAT_QUARTER, hatGain: 0.4, openHat: [],
};
const INTRO_TEASE = { ...INTRO, lead: HOOK_TEASE, padCutoff: 760 };

const BUILD = {
  bass: BASS_POCKET, bassFM: true, driveBass: false, bassGain: 0.73,
  lead: HOOK_TEASE, leadSynth: 'chip', leadGain: 1.12,
  arp: GRID_PULSE, arpGain: 0.55,
  padCutoff: 980, padGain: 0.38, sidechain: true, sidechainDepth: 0.58,
  kick: KICK_BREAKBEAT, kickGain: 0.66, snare: SNARE_BACKBEAT, snareGain: 0.62,
  hat: HAT_8TH, hatGain: 0.45, openHat: OPEN_HAT,
};
const BUILD_FILL = { ...BUILD, lead: TURNAROUND, snare: SNARE_FILL, hat: HAT_16TH };

function groove(lead, withPulse = false) {
  return {
    bass: BASS_POCKET, bassFM: true, driveBass: true, bassGain: 0.76,
    lead, leadSynth: 'chip', leadGain: 1.2,
    arp: withPulse ? GRID_PULSE : undefined, arpGain: 0.52,
    padCutoff: withPulse ? 1420 : 1220, padGain: 0.34,
    sidechain: true, sidechainDepth: 0.54,
    kick: KICK_BREAKBEAT, kickGain: 0.68, snare: SNARE_BACKBEAT, snareGain: 0.64,
    hat: HAT_8TH, hatGain: 0.46, openHat: OPEN_HAT,
  };
}

const RESET = {
  bass: BASS_BREAK, bassFM: false, driveBass: false, bassGain: 0.62,
  lead: RESET_ANSWER, leadSynth: 'keys', leadGain: 0.82,
  padCutoff: 540, padGain: 0.4, sidechain: false, sidechainDepth: 0.65,
  kick: KICK_HALF, kickGain: 0.52, snare: SNARE_HALF, snareGain: 0.5,
  hat: HAT_QUARTER, hatGain: 0.36, openHat: [],
};

function payoff(lead, isLast = false) {
  return {
    bass: BASS_POCKET, bassFM: true, driveBass: true, bassGain: 0.78,
    lead, leadSynth: 'saw', leadGain: 1.16,
    arp: GRID_PULSE, arpGain: 0.48,
    padCutoff: 1780, padGain: 0.32, sidechain: true, sidechainDepth: 0.48,
    kick: KICK_PAYOFF, kickGain: 0.72,
    snare: isLast ? SNARE_FILL : SNARE_BACKBEAT, snareGain: 0.68,
    hat: HAT_16TH, hatGain: 0.48, openHat: [3, 7, 11, 15],
  };
}

const SECTIONS = [
  INTRO, INTRO, INTRO_TEASE, INTRO_TEASE,
  BUILD, BUILD, BUILD, BUILD_FILL,
  groove(HOOK_A), groove(HOOK_A), groove(HOOK_A, true), groove(HOOK_A, true),
  groove(HOOK_B), groove(HOOK_B), groove(HOOK_B, true), groove(HOOK_B, true),
  RESET, RESET, RESET, { ...RESET, lead: TURNAROUND, snare: SNARE_FILL },
  payoff(HOOK_A), payoff(HOOK_A), payoff(HOOK_B), payoff(HOOK_B),
  payoff(HOOK_A), payoff(HOOK_B), payoff(HOOK_A), payoff(TURNAROUND, true),
];

export const PROVING_GROUND_THEME = Object.freeze({
  bpm: 144,
  stepsPerBar: 16,
  swing: 0.06,
  bars: Object.freeze(SECTIONS.map((section, index) => Object.freeze(bar(index, section)))),
});
