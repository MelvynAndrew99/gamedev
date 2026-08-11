import assert from 'node:assert/strict';
import test from 'node:test';

import { ProgressBar, progressMarkerPoint } from './ProgressBar.js';

test('course marker positions clamp to the existing ribbon', () => {
  const rail = { x: 200, width: 400 };
  assert.equal(progressMarkerPoint(rail, -1), 200);
  assert.equal(progressMarkerPoint(rail, 0.25), 300);
  assert.equal(progressMarkerPoint(rail, 2), 600);
});

test('looping rival ribbon reserves its lower lane by hiding endpoint furniture', () => {
  const texts = [];
  let flags = 0;
  const chain = {
    setOrigin() { return this; },
    setDepth() { return this; },
  };
  const graphics = new Proxy({}, { get: () => () => graphics });
  const scene = {
    scale: { width: 800 },
    add: {
      graphics: () => graphics,
      text: (_x, _y, value) => { texts.push(value); return chain; },
    },
  };

  class RivalProgressBar extends ProgressBar {
    drawFlag() { flags += 1; }
  }
  new RivalProgressBar(scene, 1, 30, {
    lapNumbers: false,
    endpointLabels: false,
    showProgressFill: false,
  });
  assert.deepEqual(texts, []);
  assert.equal(flags, 0);
});
