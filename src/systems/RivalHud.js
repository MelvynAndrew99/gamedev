// RivalHud.js — pure presentation policy for Rival School. The scene owns
// Phaser objects; this module owns the small, deterministic view model that
// keeps the timed event readable and rivals locatable without adding a second
// minimap.

export const RIVAL_MARKER_IDENTITIES = Object.freeze([
  Object.freeze({ key: 'cyan', color: 0x00e5ff, shape: 'circle' }),
  Object.freeze({ key: 'magenta', color: 0xff2d95, shape: 'diamond' }),
  Object.freeze({ key: 'gold', color: 0xffcf3f, shape: 'square' }),
]);

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function positiveModulo(value, modulus) {
  if (!(modulus > 0)) return 0;
  return ((value % modulus) + modulus) % modulus;
}

export function rivalMarkerIdentity(id = '', index = 0) {
  const normalized = String(id).toLowerCase();
  const named = RIVAL_MARKER_IDENTITIES.find((identity) =>
    normalized.includes(identity.key)
  );
  return named ?? RIVAL_MARKER_IDENTITIES[
    positiveModulo(index, RIVAL_MARKER_IDENTITIES.length)
  ];
}

// Rivals only expose position around one wrapped circuit while the ribbon
// represents the whole event. Put each marker on the nearest ribbon location
// to the player so a rival just behind the start line never appears laps away.
export function rivalCourseMarkers({
  rivals = [],
  playerPosition = 0,
  playerRaceProgress = 0,
  trackLength = 1,
  laps = 1,
  loop = false,
} = {}) {
  const safeLength = Math.max(1, Number(trackLength) || 1);
  const safeLaps = Math.max(1, Number(laps) || 1);

  return rivals
    .filter((rival) => rival && rival.active !== false &&
      rival.eliminated !== true && rival.state !== 'wrecked')
    .map((rival, index) => {
      const rawDelta = positiveModulo(
        (Number(rival.position) || 0) - (Number(playerPosition) || 0),
        safeLength,
      );
      const delta = rawDelta > safeLength / 2
        ? rawDelta - safeLength
        : rawDelta;
      const identity = rivalMarkerIdentity(rival.id, index);
      return Object.freeze({
        id: rival.id ?? `rival-${index}`,
        // A loop is drawn on a linear ribbon. Anchor living rivals to the
        // player's nearest wrapped copy so a car just across the start seam
        // stays beside the player marker rather than lying at the far end.
        fraction: clamp(
          (Number(playerRaceProgress) || 0) +
            delta / (safeLength * (loop ? 1 : safeLaps)),
          0,
          1,
        ),
        color: identity.color,
        shape: identity.shape,
        // Relative side lets a renderer layer nearby markers consistently.
        side: Math.sign(delta),
      });
    });
}

export function formatEventTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

export function rivalEventHudView({
  timeRemainingSeconds,
  carsRemaining,
  startingCars = 3,
  lap = 1,
} = {}) {
  const initial = Math.max(0, Math.floor(Number(startingCars) || 0));
  const remaining = clamp(
    Math.floor(Number.isFinite(carsRemaining) ? carsRemaining : initial),
    0,
    initial,
  );
  const seconds = Number.isFinite(timeRemainingSeconds)
    ? Math.max(0, timeRemainingSeconds)
    : null;

  return Object.freeze({
    timeText: formatEventTime(seconds),
    carsText: `${remaining}`,
    carsRemaining: remaining,
    urgent: seconds !== null && seconds <= 10,
    critical: seconds !== null && seconds <= 5,
    cleared: initial > 0 && remaining === 0,
    lapText: `LAP ${Math.max(1, Math.floor(Number(lap) || 1))}`,
  });
}
