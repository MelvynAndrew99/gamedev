export const FRONT_END_VIEWS = Object.freeze({
  MAIN: 'main',
  SCHOOL: 'school',
  STORY: 'story',
  TROPHIES: 'trophies',
  CUSTOM: 'custom',
});

export const MAIN_DESTINATIONS = Object.freeze([
  Object.freeze({
    id: FRONT_END_VIEWS.SCHOOL,
    label: 'RACE SCHOOL',
    kicker: 'LEARN THE LINE',
    description: 'Master five driving courses. Flight School is coming soon.',
  }),
  Object.freeze({
    id: FRONT_END_VIEWS.STORY,
    label: 'STORY',
    kicker: 'THE REMATCH',
    description: 'Beat each clock, then face three rivals on the open course.',
  }),
  Object.freeze({
    id: FRONT_END_VIEWS.TROPHIES,
    label: 'TROPHY ROOM',
    kicker: 'YOUR BEST RUNS',
    description: 'Review school trophies, lifetime records, style rewards, and achievements.',
  }),
  Object.freeze({
    id: 'endless',
    label: 'ENDLESS',
    kicker: 'CHASE THE HORIZON',
    description: 'Survive the open road and push the distance record.',
  }),
  Object.freeze({
    id: FRONT_END_VIEWS.CUSTOM,
    label: 'TRACK BUILDER',
    kicker: 'BUILD YOUR OWN',
    description: 'A completion reward: create, save, and race your own circuits.',
  }),
]);

export const STORY_PHASES = Object.freeze({
  QUALIFIER: 'qualifier',
  RIVALS: 'rivals',
});

export const STORY_PAGES = Object.freeze({
  COURSES: 'courses',
  GARAGE: 'garage',
});

export function cycleStoryPage(page, direction) {
  const pages = [STORY_PAGES.COURSES, STORY_PAGES.GARAGE];
  const index = Math.max(0, pages.indexOf(page));
  if (direction === 'left') return pages[(index + pages.length - 1) % pages.length];
  if (direction === 'right') return pages[(index + 1) % pages.length];
  return pages[index];
}

export function carouselWindow(count, selectedIndex, radius = 2) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return Object.freeze([]);
  const safeRadius = Math.max(0, Math.floor(Number(radius) || 0));
  const selected = ((Math.floor(Number(selectedIndex) || 0) % safeCount) + safeCount) % safeCount;
  return Object.freeze(Array.from({ length: safeRadius * 2 + 1 }, (_, position) => {
    const offset = position - safeRadius;
    return Object.freeze({
      offset,
      index: (selected + offset + safeCount) % safeCount,
    });
  }));
}

export function shouldResetFrontEndLaunch(data, hasGarageData = false) {
  return !(data?.mode === 'story' && hasGarageData);
}

export const TROPHY_PAGES = Object.freeze({
  SCHOOL: 'school',
  RECORDS: 'records',
});

export function cycleTrophyPage(page, direction) {
  if (direction === 'left') {
    return page === TROPHY_PAGES.RECORDS ? TROPHY_PAGES.SCHOOL : TROPHY_PAGES.RECORDS;
  }
  if (direction === 'right') {
    return page === TROPHY_PAGES.SCHOOL ? TROPHY_PAGES.RECORDS : TROPHY_PAGES.SCHOOL;
  }
  return page;
}

export function buildStoryCourseTiles(tracks, resultForTrack) {
  return tracks.map((track, trackIndex) => {
    const progress = resultForTrack(track) ?? null;
    const bestQualifierTime = progress?.bestQualifierTime ?? null;
    const qualifierAward = progress?.bestQualifierAward ?? (
      progress?.qualified && bestQualifierTime != null
        ? bestQualifierTime <= (track.qualifier?.goldSeconds ?? -1)
          ? 'gold'
          : bestQualifierTime <= (track.qualifier?.silverSeconds ?? -1)
            ? 'silver'
            : 'bronze'
        : null
    );
    const rivalCount = Math.max(1, Number(track?.rivals?.count) || 3);
    const legacyAward = progress?.bestRivalAward;
    const rivalAward = progress?.rivalCompleted &&
      (progress?.bestTakedowns ?? 0) >= rivalCount
      ? 'platinum'
      : legacyAward === 'platinum'
        ? 'platinum'
        : legacyAward || progress?.rivalCompleted
          ? 'gold'
          : null;
    return Object.freeze({
      id: track.id,
      track,
      trackIndex,
      qualifier: Object.freeze({
        phase: STORY_PHASES.QUALIFIER,
        label: 'TIME TRIAL',
        locked: false,
        attempted: (progress?.qualifierAttempts ?? 0) > 0 || Boolean(progress?.qualified),
        complete: Boolean(progress?.qualified),
        bestTime: bestQualifierTime,
        award: qualifierAward,
      }),
      rivals: Object.freeze({
        phase: STORY_PHASES.RIVALS,
        label: 'RIVAL RACE',
        locked: !progress?.qualified,
        attempted: (progress?.rivalAttempts ?? 0) > 0 || Boolean(progress?.rivalCompleted),
        complete: Boolean(progress?.rivalCompleted),
        bestPlace: progress?.bestRivalPlace ?? null,
        bestTime: progress?.bestRivalTime ?? null,
        bestTakedowns: progress?.bestTakedowns ?? 0,
        award: rivalAward,
      }),
    });
  });
}

