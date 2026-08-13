// FlightSchool.js — the post-game sequel preview.
//
// This state machine is deliberately NOT a general vehicle upgrade. It is
// constructed only for the sixth Race School course, after the Story Platinum
// gate. Story, Endless, Air School, and every ordinary ramp keep the finite
// jump model in Player.js.

export const FLIGHT_SCHOOL_TRACK_ID = 'training-flight';

export function isFlightSchoolEvent(mode, trackId) {
  return mode === 'training' && trackId === FLIGHT_SCHOOL_TRACK_ID;
}

export function createFlightSchoolState(config = {}) {
  const airborneStart = config.airborneStart === true;
  return {
    phase: airborneStart ? 'flight' : 'ground',
    altitude: airborneStart
      ? clamp(Number(config.initialAltitude) || 0.42, 0.08, 1)
      : 0,
    verticalSpeed: 0,
    // Presentation-ready control surfaces. They deliberately live in the
    // isolated Flight School state instead of Player: ordinary jumps and
    // Endless never inherit aircraft handling or aircraft telemetry.
    pitch: 0,
    bank: 0,
    braking: 0,
    afterburner: 0,
    ringsHit: new Set(),
    ringCount: Math.max(0, Math.floor(Number(config.ringCount) || 0)),
  };
}

export function beginFlight(state, config = {}) {
  if (!state || state.phase !== 'ground') return false;
  state.phase = 'flight';
  state.altitude = clamp(
    Number(config.initialAltitude ?? config.takeoffAltitude) || 0.16,
    0.08,
    1,
  );
  state.verticalSpeed = clamp(Number(config.takeoffVelocity) || 0.34, -1, 1);
  return true;
}

export function updateFlight(state, dt, input = {}, config = {}) {
  if (!state || state.phase !== 'flight') return state;
  const seconds = clamp(Number(dt) || 0, 0, 0.05);
  const pitchInput = clamp(Number(input.glide) || 0, -1, 1);
  const shoulderBank = (input.airbrakeR ? 0.45 : 0) -
    (input.airbrakeL ? 0.45 : 0);
  const bankInput = clamp((Number(input.steer) || 0) + shoulderBank, -1, 1);
  const brakeInput = clamp(Number(input.brake) || 0, 0, 1);
  const pitchResponse = Math.max(0.1, Number(config.pitchResponse) || 8.5);
  const bankResponse = Math.max(0.1, Number(config.bankResponse) || 10.5);
  const instrumentResponse = Math.max(
    0.1,
    Number(config.instrumentResponse) || 12,
  );
  state.pitch = damp(state.pitch, pitchInput, pitchResponse, seconds);
  state.bank = damp(state.bank, bankInput, bankResponse, seconds);
  state.braking = damp(state.braking, brakeInput, instrumentResponse, seconds);
  state.afterburner = damp(
    state.afterburner,
    input.boostActive ? 1 : 0,
    instrumentResponse,
    seconds,
  );

  // Direct pitch-to-climb-speed is more readable than accumulating endless
  // vertical acceleration. The craft begins airborne, eases into the
  // commanded climb/dive, and naturally levels when the stick returns.
  const climbSpeed = Math.max(0.1, Number(config.climbSpeed) || 0.66);
  const verticalResponse = Math.max(
    0.1,
    Number(config.verticalResponse) || 4.8,
  );
  const minAltitude = clamp(Number(config.minimumAltitude) || 0.12, 0.05, 0.8);
  const maxAltitude = clamp(Number(config.maximumAltitude) || 0.92, minAltitude, 1.25);

  const targetVerticalSpeed = state.pitch * climbSpeed;
  state.verticalSpeed = damp(
    state.verticalSpeed,
    targetVerticalSpeed,
    verticalResponse,
    seconds,
  );
  state.verticalSpeed = clamp(state.verticalSpeed, -climbSpeed, climbSpeed);
  state.altitude += state.verticalSpeed * seconds;
  if (state.altitude <= minAltitude) {
    state.altitude = minAltitude;
    state.verticalSpeed = Math.max(0, state.verticalSpeed);
  } else if (state.altitude >= maxAltitude) {
    state.altitude = maxAltitude;
    state.verticalSpeed = Math.min(0, state.verticalSpeed);
  }
  return state;
}

export function flightRingHit(state, ring, position = {}) {
  if (!state || state.phase !== 'flight' || !ring?.trackObjectId) return false;
  if (state.ringsHit.has(ring.trackObjectId)) return false;
  const x = Number(position.x) || 0;
  const altitude = Number(position.altitude) || 0;
  const radiusX = Math.max(0.08, Number(ring.ringRadiusX) || 0.32);
  const radiusY = Math.max(0.08, Number(ring.ringRadiusY) || 0.2);
  if (Math.abs(x - ring.offset) > radiusX) return false;
  if (Math.abs(altitude - ring.altitude) > radiusY) return false;
  state.ringsHit.add(ring.trackObjectId);
  return true;
}

export function flightSchoolView(state) {
  const hit = state?.ringsHit?.size ?? 0;
  const total = state?.ringCount ?? 0;
  return {
    phase: state?.phase ?? 'ground',
    altitude: Number(state?.altitude) || 0,
    verticalSpeed: Number(state?.verticalSpeed) || 0,
    pitch: Number(state?.pitch) || 0,
    bank: Number(state?.bank) || 0,
    braking: Number(state?.braking) || 0,
    afterburner: Number(state?.afterburner) || 0,
    ringsHit: hit,
    ringsTotal: total,
    ringsLeft: Math.max(0, total - hit),
  };
}

// Select the next objective aperture in authored order. Rendering and HUD code
// can use this small view to aim a reticle without owning collision rules.
// The helper accepts either RoadModel sprites or raw track objects, keeping it
// deterministic and Phaser-free for tests.
export function flightRouteCue(state, targets = [], position = {}) {
  if (!state || state.phase !== 'flight') return null;
  const route = Array.isArray(targets) ? targets : [];
  const segment = Number.isFinite(position.segment)
    ? position.segment
    : -Infinity;
  const next = route.find((target) => {
    const id = target?.trackObjectId ?? target?.id;
    const at = Number.isFinite(target?.at) ? target.at : Infinity;
    return id && at >= segment && !state.ringsHit.has(id) && target.hit !== true;
  });
  if (!next) return null;
  const id = next.trackObjectId ?? next.id;
  const offset = Number(next.offset) || 0;
  const altitude = Number(next.altitude) || 0;
  const x = Number(position.x) || 0;
  const currentAltitude = Number(position.altitude) || 0;
  return {
    id,
    offset,
    altitude,
    segment: Number.isFinite(next.at) ? next.at : null,
    horizontalError: offset - x,
    verticalError: altitude - currentAltitude,
  };
}

function damp(value, target, response, dt) {
  return value + (target - value) * (1 - Math.exp(-response * dt));
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}
