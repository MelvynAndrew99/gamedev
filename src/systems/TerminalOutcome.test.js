import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TERMINAL_OUTCOMES,
  commitTerminalOutcome,
  createTerminalOutcomeState,
} from './TerminalOutcome.js';

test('the first terminal outcome wins and every later result is a no-op', () => {
  const state = createTerminalOutcomeState();
  assert.equal(commitTerminalOutcome(state, TERMINAL_OUTCOMES.WRECKED), true);
  assert.equal(commitTerminalOutcome(state, TERMINAL_OUTCOMES.FINISHED), false);
  assert.equal(commitTerminalOutcome(state, TERMINAL_OUTCOMES.WRECKED), false);
  assert.equal(state.outcome, TERMINAL_OUTCOMES.WRECKED);
});

test('a finish prevents later timeout or duplicate finish side effects', () => {
  const state = createTerminalOutcomeState();
  assert.equal(commitTerminalOutcome(state, TERMINAL_OUTCOMES.FINISHED), true);
  assert.equal(
    commitTerminalOutcome(state, TERMINAL_OUTCOMES.QUALIFIER_EXPIRED),
    false,
  );
  assert.equal(commitTerminalOutcome(state, TERMINAL_OUTCOMES.FINISHED), false);
  assert.equal(state.outcome, TERMINAL_OUTCOMES.FINISHED);
});

test('unknown terminal outcomes cannot poison the attempt gate', () => {
  const state = createTerminalOutcomeState();
  assert.equal(commitTerminalOutcome(state, 'not-a-result'), false);
  assert.equal(state.outcome, null);
  assert.equal(
    commitTerminalOutcome(state, TERMINAL_OUTCOMES.TRAINING_EXPIRED),
    true,
  );
});
