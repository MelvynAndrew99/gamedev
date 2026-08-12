import { createGameplayEvent, validGameplayEvent } from './GameplayEvents.js';

const KEY = 'rhythmic-ride.player-stats.v1';
export const PLAYER_STATS_VERSION = 1;

export const PLAYER_STAT_KEYS = Object.freeze([
  'conesSmashed',
  'speedLinesCrossed',
  'airtimeSeconds',
  'boostedHangtimes',
  'tierThreeBoosts',
  'heldBoostSeconds',
  'longBurns',
  'rivalsWrecked',
  'qualifiersCleared',
  'rivalWins',
]);

export const PLAYER_ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: 'cone-killer', label: 'CONE KILLER', stat: 'conesSmashed', threshold: 50, icon: '△' }),
  Object.freeze({ id: 'speed-demon', label: 'SPEED DEMON', stat: 'speedLinesCrossed', threshold: 30, icon: '»' }),
  Object.freeze({ id: 'sky-rider', label: 'SKY RIDER', stat: 'airtimeSeconds', threshold: 30, icon: '⌃' }),
  Object.freeze({ id: 'rival-breaker', label: 'RIVAL BREAKER', stat: 'rivalsWrecked', threshold: 10, icon: '×' }),
]);

function emptyProfile() {
  return {
    version: PLAYER_STATS_VERSION,
    totals: Object.fromEntries(PLAYER_STAT_KEYS.map((key) => [key, 0])),
    achievements: {},
    processedEventIds: [],
    processedRuns: {},
  };
}

function sanitizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function sanitizePlayerProfile(value) {
  const profile = emptyProfile();
  if (!value || value.version !== PLAYER_STATS_VERSION) return profile;
  PLAYER_STAT_KEYS.forEach((key) => {
    profile.totals[key] = sanitizeNumber(value.totals?.[key]);
  });
  PLAYER_ACHIEVEMENTS.forEach((achievement) => {
    const stored = value.achievements?.[achievement.id];
    if (stored?.earned === true) {
      profile.achievements[achievement.id] = {
        earned: true,
        earnedAt: Math.max(0, Math.floor(Number(stored.earnedAt) || 0)),
        version: PLAYER_STATS_VERSION,
      };
    }
  });
  Object.entries(value.processedRuns ?? {}).forEach(([runId, ranges]) => {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(runId) || !Array.isArray(ranges)) return;
    const clean = ranges
      .filter((range) => Array.isArray(range) && range.length === 2)
      .map(([start, end]) => [
        Math.max(0, Math.floor(Number(start) || 0)),
        Math.max(0, Math.floor(Number(end) || 0)),
      ])
      .filter(([start, end]) => start > 0 && end >= start)
      .sort((a, b) => a[0] - b[0]);
    if (clean.length) profile.processedRuns[runId] = mergeRanges(clean);
  });
  [...new Set(
    (Array.isArray(value.processedEventIds) ? value.processedEventIds : [])
      .filter((id) => typeof id === 'string' && id.length <= 96),
  )].forEach((eventId) => {
    const run = statEventRun(eventId);
    if (!run) {
      profile.processedEventIds.push(eventId);
      return;
    }
    const ranges = profile.processedRuns[run.runId] ?? [];
    profile.processedRuns[run.runId] = mergeRanges([
      ...ranges,
      [run.sequence, run.sequence],
    ]);
  });
  return profile;
}

function mergeRanges(ranges) {
  const merged = [];
  ranges.forEach(([start, end]) => {
    const previous = merged.at(-1);
    if (previous && start <= previous[1] + 1) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  });
  return merged;
}

function statEventRun(eventId) {
  const match = /^(.*):stat:(\d+)$/.exec(eventId);
  if (!match || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(match[1])) return null;
  const sequence = Number(match[2]);
  return Number.isSafeInteger(sequence) && sequence > 0
    ? { runId: match[1], sequence }
    : null;
}

function sequenceSeen(ranges, sequence) {
  return ranges.some(([start, end]) => sequence >= start && sequence <= end);
}

function rememberEvent(profile, eventId) {
  const run = statEventRun(eventId);
  if (!run) {
    profile.processedEventIds.push(eventId);
    return;
  }
  const ranges = profile.processedRuns[run.runId] ?? [];
  profile.processedRuns[run.runId] = mergeRanges([...ranges, [run.sequence, run.sequence]]);
}

function eventSeen(profile, eventId) {
  const run = statEventRun(eventId);
  return run
    ? sequenceSeen(profile.processedRuns[run.runId] ?? [], run.sequence) ||
      profile.processedEventIds.includes(eventId)
    : profile.processedEventIds.includes(eventId);
}

function load() {
  try {
    return sanitizePlayerProfile(JSON.parse(globalThis.localStorage.getItem(KEY)));
  } catch {
    return emptyProfile();
  }
}

function save(profile) {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Stats are optional persistence and must never interrupt driving.
  }
}

export function getPlayerProfile() {
  return load();
}

export function achievementViews(profile = getPlayerProfile()) {
  return PLAYER_ACHIEVEMENTS.map((achievement) => {
    const value = sanitizeNumber(profile.totals?.[achievement.stat]);
    const earned = profile.achievements?.[achievement.id]?.earned === true;
    return Object.freeze({
      ...achievement,
      value,
      progress: Math.min(achievement.threshold, value),
      earned,
      earnedAt: earned ? profile.achievements[achievement.id].earnedAt : null,
    });
  });
}

export function submitPlayerStatEvent(event) {
  if (!validGameplayEvent(event, 'stat_increment')) return { accepted: false, profile: load() };
  const stat = event.payload.stat;
  const amount = sanitizeNumber(event.payload.amount);
  const profile = load();
  if (!PLAYER_STAT_KEYS.includes(stat) || amount <= 0 ||
      eventSeen(profile, event.eventId)) {
    return { accepted: false, profile };
  }
  profile.totals[stat] += amount;
  rememberEvent(profile, event.eventId);
  const unlocked = [];
  PLAYER_ACHIEVEMENTS.forEach((achievement) => {
    if (profile.achievements[achievement.id]?.earned ||
        profile.totals[achievement.stat] < achievement.threshold) return;
    profile.achievements[achievement.id] = {
      earned: true,
      earnedAt: event.timestamp,
      version: PLAYER_STATS_VERSION,
    };
    unlocked.push(achievement.id);
  });
  save(profile);
  return { accepted: true, unlocked, profile };
}

export function createPlayerStatEvent(runId, sequence, stat, amount, timestamp = Date.now()) {
  return createGameplayEvent({
    eventId: `${runId}:stat:${sequence}`,
    type: 'stat_increment',
    source: 'local',
    timestamp,
    payload: { stat, amount },
  });
}

export class HeldBoostAccumulator {
  constructor(thresholdSeconds = 1.05) {
    this.thresholdSeconds = Math.max(0.01, Number(thresholdSeconds) || 1.05);
    this.seconds = 0;
    this.longBurnAwarded = false;
  }

  update(dt, held) {
    if (!held) return this.breakSegment();
    this.seconds += Math.max(0, Number(dt) || 0);
    const longBurn = !this.longBurnAwarded &&
      this.seconds + 1e-9 >= this.thresholdSeconds;
    if (longBurn) this.longBurnAwarded = true;
    return { completedSeconds: 0, longBurn };
  }

  breakSegment() {
    const completedSeconds = this.seconds;
    this.seconds = 0;
    this.longBurnAwarded = false;
    return { completedSeconds, longBurn: false };
  }
}
