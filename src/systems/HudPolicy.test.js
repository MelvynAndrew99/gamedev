import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HUD_SAFE_LAYOUT, hudVisibilityPolicy, rectsOverlap } from './HudPolicy.js';

test('race modes have one progress authority and never expose a health bar', () => {
  for (const mode of ['training', 'story']) {
    const view = hudVisibilityPolicy({ mode, hasRace: true, hasObjectives: true });
    assert.equal(view.courseProgress, true);
    assert.equal(view.lapChip, false);
    assert.equal(view.healthBar, false);
    assert.equal(Number(view.courseProgress) + Number(view.lapChip), 1);
  }
});

test('Story removes persistent objectives while retaining transient confirmation', () => {
  const view = hudVisibilityPolicy({
    mode: 'story', hasRace: true, hasObjectives: true, hasBoostCapability: true,
  });
  assert.equal(view.objectiveRows, false);
  assert.equal(view.objectiveToast, true);
  assert.equal(view.boostGauge, true);
  assert.equal(view.endlessDistance, false);
  assert.equal(view.storyEventHud, true);
  assert.equal(view.storyRivalMarkers, true);
  assert.equal(view.styleRewards, true);
});

test('Air School has one teaching voice instead of coach plus checklist', () => {
  const view = hudVisibilityPolicy({
    mode: 'training', hasRace: true, hasObjectives: true,
    trackId: 'training-airtime', hasBoostCapability: true,
  });
  assert.equal(view.airtimeCoach, true);
  assert.equal(view.objectiveRows, false);
  assert.equal(view.objectiveToast, true);
});

test('Flight School reuses the airtime teaching voice for its sequel preview', () => {
  const view = hudVisibilityPolicy({
    mode: 'training', hasRace: true, hasObjectives: true,
    trackId: 'training-flight', hasBoostCapability: true,
  });
  assert.equal(view.airtimeCoach, true);
  assert.equal(view.objectiveRows, false);
  assert.equal(view.objectiveToast, true);
});

test('other training lessons retain compact checkable rows', () => {
  const view = hudVisibilityPolicy({
    mode: 'training', hasRace: true, hasObjectives: true,
    trackId: 'training-loop', trainingDamageMax: 4,
  });
  assert.equal(view.objectiveRows, true);
  assert.equal(view.objectiveToast, false);
  assert.equal(view.windshieldDamage, true);
});

test('Rival School replaces checklist with timed-event reads and confirmations', () => {
  const view = hudVisibilityPolicy({
    mode: 'training', hasRace: true, hasObjectives: true,
    trackId: 'training-rivals', hasBoostCapability: true,
  });
  assert.equal(view.objectiveRows, false);
  assert.equal(view.objectiveToast, false);
  assert.equal(view.rivalToast, true);
  assert.equal(view.rivalEventHud, true);
  assert.equal(view.rivalCourseMarkers, true);
  assert.equal(view.airtimeCoach, false);
});

test('Endless is distance, speed, boost, and glass only', () => {
  const view = hudVisibilityPolicy({
    mode: 'endless', hasBoostCapability: true,
  });
  assert.deepEqual(
    {
      progress: view.courseProgress,
      distance: view.endlessDistance,
      rows: view.objectiveRows,
      mission: view.endlessMission,
      health: view.healthBar,
      boost: view.boostGauge,
      glass: view.windshieldDamage,
    },
    {
      progress: false,
      distance: true,
      rows: false,
      mission: false,
      health: false,
      boost: true,
      glass: true,
    },
  );
});

test('persistent corner instruments stay outside the player and road corridor', () => {
  const leftTeaching = { ...HUD_SAFE_LAYOUT.leftColumn, height: 100 };
  assert.equal(rectsOverlap(leftTeaching, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.speed, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.eventTimer, HUD_SAFE_LAYOUT.courseRibbon), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.carsRemaining, HUD_SAFE_LAYOUT.courseRibbon), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.eventTimer, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.carsRemaining, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.objectiveToast, HUD_SAFE_LAYOUT.rivalToast), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.objectiveToast, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.rivalToast, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.equal(rectsOverlap(HUD_SAFE_LAYOUT.styleReward, HUD_SAFE_LAYOUT.roadCorridor), false);
  assert.ok(
    HUD_SAFE_LAYOUT.courseRibbon.y + HUD_SAFE_LAYOUT.courseRibbon.height <= 54,
  );
});

test('HudScene cannot regress to duplicate lap text or a constructed health bar', () => {
  const source = readFileSync(new URL('../scenes/HudScene.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /HealthBar/);
  assert.doesNotMatch(source, /`LAP \$\{/);
  assert.doesNotMatch(source, /RUN OBJECTIVE|DRIVE AS FAR AS YOU CAN/);
  assert.doesNotMatch(source, /STYLE LINE|CRASH BREAKS THE LINE/);
  assert.doesNotMatch(source, /styleRewardPanel/);
});
