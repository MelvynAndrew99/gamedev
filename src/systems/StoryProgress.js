// Two-phase Story persistence. Keep this key stable across the title rename so
// qualifying runs and Rival victories survive presentation changes.
const KEY = 'destruction-racer.story.v1';

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
    // Progress is a convenience; storage failure must never stop a result.
  }
}

export function getStoryProgress(trackId, version = null) {
  const result = load()[trackId] ?? null;
  if (version != null && result?.version !== version) return null;
  return result;
}

export function isStoryCampaignComplete(tracks = []) {
  return tracks.length > 0 && tracks.every((track) => (
    getStoryProgress(track.id, track.storyVersion ?? 1)?.rivalCompleted === true
  ));
}

export function isStoryCampaignPlatinum(tracks = []) {
  return tracks.length > 0 && tracks.every((track) => {
    const result = getStoryProgress(track.id, track.storyVersion ?? 1);
    const rivalCount = Math.max(1, Math.floor(Number(track?.rivals?.count) || 3));
    return result?.bestRivalAward === 'platinum' || (
      result?.rivalCompleted === true &&
      (result?.bestTakedowns ?? 0) >= rivalCount
    );
  });
}

export function submitQualifierResult(track, time, targetSeconds, finished = true) {
  const progress = load();
  const version = track.storyVersion ?? 1;
  const stored = progress[track.id];
  const previous = stored?.version === version ? stored : {};
  const cleanTime = Math.max(0, Number(time) || 0);
  const target = Math.max(0, Number(targetSeconds) || 0);
  const qualified = Boolean(finished) && cleanTime <= target;
  const bestQualifierTime = previous.bestQualifierTime == null
    ? cleanTime
    : Math.min(previous.bestQualifierTime, cleanTime);
  const next = {
    ...previous,
    version,
    qualified: Boolean(previous.qualified || qualified),
    bestQualifierTime,
    qualifierAttempts: (previous.qualifierAttempts ?? 0) + 1,
  };
  progress[track.id] = next;
  save(progress);
  return Object.freeze({ qualified, newBest: cleanTime === bestQualifierTime, progress: next });
}

export function submitRivalResult(track, { place = 1, time = 0, takedowns = 0 } = {}) {
  const progress = load();
  const version = track.storyVersion ?? 1;
  const stored = progress[track.id];
  const previous = stored?.version === version ? stored : {};
  const cleanPlace = Math.max(1, Math.floor(Number(place) || 1));
  const cleanTime = Math.max(0, Number(time) || 0);
  const cleanTakedowns = Math.max(0, Math.floor(Number(takedowns) || 0));
  const won = cleanPlace === 1;
  const rivalCount = Math.max(1, Math.floor(Number(track?.rivals?.count) || 3));
  const fullClear = won && cleanTakedowns >= rivalCount;
  const award = fullClear ? 'platinum' : won ? 'gold' : null;
  // Save migration: the previous rules called a win Silver and a full clear
  // Gold. Preserve the achievement while translating it into the new
  // Gold/Platinum ladder; no player should lose a rank after this update.
  const previousAward = (previous.bestTakedowns ?? 0) >= rivalCount &&
    previous.rivalCompleted
    ? 'platinum'
    : previous.bestRivalAward === 'platinum'
      ? 'platinum'
      : previous.bestRivalAward || previous.rivalCompleted
        ? 'gold'
        : null;
  const awardValue = { platinum: 2, gold: 1 };
  const bestRivalAward = (awardValue[award] ?? 0) > (awardValue[previousAward] ?? 0)
    ? award
    : previousAward;
  const bestRivalTime = award
    ? previous.bestRivalTime == null
      ? cleanTime
      : Math.min(previous.bestRivalTime, cleanTime)
    : previous.bestRivalTime ?? null;
  const next = {
    ...previous,
    version,
    qualified: Boolean(previous.qualified),
    rivalCompleted: Boolean(previous.rivalCompleted || won || fullClear),
    bestRivalAward,
    bestRivalPlace: Math.min(previous.bestRivalPlace ?? Infinity, cleanPlace),
    bestRivalTime,
    bestTakedowns: Math.max(previous.bestTakedowns ?? 0, cleanTakedowns),
    rivalAttempts: (previous.rivalAttempts ?? 0) + 1,
  };
  progress[track.id] = next;
  save(progress);
  return Object.freeze({ won, fullClear, award, progress: next });
}
