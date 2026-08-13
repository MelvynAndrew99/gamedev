// HighScores.js — persistence via localStorage, defensively wrapped.
// localStorage can throw (private browsing, storage disabled, quota), and a
// racing game should never crash because the browser won't remember a
// number. Every call degrades to "no scores" silently.

// This key keeps its original "destruction-racer" prefix from before the
// game was renamed to Rhythmic Ride. It is intentionally retained for
// legacy save compatibility: renaming or migrating it would orphan every
// player's existing saved scores. Do not migrate or delete old data here.
const KEY = 'destruction-racer.scores.v1';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A record is only ever a finite, nonnegative number. Anything else
// (NaN, Infinity, negatives, strings, objects, arrays) is not a valid score.
function isValidValue(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Score ids are internal identifiers (track slugs, 'endless'), never
// player-authored text, so a tight allowlist is safe: letters, digits,
// hyphen, underscore, bounded length. This also rejects whitespace-only
// strings and blocks '__proto__'/'constructor'/'prototype' from ever
// becoming an object key, without needing a Map or Object.create(null).
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id) && !RESERVED_IDS.has(id);
}

function isValidMode(mode) {
  return mode === 'max' || mode === 'min';
}

// Strips anything that isn't a validly-keyed, validly-valued record instead
// of trusting the shape of whatever was in storage (or whatever a caller
// passes in). Reloaded fresh on every call — never a stale module cache —
// so external/manual changes to storage are picked up immediately.
function sanitizeMap(raw) {
  if (!isPlainObject(raw)) return {};
  const clean = {};
  for (const [id, value] of Object.entries(raw)) {
    if (isValidId(id) && isValidValue(value)) clean[id] = value;
  }
  return clean;
}

function load() {
  try {
    return sanitizeMap(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    // Corrupt JSON, disabled storage, or a throwing localStorage all land
    // here. A subsequent successful submitScore() will overwrite this with
    // a clean map, self-healing the corruption.
    return {};
  }
}

export function getScore(id) {
  if (!isValidId(id)) return null;
  return load()[id] ?? null;
}

// mode: 'max' (endless distance) or 'min' (lap times — lower is better).
// Any other mode is rejected outright rather than silently falling back to
// 'min' — a typo'd mode string must never quietly invert what "better" means.
// Returns true if this was a new record. Invalid ids/values are rejected
// before ever touching storage, so a bad submit can't corrupt a record.
export function submitScore(id, value, mode = 'max') {
  if (!isValidId(id) || !isValidValue(value) || !isValidMode(mode)) return false;
  try {
    const scores = load();
    const prev = scores[id];
    const isRecord =
      prev == null || (mode === 'max' ? value > prev : value < prev);
    if (isRecord) {
      scores[id] = value;
      localStorage.setItem(KEY, JSON.stringify(scores));
    }
    return isRecord;
  } catch {
    return false;
  }
}

// Pure read-only view for UI/dashboards. Never throws, never returns an
// invalid distance — just the saved 'endless' max record (if any).
export function endlessRecordSnapshot() {
  const best = getScore('endless');
  return Object.freeze({
    distanceM: best == null ? 0 : best,
    hasRun: best != null,
  });
}
