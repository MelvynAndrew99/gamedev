// AirtimeFx.js — pure visual policy for jump readability.
// Physics owns the arc. This module translates it into squash/stretch,
// active-aero silhouette, trail length, and one-shot highlight decisions.

import {
  VEHICLE_PITCH_ROWS,
  VEHICLE_STEER_FRAMES,
} from '../config/vehicleSprite.js';

export const AIRTIME_COLORS = Object.freeze({
  neutral: 0x00e5ff,
  short: 0xff2d95,
  long: 0xffcf3f,
  boosted: 0x6df7ff,
  mastery: 0x2ee56b,
});

export const CAR_STEER_FRAME_COUNT = VEHICLE_STEER_FRAMES;
export const CAR_PITCH_ROW = Object.freeze({
  down: VEHICLE_PITCH_ROWS - 1,
  neutral: 1,
  up: 0,
});

// A small inertial filter keeps analog pitch from snapping between authored
// sprite rows. Positive glide is the long/nose-up choice; negative glide is
// the short/nose-down choice. Ground contact eases the chassis back through
// neutral so the landing squash can remain the dominant impact shape.
export function nextAirtimePitch(
  previous = 0,
  { airborne = false, glide = 0, dt = 0 } = {},
) {
  const current = clamp(Number.isFinite(previous) ? previous : 0, -1, 1);
  const target = airborne
    ? clamp(Number.isFinite(glide) ? glide : 0, -1, 1)
    : 0;
  const seconds = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const response = airborne ? 14 : 20;
  const next = current + (target - current) * (1 - Math.exp(-response * seconds));
  return !airborne && Math.abs(next) < 0.015 ? 0 : clamp(next, -1, 1);
}

export function airtimePitchPose(pitch = 0) {
  const value = Number.isFinite(pitch) ? pitch : 0;
  if (value <= -0.2) return 'down';
  if (value >= 0.2) return 'up';
  return 'neutral';
}

export function carSpriteFrame(steerFrame = 2, pitch = 0) {
  const steer = clamp(Math.round(Number.isFinite(steerFrame) ? steerFrame : 2), 0, 4);
  return CAR_PITCH_ROW[airtimePitchPose(pitch)] * CAR_STEER_FRAME_COUNT + steer;
}

// The atlas was authored from the craft's point of view. In a rear chase
// camera that made its left/right silhouettes read backward to the driver.
// Mirror only the pose lookup; physics and road movement keep their signs.
export function chaseSteerFrame(steer = 0) {
  const value = Number.isFinite(steer) ? steer : 0;
  return value < -0.6 ? 4
    : value < -0.2 ? 3
      : value <= 0.2 ? 2
        : value <= 0.6 ? 1 : 0;
}

export function nextGlideMode(previous = 'neutral', glide = 0) {
  const value = Number.isFinite(glide) ? glide : 0;
  if (previous === 'short' && value < -0.12) return 'short';
  if (previous === 'long' && value > 0.12) return 'long';
  if (value <= -0.25) return 'short';
  if (value >= 0.25) return 'long';
  return 'neutral';
}

export function airtimeTier(seconds = 0) {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (value >= 1.15) return { level: 3, id: 'soar' };
  if (value >= 0.85) return { level: 2, id: 'flow' };
  if (value >= 0.5) return { level: 1, id: 'hop' };
  return { level: 0, id: 'launch' };
}

export function shouldTriggerApex({ airborne = false, arc = 0, latched = false } = {}) {
  return airborne && !latched && arc >= 0.97;
}

export function landingFxStrength({
  airtime = 0,
  launchSpeed = 0,
  maxSpeed = 1,
  mastery = false,
} = {}) {
  const duration = clamp(airtime, 0, 1.4) / 1.4;
  const speed = maxSpeed > 0 ? clamp(launchSpeed / maxSpeed, 0, 1.65) / 1.65 : 0;
  return clamp(0.42 + duration * 0.42 + speed * 0.34 + (mastery ? 0.2 : 0), 0.42, 1.25);
}

export function landingFxColor({ mastery = false, miss = false, glideMode = 'neutral' } = {}) {
  if (mastery) return AIRTIME_COLORS.mastery;
  if (miss || glideMode === 'short') return AIRTIME_COLORS.short;
  if (glideMode === 'long') return AIRTIME_COLORS.long;
  return AIRTIME_COLORS.neutral;
}

export function airtimeFxFrame({
  airborne = false,
  arc = 0,
  glideMode = 'neutral',
  speedRatio = 0,
  boosted = false,
  takeoff = 0,
  landing = 0,
  landingStrength = 0,
} = {}) {
  const a = clamp(arc, 0, 1);
  const speed = clamp(speedRatio, 0, 1.65) / 1.65;
  const kick = clamp(takeoff, 0, 1);
  const land = clamp(landing, 0, 1);
  const kickProgress = 1 - kick;
  const compression = kick > 0 && kickProgress < 0.28
    ? 1 - kickProgress / 0.28
    : 0;
  const release = kick > 0 && kickProgress >= 0.16
    ? Math.sin(clamp((kickProgress - 0.16) / 0.84, 0, 1) * Math.PI)
    : 0;
  const long = glideMode === 'long' ? 1 : 0;
  const short = glideMode === 'short' ? 1 : 0;
  const baseAirScale = 1 + 0.45 * a;
  const landingSquash = land * landingStrength;

  const trailIntensity = airborne
    ? clamp(0.28 + speed * 0.46 + (boosted ? 0.26 : 0), 0, 1)
    : 0;
  const trailLength = trailIntensity * (
    30 + a * 25 + long * 30 - short * 10 + (boosted ? 24 : 0)
  );
  const apex = airborne ? clamp(1 - Math.abs(1 - a) / 0.16, 0, 1) : 0;

  return {
    scaleX: baseAirScale * (
      1 + compression * 0.2 - release * 0.05 + long * 0.09 - short * 0.04 +
      landingSquash * 0.18
    ),
    scaleY: baseAirScale * (
      1 - compression * 0.22 + release * 0.1 - long * 0.06 + short * 0.1 -
      landingSquash * 0.2
    ),
    liftPx: 46 * a + 10 * release - 3 * landingSquash,
    trailIntensity,
    trailLength: Math.max(0, trailLength),
    apex,
    aero: glideMode,
    color: boosted
      ? AIRTIME_COLORS.boosted
      : long
        ? AIRTIME_COLORS.long
        : short
          ? AIRTIME_COLORS.short
          : AIRTIME_COLORS.neutral,
  };
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}
