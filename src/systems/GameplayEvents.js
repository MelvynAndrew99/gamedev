export const GAMEPLAY_EVENT_SCHEMA_VERSION = 1;

const EVENT_TYPES = new Set(['style_reward', 'stat_increment', 'remote_attack']);
const STYLE_IDS = new Set([
  'cone_chain', 'speed_line_chain', 'boosted_hangtime', 'triple_boost', 'long_burn',
]);
const ATTACK_CLASSES = new Set([
  'cone_scatter', 'road_pressure', 'air_drop', 'speed_surge', 'burn_line',
]);
const STAT_KEYS = new Set([
  'conesSmashed', 'speedLinesCrossed', 'airtimeSeconds', 'boostedHangtimes',
  'tierThreeBoosts', 'heldBoostSeconds', 'longBurns', 'rivalsWrecked',
  'qualifiersCleared', 'rivalWins',
]);

function safeToken(value, fallback = '') {
  const token = String(value ?? fallback);
  return /^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(token) ? token : fallback;
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validCompressionMetadata(payload) {
  return (payload.repeatCount == null ||
      (validPositiveInteger(payload.repeatCount) && payload.repeatCount <= 64)) &&
    (payload.latestEventId == null ||
      safeToken(payload.latestEventId) === payload.latestEventId);
}

export function createGameplayEvent({
  eventId,
  type,
  source = 'local',
  target = null,
  timestamp = Date.now(),
  payload = {},
} = {}) {
  const cleanId = safeToken(eventId);
  const cleanType = EVENT_TYPES.has(type) ? type : null;
  const cleanSource = safeToken(source, 'local');
  const cleanTarget = target == null ? null : safeToken(target);
  if (!cleanId || !cleanType || !cleanSource || (target != null && !cleanTarget)) {
    return null;
  }
  return Object.freeze({
    schemaVersion: GAMEPLAY_EVENT_SCHEMA_VERSION,
    eventId: cleanId,
    type: cleanType,
    source: cleanSource,
    target: cleanTarget,
    timestamp: Math.max(0, Math.floor(Number(timestamp) || 0)),
    payload: Object.freeze({ ...payload }),
  });
}

export function validGameplayEvent(event, type = null) {
  const envelopeValid = !!event &&
    event.schemaVersion === GAMEPLAY_EVENT_SCHEMA_VERSION &&
    safeToken(event.eventId) === event.eventId &&
    EVENT_TYPES.has(event.type) &&
    (type == null || event.type === type) &&
    safeToken(event.source) === event.source &&
    (event.target == null || safeToken(event.target) === event.target) &&
    Number.isFinite(event.timestamp) && event.timestamp >= 0 &&
    event.payload != null && typeof event.payload === 'object' &&
    !Array.isArray(event.payload);
  if (!envelopeValid) return false;
  const payload = event.payload;
  if (event.type === 'style_reward') {
    const allowed = new Set([
      'styleId', 'attackClass', 'sequence', 'count', 'tier', 'seconds',
      'heldSeconds', 'repeatCount', 'latestEventId',
    ]);
    if (!hasOnlyKeys(payload, allowed) ||
        !STYLE_IDS.has(payload.styleId) ||
        !ATTACK_CLASSES.has(payload.attackClass) ||
        !validPositiveInteger(payload.sequence)) return false;
    const optionalNumbers = ['count', 'tier', 'seconds', 'heldSeconds'];
    if (optionalNumbers.some((key) => payload[key] != null &&
        (!Number.isFinite(payload[key]) || payload[key] < 0))) return false;
    return validCompressionMetadata(payload);
  }
  if (event.type === 'stat_increment') {
    return event.source === 'local' && event.target == null &&
      hasOnlyKeys(payload, new Set(['stat', 'amount'])) &&
      STAT_KEYS.has(payload.stat) &&
      Number.isFinite(payload.amount) && payload.amount > 0;
  }
  return hasOnlyKeys(payload, new Set([
    'attackClass', 'sequence', 'repeatCount', 'latestEventId',
  ])) &&
    event.source !== 'local' &&
    ATTACK_CLASSES.has(payload.attackClass) &&
    validPositiveInteger(payload.sequence) &&
    validCompressionMetadata(payload);
}
