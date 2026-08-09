// HudPolicy.js — one authoritative answer for which instruments may exist
// while the player is driving. The 800x600 view cannot afford every system in
// every mode: permanent UI is reserved for decisions the player can act on
// now, while briefings/results own detail and world feedback owns events.

export const HUD_SAFE_LAYOUT = Object.freeze({
  courseRibbon: Object.freeze({ y: 8, height: 44 }),
  leftColumn: Object.freeze({ x: 10, y: 66, width: 230 }),
  roadCorridor: Object.freeze({ x: 250, y: 170, width: 300, height: 430 }),
  speed: Object.freeze({ x: 652, y: 532, width: 136, height: 56 }),
});

export function hudVisibilityPolicy({
  mode = 'story',
  hasRace = false,
  hasObjectives = false,
  trackId = '',
  hasBoostCapability = false,
  trainingDamageMax = 0,
} = {}) {
  const training = mode === 'training';
  const endless = mode === 'endless';
  const airSchool = training && trackId === 'training-airtime';

  return Object.freeze({
    // The numbered START→FINISH ribbon is the sole persistent lap/position
    // read. There is deliberately no second LAP x/y chip.
    courseProgress: hasRace,
    endlessDistance: endless,
    lapChip: false,
    healthBar: false,
    endlessMission: false,

    // Training may retain a small checklist until a lesson has a dedicated
    // live coach. Story relies on authored objects and brief edge feedback.
    objectiveRows: training && hasObjectives && !airSchool,
    objectiveToast: hasObjectives && (!training || airSchool),
    airtimeCoach: airSchool,

    boostGauge: hasBoostCapability,
    windshieldDamage: !training || trainingDamageMax > 0,
  });
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}
