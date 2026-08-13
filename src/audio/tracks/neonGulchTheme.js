// neonGulchTheme.js — Neon Gulch's theme: fast future-funk pop for a
// wide-open desert highway level in a futuristic racer. An earlier draft
// read as 80s pop-punk (guitar chugs, acoustic-character snare) — that
// missed the game's era, and GAME_DESIGN.md's Music rules now pin it down:
// synthetic sources carry a theme's identity; acoustic-imitating voices
// are accents at most. So the identity here is FM-gritted syncopated funk
// bass under a sidechain pump, a bright detuned-saw hook, a relentless
// 16th arp, and a light swing for the funk pocket. The synth-guitar
// survives only as an accent — short syncopated stabs in the intro and
// acceleration, funk-rhythm-section style, never chugging power chords.
//
// Key: E major, I-V-vi-IV (E-B-C#m-A) — deliberately the only major-key
// racing theme in the score: Training Loop broods in A minor; Neon Gulch
// is the one grinning with the top down. 160 BPM, 24 bars = 36 seconds
// (>=30s per GAME_DESIGN.md). Every section is a multiple of the 4-bar
// progression, so section boundaries always land back on E.
//
// Structure: short intro (groove + hook tease) → immediate acceleration
// (drums and arp slam in after 2 bars) → main drive → brief breakdown
// (electric-piano comp) → final push.

const E2 = 82.41;
const E3 = 164.81;
const E4 = 329.63;

// E(I) - B(V) - C#m(vi) - A(IV), voiced to stay in one register so the
// riff and arp don't leap around when the harmony moves.
const PROGRESSION = [
  { root: 0, chordTones: [0, 4, 7, 12] },   // E  (I)
  { root: -5, chordTones: [-5, -1, 2, 7] }, // B  (V)
  { root: -3, chordTones: [-3, 1, 4, 9] },  // C#m (vi)
  { root: -7, chordTones: [-7, -3, 0, 5] }, // A  (IV)
];

const SILENT = new Array(16).fill(null);

// Syncopated funk bass: root anchors on the beat, octave pops land on
// off-beats, and a b7 pickup walks into the next bar — the line grooves
// instead of chugging, and the FM grit + sidechain pump on top of it are
// what make it read as future-funk rather than a bar band.
const FUNK_BASS = [
  0, null, 0, null, null, 12, null, 0,
  null, 0, null, null, 12, null, 10, null,
];
// Half-time roots for the breakdown.
const BASS_HALF = [
  0, null, null, null, null, null, null, null,
  0, null, null, null, null, null, null, null,
];

// The riff: double-hit root pickup answered by octave jumps — the pop
// hook this theme keeps from its punkier draft; the genre transplant
// changed the clothes, not the song. Index 3 is the voicing's top note,
// so the octave leaps are built into the contour.
const RIFF_A = [0, 0, null, 3, null, 3, 2, null, 0, 0, null, 3, null, 2, 1, null];
// Second pass climbs out the back instead of resolving down, so eight bars
// of riff never repeat note-for-note.
const RIFF_B = [0, 0, null, 3, null, 3, 2, null, 3, null, 2, null, 3, 2, 1, null];
// Two-hit-and-jump preview, stabbed as power chords on the guitar accent
// voice in the intro's second bar.
const RIFF_TEASE = [0, 0, null, 3, null, null, null, null, null, null, null, null, null, null, null, null];

// Guitar accent: short syncopated stabs (funk rhythm section), including
// an anticipation of beat 4 — explicitly not a chug pattern.
const STAB = [null, null, 0, null, null, null, 0, null, null, null, 0, null, null, 0, null, null];

// Syncopated electric-piano comp for the breakdown — the funkiest four
// bars in the score, and still a synth (see MusicEngine.playKeys).
const KEYS_COMP = [0, null, null, 2, null, null, 1, null, null, 2, null, 0, null, null, 3, null];

// Straight-climb 16th arp — pure speed reinforcement, and a different
// shape from Training Loop's root-5th-octave roll so the two themes'
// arps don't blur together.
const ARP_SPEED = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];

const KICK_FULL = [0, 4, 8, 12];
const KICK_HALF = [0, 8];
const SNARE_BACKBEAT = [4, 12];
const SNARE_ROLL = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15];
const HAT_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const OPEN_HAT = [6, 14];
const OPEN_HAT_FULL = [2, 6, 10, 14];

function bar(index, section) {
  const chord = PROGRESSION[index % PROGRESSION.length];
  return {
    bassRootFreq: E2,
    // Guitar stabs live an octave under the saw riff's register.
    leadRootFreq: section.leadSynth === 'guitar' ? E3 : E4,
    arpRootFreq: E3,
    padRootFreq: E3,
    bass: section.bass.map((offset) => (offset == null ? null : chord.root + offset)),
    driveBass: section.driveBass,
    bassFM: section.bassFM,
    sidechain: section.sidechain,
    chordTones: chord.chordTones,
    lead: section.lead,
    leadSynth: section.leadSynth,
    arp: section.arp,
    padStepsHeld: 16,
    padSaw: true, // wide, bright pads — the open-desert-sky layer
    kick: section.kick,
    snare: section.snare,
    hat: section.hat,
    openHat: section.openHat,
  };
}

