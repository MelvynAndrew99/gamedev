// RivalContact.js — pure swept player/rival contact for a looping road.
// No Phaser, audio, scoring state, or sprite concerns live here.

export const DEFAULT_RIVAL_CONTACT = Object.freeze({
  playerHalfWidth: 0.14,
  rivalHalfWidth: 0.14,
  longitudinalRadius: 130,
  lowRelativeSpeed: 480,
  highRelativeSpeed: 1440,
  contactCooldownSeconds: 0.45,
  minimumSeparation: 0.3,
  roadLimit: 2,
  rearRamAlignment: 0.2,
  lateralPushImpulse: 0.24,
  edgeTakedownThreshold: 1,
});

// Legacy compatibility helper: returns a one-frame directional shoulder tap.
// Training rear rams no longer require this input; integrations may instead
// pass ordinary steering as lateralIntent for the simpler edge-push verb.
export function attackIntent(input = {}, previousInput = {}) {
  const left = !!input.airbrakeL;
  const right = !!input.airbrakeR;
  if (left === right) return 0;
  if (left && !previousInput.airbrakeL) return -1;
  if (right && !previousInput.airbrakeR) return 1;
  return 0;
}

// Sweep relative player/rival motion over one frame. Positions may wrap from
// trackLength to zero; unwrapping each forward displacement prevents tunneling
// through a car at the finish line during a long/overspeed frame.
export function sweptRivalContact(
  previousPlayer,
  player,
  previousRival,
  rival,
  options = {},
) {
  const t = { ...DEFAULT_RIVAL_CONTACT, ...options };
  if (!previousPlayer || !player || !previousRival || !rival) return null;
  if (isAirborne(previousPlayer) || isAirborne(player) ||
      isAirborne(previousRival) || isAirborne(rival)) return null;
  // RivalPack may relocate an opponent only while it is far outside the
  // encounter. Ignore the resulting long positional sweep until the staged
  // car has been visible and physically approachable for a moment.
  if ((previousRival.stagingGrace ?? 0) > 0 || (rival.stagingGrace ?? 0) > 0) return null;

  const trackLength = Number(t.trackLength);
  if (!Number.isFinite(trackLength) || trackLength <= 0) {
    throw new Error('sweptRivalContact needs a positive trackLength');
  }

  const playerTravel = forwardDistance(previousPlayer.position, player.position, trackLength);
  const rivalTravel = forwardDistance(previousRival.position, rival.position, trackLength);
  const relativeStart = wrappedDelta(previousPlayer.position, previousRival.position, trackLength);
  const relativeTravel = rivalTravel - playerTravel;
  const closestTime = relativeTravel === 0
    ? 0
    : clamp(-relativeStart / relativeTravel, 0, 1);
  const longitudinalDistance = relativeStart + relativeTravel * closestTime;

  const playerX = lerp(previousPlayer.x, player.x, closestTime);
  const rivalX = lerp(previousRival.x, rival.x, closestTime);
  const lateralDistance = rivalX - playerX;
  const lateralRadius = positive(t.playerHalfWidth, 0.14) + positive(t.rivalHalfWidth, 0.14);
  if (Math.abs(longitudinalDistance) > positive(t.longitudinalRadius, 130) ||
      Math.abs(lateralDistance) >= lateralRadius) return null;

  const dt = positive(t.dt, 1 / 60);
  // RivalPack advances on a fixed 60Hz step while this sweep runs at render
  // frequency. Displacement/dt would therefore alternate between zero and a
  // double-sized rival velocity at 120Hz. Body speeds are the authoritative,
  // time-consistent impact signal; displacement remains authoritative for the
  // swept point of contact and is only a fallback for callers without speeds.
  const hasBodySpeeds = Number.isFinite(player.speed) && Number.isFinite(rival.speed);
  const closingSpeed = hasBodySpeeds
    ? player.speed - rival.speed
    : (playerTravel - rivalTravel) / dt;
  return {
    time: closestTime,
    playerX,
    rivalX,
    side: Math.sign(lateralDistance),
    lateralDistance,
    longitudinalDistance,
    relativeSpeed: Math.abs(closingSpeed),
    closingSpeed,
    playerCatching: relativeStart >= 0 && closingSpeed > 0,
  };
}

