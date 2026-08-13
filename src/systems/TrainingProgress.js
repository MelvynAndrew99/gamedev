// TrainingProgress.js — medal evaluation and defensive local persistence.
// A lesson records its best result once; replaying Gold cannot farm stars.
// Those best-earned stars are the future unlock currency for optional gear,
// mods, and cosmetics, while simple lesson completion can unlock the next
// lesson without turning onboarding into a skill gate.

const KEY = 'destruction-racer.training.v1';

export function trainingMetricUsage(scoring = {}) {
  const thresholds = scoring?.thresholds ?? [];
  return Object.freeze({
    damage: thresholds.some((threshold) => threshold.maximumDamageHits != null),
    cones: thresholds.some((threshold) => threshold.maximumConesMissed != null),
    offTrack: thresholds.some((threshold) => threshold.maximumOffTrackEvents != null),
  });
}

function load() {
  try {
    return JSON.parse(globalThis.localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(progress) {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage is a convenience, never a reason to interrupt a race result.
  }
}

export function trophyFor(scoring, progress, metrics = {}) {
  const damageHits = metrics.damageHits ?? 0;
  const conesMissed = metrics.conesMissed ?? 0;
  const offTrackEvents = metrics.offTrackEvents ?? 0;
  const boostedTakedowns = metrics.boostedTakedowns ?? 0;
  const time = metrics.time ?? Infinity;
  const thresholds = [...(scoring?.thresholds ?? [])]
    .filter((threshold) => Number.isFinite(threshold.minimum))
    // Evaluate mastery before fallback when ranks share a target count.
    // Authoring order should never turn a Gold-qualified result into Silver.
    .sort((a, b) =>
      b.minimum - a.minimum || (b.stars ?? 0) - (a.stars ?? 0)
    );
  const earned = thresholds.find((threshold) =>
    progress >= threshold.minimum &&
    (
      threshold.maximumDamageHits == null ||
      damageHits <= threshold.maximumDamageHits
    ) &&
    (
      threshold.maximumConesMissed == null ||
      conesMissed <= threshold.maximumConesMissed
    ) &&
    (
      threshold.maximumOffTrackEvents == null ||
      offTrackEvents <= threshold.maximumOffTrackEvents
    ) &&
    (
      threshold.minimumBoostedTakedowns == null ||
      boostedTakedowns >= threshold.minimumBoostedTakedowns
    ) &&
    (
      threshold.maximumTime == null ||
      time <= threshold.maximumTime
    )
  );
  return earned
    ? {
      rank: earned.rank,
      stars: earned.stars ?? 0,
      minimum: earned.minimum,
      ...(earned.maximumDamageHits == null
        ? {}
        : { maximumDamageHits: earned.maximumDamageHits }),
      ...(earned.maximumConesMissed == null
        ? {}
        : { maximumConesMissed: earned.maximumConesMissed }),
      ...(earned.maximumOffTrackEvents == null
        ? {}
        : { maximumOffTrackEvents: earned.maximumOffTrackEvents }),
      ...(earned.minimumBoostedTakedowns == null
        ? {}
        : { minimumBoostedTakedowns: earned.minimumBoostedTakedowns }),
      ...(earned.maximumTime == null
        ? {}
        : { maximumTime: earned.maximumTime }),
    }
    : null;
}

// Hazard-style mastery cones can grade the complete multi-lap run rather than
// treating lap one as disposable rehearsal. Other lessons retain their
// finishing-lap behavior unless the track opts into scoreAcrossLaps.
export function trainingConeScore(track, { allHits = 0, lastLapHits = 0 } = {}) {
  const conesPerLap = track.objects?.filter(
    (object) => object?.kind === 'cone',
  ).length ?? 0;
  const scoringMode = track.trainingCones?.scoreAcrossLaps;
  const acrossLaps = scoringMode === true || scoringMode === 'unique';
  // Boolean true preserves the original every-lap contract. "unique" is for
  // persistent authored cones: either lap can claim each cone once.
  const target = conesPerLap * (scoringMode === true ? (track.laps ?? 1) : 1);
  const hits = Math.min(target, acrossLaps ? allHits : lastLapHits);
  return { hits, target, missed: Math.max(0, target - hits) };
}

export function getTrainingResult(trackId, version = null) {
  const result = load()[trackId] ?? null;
  if (version != null && result?.version !== version) return null;
  return result;
}

export function totalTrainingStars() {
  return Object.values(load()).reduce(
    (total, result) => total + (result.stars ?? 0),
    0,
  );
}

export function submitTrainingResult(track, progress, time, metrics = {}) {
  const results = load();
  const version = track.scoring?.version ?? 1;
  const stored = results[track.id] ?? null;
  const previous = stored?.version === version ? stored : null;
  const damageHits = metrics.damageHits ?? 0;
  const conesMissed = metrics.conesMissed ?? 0;
  const offTrackEvents = metrics.offTrackEvents ?? 0;
  const boostedTakedowns = metrics.boostedTakedowns ?? 0;
  const objectiveTargetCount = track.objects?.filter(
    (object) => object?.objective === track.scoring?.objective,
  ).length ?? 0;
  const total = metrics.total ?? (
    objectiveTargetCount || track.objects?.length || progress
  );
  const trophy = trophyFor(track.scoring, progress, {
    damageHits,
    conesMissed,
    offTrackEvents,
    boostedTakedowns,
    time,
  });
  const stars = trophy?.stars ?? 0;
  const earnedAt = Number.isFinite(metrics.timestamp) && metrics.timestamp > 0
    ? Math.floor(metrics.timestamp)
    : Date.now();
  const newBest = previous == null ||
    stars > (previous.stars ?? 0) ||
    (
      stars === (previous.stars ?? 0) &&
      (
        progress > previous.bestProgress ||
        (
          progress === previous.bestProgress &&
          (
            damageHits < (previous.damageHits ?? Infinity) ||
            (
              damageHits === (previous.damageHits ?? Infinity) &&
              (
                offTrackEvents < (previous.offTrackEvents ?? Infinity) ||
                (
                  offTrackEvents === (previous.offTrackEvents ?? Infinity) &&
                  time < previous.bestTime
                )
              )
            )
          )
        )
      )
    );

  if (newBest) {
    results[track.id] = {
      version,
      completed: true,
      bestProgress: progress,
      total,
      bestTime: time,
      damageHits,
      conesMissed,
      offTrackEvents,
      boostedTakedowns,
      trophy: trophy?.rank ?? null,
      trophyEarnedAt: trophy
        ? previous?.trophy === trophy.rank
          ? previous.trophyEarnedAt ?? null
          : earnedAt
        : null,
      stars,
    };
    save(results);
  } else if (!previous.completed) {
    previous.completed = true;
    save(results);
  }

  return {
    trophy,
    newBest,
    best: results[track.id] ?? previous,
  };
}

export function highestUnlockedTrainingIndex(tracks) {
  let unlocked = 0;
  for (let index = 0; index < tracks.length - 1; index++) {
    const track = tracks[index];
    const nextTrack = tracks[index + 1];
    const result = getTrainingResult(track.id, track.scoring?.version ?? 1);
    if (
      !result?.completed ||
      nextTrack?.status === 'placeholder' ||
      nextTrack?.status === 'coming_soon'
    ) break;
    unlocked = index + 1;
  }
  return unlocked;
}
