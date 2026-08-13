import assert from 'node:assert/strict';
import test from 'node:test';

import { hapticSpec, rumbleGamepad } from './Haptics.js';

test('haptic strength and duration are finite and bounded', () => {
  assert.deepEqual(hapticSpec({ duration: 5000, strong: 4, weak: -2 }), {
    duration: 1000,
    strongMagnitude: 1,
    weakMagnitude: 0,
  });
});

test('Phaser dual-rumble actuator receives the normalized effect', () => {
  let call = null;
  const pad = {
    vibration: {
      playEffect(type, spec) {
        call = { type, spec };
        return Promise.resolve();
      },
    },
  };
  assert.equal(rumbleGamepad(pad, { duration: 120, strong: 0.8, weak: 0.3 }), true);
  assert.deepEqual(call, {
    type: 'dual-rumble',
    spec: { duration: 120, strongMagnitude: 0.8, weakMagnitude: 0.3 },
  });
});

test('unsupported controllers are a silent no-op and pulse actuators degrade safely', () => {
  assert.equal(rumbleGamepad(null), false);
  let pulse = null;
  const pad = { pad: { hapticActuators: [{ pulse: (...args) => { pulse = args; } }] } };
  assert.equal(rumbleGamepad(pad, { duration: 60, strong: 0.2, weak: 0.5 }), true);
  assert.deepEqual(pulse, [0.5, 60]);
});