// Classify only. Integration decides damage/VFX and calls resolveRivalContact.
// Catching a rival squarely from behind is itself a deliberate training verb;
// no shoulder-button chord is required. A directional input remains useful
// for an authored side push. Equal-speed incidental overlap is always a rub.
export function classifyRivalContact(contact, options = {}) {
  if (!contact || (options.contactCooldown ?? 0) > 0) return null;
  const t = { ...DEFAULT_RIVAL_CONTACT, ...options };
  const relativeSpeed = Number.isFinite(options.relativeSpeed)
    ? Math.abs(options.relativeSpeed)
    : contact.relativeSpeed;
  const playerSpeedAdvantage = Number.isFinite(options.playerSpeedAdvantage)
    ? options.playerSpeedAdvantage
    : Number.isFinite(contact.closingSpeed)
      ? contact.closingSpeed
      : contact.playerCatching ? relativeSpeed : 0;
  const impact = relativeSpeed >= t.highRelativeSpeed
    ? 'high'
    : relativeSpeed >= t.lowRelativeSpeed ? 'medium' : 'low';
  const hasDrivingIntent = options.lateralIntent !== undefined ||
    options.steeringDirection !== undefined;
  const lateralIntent = Math.sign(
    options.lateralIntent ?? options.steeringDirection ?? options.attackDirection ?? 0,
  );
  const rivalSide = contact.side || lateralIntent;
  const hasSpeedEdge = playerSpeedAdvantage >= t.lowRelativeSpeed;
  const alignedRearRam = !!contact.playerCatching && hasSpeedEdge &&
    Math.abs(contact.lateralDistance ?? 0) <= t.rearRamAlignment;
  const lateralCommitment = Number.isFinite(options.lateralCommitment)
    ? Math.abs(options.lateralCommitment)
    : lateralIntent !== 0 ? 1 : 0;
  const deliberatePush = (hasDrivingIntent || hasSpeedEdge) && lateralIntent !== 0 &&
    lateralIntent === rivalSide && lateralCommitment >= 0.45 &&
    // A rival arriving faster cannot donate an elimination merely because
    // the player happens to be steering toward the impact. Equal-speed
    // committed contact is valid; materially negative advantage is not.
    playerSpeedAdvantage >= 0;
  const rivalContactX = Number.isFinite(contact.rivalX) ? contact.rivalX : 0;
  const outwardEdgePush = deliberatePush && Math.sign(rivalContactX) === lateralIntent &&
    Math.abs(rivalContactX + lateralIntent * t.lateralPushImpulse) >=
      t.edgeTakedownThreshold;

  if (alignedRearRam || deliberatePush) {
    const kind = alignedRearRam ? 'rear_ram' : 'side_push';
    return {
      kind,
      impact,
      deliberate: true,
      scores: true,
      // Once a rear ram has passed the explicit closing-speed/alignment gate,
      // it is the simple one-contact elimination verb this lesson teaches.
      // Side contact remains positional and only becomes decisive at the edge
      // (or with an authored high-energy/boost commitment).
      takedownForce: alignedRearRam || impact === 'high' ||
        !!options.boostActive || outwardEdgePush,
      side: alignedRearRam ? rivalSide : lateralIntent,
      lateralImpulse: kind === 'side_push' ? t.lateralPushImpulse : 0,
      relativeSpeed,
      playerSpeedAdvantage,
    };
  }
  const incomingAttack = !!options.rivalAttacking && (
    contact.side === 0 || Math.sign(options.rivalAttackSide ?? 0) === -contact.side
  );
  if (incomingAttack) {
    return {
      kind: 'incoming_attack', impact, deliberate: false, scores: false,
      takedownForce: false, side: rivalSide, relativeSpeed,
    };
  }
  if (contact.playerCatching && impact !== 'low') {
    return {
      kind: 'shunt', impact, deliberate: false, scores: false,
      takedownForce: false, side: rivalSide, relativeSpeed,
    };
  }
  return {
    kind: 'rub', impact, deliberate: false, scores: false,
    takedownForce: false, side: rivalSide, relativeSpeed,
  };
}

