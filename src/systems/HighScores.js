// HighScores.js — persistence via localStorage, defensively wrapped.
// localStorage can throw (private browsing, storage disabled, quota), and a
// racing game should never crash because the browser won't remember a
// number. Every call degrades to "no scores" silently.

const KEY = 'destruction-racer.scores.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function getScore(id) {
  return load()[id] ?? null;
}

// mode: 'max' (endless distance) or 'min' (lap times — lower is better).
// Returns true if this was a new record.
export function submitScore(id, value, mode = 'max') {
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