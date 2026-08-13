// flightSchoolTheme.js — "Cloudline Promise"
//
// Flight School is canonically a different location and a preview of a new
// movement model, so it does not remix Open Circuit. This original synth-pop
// cue uses a major-key lift, syncopated octave bass, glassy keys, gated arps,
// and a four-on-the-floor chorus. 24 bars at 140 BPM = ~41 seconds.

const D2 = 73.42;
const D3 = 146.83;
const D4 = 293.66;
const SILENT = Array(16).fill(null);
const BASS = [0, null, null, 7, null, 0, null, null, 12, null, 7, null, 0, null, 7, null];
const BASS_LIGHT = [0, null, null, null, null, null, null, null, 12, null, null, null, null, null, null, null];
const HOOK_A = [0, null, 2, null, 4, null, 5, null, 4, null, 2, null, 1, null, 2, null];
const HOOK_B = [0, null, 2, null, 4, null, 6, null, 5, null, 4, 2, 1, null, 0, null];
const TEASE = [0, null, null, null, 2, null, null, null, 4, null, null, null, null, null, null, null];
const ARP = [0, 1, 2, 1, 0, 1, 3, 1, 0, 1, 2, 1, 0, 1, 3, 2];
const KICK = [0, 4, 8, 12];
const KICK_HALF = [0, 8];
const SNARE = [4, 12];
const HATS = [0, 2, 4, 6, 8, 10, 12, 14];
const HATS_FULL = Array.from({ length: 16 }, (_, index) => index);
const OPEN = [6, 14];
const HARMONY = [
  { root: 0, chord: [0, 4, 7, 12] },
  { root: 7, chord: [7, 11, 14, 19] },
  { root: 9, chord: [9, 12, 16, 21] },
  { root: 5, chord: [5, 9, 12, 17] },
];

function bar(index, section) {
  const harmony = HARMONY[index % HARMONY.length];
  return Object.freeze({
    bassRootFreq: D2,
    leadRootFreq: D4,
    arpRootFreq: D3,
    padRootFreq: D3,
    bass: (section.bass ?? BASS).map(
      (tone) => tone == null ? null : harmony.root + tone,
    ),
    driveBass: true,
    bassFM: false,
    bassGain: section.bassGain ?? 0.72,
    bassCutoff: 1450,
    sidechain: section.sidechain ?? true,
    sidechainDepth: section.sidechainDepth ?? 0.58,
    chordTones: harmony.chord,
    leadTones: [0, 2, 4, 7, 9, 11, 12],
    lead: section.lead ?? SILENT,
    leadSynth: section.leadSynth ?? 'keys',
    leadGain: section.leadGain ?? 1.02,
    arp: section.arp,
    arpGain: section.arpGain ?? 0.4,
    padStepsHeld: 16,
    padSaw: true,
    padCutoff: section.padCutoff ?? 1750,
    padGain: section.padGain ?? 0.12,
    kick: section.kick ?? KICK,
    snare: section.snare ?? SNARE,
    hat: section.hat ?? HATS,
    openHat: section.openHat ?? OPEN,
    kickGain: section.kickGain ?? 0.78,
    snareGain: section.snareGain ?? 0.7,
    hatGain: section.hatGain ?? 0.46,
  });
}

const INTRO = {
  bass: BASS_LIGHT, sidechain: false, lead: SILENT,
  kick: KICK_HALF, snare: [], hat: [8], openHat: [],
  padCutoff: 900, padGain: 0.17, bassGain: 0.6,
};
const BUILD = {
  bass: BASS, lead: TEASE, arp: ARP, arpGain: 0.28,
  padCutoff: 1500, hat: HATS, openHat: [],
};
const CHORUS_A = { lead: HOOK_A, arp: ARP, padCutoff: 2100 };
const CHORUS_B = {
  lead: HOOK_B, arp: ARP, padCutoff: 2350,
  hat: HATS_FULL, openHat: [2, 6, 10, 14], leadGain: 1.08,
};
const BREAK = {
  bass: BASS_LIGHT, sidechain: false, lead: TEASE, leadSynth: 'chip',
  kick: KICK_HALF, snare: [], hat: [4, 12], openHat: [],
  padCutoff: 1050, padGain: 0.16, bassGain: 0.58,
};
const PAYOFF = {
  lead: HOOK_B, arp: ARP, arpGain: 0.48, padCutoff: 2700,
  hat: HATS_FULL, openHat: [2, 6, 10, 14],
  leadGain: 1.12, kickGain: 0.84,
};

const SECTIONS = [
  INTRO, INTRO, INTRO, { ...INTRO, lead: TEASE },
  BUILD, BUILD, BUILD, BUILD,
  CHORUS_A, CHORUS_A, CHORUS_A, CHORUS_A,
  CHORUS_B, CHORUS_B, CHORUS_B, CHORUS_B,
  BREAK, BREAK, BREAK, { ...BREAK, arp: ARP },
  PAYOFF, PAYOFF, PAYOFF, PAYOFF,
];

export const FLIGHT_SCHOOL_THEME = Object.freeze({
  id: 'cloudline-promise',
  title: 'CLOUDLINE PROMISE',
  bpm: 140,
  stepsPerBar: 16,
  swing: 0,
  schoolVariant: 'flight-school',
  arrangement: 'synth-pop-flight',
  bars: Object.freeze(SECTIONS.map((section, index) => bar(index, section))),
});