export function modeMenuTarget(mode, trackIndex = 0, phase = null, storyPage = null) {
  const selection = Number.isInteger(trackIndex) && trackIndex >= 0
    ? trackIndex
    : 0;
  if (mode === 'training') {
    return Object.freeze({ view: FRONT_END_VIEWS.SCHOOL, selection });
  }
  if (mode === 'story') {
    return Object.freeze({
      view: FRONT_END_VIEWS.STORY,
      selection,
      storyPhase: phase ?? STORY_PHASES.QUALIFIER,
      ...(storyPage == null ? {} : { storyPage }),
    });
  }
  if (mode === 'custom') {
    return Object.freeze({
      view: FRONT_END_VIEWS.CUSTOM,
      selection: 0,
      menuOpen: true,
    });
  }
  return Object.freeze({ view: FRONT_END_VIEWS.MAIN, selection: 0, menuOpen: true });
}

const DIRECTIONS = Object.freeze({
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
});

// Move through a visual grid while keeping short final rows intuitive.
// Horizontal movement stays in the row; vertical movement preserves column
// when possible and falls back to the last tile in a short destination row.
export function moveGridSelection(index, count, columns, direction) {
  if (count <= 0) return 0;
  const [dx, dy] = DIRECTIONS[direction] ?? [0, 0];
  const safeIndex = Math.min(Math.max(0, index), count - 1);
  const row = Math.floor(safeIndex / columns);
  const column = safeIndex % columns;
  if (dx !== 0) {
    const rowStart = row * columns;
    const rowCount = Math.min(columns, count - rowStart);
    return rowStart + (column + dx + rowCount) % rowCount;
  }
  if (dy !== 0) {
    const rowCount = Math.ceil(count / columns);
    const targetRow = (row + dy + rowCount) % rowCount;
    return Math.min(targetRow * columns + column, count - 1);
  }
  return safeIndex;
}

export function maxTrackStars(track) {
  return Math.max(
    0,
    ...(track.scoring?.thresholds ?? []).map((threshold) => threshold.stars ?? 0),
  );
}

export function buildSchoolTiles(
  tracks,
  highestUnlocked,
  resultForTrack,
  unlockState = {},
) {
  return tracks.map((track, index) => {
    const comingSoon = track.status === 'coming_soon';
    const result = comingSoon ? null : resultForTrack(track) ?? null;
    const storyPlatinumUnlock = track.unlock?.type === 'story_platinum';
    const lockedBySpecialRule = storyPlatinumUnlock && !unlockState.storyPlatinum;
    const lockedBySequence = !storyPlatinumUnlock && index > highestUnlocked;
    return Object.freeze({
      id: track.id,
      index,
      name: track.name,
      intro: track.intro ?? '',
      comingSoon,
      locked: comingSoon || lockedBySpecialRule || lockedBySequence || track.status === 'placeholder',
      lockReason: comingSoon
        ? track.unlock?.lockedText ?? 'COMING SOON'
        : lockedBySpecialRule
          ? track.unlock?.lockedText ?? 'LOCKED — PLATINUM THE RIVAL RACES TO UNLOCK'
          : null,
      completed: Boolean(result?.completed),
      trophy: result?.trophy ?? null,
      earnedAt: result?.trophyEarnedAt ?? null,
      stars: result?.stars ?? 0,
      maxStars: comingSoon ? 0 : maxTrackStars(track),
      specialUnlock: storyPlatinumUnlock,
    });
  });
}

export function buildTrophySummary(schoolTiles) {
  const releasedTiles = schoolTiles.filter((tile) => !tile.comingSoon);
  const stars = releasedTiles.reduce((total, tile) => total + tile.stars, 0);
  const maxStars = releasedTiles.reduce((total, tile) => total + tile.maxStars, 0);
  const allGold = releasedTiles.length > 0 &&
    releasedTiles.every((tile) => tile.trophy === 'gold');
  const drivingTiles = schoolTiles.filter((tile) => !tile.specialUnlock);
  const drivingAllGold = drivingTiles.length > 0 &&
    drivingTiles.every((tile) => tile.trophy === 'gold');
  return Object.freeze({ stars, maxStars, allGold, drivingAllGold });
}

export function schoolTileDescription(tile) {
  if (tile.locked) {
    if (tile.lockReason) return tile.lockReason;
    return tile.index === 0
      ? 'LOCKED'
      : `LOCKED — COMPLETE COURSE ${tile.index} TO UNLOCK`;
  }
  if (!tile.completed) return `${tile.intro}  •  NO TROPHY YET`;
  const trophy = tile.trophy?.toUpperCase() ?? 'NO TROPHY';
  return `${tile.intro}  •  BEST: ${trophy} / ${tile.stars} STARS`;
}

export function trophyStatusLabel(tile) {
  if (tile.comingSoon) return 'SOON';
  if (tile.locked) return 'LOCKED';
  if (tile.trophy) return tile.trophy.toUpperCase();
  return tile.completed ? 'COMPLETE — NO TROPHY' : 'UNEARNED';
}
