function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

// Compares the quickest authored opponent with a perfect speed-line route.
// It deliberately does not count nitro, ramps, downhill gravity, or opponent
// contact, so a positive margin is a conservative proof that the race has a
// winnable ceiling rather than a promise that an ordinary run will win.
export function rivalRaceSpeedBudget(track, tuning, trackLength) {
  const length = Math.max(1, finite(trackLength, 1));
  const laps = Math.max(1, Math.floor(finite(track?.rivalRace?.laps, 1)));
  const segmentLength = Math.max(1, finite(tuning?.segmentLength, 200));
  const maxSpeed = Math.max(1, finite(tuning?.maxSpeed, 12000));
  const racePace = Math.max(0.01, finite(track?.rivals?.racePace, 1));
  const spawns = (track?.rivals?.spawns ?? []).slice(
    0,
    Math.max(1, Math.floor(finite(track?.rivals?.count, 3))),
  );
  const rivalTimes = spawns.map((spawn) => {
    const start = Math.max(0, finite(spawn.segmentsAhead, 0) * segmentLength);
    const speed = maxSpeed * racePace * Math.max(0.01, finite(spawn.pace, 1));
    return (laps * length - start) / speed;
  });
  const fastestRivalSeconds = Math.min(...rivalTimes);
  const playerDistance = laps * length + Math.max(0, finite(tuning?.gridSetback, 0));
  const speedLineCeiling = maxSpeed * Math.max(1, finite(tuning?.overspeedCap, 1));
  const perfectPlayerSeconds = playerDistance / speedLineCeiling;
  const requiredAverageSpeed = playerDistance / fastestRivalSeconds;
  return Object.freeze({
    fastestRivalSeconds,
    perfectPlayerSeconds,
    marginSeconds: fastestRivalSeconds - perfectPlayerSeconds,
    requiredCeilingFraction: requiredAverageSpeed / speedLineCeiling,
  });
}
