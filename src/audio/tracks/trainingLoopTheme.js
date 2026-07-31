// trainingLoopTheme.js — Training Loop's theme: a high-energy Outrun/
// synthwave track following the full genre arc — atmospheric intro →
// rhythmic build → main drive → breakdown → final push — around one
// repeated melodic hook (not a scale-run arpeggio). Under the hook a quiet
// gated 16th arp (the engine's opt-in bar.arp voice) supplies constant
// forward momentum, and the pad runs the triangle/saw blend (bar.padSaw)
// for a brighter, more cinematic wash. Earlier drafts lacked either a
// hook, an intro, or — before the engine grew a second melodic voice —
// the ability to have hook and arp at once. This one is meant to be
// hummable *and* driving.
//
// Key: A minor, i-VII-VI-VII (Am-G-F-G) — a "pendulum" progression (root,
// down a step, down another, back up to the pivot chord) instead of the
// climbing i-VI-III-VII an earlier draft used in the same key. 128 BPM,
// 24 bars = 45 seconds (GAME_DESIGN.md requires >=30s). Every section is
// four bars so section boundaries always land on the progression's Am.
 
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
const DRIVE_BASS = [
  0, null, 7, null, 0, null, 12, null,
  0, null, 7, null, 0, null, 10, null,
];
 
// The hook: a spaced-out root-5th-3rd skip mostly on the quarter, with
// rests instead of a running arpeggio — the hook's rhythm stays put while
// the harmony moves under it. (Distinct from Neon Gulch's double-hit-and-
// octave-jump future-funk riff, per GAME_DESIGN.md's no-shared-songwriting
// rule.)
const HOOK_A = [0, null, 2, null, 1, null, 0, null, 2, null, 1, null, 0, null, null, null];
// Same shape with a passing run at the end, so the loop's second pass isn't
// a note-for-note repeat of the first.
const HOOK_B = [0, null, 2, null, 1, null, 0, null, 2, null, 3, 2, 1, null, null, null];
// A two-note preview of the hook's opening, used in the intro's last bar
// and echoed on keys through the breakdown, so both arrivals of the main
// drive land as payoffs instead of cold starts.
const HOOK_TEASE = [0, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null];
 
// Fast 16th arp — reserved for the one-bar transitions between sections
// so it reads as a fill, not the main event the hook already owns.
const ARP_FILL = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1];
 
// Background gated arp (bar.arp voice, an octave below the hook):
// root-5th-octave-5th rolling every beat — constant 16th motion that gives
// the drive sections their forward pull without competing with the hook's
// register or rhythm. Distinct shape from ARP_FILL so fills still pop.
const ARP_BG = [0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 3, 2];
 
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
    chordTones: chord.chordTones,
    lead: section.lead,
    leadSynth: section.leadSynth,
    arp: section.arp,
    padStepsHeld: 16,
    padSaw: true, // triangle/saw-blend pad for the whole theme
    kick: section.kick,
    snare: section.snare,
    hat: section.hat,
    openHat: section.openHat,
  };
}
 
// Atmospheric intro: kick already present but half-time, pad wash, no hook
// yet — the "notable intro" before the song commits to its groove.
const INTRO = {
  bass: SPARSE_BASS, driveBass: false, lead: SILENT, leadSynth: 'keys',
  kick: KICK_HALF, snare: [], hat: [8], openHat: [],
};
const INTRO_TEASE = { ...INTRO, lead: HOOK_TEASE };
 
// Rhythmic build: the four-on-the-floor kick and the background arp arrive
// together over a still-sparse top end, then BUILD_B adds backbeat snare,
// 16th hats, and the FM grit — each pass of the section audibly escalating
// toward the FILL that launches the main drive.
const BUILD_A = {
  bass: DRIVE_BASS, driveBass: true, sidechain: true,
  lead: SILENT, leadSynth: 'saw', arp: ARP_BG,
  kick: KICK_FULL, snare: [], hat: HAT_8TH, openHat: [],
};
const BUILD_B = {
  bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: SILENT, leadSynth: 'saw', arp: ARP_BG,
  kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_16TH, openHat: OPEN_HAT,
};
 
// Main drive: four-on-the-floor kick, pumping FM/driven bass with the
// sidechain duck, the hook on the saw lead, the gated arp running
// underneath — the danceable core of the track.
function main(lead) {
  return {
    bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
    lead, leadSynth: 'saw', arp: ARP_BG,
    kick: KICK_FULL, snare: SNARE_BACKBEAT, hat: HAT_16TH, openHat: OPEN_HAT,
  };
}
 
// One-bar transition: a snare roll and a fast arp burst, every hat forced
// open for a riser-like shimmer — the "fill between sections." No bar.arp
// here: two simultaneous 16th arps would smear into mud.
const FILL = {
  bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
  lead: ARP_FILL, leadSynth: 'saw',
  kick: KICK_FULL, snare: SNARE_ROLL, hat: HAT_16TH, openHat: HAT_16TH,
};
 
// Breakdown: drums thin back to the intro's half-time kick, the driven bass
// drops to the sparse clean one, and the hook shrinks to its keys tease —
// but the gated arp keeps running, so the momentum never fully stops (the
// road doesn't slow down just because the song breathes).
const BREAK = {
  bass: SPARSE_BASS, driveBass: false, lead: HOOK_TEASE, leadSynth: 'keys',
  arp: ARP_BG,
  kick: KICK_HALF, snare: [], hat: [4, 12], openHat: [],
};
 
// Final push: same groove as the main drive but with every off-beat hat
// open; the last bar adds the snare roll as the turnaround into the intro.
function final(lead, isLast) {
  return {
    bass: DRIVE_BASS, driveBass: true, bassFM: true, sidechain: true,
    lead, leadSynth: 'saw', arp: ARP_BG,
    kick: KICK_FULL, snare: isLast ? SNARE_ROLL : SNARE_BACKBEAT,
    hat: HAT_16TH, openHat: OPEN_HAT_FULL,
  };
}
 
const SECTIONS = [
  INTRO, INTRO, INTRO, INTRO_TEASE,                                     // atmospheric intro
  BUILD_A, BUILD_A, BUILD_B, FILL,                                      // rhythmic build
  main(HOOK_A), main(HOOK_A), main(HOOK_A), main(HOOK_A),               // main drive, first pass
  main(HOOK_B), main(HOOK_B), main(HOOK_B), main(HOOK_B),               // main drive, varied pass
  BREAK, BREAK, BREAK, FILL,                                            // breakdown + relaunch
  final(HOOK_B, false), final(HOOK_B, false), final(HOOK_B, false), final(HOOK_B, true), // final push
];
 
export const TRAINING_LOOP_THEME = {
  bpm: 128,
  stepsPerBar: 16,
  bars: SECTIONS.map((section, i) => bar(i, section)),
};