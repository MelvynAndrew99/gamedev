import assert from 'node:assert/strict';
import test from 'node:test';

import { presentationFpsLimit } from './FrameRatePolicy.js';

test('high-refresh rendering remains the default', () => {
  assert.equal(presentationFpsLimit(''), 0);
  assert.equal(presentationFpsLimit('?fps=120'), 0);
  assert.equal(presentationFpsLimit('?track=training-rivals'), 0);
});

test('the showcase fallback is explicitly enabled with fps=60', () => {
  assert.equal(presentationFpsLimit('?fps=60'), 60);
  assert.equal(presentationFpsLimit('?track=training-rivals&fps=60'), 60);
});
