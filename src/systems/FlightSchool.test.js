import test from 'node:test';
import assert from 'node:assert/strict';
import flightTrack from '../tracks/training-flight.json' with { type: 'json' };
import {
  beginFlight,
  createFlightSchoolState,
  flightRingHit,
  flightRouteCue,
  flightSchoolView,
  isFlightSchoolEvent,
  updateFlight,
} from './FlightSchool.js';

test('persistent flight is scoped to the exact post-game training course', () => {
  assert.equal(isFlightSchoolEvent('training', 'training-flight'), true);
  assert.equal(isFlightSchoolEvent('endless', 'training-flight'), false);
  assert.equal(isFlightSchoolEvent('story', 'training-flight'), false);
  assert.equal(isFlightSchoolEvent('training', 'training-airtime'), false);
});

test('the authored Flight School route begins airborne without a launch ritual', () => {
  const state = createFlightSchoolState(flightTrack.flightTraining);
  assert.equal(flightTrack.flightTraining.airborneStart, true);
  assert.equal(state.phase, 'flight');
  assert.equal(state.altitude, flightTrack.flightTraining.initialAltitude);
  assert.equal(flightTrack.flightTraining.startingBoostSlots, 3);
  assert.equal(
    flightTrack.objects.every((object) => object.kind === 'flightRing'),
    true,
  );
});

test('launch transitions once into bounded persistent altitude control', () => {
  const state = createFlightSchoolState({ ringCount: 10 });
  assert.equal(beginFlight(state), true);
  assert.equal(beginFlight(state), false);
  for (let i = 0; i < 600; i++) updateFlight(state, 1 / 60, { glide: 1 });
  assert.equal(state.phase, 'flight');
  assert.equal(state.altitude, 0.92);
  for (let i = 0; i < 600; i++) updateFlight(state, 1 / 60, { glide: -1 });
  assert.equal(state.altitude, 0.12);
});

test('flight controls respond quickly, then self-level without oscillation', () => {
  const state = createFlightSchoolState();
  beginFlight(state);
  for (let i = 0; i < 30; i++) {
    updateFlight(state, 1 / 60, {
      glide: 1,
      steer: -1,
      airbrakeL: true,
      brake: 1,
      boostActive: true,
    });
  }
  assert.ok(state.pitch > 0.95, 'pitch follows deliberate input promptly');
  assert.ok(state.bank < -0.95, 'stick and shoulder produce a committed bank');
  assert.ok(state.verticalSpeed > 0.5, 'pitch commands an immediate climb');
  assert.ok(state.braking > 0.95);
  assert.ok(state.afterburner > 0.95);

  for (let i = 0; i < 90; i++) updateFlight(state, 1 / 60, {});
  assert.ok(Math.abs(state.pitch) < 0.001, 'released pitch returns to level');
  assert.ok(Math.abs(state.bank) < 0.001, 'released bank returns to level');
  assert.ok(Math.abs(state.verticalSpeed) < 0.005, 'neutral flight holds altitude');
  assert.ok(state.braking < 0.001);
  assert.ok(state.afterburner < 0.001);
});

test('flight response is stable across common frame rates', () => {
  const simulate = (dt) => {
    const state = createFlightSchoolState();
    beginFlight(state);
    for (let elapsed = 0; elapsed < 0.75 - 1e-8; elapsed += dt) {
      updateFlight(state, dt, { glide: -0.65, steer: 0.7 });
    }
    return state;
  };
  const sixty = simulate(1 / 60);
  const thirty = simulate(1 / 30);
  assert.ok(Math.abs(sixty.altitude - thirty.altitude) < 0.012);
  assert.ok(Math.abs(sixty.pitch - thirty.pitch) < 0.002);
  assert.ok(Math.abs(sixty.bank - thirty.bank) < 0.002);
});

test('rings require distinct IDs plus horizontal and vertical precision', () => {
  const state = createFlightSchoolState({ ringCount: 2 });
  beginFlight(state);
  const ring = {
    trackObjectId: 'ring-1', offset: 0.4, altitude: 0.7,
    ringRadiusX: 0.25, ringRadiusY: 0.18,
  };
  assert.equal(flightRingHit(state, ring, { x: 0, altitude: 0.7 }), false);
  assert.equal(flightRingHit(state, ring, { x: 0.4, altitude: 0.3 }), false);
  assert.equal(flightRingHit(state, ring, { x: 0.4, altitude: 0.7 }), true);
  assert.equal(flightRingHit(state, ring, { x: 0.4, altitude: 0.7 }), false);
  assert.deepEqual(flightSchoolView(state), {
    phase: 'flight', altitude: state.altitude, verticalSpeed: state.verticalSpeed,
    pitch: 0, bank: 0, braking: 0, afterburner: 0,
    ringsHit: 1, ringsTotal: 2, ringsLeft: 1,
  });
});

test('route cue advances to the first uncleared aperture and reports aim error', () => {
  const state = createFlightSchoolState({ ringCount: 3 });
  beginFlight(state);
  const route = [
    { id: 'one', offset: -0.4, altitude: 0.3 },
    { id: 'two', offset: 0.25, altitude: 0.72 },
    { id: 'three', offset: 0, altitude: 0.5 },
  ];
  state.ringsHit.add('one');
  assert.deepEqual(
    flightRouteCue(state, route, { x: -0.1, altitude: 0.5 }),
    {
      id: 'two', offset: 0.25, altitude: 0.72,
      segment: null,
      horizontalError: 0.35, verticalError: 0.21999999999999997,
    },
  );
  state.ringsHit.add('two');
  state.ringsHit.add('three');
  assert.equal(flightRouteCue(state, route), null);
  assert.equal(flightRouteCue(createFlightSchoolState(), route), null);
});

test('route cue never points backward to a missed target', () => {
  const state = createFlightSchoolState();
  beginFlight(state);
  const route = [
    { id: 'missed', at: 100, offset: -0.6, altitude: 0.3 },
    { id: 'next', at: 240, offset: 0.2, altitude: 0.55 },
  ];
  assert.equal(
    flightRouteCue(state, route, { segment: 180 })?.id,
    'next',
  );
});

test('the architectural fly-through is readable, optional, and ring-led', () => {
  const section = flightTrack.flightTraining.architecturalFlyThroughs[0];
  const objects = new Map(flightTrack.objects.map((object) => [object.id, object]));
  const route = section.ringIds.map((id) => objects.get(id));
  assert.equal(section.style, 'open-atrium');
  assert.ok(route.every(Boolean), 'each architectural aperture has a target ring');
  assert.ok(route.every((ring) => ring.at >= section.from && ring.at <= section.to));
  assert.ok(route[0].radiusX >= 0.38 && route[0].radiusY >= 0.22,
    'the entrance aperture gives a generous first read');
  assert.equal(
    flightTrack.objects.some((object) =>
      object.at >= section.from && object.at <= section.to && object.kind === 'rock'
    ),
    false,
    'missing the optional interior route cannot cause an invisible ground collision',
  );
});