// Short intro: the FM funk bass groove and guitar stabs over hats alone —
// two bars of the machine warming up, hook teased as chord stabs in bar 2.
const INTRO = {
  bass: FUNK_BASS, driveBass: true, bassFM: true,
  lead: STAB, leadSynth: 'guitar',
  kick: [], snare: [], hat: HAT_8TH, openHat: [],
};
const INTRO_TEASE = { ...INTRO, lead: RIFF_TEASE };

// Immediate acceleration: full kit, sidechain pump, and the 16th arp slam
// in together over the still-stabbing guitar — the green light, two bars
// after the loop starts.
const ACCEL = {
  bass: FUNK_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: STAB, leadSynth: 'guitar', arp: ARP_SPEED,
  kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_8TH, openHat: OPEN_HAT,
};

// Main drive: the saw riff over the pumping funk bass and the speed arp —
// full highway.
function main(lead) {
  return {
    bass: FUNK_BASS, driveBass: true, bassFM: true, sidechain: true,
    lead, leadSynth: 'saw', arp: ARP_SPEED,
    kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_8TH, openHat: OPEN_HAT,
  };
}

// Brief breakdown: bass and kick go half-time, the arp stops, and a
// syncopated electric-piano comp takes the top — three bars of coasting
// with the pads wide open (heat shimmer, empty horizon) before the fill
// relaunches.
const BREAK = {
  bass: BASS_HALF, driveBass: false, lead: KEYS_COMP, leadSynth: 'keys',
  kick: KICK_HALF, snare: [], hat: [4, 12], openHat: [],
};

// One-bar relaunch: snare roll, every hat open, arp already back up to
// speed — the downshift-and-floor-it moment.
const FILL = {
  bass: FUNK_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: SILENT, leadSynth: 'saw', arp: ARP_SPEED,
  kick: KICK_FULL, snare: SNARE_ROLL, hat: HAT_16TH, openHat: HAT_16TH,
};

// Final push: the B riff on saw, 16th hats with every off-beat open, and
// the last bar's snare roll as the turnaround into the intro's groove —
// which now reads as catching your breath, not starting cold.
function final(lead, isLast) {
  return {
    bass: FUNK_BASS, driveBass: true, bassFM: true, sidechain: true,
    lead, leadSynth: 'saw', arp: ARP_SPEED,
    kick: KICK_FULL, snare: isLast ? SNARE_ROLL : SNARE_BACKBEAT,
    hat: HAT_16TH, openHat: OPEN_HAT_FULL,
  };
}

const SECTIONS = [
  INTRO, INTRO_TEASE,                                                   // short intro (2 bars)
  ACCEL, ACCEL,                                                         // immediate acceleration
  main(RIFF_A), main(RIFF_A), main(RIFF_A), main(RIFF_A),               // main drive, first pass
  main(RIFF_B), main(RIFF_B), main(RIFF_B), main(RIFF_B),               // main drive, varied pass
  BREAK, BREAK, BREAK, FILL,                                            // brief breakdown + relaunch
  final(RIFF_B, false), final(RIFF_B, false), final(RIFF_B, false), final(RIFF_B, false), // final push
  final(RIFF_A, false), final(RIFF_A, false), final(RIFF_A, false), final(RIFF_A, true),  // push, riff comes home
];

// Base arrangement used to produce the sole shipped Open Road mix.
const NEON_GULCH_BASE_THEME = Object.freeze({
  bpm: 160,
  stepsPerBar: 16,
  // Light swing on the off-beat 16ths — the funk pocket. Small on purpose:
  // at 160 BPM a heavy shuffle would fight the racing pulse.
  swing: 0.12,
  bars: Object.freeze(SECTIONS.map((section, i) => Object.freeze(bar(i, section)))),
});

function productionBar(source, index) {
  const intro = index < 2;
  const acceleration = index >= 2 && index < 4;
  const firstHook = index >= 4 && index < 8;
  const breakdown = index >= 12 && index < 15;
  const fill = index === 15;
  const payoff = index >= 16;

  return Object.freeze({
    ...source,
    // State the riff by itself for two bars before the gated speed texture
    // returns. That makes the melody memorable instead of merely brighter.
    arp: firstHook && index < 6 ? undefined : source.arp,
    bassGain: breakdown ? 0.6 : intro ? 0.68 : payoff ? 0.76 : 0.72,
    bassCutoff: breakdown ? 700 : payoff ? 1040 : 940,
    bassHighpass: 49,
    leadGain: breakdown ? 0.84 : intro || acceleration ? 0.72 : payoff ? 1.18 : 1.12,
    arpGain: payoff ? 0.52 : 0.46,
    guitarGain: 0.62,
    padGain: breakdown ? 0.46 : intro ? 0.4 : 0.34,
    padCutoff: breakdown ? 680 : intro ? 980 : payoff ? 1980 : fill ? 1760 : 1580,
    sidechainDepth: payoff ? 0.5 : 0.56,
    kickGain: breakdown ? 0.5 : payoff ? 0.72 : 0.66,
    snareGain: breakdown ? 0.46 : fill ? 0.72 : 0.62,
    hatGain: breakdown ? 0.36 : payoff ? 0.48 : 0.44,
  });
}

// "Neon Gulch — Open Road Mix": same E-major song and recognizable
// double-hit/octave hook, now with controlled bass, quieter hats/arp, and a
// deliberately exposed first hook statement modeled on Night Drive's clarity.
export const NEON_GULCH_THEME = Object.freeze({
  ...NEON_GULCH_BASE_THEME,
  bars: Object.freeze(NEON_GULCH_BASE_THEME.bars.map(productionBar)),
});
