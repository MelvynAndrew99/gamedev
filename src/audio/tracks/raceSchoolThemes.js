// raceSchoolThemes.js — six lesson-specific mixes of Open Circuit.
// Race School remains one musical world and one recognizable composition,
// but each course changes tempo, register, timbre, and one arrangement layer
// to match the skill being taught. The source tracker arrangement is never
// mutated and remains the version exposed by the Music Player.

import { TRAINING_LOOP_THEME } from './trainingLoopTheme.js';
import { FLIGHT_SCHOOL_THEME } from './flightSchoolTheme.js';

const semitoneRatio = (semitones) => Math.pow(2, semitones / 12);
const ALL_16THS = Object.freeze(Array.from({ length: 16 }, (_, index) => index));
const BREAKBEAT_KICK = Object.freeze([0, 3, 6, 8, 11, 14]);

export const RACE_SCHOOL_VARIANTS = Object.freeze({
  'training-loop': Object.freeze({
    id: 'cone-control', bpm: 128, transpose: 0, arrangement: 'open-circuit',
  }),
  'training-hazard-weave': Object.freeze({
    id: 'hazard-weave', bpm: 124, transpose: -2, arrangement: 'low-visibility',
  }),
  'training-top-speed': Object.freeze({
    id: 'redline', bpm: 134, transpose: 2, arrangement: 'accelerator',
  }),
  'training-airtime': Object.freeze({
    id: 'air-school', bpm: 130, transpose: 3, arrangement: 'open-sky',
  }),
  'training-rivals': Object.freeze({
    id: 'rival-school', bpm: 132, transpose: -3, arrangement: 'breakbeat',
  }),
  'training-flight': Object.freeze({
    id: 'flight-school', bpm: 136, transpose: 4, arrangement: 'high-lift',
  }),
});

function uniqueSteps(...patterns) {
  return [...new Set(patterns.flat().filter((step) => step != null))].sort((a, b) => a - b);
}

function arrangeBar(bar, index, spec) {
  const ratio = semitoneRatio(spec.transpose);
  const next = {
    ...bar,
    bassRootFreq: bar.bassRootFreq * ratio,
    leadRootFreq: bar.leadRootFreq * ratio,
    arpRootFreq: (bar.arpRootFreq ?? bar.leadRootFreq) * ratio,
    padRootFreq: bar.padRootFreq * ratio,
  };

  if (spec.arrangement === 'low-visibility') {
    // Slower, lower, and less bright: hazards need room for collision cues.
    next.padCutoff = Math.round((bar.padCutoff ?? 1400) * 0.76);
    next.hatGain = Math.min(bar.hatGain ?? 1, 0.46);
    next.openHat = index < 16 ? [] : bar.openHat;
    next.leadGain = 0.94;
  } else if (spec.arrangement === 'accelerator') {
    // Introduce the gated voltage pulse one phrase earlier, then let 16ths
    // take over only for the earned final push.
    if (index >= 8 && index < 12) next.arp = TRAINING_LOOP_THEME.bars[12].arp;
    if (index >= 20) next.hat = ALL_16THS;
    next.arpGain = 0.58;
    next.hatGain = Math.min(bar.hatGain ?? 1, 0.5);
    next.leadGain = 1.04;
  } else if (spec.arrangement === 'open-sky') {
    // A lighter chip articulation leaves a clean gap around takeoff/landing
    // feedback while the higher register gives the lesson an airborne lift.
    if (index >= 8 && bar.lead?.some((tone) => tone != null)) next.leadSynth = 'chip';
    next.bassGain = Math.min(bar.bassGain ?? 1, 0.78);
    next.padCutoff = Math.round((bar.padCutoff ?? 1400) * 1.08);
    next.leadGain = 1.06;
  } else if (spec.arrangement === 'breakbeat') {
    // Rival practice gets a syncopated kick answer rather than more volume.
    if (index >= 8 && index < 16) next.kick = uniqueSteps(bar.kick, BREAKBEAT_KICK);
    next.bassGain = Math.min(bar.bassGain ?? 1, 0.8);
    next.kickGain = Math.min(bar.kickGain ?? 1, 0.74);
    next.leadGain = 1.02;
  } else if (spec.arrangement === 'high-lift') {
    // The sequel-preview course keeps a quiet continuous pulse beneath the
    // hook and opens the pad as the arrangement climbs into its payoff.
    if (index >= 8 && index < 16 && !next.arp) next.arp = TRAINING_LOOP_THEME.bars[12].arp;
    next.arpGain = 0.42;
    next.padCutoff = Math.round((bar.padCutoff ?? 1400) * (index >= 20 ? 1.2 : 1.12));
    next.bassGain = Math.min(bar.bassGain ?? 1, 0.76);
    next.leadGain = 1.08;
  }

  return Object.freeze(next);
}

function makeVariant(spec) {
  return Object.freeze({
    bpm: spec.bpm,
    stepsPerBar: TRAINING_LOOP_THEME.stepsPerBar,
    swing: spec.arrangement === 'breakbeat' ? 0.05 : 0,
    schoolVariant: spec.id,
    arrangement: spec.arrangement,
    bars: Object.freeze(TRAINING_LOOP_THEME.bars.map(
      (bar, index) => arrangeBar(bar, index, spec),
    )),
  });
}

export const RACE_SCHOOL_THEMES = Object.freeze(Object.fromEntries(
  Object.entries(RACE_SCHOOL_VARIANTS).map(([trackId, spec]) => [
    trackId,
    trackId === 'training-flight' ? FLIGHT_SCHOOL_THEME : makeVariant(spec),
  ]),
));

export function raceSchoolThemeForTrack(trackId) {
  return RACE_SCHOOL_THEMES[trackId] ?? RACE_SCHOOL_THEMES['training-loop'];
}
