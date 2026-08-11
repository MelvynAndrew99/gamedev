// tracks/index.js — the campaign, in order. Adding a course to the game
// is: drop a JSON file here, import it, add it to the appropriate array.
//
// Format (also the future grid-editor's save format — each entry is one
// "tile" on the editor grid):
//   ["straight", length]        length in segments (~3x after easing)
//   ["curve", length, curve]    curve: -8..8, sign = direction
//   ["chicane", length, curve]  compact mirrored precision sequence
//   ["scurves"]                 legacy long-form S-curve combo
//   laps: races to finish, or par when finish is "objectives"
//   objectives + objects: stable-ID authored training targets
//   intro: one-line flavor shown at race start
//   patterns.placements: exact campaign event kind/segment pairs
//   patterns weights/gap: procedural fallback used by generated layouts

import trainingLoop from './training-loop.json' with { type: 'json' };
import trainingHazardWeave from './training-hazard-weave.json' with { type: 'json' };
import trainingTopSpeed from './training-top-speed.json' with { type: 'json' };
import trainingAirtime from './training-airtime.json' with { type: 'json' };
import trainingRivals from './training-rivals.json' with { type: 'json' };
import trainingValidation from './training-validation.json' with { type: 'json' };
import neonGulch from './neon-gulch.json' with { type: 'json' };
import syndicateRun from './syndicate-run.json' with { type: 'json' };

export const TRAINING_TRACKS = [
  trainingLoop,
  trainingHazardWeave,
  trainingTopSpeed,
  trainingAirtime,
  trainingRivals,
];
export const TRACKS = [trainingValidation, neonGulch, syndicateRun];
