import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleShadowFrame } from './VehicleShadow.js';

test('vehicle shadow is full beneath a grounded vehicle', () => {
    assert.deepEqual(vehicleShadowFrame({ liftPx: 0, airScaleX: 1 }), {
      scaleX: 1,
      scaleY: 1,
      alpha: 0.48,
    });
});

test('vehicle shadow shrinks and fades with lift', () => {
    const low = vehicleShadowFrame({ liftPx: 24, airScaleX: 1 });
    const high = vehicleShadowFrame({ liftPx: 96, airScaleX: 1 });
    assert.ok(high.scaleX < low.scaleX);
    assert.ok(high.scaleY < low.scaleY);
    assert.ok(high.alpha < low.alpha);
    assert.ok(high.alpha > 0);
});
