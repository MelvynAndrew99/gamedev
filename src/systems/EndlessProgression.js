export const ENDLESS_TRICK_HEAL = 3;

export const ENDLESS_STAGES = Object.freeze([
  Object.freeze({
    index: 0,
    level: 1,
    id: 'proving-ground',
    name: 'PROVING GROUND',
    startsAtM: 0,
    environment: 'training-loop',
    music: 'high-speed',
    difficulty: 0,
  }),
  Object.freeze({
    index: 1,
    level: 2,
    id: 'neon-gulch',
    name: 'NEON GULCH',
    startsAtM: 6500,
    environment: 'neon-gulch',
    music: 'neon-gulch',
    difficulty: 0.36,
  }),
  Object.freeze({
    index: 2,
    level: 3,
    id: 'syndicate-run',
    name: 'SYNDICATE RUN',
    startsAtM: 13500,
    environment: 'syndicate-run',
    music: 'syndicate-run',
    difficulty: 0.7,
  }),
]);

function distance(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function endlessStageForDistance(distanceM = 0) {
  const meters = distance(distanceM);
  for (let index = ENDLESS_STAGES.length - 1; index >= 0; index -= 1) {
    if (meters >= ENDLESS_STAGES[index].startsAtM) return ENDLESS_STAGES[index];
  }
  return ENDLESS_STAGES[0];
}

// Generation eases across each named level instead of reaching maximum
// pressure before the first environment change. Stage 3 keeps tightening for
// another full course-length, then holds the authored maximum indefinitely.
export function endlessDifficultyForDistance(distanceM = 0) {
  const meters = distance(distanceM);
  const stage = endlessStageForDistance(meters);
  const next = ENDLESS_STAGES[stage.index + 1];
  if (!next) {
    const finalSpan = 7000;
    const progress = Math.min(1, (meters - stage.startsAtM) / finalSpan);
    return stage.difficulty + (1 - stage.difficulty) * progress;
  }
  const progress = Math.min(
    1,
    (meters - stage.startsAtM) / (next.startsAtM - stage.startsAtM),
  );
  return stage.difficulty + (next.difficulty - stage.difficulty) * progress;
}

export const ENDLESS_SPEED_LINE_TIERS = Object.freeze([
  Object.freeze({ count: 3, title: 'SPEED DEMON!', color: 0x2ee56b, spectacle: 1 }),
  Object.freeze({ count: 5, title: 'OVERDRIVE!', color: 0x00e5ff, spectacle: 2 }),
  Object.freeze({ count: 7, title: 'HYPERDRIVE!', color: 0xffcf3f, spectacle: 3 }),
  Object.freeze({ count: 10, title: 'UNSTOPPABLE!', color: 0xff2d95, spectacle: 4 }),
  Object.freeze({ count: 15, title: 'MAXIMUM VELOCITY!', color: 0xffffff, spectacle: 5 }),
]);

export function endlessSpeedLineTier(count = 0) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const exact = ENDLESS_SPEED_LINE_TIERS.find((candidate) => candidate.count === total);
  if (exact) return Object.freeze({ ...exact, count: total });
  const maximum = ENDLESS_SPEED_LINE_TIERS.at(-1);
  if (total > maximum.count && total % 5 === 0) {
    return Object.freeze({ ...maximum, count: total });
  }
  return null;
}
