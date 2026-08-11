// TrackDiscipline.js — tolerant, frame-rate-independent clean-line tracking.
// One noisy edge sample must never erase a Gold run; an excursion only counts
// after the grounded car remains materially beyond the road for 120ms.

export function createTrackDiscipline() {
  return {
    outsideSeconds: 0,
    offTrackEvents: 0,
    excursionLatched: false,
  };
}

export function updateTrackDiscipline(
  state,
  dt,
  { x = 0, airborne = false, edge = 1, latchSeconds = 0.12 } = {},
) {
  const next = { ...state };
  let justLostCleanLine = false;
  if (airborne) return { state: next, justLostCleanLine };

  if (Math.abs(x) <= edge) {
    next.outsideSeconds = 0;
    next.excursionLatched = false;
    return { state: next, justLostCleanLine };
  }

  next.outsideSeconds += Math.max(0, dt);
  if (!next.excursionLatched && next.outsideSeconds + 1e-9 >= latchSeconds) {
    next.excursionLatched = true;
    next.offTrackEvents += 1;
    justLostCleanLine = true;
  }
  return { state: next, justLostCleanLine };
}
