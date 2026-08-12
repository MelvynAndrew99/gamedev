export class QualifierClock {
  constructor(targetSeconds) {
    this.targetSeconds = Math.max(0.1, Number(targetSeconds) || 0.1);
    this.elapsedSeconds = 0;
    this.started = false;
    this.expired = false;
  }

  start() {
    if (this.started) return false;
    this.started = true;
    return true;
  }

  update(dt, running = true) {
    if (!running || !this.started || this.expired) return null;
    this.elapsedSeconds = Math.min(
      this.targetSeconds,
      this.elapsedSeconds + Math.max(0, Number(dt) || 0),
    );
    if (this.elapsedSeconds + 1e-9 < this.targetSeconds) return null;
    this.expired = true;
    return 'expired';
  }

  get remainingSeconds() {
    return Math.max(0, this.targetSeconds - this.elapsedSeconds);
  }
}

export function objectivesForStoryPhase(objectives = [], phase = 'qualifier', laps = 1) {
  const visible = phase === 'qualifier'
    ? objectives.filter((objective) => (
      objective.event !== 'rival_takedown' && objective.event !== 'rival_hit'
    ))
    : objectives;
  return visible.map((objective) => (
    objective.type === 'complete_laps'
      ? { ...objective, value: Math.max(1, Math.floor(Number(laps) || 1)) }
      : objective
  ));
}

export function remainingStoryOpponents(total = 3, takedowns = 0) {
  const field = Math.max(0, Math.floor(Number(total) || 0));
  const removed = Math.max(0, Math.floor(Number(takedowns) || 0));
  return Math.max(0, field - removed);
}

export class RivalRaceOrder {
  constructor({ trackLength, laps = 1, rivals = [] } = {}) {
    this.trackLength = Math.max(1, Number(trackLength) || 1);
    this.laps = Math.max(1, Math.floor(Number(laps) || 1));
    this.state = new Map(rivals.map((rival) => [String(rival.id), {
      previousPosition: Number(rival.position) || 0,
      completedLaps: 0,
      finished: false,
    }]));
    this.finishOrder = [];
    this.latestCrossings = [];
    this.finishCountBeforeLatestUpdate = 0;
  }

  update(rivals = []) {
    this.finishCountBeforeLatestUpdate = this.finishOrder.length;
    const crossings = [];
    for (const rival of rivals) {
      const id = String(rival.id);
      const state = this.state.get(id);
      if (!state || state.finished || rival.eliminated || rival.state === 'wrecked') continue;
      const position = Number(rival.position) || 0;
      if (position < state.previousPosition - this.trackLength / 2) {
        const distanceToLine = this.trackLength - state.previousPosition;
        const frameTravel = distanceToLine + position;
        state.completedLaps += 1;
        if (state.completedLaps >= this.laps) {
          state.finished = true;
          crossings.push({
            id,
            // Both positions are sampled at the render boundary. Interpolate
            // the wrap within that interval so simultaneous-frame finishers
            // are ordered by when they reached the line, not JSON array order.
            fraction: frameTravel > 0 ? distanceToLine / frameTravel : 1,
          });
        }
      }
      state.previousPosition = position;
    }
    crossings.sort((a, b) => a.fraction - b.fraction || a.id.localeCompare(b.id));
    this.latestCrossings = crossings;
    const newlyFinished = crossings.map(({ id }) => id);
    this.finishOrder.push(...newlyFinished);
    return newlyFinished;
  }

  playerPlace(crossingFraction = Infinity) {
    const fraction = Number.isFinite(crossingFraction) ? crossingFraction : Infinity;
    const sameFrameAhead = this.latestCrossings.filter(
      (crossing) => crossing.fraction <= fraction,
    ).length;
    return this.finishCountBeforeLatestUpdate + sameFrameAhead + 1;
  }

  livePlace(playerPosition, playerCompletedLaps, rivals = [], playerStarted = true) {
    const playerProgress = playerCompletedLaps * this.trackLength + playerPosition -
      (playerStarted ? 0 : this.trackLength);
    let ahead = this.finishOrder.length;
    for (const rival of rivals) {
      const id = String(rival.id);
      const state = this.state.get(id);
      if (!state || state.finished || rival.eliminated || rival.state === 'wrecked') continue;
      const progress = state.completedLaps * this.trackLength + (Number(rival.position) || 0);
      if (progress > playerProgress) ahead += 1;
    }
    return ahead + 1;
  }
}
