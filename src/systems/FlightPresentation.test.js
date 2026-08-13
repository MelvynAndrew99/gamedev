import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flightCraftVisual,
  flightHudView,
  flightPortalStyle,
} from './FlightPresentation.js';

test('sustained flight keeps a stable authored silhouette and hides the road shadow', () => {
  const view = flightCraftVisual({
    phase: 'flight', altitude: 0.5, pitch: 0.5,
  }, -0.7);
  assert.equal(view.scaleX, view.scaleY);
  assert.equal(view.hideGroundShadow, true);
  assert.ok(view.liftPx > 100);
  assert.ok(view.xOffset < 0);
  assert.ok(view.pitch > 0);
});

test('persistent world position, not momentary bank input, drives craft screen x', () => {
  const releasedStick = flightCraftVisual({
    phase: 'flight', altitude: 0.5, bank: 0,
  }, 0.8);
  const heldStick = flightCraftVisual({
    phase: 'flight', altitude: 0.5, bank: -1,
  }, 0.8);
  assert.equal(releasedStick.xOffset, heldStick.xOffset);
  assert.ok(releasedStick.xOffset > 0);
});

test('ground approach remains visually compatible with the driving lesson', () => {
  assert.deepEqual(flightCraftVisual({ phase: 'ground' }), {
    airborne: false,
    xOffset: 0,
    liftPx: 0,
    scaleX: 1,
    scaleY: 1,
    pitch: 0,
    hideGroundShadow: false,
    engineIntensity: 0,
  });
});

test('flight HUD has one mission read and bounded course telemetry', () => {
  const view = flightHudView({
    state: { phase: 'flight', altitude: 0.76, ringsHit: new Set(['a', 'b']), ringCount: 10 },
    progress: 1.5,
    speed: 12900,
    maxSpeed: 12000,
    device: 'gamepad',
  });
  assert.equal(view.rings, '2/10');
  assert.equal(view.altitude, 'ALT 76');
  assert.equal(view.progress, 1);
  assert.match(view.objective, /NEXT RING/);
  assert.match(view.controls, /STICK/);
  assert.equal(view.showControls, false);
});

test('only authored ring beats receive monumental fly-through architecture', () => {
  assert.deepEqual(flightPortalStyle('flight-ring-3'), {
    architectural: true, landmark: false,
  });
  assert.deepEqual(flightPortalStyle('flight-ring-6'), {
    architectural: true, landmark: true,
  });
  assert.equal(flightPortalStyle('flight-ring-4').architectural, false);
});
