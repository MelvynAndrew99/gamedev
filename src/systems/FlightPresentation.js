// FlightPresentation.js — pure visual policy for the sequel-preview lesson.
//
// Flight School is sustained arcade flight, not an extra-long Air School
// jump.  Keeping its craft pose and instrument copy here prevents the jump
// arc's squash, shadow, apex halo, and active-aero arrows from leaking into
// the new mechanic.

export function flightCraftVisual(state = {}, lateralPosition = 0) {
  const airborne = state.phase === 'flight';
  if (!airborne) {
    return Object.freeze({
      airborne: false,
      xOffset: 0,
      liftPx: 0,
      scaleX: 1,
      scaleY: 1,
      pitch: 0,
      hideGroundShadow: false,
      engineIntensity: 0,
    });
  }

  const altitude = clamp(Number(state.altitude) || 0, 0, 1.25);
  const pitch = clamp(Number(state.pitch) || 0, -1, 1);
  return Object.freeze({
    airborne: true,
    // The craft travels around the screen in the flight corridor. Directional
    // atlas poses provide bank/pitch; its silhouette is never stretched.
    // Collision uses Player.x, so the sprite must use the same persistent
    // world position. Instantaneous steering input only selects a bank frame
    // and cannot snap the craft back to screen center.
    xOffset: clamp(Number(lateralPosition) || 0, -2, 2) * 74,
    liftPx: 60 + altitude * 126,
    scaleX: 1.08,
    scaleY: 1.08,
    pitch,
    hideGroundShadow: true,
    engineIntensity: 0.66 + Math.min(0.34, Math.abs(pitch) * 0.2 +
      clamp(Number(state.afterburner) || 0, 0, 1) * 0.14),
  });
}

export function flightHudView({
  state = {},
  progress = 0,
  speed = 0,
  maxSpeed = 1,
  device = 'keyboard',
} = {}) {
  const hit = Math.max(0, Math.floor(Number(state.ringsHit?.size ?? state.ringsHit) || 0));
  const total = Math.max(hit, Math.floor(Number(state.ringCount ?? state.ringsTotal) || 0));
  const phase = state.phase ?? 'ground';
  const altitude = Math.round(clamp(Number(state.altitude) || 0, 0, 1.25) * 100);
  const speedRatio = clamp((Number(speed) || 0) / Math.max(1, Number(maxSpeed) || 1), 0, 1.8);

  return Object.freeze({
    phase,
    rings: `${hit}/${total}`,
    ringsHit: hit,
    ringsTotal: total,
    progress: clamp(Number(progress) || 0, 0, 1),
    progressLabel: `${Math.round(clamp(Number(progress) || 0, 0, 1) * 100)}%`,
    altitude: `ALT ${String(altitude).padStart(2, '0')}`,
    speed: String(Math.round(Math.max(0, Number(speed) || 0) / 100)),
    speedRatio,
    objective: 'FLY THROUGH\nTHE NEXT RING',
    controls: device === 'gamepad'
      ? 'STICK  FLY     ○  BRAKE     □  BOOST'
      : 'ARROWS / W S  FLY     ↓  BRAKE     C  BOOST',
    showControls: phase !== 'flight' || hit === 0,
  });
}

export function flightPortalStyle(trackObjectId = '') {
  const match = /flight-ring-(\d+)/.exec(String(trackObjectId));
  const ring = Number(match?.[1]) || 0;
  return Object.freeze({
    architectural: [3, 6, 8, 10].includes(ring),
    landmark: ring === 6 || ring === 10,
  });
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}
