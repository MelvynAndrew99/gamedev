// One race attempt may publish exactly one terminal outcome. Gameplay systems
// run sequentially inside a frame (rival contact, road contact, finish line,
// clocks), so the first authoritative result wins and every later caller must
// become a no-op. In GameScene, damage is resolved before the finish line;
// therefore a fatal finish-line collision is consistently a wreck.

export const TERMINAL_OUTCOMES = Object.freeze({
  WRECKED: 'wrecked',
  FINISHED: 'finished',
  QUALIFIER_EXPIRED: 'qualifier-expired',
  TRAINING_EXPIRED: 'training-expired',
});

export function createTerminalOutcomeState() {
  return { outcome: null };
}

export function commitTerminalOutcome(state, outcome) {
  if (!state || state.outcome != null) return false;
  if (!Object.values(TERMINAL_OUTCOMES).includes(outcome)) return false;
  state.outcome = outcome;
  return true;
}
