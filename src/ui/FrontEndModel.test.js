import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAINING_TRACKS } from '../tracks/index.js';

import {
  buildSchoolTiles,
  buildStoryCourseTiles,
  buildTrophySummary,
  carouselWindow,
  cycleStoryPage,
  cycleTrophyPage,
  moveGridSelection,
  modeMenuTarget,
  STORY_PHASES,
  STORY_PAGES,
  TROPHY_PAGES,
  schoolTileDescription,
  shouldResetFrontEndLaunch,
  trophyStatusLabel,
} from './FrontEndModel.js';

test('completed races return to their mode submenu and retain course focus', () => {
  assert.deepEqual(modeMenuTarget('training', 3), {
    view: 'school', selection: 3,
  });
  assert.deepEqual(modeMenuTarget('story', 2), {
    view: 'story', selection: 2, storyPhase: STORY_PHASES.QUALIFIER,
  });
  assert.deepEqual(modeMenuTarget('story', 2, STORY_PHASES.RIVALS), {
    view: 'story', selection: 2, storyPhase: STORY_PHASES.RIVALS,
  });
  assert.deepEqual(
    modeMenuTarget('story', 1, STORY_PHASES.RIVALS, STORY_PAGES.GARAGE),
    {
      view: 'story', selection: 1, storyPhase: STORY_PHASES.RIVALS,
      storyPage: STORY_PAGES.GARAGE,
    },
  );
  assert.deepEqual(modeMenuTarget('endless', 9), {
    view: 'main', selection: 0, menuOpen: true,
  });
});

test('Story course tiles keep one illustrated course card with two event states', () => {
  const [tile] = buildStoryCourseTiles(
    [{ id: 'one', name: 'ONE', qualifier: { targetSeconds: 60 } }],
    () => ({
      qualified: true,
      bestQualifierAward: 'silver',
      rivalCompleted: false,
      bestQualifierTime: 55,
      bestRivalPlace: 2,
      bestTakedowns: 1,
      bestRivalAward: 'gold',
    }),
  );
  assert.equal(tile.qualifier.locked, false);
  assert.equal(tile.qualifier.attempted, true);
  assert.equal(tile.qualifier.bestTime, 55);
  assert.equal(tile.qualifier.award, 'silver');
  assert.equal(tile.rivals.locked, false);
  assert.equal(tile.rivals.attempted, false);
  assert.equal(tile.rivals.bestPlace, 2);
  assert.equal(tile.rivals.bestTakedowns, 1);
  assert.equal(tile.rivals.award, 'gold');
});

test('Story cards migrate old full-clear Gold to Platinum', () => {
  const [tile] = buildStoryCourseTiles(
    [{ id: 'one', rivals: { count: 3 } }],
    () => ({
      qualified: true,
      rivalCompleted: true,
      bestRivalAward: 'gold',
      bestTakedowns: 3,
    }),
  );
  assert.equal(tile.rivals.award, 'platinum');
});

test('grid navigation follows the card layout and handles a short final row', () => {
  assert.equal(moveGridSelection(0, 4, 2, 'right'), 1);
  assert.equal(moveGridSelection(1, 4, 2, 'down'), 3);
  assert.equal(moveGridSelection(3, 4, 2, 'right'), 2);
  assert.equal(moveGridSelection(1, 5, 3, 'down'), 4);
  assert.equal(moveGridSelection(2, 5, 3, 'down'), 4);
  assert.equal(moveGridSelection(4, 5, 3, 'down'), 1);
});

test('L/R trophy navigation alternates between school and player records', () => {
  assert.equal(cycleTrophyPage(TROPHY_PAGES.SCHOOL, 'right'), TROPHY_PAGES.RECORDS);
  assert.equal(cycleTrophyPage(TROPHY_PAGES.RECORDS, 'right'), TROPHY_PAGES.SCHOOL);
  assert.equal(cycleTrophyPage(TROPHY_PAGES.RECORDS, 'left'), TROPHY_PAGES.SCHOOL);
});

test('L/R Story navigation alternates between courses and garage', () => {
  assert.equal(cycleStoryPage(STORY_PAGES.COURSES, 'right'), STORY_PAGES.GARAGE);
  assert.equal(cycleStoryPage(STORY_PAGES.GARAGE, 'right'), STORY_PAGES.COURSES);
  assert.equal(cycleStoryPage(STORY_PAGES.COURSES, 'left'), STORY_PAGES.GARAGE);
  assert.equal(cycleStoryPage(STORY_PAGES.GARAGE, 'left'), STORY_PAGES.COURSES);
});

test('title carousel keeps the selected destination centered and wraps both edges', () => {
  assert.deepEqual(carouselWindow(5, 0), [
    { offset: -2, index: 3 }, { offset: -1, index: 4 },
    { offset: 0, index: 0 }, { offset: 1, index: 1 },
    { offset: 2, index: 2 },
  ]);
  assert.deepEqual(carouselWindow(5, 4).map(({ index }) => index), [2, 3, 4, 0, 1]);
});

