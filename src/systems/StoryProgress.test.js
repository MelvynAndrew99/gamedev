import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStoryProgress,
  isStoryCampaignComplete,
  isStoryCampaignPlatinum,
  submitQualifierResult,
  submitRivalResult,
} from './StoryProgress.js';

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('qualifying unlocks the rival phase and preserves the best time', () => {
  globalThis.localStorage = storage();
  const track = { id: 'story-test', storyVersion: 2 };
  assert.equal(submitQualifierResult(track, 61, 60).qualified, false);
  assert.equal(submitQualifierResult(track, 58, 60).qualified, true);
  assert.equal(submitQualifierResult(track, 59, 60).qualified, true);
  assert.deepEqual(getStoryProgress(track.id, 2), {
    version: 2,
    qualified: true,
    bestQualifierTime: 58,
    qualifierAttempts: 3,
  });
});

test('reaching the deadline without the finish line does not qualify', () => {
  globalThis.localStorage = storage();
  const track = { id: 'story-timeout', storyVersion: 1 };
  assert.equal(submitQualifierResult(track, 60, 60, false).qualified, false);
  assert.equal(getStoryProgress(track.id, 1).qualified, false);
});

test('rival progress stores wins independently from qualifier attempts', () => {
  globalThis.localStorage = storage();
  const track = { id: 'story-rival', storyVersion: 1, rivals: { count: 3 } };
  submitQualifierResult(track, 50, 55);
  assert.equal(submitRivalResult(track, { place: 2, time: 70, takedowns: 1 }).won, false);
  const gold = submitRivalResult(track, { place: 1, time: 68, takedowns: 2 });
  assert.equal(gold.won, true);
  assert.equal(gold.award, 'gold');
  const result = getStoryProgress(track.id, 1);
  assert.equal(result.qualified, true);
  assert.equal(result.rivalCompleted, true);
  assert.equal(result.bestRivalPlace, 1);
  assert.equal(result.bestRivalTime, 68);
  assert.equal(result.bestTakedowns, 2);
  assert.equal(result.bestRivalAward, 'gold');
});

test('wrecking the entire rival field earns Platinum and cannot be downgraded', () => {
  globalThis.localStorage = storage();
  const track = { id: 'story-gold', storyVersion: 1, rivals: { count: 3 } };
  const platinum = submitRivalResult(track, { place: 1, time: 72, takedowns: 3 });
  assert.equal(platinum.fullClear, true);
  assert.equal(platinum.award, 'platinum');
  assert.equal(platinum.progress.bestRivalAward, 'platinum');
  const laterWin = submitRivalResult(track, { place: 1, time: 68, takedowns: 0 });
  assert.equal(laterWin.award, 'gold');
  assert.equal(laterWin.progress.bestRivalAward, 'platinum');
});

test('legacy Silver wins and Gold full clears migrate without losing progress', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const track = { id: 'story-migrate', storyVersion: 1, rivals: { count: 3 } };
  data.set('destruction-racer.story.v1', JSON.stringify({
    [track.id]: {
      version: 1, rivalCompleted: true, bestRivalAward: 'silver', bestTakedowns: 1,
    },
  }));
  assert.equal(
    submitRivalResult(track, { place: 2, takedowns: 0 }).progress.bestRivalAward,
    'gold',
  );
  data.set('destruction-racer.story.v1', JSON.stringify({
    [track.id]: {
      version: 1, rivalCompleted: true, bestRivalAward: 'gold', bestTakedowns: 3,
    },
  }));
  assert.equal(
    submitRivalResult(track, { place: 2, takedowns: 0 }).progress.bestRivalAward,
    'platinum',
  );
});

test('campaign completion requires a Rival Race victory on every course', () => {
  globalThis.localStorage = storage();
  const tracks = [
    { id: 'story-a', storyVersion: 1 },
    { id: 'story-b', storyVersion: 1 },
  ];
  submitRivalResult(tracks[0], { place: 1, time: 60 });
  submitRivalResult(tracks[1], { place: 2, time: 70 });
  assert.equal(isStoryCampaignComplete(tracks), false);
  submitRivalResult(tracks[1], { place: 1, time: 65 });
  assert.equal(isStoryCampaignComplete(tracks), true);
});

test('Flight School mastery requires a full-clear Platinum on every Story race', () => {
  globalThis.localStorage = storage();
  const tracks = [
    { id: 'story-a', storyVersion: 1, rivals: { count: 3 } },
    { id: 'story-b', storyVersion: 1, rivals: { count: 3 } },
    { id: 'story-c', storyVersion: 1, rivals: { count: 3 } },
  ];
  tracks.forEach((track) => submitRivalResult(track, {
    place: 1, time: 60, takedowns: track.id === 'story-c' ? 2 : 3,
  }));
  assert.equal(isStoryCampaignComplete(tracks), true, 'three wins complete Story');
  assert.equal(isStoryCampaignPlatinum(tracks), false, 'a Gold race keeps Flight locked');
  submitRivalResult(tracks[2], { place: 1, time: 61, takedowns: 3 });
  assert.equal(isStoryCampaignPlatinum(tracks), true);
});
