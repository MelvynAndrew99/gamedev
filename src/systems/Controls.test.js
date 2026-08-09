import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { Controls } from './Controls.js';

function released() {
  return { isDown: false };
}

function controlsFrame({ up = false, down = false, w = false, s = false } = {}) {
  const controls = Object.create(Controls.prototype);
  controls.scene = { input: { gamepad: { total: 0 } } };
  controls.cursors = {
    left: released(), right: released(),
    up: { isDown: up }, down: { isDown: down },
  };
  controls.keyZ = released();
  controls.keyX = released();
  controls.keyC = released();
  controls.keyW = { isDown: w };
  controls.keyS = { isDown: s };
  return controls.read(TUNING);
}

test('keyboard glide is dedicated so ordinary throttle never shortens a jump', () => {
  assert.deepEqual(
    { throttle: controlsFrame({ up: true }).throttle, glide: controlsFrame({ up: true }).glide },
    { throttle: 1, glide: 0 },
  );
  assert.deepEqual(
    { brake: controlsFrame({ down: true }).brake, glide: controlsFrame({ down: true }).glide },
    { brake: 1, glide: 0 },
  );
  assert.equal(controlsFrame({ w: true }).glide, -1);
  assert.equal(controlsFrame({ s: true }).glide, 1);
});

test('left stick Y uses forward-shorter and back-longer signs', () => {
  const controls = Object.create(Controls.prototype);
  const y = { value: -0.8 };
  controls.scene = {
    input: {
      gamepad: {
        total: 1,
        pad1: {
          axes: [
            { getValue: () => 0 },
            { getValue: () => y.value },
          ],
          buttons: [],
        },
      },
    },
  };
  controls.cursors = { left: released(), right: released(), up: released(), down: released() };
  controls.keyZ = released();
  controls.keyX = released();
  controls.keyC = released();
  controls.keyW = released();
  controls.keyS = released();

  assert.ok(controls.read(TUNING).glide < 0);
  y.value = 0.8;
  assert.ok(controls.read(TUNING).glide > 0);
});
