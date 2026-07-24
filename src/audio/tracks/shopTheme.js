// shopTheme.js — the garage/pit theme. Same engine as the racing score
// (highSpeedTheme.js) but built to feel like the opposite place: slower,
// swung, and harmonically softer, the way Rare's shop/hub themes (Funky's
// Flights, DKC's title-screen calm) always broke from the level music —
// so the game has a "put the wrench down" register as well as a "go" one.
//
// Key: still A, but a ii-V-i-IV lounge turnaround (Bm7b5 - E7 - Am7 - D7)
// instead of the racing theme's pure-Dorian loop. The E7 borrows a raised
// 3rd (G#) — outside A Dorian — specifically for that jazzy pull back to
// Am7; Bm7b5 is the same borrow's shadow (half-diminished ii). D7
// reappears from the racing theme on purpose: same instrument, same room,
// different pace — a small motif tying the two spaces together.
//
// 76 BPM, walking quarter-note bass with chromatic approach tones between
// chords, comping "keys" hits on the upbeat, and swing on those upbeats
// only — the shuffle a straight racing engine would never use.

const A2 = 110;
const A4 = 440;
const A3 = 220;

// Quarter-note walking bass: root, 3rd, 5th, then a chromatic approach
// tone leading into next bar's root — the line never repeats a shape,
// which is most of what makes a walking bass feel like it's *going*
// somewhere instead of vamping.
function walk(root, third, fifth, approach) {
  return [
    root, null, null, null,
    third, null, null, null,
    fifth, null, null, null,
    approach, null, null, null,
  ];
}

// Sparse comping on the "and" of each beat only — the swing engine hook
// (track.swing) delays exactly these steps, which is what makes them read
// as a lazy upbeat stab instead of a metronome.
const COMP = [null, null, 0, null, null, null, 2, null, null, null, 1, null, null, null, 3, null];

function bar({ chordTones, bass }) {
  return {
    bassRootFreq: A2,
    leadRootFreq: A4,
    padRootFreq: A3,
    bass,
    chordTones,
    lead: COMP,
    leadSynth: 'keys',
    padStepsHeld: 16,
    kick: [],
    snare: [],
    hat: [2, 6, 10, 14], // brushed/shaker feel, not a kit
    openHat: [],
  };
}

export const SHOP_THEME = {
  bpm: 76,
  stepsPerBar: 16,
  swing: 0.55,
  bars: [
    bar({ chordTones: [2, 5, 8, 12], bass: walk(2, 5, 8, 6) }),     // Bm7b5 (ii)  -> approach E
    bar({ chordTones: [7, 11, 14, 17], bass: walk(7, 11, 14, 13) }), // E7 (V/i)   -> approach Am7
    bar({ chordTones: [0, 3, 7, 10], bass: walk(0, 3, 7, 4) }),     // Am7 (i)    -> approach D7
    bar({ chordTones: [5, 9, 12, 15], bass: walk(5, 9, 12, 1) }),   // D7 (IV)    -> approach Bm7b5
  ],
};
