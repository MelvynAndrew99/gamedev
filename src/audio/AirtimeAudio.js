// AirtimeAudio.js — pure timing and landing policy for jump feedback. Keeping
// these decisions out of Web Audio makes the feel contract testable without a
// browser.

// Launch audio is punctuation, not an airborne bed. Keep the complete noise
// sweep inside the research/playtest target so the road and landing regain
// the mix before the player has to read the next setup.
export const AIRTIME_TAKEOFF_SWEEP_SECONDS = 0.2;

export function shouldPlayBoostHold({ holding = false, airborne = false } = {}) {
  return !!holding && !airborne;
}

export function nextAirtimeControl(previous = 'neutral', glide = 0) {
  const input = Number.isFinite(glide) ? glide : 0;
  if (previous === 'long' && input > 0.12) return 'long';
  if (previous === 'short' && input < -0.12) return 'short';
  if (input >= 0.25) return 'long';
  if (input <= -0.25) return 'short';
  return 'neutral';
}

export function airtimeLandingKind(seconds = 0, boosted = false, control = 'neutral') {
  const duration = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  if (boosted || duration >= 0.95) return 'heavy';
  if (control === 'short' && duration < 0.85) return 'controlled-short';
  if (duration >= 0.62) return 'medium';
  return 'light';
}

// Closely repeated ramps retain their identity but back off slightly so a
// dense line feels rhythmic rather than like the same maximal sting stacking.
export function repeatedTakeoffGain(secondsSinceLast = Infinity) {
  if (!Number.isFinite(secondsSinceLast) || secondsSinceLast >= 1.6) return 1;
  if (secondsSinceLast < 0.55) return 0.62;
  if (secondsSinceLast < 0.95) return 0.76;
  return 0.9;
}
