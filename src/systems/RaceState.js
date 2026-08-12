// RaceState.js — lap counting, race timer, finish detection. Pure logic,
// no Phaser. The scene asks "what happened this frame?" and gets an event
// string back (or null); presentation decisions stay in the scene.

export class RaceState {
  constructor(model, laps, options = {}) {
    this.model = model;
    this.laps = laps;
    this.finishOnLapLimit = options.finishOnLapLimit ?? true;
    this.lap = 1;
    this.time = 0;
    this.finished = false;
    this.finishArmed = false;
    this.completedLaps = 0;
    this.prevPos = 0;
    this.lastCrossingFraction = null;
    // The grid sits BEHIND the start/finish line (see TUNING.gridSetback), so
    // the very first crossing of the line is the START of lap 1, not a lap
    // completed. Every crossing after it counts.
    this.crossedStart = false;
  }

  // Returns 'start' | 'lap' | 'finished' | null.
  update(dt, player) {
    if (this.finished) return null;
    this.time += dt;

    // Wrap detection: Player.update wraps position past trackLength, so a line
    // crossing shows up as position suddenly dropping by roughly a whole track.
    // "More than half the track backwards in one frame" can't be driving.
    if (player.position < this.prevPos - this.model.trackLength / 2) {
      const distanceToLine = this.model.trackLength - this.prevPos;
      const frameTravel = distanceToLine + player.position;
      this.lastCrossingFraction = frameTravel > 0
        ? distanceToLine / frameTravel
        : 1;
      this.prevPos = player.position;
      if (!this.crossedStart) {
        this.crossedStart = true; // rolling start: this crossing begins the race
        return 'start';
      }
      this.completedLaps++;
      this.lap++;
      if (this.finishArmed || (this.finishOnLapLimit && this.lap > this.laps)) {
        this.finished = true;
        return 'finished';
      }
      return 'lap';
    }
    this.prevPos = player.position;
    return null;
  }

  finish() {
    this.finished = true;
  }

  armFinish() {
    this.finishArmed = true;
  }
}

// 83.456 -> "1:23.4"
export function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
