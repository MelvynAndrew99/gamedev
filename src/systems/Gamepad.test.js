import test from 'node:test';
import assert from 'node:assert/strict';

import {
  axisValue,
  buttonDown,
  buttonValue,
  getPrimaryPad,
} from './Gamepad.js';

test('selects the first connected pad instead of assuming hardware index zero', () => {
  const dualSense = { index: 3 };
  const sparsePads = [];
  sparsePads[3] = dualSense;

  assert.equal(
    getPrimaryPad({ total: 1, pad1: dualSense, gamepads: sparsePads }),
    dualSense,
  );
  assert.equal(
    getPrimaryPad({ total: 1, gamepads: sparsePads }),
    dualSense,
  );
});

test('reads Phaser values and raw standard-mapping fallbacks', () => {
  const phaserPad = { R2: 0.75, axes: [{ getValue: () => -0.4 }] };
  const rawPad = {
    buttons: Array.from({ length: 8 }, () => ({ value: 0, pressed: false })),
  };
  rawPad.buttons[0] = { value: 1, pressed: true };

  assert.equal(buttonValue(phaserPad, 7, 'R2'), 0.75);
  assert.equal(axisValue(phaserPad, 0), -0.4);
  assert.equal(buttonDown(rawPad, 0, 'A'), true);
});
