import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRTIME_TAKEOFF_SWEEP_SECONDS,
  airtimeLandingKind,
  nextAirtimeControl,
  repeatedTakeoffGain,
  shouldPlayBoostHold,
} from './AirtimeAudio.js';

test('ramp swoosh stays short enough to hand the mix back to the landing', () => {
  assert.ok(AIRTIME_TAKEOFF_SWEEP_SECONDS >= 0.16);
  assert.ok(AIRTIME_TAKEOFF_SWEEP_SECONDS <= 0.22);
});

test('held boost keeps its physics but its sustained sound never follows the car into flight', () => {
  assert.equal(shouldPlayBoostHold({ holding: true, airborne: false }), true);
  assert.equal(shouldPlayBoostHold({ holding: true, airborne: true }), false);
  assert.equal(shouldPlayBoostHold({ holding: false, airborne: false }), false);
});

test('arc choice uses hysteresis so analog stick noise does not chatter cues', () => {
  assert.equal(nextAirtimeControl('neutral', 0.24), 'neutral');
  assert.equal(nextAirtimeControl('neutral', 0.25), 'long');
  assert.equal(nextAirtimeControl('long', 0.13), 'long');
  assert.equal(nextAirtimeControl('long', 0.11), 'neutral');
  assert.equal(nextAirtimeControl('neutral', -0.25), 'short');
  assert.equal(nextAirtimeControl('short', -0.13), 'short');
});

test('landing weight follows commitment and boosted flights always read heavy', () => {
  assert.equal(airtimeLandingKind(0.4), 'light');
  assert.equal(airtimeLandingKind(0.75), 'medium');
  assert.equal(airtimeLandingKind(1.1), 'heavy');
  assert.equal(airtimeLandingKind(0.4, true), 'heavy');
  assert.equal(airtimeLandingKind(0.4, false, 'short'), 'controlled-short');
  assert.equal(airtimeLandingKind(0.4, true, 'short'), 'heavy');
});

test('rapid repeated takeoffs back off but recover to full weight', () => {
  assert.equal(repeatedTakeoffGain(0.2), 0.62);
  assert.equal(repeatedTakeoffGain(0.7), 0.76);
  assert.equal(repeatedTakeoffGain(1.2), 0.9);
  assert.equal(repeatedTakeoffGain(2), 1);
});
