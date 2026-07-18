// tracks/index.js — the campaign, in order. Adding a course to the game
// is: drop a JSON file here, import it, add it to the array. That's the
// entire "level pipeline."
//
// Format (also the future grid-editor's save format — each entry is one
// "tile" on the editor grid):
//   ["straight", length]        length in segments (~3x after easing)
//   ["curve", length, curve]    curve: -8..8, sign = direction
//   ["scurves"]                 preset S-curve combo
//   laps: races to finish; intro: one-line flavor shown at race start

import trainingLoop from './training-loop.json';
import neonGulch from './neon-gulch.json';
import syndicateRun from './syndicate-run.json';

export const TRACKS = [trainingLoop, neonGulch, syndicateRun];