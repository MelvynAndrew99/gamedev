// ObjectivePresentation.js — shared, testable HUD language for every course.
// ObjectiveState owns progress; this module turns one immutable view into the
// exact row players see. Keeping the contract out of Phaser lets tests verify
// all authored training tracks, including rows revealed after progress occurs.

export const OBJECTIVE_ROW_COLORS = Object.freeze({
  incomplete: '#ffffff',
  complete: '#2ee56b',
});

// The game renders into a fixed 800x600 canvas. Training lessons that do not
// own a live coach may use this narrow left column; Story and Air School do
// not instantiate it. Trophy tiers deliberately belong to paused briefing and
// results presentation.
export const OBJECTIVE_HUD_LAYOUT = Object.freeze({
  x: 10,
  y: 68,
  width: 230,
  headerHeight: 31,
  rowGap: 22,
});

export function objectivePanelLayout(objectiveCount = 0) {
  const count = Math.max(0, Math.floor(Number.isFinite(objectiveCount)
    ? objectiveCount
    : 0));
  return {
    ...OBJECTIVE_HUD_LAYOUT,
    height: OBJECTIVE_HUD_LAYOUT.headerHeight + count * OBJECTIVE_HUD_LAYOUT.rowGap,
  };
}

export function objectiveRowView(objective = {}) {
  const complete = objective.complete === true;
  const progress = objective.total > 1
    ? `  ${objective.progressLabel}/${objective.totalLabel}`
    : '';

  return {
    id: objective.id,
    complete,
    text: `${complete ? '✓' : '○'}  ${objective.hudLabel ?? objective.label ?? ''}${progress}`,
    color: complete
      ? OBJECTIVE_ROW_COLORS.complete
      : OBJECTIVE_ROW_COLORS.incomplete,
  };
}