// Rival School's current lesson rule is intentionally binary and visible:
// contact can create a ricochet, but only contact made during live boost can
// remove a car. Keeping the gate pure prevents hidden stability damage from
// quietly turning ordinary bumps into later takedowns.
export function qualifiesRivalTakedown(classification, boostActive = false) {
  return !!boostActive && !!classification?.deliberate &&
    !!classification?.takedownForce;
}

// Stored fixed-step traces describe what existed during that step, but an
// earlier trace in the same 30Hz render frame may already have wrecked the
// live slot. Both snapshots must still be eligible before contact resolution.
export function rivalContactTraceEligible(tracedRival, liveRival) {
  const traced = tracedRival?.current;
  return !!traced?.active && !traced.eliminated && traced.state !== 'wrecked' &&
    !!liveRival?.active && !liveRival.eliminated && liveRival.state !== 'wrecked' &&
    traced.generation === liveRival.generation;
}

// Apply a small symmetric lateral separation and arm the rival's cooldown.
// The caller owns the objects and explicitly opts into mutation by calling it.
export function resolveRivalContact(player, rival, classification, options = {}) {
  if (!classification || !player || !rival) return null;
  const t = { ...DEFAULT_RIVAL_CONTACT, ...options };
  let side = Math.sign(rival.x - player.x) || classification.side || 1;
  const separation = positive(t.minimumSeparation, 0.3);
  const overlap = separation - Math.abs(rival.x - player.x);
  if (overlap > 0) {
    const shift = overlap / 2;
    player.x = clamp(player.x - side * shift, -t.roadLimit, t.roadLimit);
    rival.x = clamp(rival.x + side * shift, -t.roadLimit, t.roadLimit);
    // If one car hit the outer clamp, put the residual space on the other.
    if (Math.abs(rival.x - player.x) < separation) {
      side = Math.sign(rival.x - player.x) || side;
      player.x = clamp(rival.x - side * separation, -t.roadLimit, t.roadLimit);
      rival.x = clamp(player.x + side * separation, -t.roadLimit, t.roadLimit);
    }
  }
  const lateralImpulse = Math.max(0, Number(classification.lateralImpulse) || 0);
  if (lateralImpulse > 0) {
    rival.x = clamp(rival.x + side * lateralImpulse, -t.roadLimit, t.roadLimit);
  }
  rival.contactCooldown = Math.max(
    rival.contactCooldown ?? 0,
    positive(t.contactCooldownSeconds, 0.45),
  );
  return {
    ...classification,
    playerX: player.x,
    rivalX: rival.x,
    contactCooldown: rival.contactCooldown,
  };
}

export function rivalDamagePolicy(mode = 'training', campaignDamage = 10) {
  return mode === 'training'
    ? { trainingHits: 1, persistentHullDamage: 0 }
    : {
      trainingHits: 0,
      persistentHullDamage: Math.max(0, Number(campaignDamage) || 0),
    };
}

export function wrappedDelta(from, to, length) {
  let delta = wrap(to, length) - wrap(from, length);
  if (delta > length / 2) delta -= length;
  if (delta < -length / 2) delta += length;
  return delta;
}

function forwardDistance(from, to, length) {
  let distance = wrap(to, length) - wrap(from, length);
  if (distance < 0) distance += length;
  return distance;
}

function isAirborne(body) {
  return !!body.airborne || (body.air ?? 0) > 0;
}

function lerp(from, to, amount) {
  return finite(from, 0) + (finite(to, 0) - finite(from, 0)) * amount;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function wrap(value, length) {
  return ((value % length) + length) % length;
}
