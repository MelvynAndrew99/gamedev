// ObjectiveState.js — data-driven training/race goal progress. It knows
// nothing about Phaser or presentation: gameplay reports events, this class
// matches them to track-authored targets and returns a small progress result.

export class ObjectiveState {
  constructor(definitions = [], model) {
    const sprites = model?.segments.flatMap((segment) => segment.sprites) ?? [];
    this.objectives = definitions.map((definition) => {
      if (definition.type === 'hit_all') {
        const targets = sprites.filter(
          (sprite) => sprite.objectiveId === definition.id,
        );
        if (targets.length === 0) {
          throw new Error(`Objective ${definition.id} has no authored targets`);
        }
        if (targets.some((sprite) => sprite.key !== definition.target)) {
          throw new Error(`Objective ${definition.id} target kind does not match its objects`);
        }
        return {
          definition,
          event: 'object_hit',
          total: targets.length,
          targetIds: new Set(targets.map((sprite) => sprite.trackObjectId)),
          hitIds: new Set(),
          progress: 0,
        };
      }
      if (definition.type === 'count_event' || definition.type === 'complete_laps') {
        const total = Number(definition.value);
        if (!Number.isFinite(total) || total <= 0) {
          throw new Error(`Objective ${definition.id} needs a positive value`);
        }
        const event = definition.type === 'complete_laps'
          ? 'lap_complete'
          : definition.event;
        if (!event) throw new Error(`Objective ${definition.id} needs an event`);
        return { definition, event, total, progress: 0 };
      }
      throw new Error(`Unknown objective type: ${definition.type}`);
    });
  }

  record(event, payload = {}) {
    const changes = [];
    const newlyCompleted = [];
    for (const objective of this.objectives) {
      if (objective.event !== event || objective.progress >= objective.total) continue;
      const before = objective.progress;
      if (objective.definition.type === 'hit_all') {
        const sprite = payload.sprite;
        if (
          sprite?.objectiveId !== objective.definition.id ||
          !objective.targetIds.has(sprite.trackObjectId)
        ) continue;
        objective.hitIds.add(sprite.trackObjectId);
        objective.progress = objective.hitIds.size;
      } else {
        objective.progress = Math.min(
          objective.total,
          objective.progress + Math.max(0, payload.amount ?? 1),
        );
      }
      if (objective.progress === before) continue;
      const view = this.view(objective);
      changes.push(view);
      if (view.complete) newlyCompleted.push(view);
    }
    if (changes.length === 0) return null;
    return { changes, newlyCompleted, allComplete: this.complete };
  }

  get active() {
    return this.objectives.length > 0;
  }

  get complete() {
    return this.active && this.objectives.every(
      (objective) => objective.progress >= objective.total,
    );
  }

  get views() {
    return this.objectives.map((objective) => this.view(objective));
  }

  get primary() {
    const objective = this.objectives[0];
    return objective ? this.view(objective) : null;
  }

  get score() {
    return this.objectives.reduce(
      (score, objective) => score + this.earnedPoints(objective),
      0,
    );
  }

  get pointsAvailable() {
    return this.objectives.reduce(
      (points, objective) => points + this.maximumPoints(objective),
      0,
    );
  }

  get completedCount() {
    return this.objectives.filter(
      (objective) => objective.progress >= objective.total,
    ).length;
  }

  view(objective) {
    const display = objective.definition.display;
    return {
      id: objective.definition.id,
      label: objective.definition.label,
      hudLabel: objective.definition.hudLabel ?? objective.definition.label,
      progress: objective.progress,
      total: objective.total,
      points: this.maximumPoints(objective),
      earnedPoints: this.earnedPoints(objective),
      unitPoints: objective.definition.pointsPerUnit ?? null,
      display: display ?? null,
      progressLabel: formatObjectiveValue(objective.progress, display),
      totalLabel: formatObjectiveValue(objective.total, display),
      complete: objective.progress >= objective.total,
    };
  }

  // Most race objectives pay only on completion. Collection lessons can opt
  // into pointsPerUnit so every successful contact has value and a missed
  // target lowers the medal instead of zeroing the whole lesson.
  earnedPoints(objective) {
    const perUnit = objective.definition.pointsPerUnit;
    if (perUnit != null) return objective.progress * perUnit;
    return objective.progress >= objective.total
      ? objective.definition.points ?? 0
      : 0;
  }

  maximumPoints(objective) {
    const perUnit = objective.definition.pointsPerUnit;
    return perUnit != null
      ? objective.total * perUnit
      : objective.definition.points ?? 0;
  }
}

// Physics/scoring and presentation can use different units without teaching
// that implementation detail. Air School stores measured tenths as integers
// and consistently formats them as seconds in HUD, briefing, and result.
export function formatObjectiveValue(value, display = null) {
  const scale = Number.isFinite(display?.scale) ? display.scale : 1;
  const precision = Number.isInteger(display?.precision)
    ? Math.max(0, display.precision)
    : scale === 1 ? 0 : 1;
  const amount = Number.isFinite(value) ? value * scale : 0;
  return `${amount.toFixed(precision)}${display?.unit ?? ''}`;
}
