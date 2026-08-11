// TimedElimination.js — pure event clock for Rival School.
//
// Laps and one-shot cones extend the attempt; defeating the complete pack ends
// it immediately. The clock is deliberately independent of Phaser and
// RaceState so pausing for a briefing/result can never silently spend time.

export class TimedElimination {
  constructor(config = {}, rivalIds = []) {
    this.initialSeconds = positive(config.initialSeconds, 55);
    this.maximumSeconds = Math.max(
      this.initialSeconds,
      positive(config.maximumSeconds, 75),
    );
    this.lapBonusSeconds = positive(config.lapBonusSeconds, 20);
    this.coneBonusSeconds = positive(config.coneBonusSeconds, 3);
    this.remainingSeconds = this.initialSeconds;
    this.elapsedSeconds = 0;
    this.rivalIds = [...new Set(rivalIds.map(String))];
    this.eliminatedIds = new Set();
    this.totalTimeAdded = 0;
    this.expired = false;
    this.complete = this.rivalIds.length === 0;
  }

  update(dt, running = true) {
    if (!running || this.expired || this.complete) return null;
    // Spend only clock time that actually remained. This keeps expiry and
    // Gold timing identical at 30/60/120Hz instead of overshooting by one
    // render frame when floating-point residue survives at zero.
    const spent = Math.min(this.remainingSeconds, Math.max(0, dt));
    this.elapsedSeconds += spent;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - spent);
    if (this.remainingSeconds > 1e-9) return null;
    this.remainingSeconds = 0;
    this.expired = true;
    return 'expired';
  }

  addTime(seconds, reason = 'bonus') {
    if (this.expired || this.complete) return { reason, awarded: 0 };
    const before = this.remainingSeconds;
    this.remainingSeconds = Math.min(
      this.maximumSeconds,
      before + Math.max(0, Number(seconds) || 0),
    );
    const awarded = this.remainingSeconds - before;
    this.totalTimeAdded += awarded;
    return { reason, awarded };
  }

  addLapBonus() {
    return this.addTime(this.lapBonusSeconds, 'lap');
  }

  addConeBonus() {
    return this.addTime(this.coneBonusSeconds, 'cone');
  }

  eliminate(rivalId) {
    const id = String(rivalId);
    if (this.expired || this.complete || !this.rivalIds.includes(id) ||
        this.eliminatedIds.has(id)) return false;
    this.eliminatedIds.add(id);
    this.complete = this.eliminatedIds.size >= this.rivalIds.length;
    return true;
  }

  get carsRemaining() {
    return Math.max(0, this.rivalIds.length - this.eliminatedIds.size);
  }

  get view() {
    return {
      timeRemainingSeconds: this.remainingSeconds,
      elapsedSeconds: this.elapsedSeconds,
      carsRemaining: this.carsRemaining,
      startingCars: this.rivalIds.length,
      totalTimeAdded: this.totalTimeAdded,
      expired: this.expired,
      complete: this.complete,
    };
  }
}

function positive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