test('custom races return to the custom-track library', () => {
  assert.deepEqual(modeMenuTarget('custom', 4), {
    view: 'custom', selection: 0, menuOpen: true,
  });
});

test('garage continuation preserves repairs while fresh launches reset', () => {
  assert.equal(shouldResetFrontEndLaunch({ mode: 'story' }, false), true);
  assert.equal(shouldResetFrontEndLaunch({ mode: 'story' }, true), false);
  assert.equal(shouldResetFrontEndLaunch({ mode: 'training' }, true), true);
  assert.equal(shouldResetFrontEndLaunch({ mode: 'endless' }, true), true);
});

test('school view models preserve sequential locks and saved trophy results', () => {
  const tracks = [0, 1, 2].map((index) => ({
    id: `school-${index}`,
    name: `COURSE ${index + 1}`,
    intro: `Lesson ${index + 1}`,
    scoring: { thresholds: [{ rank: 'gold', stars: 3 }] },
  }));
  const saved = new Map([
    ['school-0', { completed: true, trophy: 'silver', stars: 2 }],
  ]);
  const tiles = buildSchoolTiles(tracks, 1, (track) => saved.get(track.id));

  assert.deepEqual(tiles.map(({ locked, completed, trophy }) => ({
    locked, completed, trophy,
  })), [
    { locked: false, completed: true, trophy: 'silver' },
    { locked: false, completed: false, trophy: null },
    { locked: true, completed: false, trophy: null },
  ]);
  assert.match(schoolTileDescription(tiles[2]), /COMPLETE COURSE 2/);
});

test('the sixth Flight School stays visible as SOON and cannot launch in the jam build', () => {
  const tracks = [
    { id: 'lesson-1', name: 'ONE' },
    {
      id: 'training-flight',
      name: 'FLIGHT SCHOOL',
      status: 'coming_soon',
      unlock: {
        type: 'story_platinum',
        lockedText: 'COMING SOON — FLIGHT SCHOOL IS A POST-JAM PREVIEW',
      },
    },
  ];
  const locked = buildSchoolTiles(tracks, 0, () => null, { storyPlatinum: false });
  assert.equal(locked[1].locked, true);
  assert.equal(
    schoolTileDescription(locked[1]),
    'COMING SOON — FLIGHT SCHOOL IS A POST-JAM PREVIEW',
  );
  assert.equal(locked[1].comingSoon, true);
  assert.equal(trophyStatusLabel(locked[1]), 'SOON');
  const unlocked = buildSchoolTiles(tracks, 0, () => null, { storyPlatinum: true });
  assert.equal(unlocked[1].locked, true, 'campaign mastery cannot enable a post-jam course');
  assert.equal(unlocked[1].maxStars, 0, 'unreleased trophies do not inflate jam totals');
});

test('actual Air School remains sequential while only Flight School uses Story mastery', () => {
  const tiles = buildSchoolTiles(
    TRAINING_TRACKS,
    3,
    () => null,
    { storyPlatinum: false },
  );
  assert.equal(tiles[3].id, 'training-airtime');
  assert.equal(tiles[3].locked, false);
  assert.equal(tiles[4].id, 'training-rivals');
  assert.equal(tiles[4].locked, true, 'Rival School still follows Air School');
  assert.equal(tiles[5].id, 'training-flight');
  assert.equal(tiles[5].locked, true);
  assert.equal(tiles[5].comingSoon, true);
  assert.match(tiles[5].lockReason, /COMING SOON/);
});

test('trophy summary counts authored stars and requires Gold in every course', () => {
  const summary = buildTrophySummary([
    { trophy: 'gold', stars: 3, maxStars: 3 },
    { trophy: 'silver', stars: 2, maxStars: 3 },
  ]);
  assert.deepEqual(summary, {
    stars: 5, maxStars: 6, allGold: false, drivingAllGold: false,
  });
  assert.equal(buildTrophySummary([
    { trophy: 'gold', stars: 3, maxStars: 3 },
    { trophy: 'gold', stars: 3, maxStars: 3 },
  ]).allGold, true);
});

test('five driving Golds unlock customization without requiring secret Flight School Gold', () => {
  const summary = buildTrophySummary([
    ...Array.from({ length: 5 }, () => ({
      trophy: 'gold', stars: 3, maxStars: 3, specialUnlock: false,
    })),
    { trophy: null, stars: 0, maxStars: 0, specialUnlock: true, comingSoon: true },
  ]);
  assert.equal(summary.drivingAllGold, true);
  assert.equal(summary.allGold, true);
  assert.equal(summary.maxStars, 15);
});

test('trophy presentation distinguishes a completed course from an unplayed course', () => {
  assert.equal(trophyStatusLabel({ completed: false, trophy: null }), 'UNEARNED');
  assert.equal(
    trophyStatusLabel({ completed: true, trophy: null }),
    'COMPLETE — NO TROPHY',
  );
  assert.equal(trophyStatusLabel({ completed: true, trophy: 'gold' }), 'GOLD');
});
