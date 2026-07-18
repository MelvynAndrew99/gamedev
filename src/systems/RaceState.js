// RaceState.js — lap counting, race timer, finish detection. Pure logic,
// no Phaser. The scene asks "what happened this frame?" and gets an event
// string back (or null); presentation decisions stay in the scene.

export class RaceState {
  constructor(model, laps) {
    this.model = model;
    this.laps = laps;
    this.lap = 1;
    this.time = 0;
    this.finished = false;
    this.prevPos = 0;
  }

  // Returns 'lap' | 'finished' | null.
  update(dt, player) {
    if (this.finished) return null;
    this.time += dt;

    // Wrap detection: Player.update wraps position past trackLength, so a
    // lap shows up as position suddenly dropping by roughly a whole track.
    // "More than half the track backwards in one frame" can't be driving.
    if (player.position < this.prevPos - this.model.trackLength / 2) {
      this.lap++;
      this.prevPos = player.position;
      if (this.lap > this.laps) {
        this.finished = true;
        return 'finished';
      }
      return 'lap';
    }
    this.prevPos = player.position;
    return null;
  }
}

// 83.456 -> "1:23.4"
export function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}