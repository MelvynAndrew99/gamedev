import assert from 'node:assert/strict';
import test from 'node:test';

import { progressMarkerPoint } from './ProgressBar.js';

test('course marker positions clamp to the existing ribbon', () => {
  const rail = { x: 200, width: 400 };
  assert.equal(progressMarkerPoint(rail, -1), 200);
  assert.equal(progressMarkerPoint(rail, 0.25), 300);
  assert.equal(progressMarkerPoint(rail, 2), 600);
});
