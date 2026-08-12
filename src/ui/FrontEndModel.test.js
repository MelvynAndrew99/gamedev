import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAINING_TRACKS } from '../tracks/index.js';

import {
  buildSchoolTiles,
  buildStoryCourseTiles,
  buildTrophySummary,
  cycleTrophyPage,
  moveGridSelection,
  modeMenuTarget,
  STORY_PHASES,
  TROPHY_PAGES,
  schoolTileDescription,
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
  assert.deepEqual(modeMenuTarget('endless', 9), {
    view: 'main', selection: 0,
  });
});

test('Story course tiles keep one illustrated course card with two event states', () => {
  const [tile] = buildStoryCourseTiles(
    [{ id: 'one', name: 'ONE', qualifier: { targetSeconds: 60 } }],
    () => ({
      qualified: true,
      rivalCompleted: false,
      bestQualifierTime: 55,
      bestRivalPlace: 2,
      bestTakedowns: 1,
      bestRivalAward: 'gold',
    }),
  );
  assert.equal(tile.qualifier.locked, false);
  assert.equal(tile.qualifier.bestTime, 55);
  assert.equal(tile.rivals.locked, false);
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

test('the sixth Flight School is visible but requires Platinum on every Rival Race', () => {
  const tracks = [
    { id: 'lesson-1', name: 'ONE' },
    {
      id: 'training-flight',
      name: 'FLIGHT SCHOOL',
      unlock: {
        type: 'story_platinum',
        lockedText: 'LOCKED — PLATINUM THE RIVAL RACES TO UNLOCK',
      },
    },
  ];
  const locked = buildSchoolTiles(tracks, 0, () => null, { storyPlatinum: false });
  assert.equal(locked[1].locked, true);
  assert.equal(
    schoolTileDescription(locked[1]),
    'LOCKED — PLATINUM THE RIVAL RACES TO UNLOCK',
  );
  assert.equal(trophyStatusLabel(locked[1]), 'LOCKED');
  const unlocked = buildSchoolTiles(tracks, 0, () => null, { storyPlatinum: true });
  assert.equal(unlocked[1].locked, false, 'campaign mastery is the complete unlock rule');
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
  assert.match(tiles[5].lockReason, /PLATINUM THE RIVAL RACES/);
});

test('trophy summary counts authored stars and requires Gold in every course', () => {
  const summary = buildTrophySummary([
    { trophy: 'gold', stars: 3, maxStars: 3 },
    { trophy: 'silver', stars: 2, maxStars: 3 },
  ]);
  assert.deepEqual(summary, { stars: 5, maxStars: 6, allGold: false });
  assert.equal(buildTrophySummary([
    { trophy: 'gold', stars: 3, maxStars: 3 },
    { trophy: 'gold', stars: 3, maxStars: 3 },
  ]).allGold, true);
});

test('trophy presentation distinguishes a completed course from an unplayed course', () => {
  assert.equal(trophyStatusLabel({ completed: false, trophy: null }), 'UNEARNED');
  assert.equal(
    trophyStatusLabel({ completed: true, trophy: null }),
    'COMPLETE — NO TROPHY',
  );
  assert.equal(trophyStatusLabel({ completed: true, trophy: 'gold' }), 'GOLD');
});
