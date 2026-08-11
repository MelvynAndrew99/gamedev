// TimedScoreAttack.js — generation-safe Rival School score clock.
//
// The base clock and any authored clock-cone bonuses are anchored to
// RivalPack's fixed 60Hz simulation time so the last legal takedown is
// identical at 30/60/120Hz. Stable sprite slots may respawn, but each
// (id,generation) can award exactly one point.

export class TimedScoreAttack {
  constructor(config = {}) {
    this.durationSeconds = positive(config.durationSeconds, 35);
    this.maximumBonusSeconds = nonNegative(config.maximumBonusSeconds, 0);
    this.bonusSeconds = 0;
    this.remainingSeconds = this.durationSeconds;
    this.elapsedSeconds = 0;
    this.takedowns = 0;
    this.started = false;
    this.expired = false;
    this.startSimulationTime = null;
    this.scoredGenerations = new Set();
  }

  start(simulationTime = 0) {
    if (this.started) return false;
    this.started = true;
    this.startSimulationTime = finite(simulationTime, 0);
    return true;
  }

  update(simulationTime, running = true) {
    if (!running || !this.started || this.expired) return null;
    const elapsed = Math.max(
      0,
      finite(simulationTime, this.startSimulationTime) - this.startSimulationTime,
    );
    this.elapsedSeconds = Math.min(this.totalDurationSeconds, elapsed);
    this.remainingSeconds = Math.max(0, this.totalDurationSeconds - this.elapsedSeconds);
    if (this.remainingSeconds > 1e-9) return null;
    this.remainingSeconds = 0;
    this.elapsedSeconds = this.totalDurationSeconds;
    this.expired = true;
    return 'expired';
  }

  canScoreAt(simulationTime) {
    if (!this.started || this.expired) return false;
    return finite(simulationTime, Infinity) <=
      this.startSimulationTime + this.totalDurationSeconds + 1e-9;
  }

  addTime(seconds, simulationTime) {
    if (!this.started || this.expired) return { reason: 'cone', awarded: 0 };
    const now = finite(simulationTime, this.startSimulationTime + this.elapsedSeconds);
    if (!this.canScoreAt(now)) return { reason: 'cone', awarded: 0 };

    // Bring the public clock up to the fixed simulation timestamp before
    // extending its deadline. This prevents a low-refresh frame from showing
    // more time than it actually earned.
    const elapsed = Math.max(0, now - this.startSimulationTime);
    this.elapsedSeconds = Math.min(this.totalDurationSeconds, elapsed);
    const room = Math.max(0, this.maximumBonusSeconds - this.bonusSeconds);
    const awarded = Math.min(room, Math.max(0, Number(seconds) || 0));
    this.bonusSeconds += awarded;
    this.remainingSeconds = Math.max(0, this.totalDurationSeconds - this.elapsedSeconds);
    return { reason: 'cone', awarded };
  }

  recordTakedown(rivalId, generation, simulationTime) {
    if (!this.canScoreAt(simulationTime)) return false;
    const key = `${String(rivalId)}:${Math.max(1, Math.floor(finite(generation, 1)))}`;
    if (this.scoredGenerations.has(key)) return false;
    this.scoredGenerations.add(key);
    this.takedowns += 1;
    return true;
  }

  get view() {
    return Object.freeze({
      scoreAttack: true,
      durationSeconds: this.durationSeconds,
      totalDurationSeconds: this.totalDurationSeconds,
      bonusSeconds: this.bonusSeconds,
      totalTimeAdded: this.bonusSeconds,
      timeRemainingSeconds: this.remainingSeconds,
      elapsedSeconds: this.elapsedSeconds,
      takedowns: this.takedowns,
      started: this.started,
      expired: this.expired,
    });
  }

  get totalDurationSeconds() {
    return this.durationSeconds + this.bonusSeconds;
  }
}

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
