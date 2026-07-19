// ProgressBar.js — Snowboard Kids-style race progress: a horizontal bar
// across the top, divided into laps, with a marker sliding through it.
// No minimap: position-in-race is one number (segments done / segments
// total), so it gets one dimension of UI. The lap ticks turn "how far?"
// into "which lap, how deep" at a glance without reading anything.

export class ProgressBar {
  constructor(scene, laps) {
    this.laps = laps;
    this.w = scene.scale.width * 0.5;
    this.x = (scene.scale.width - this.w) / 2;
    this.y = 14;
    this.g = scene.add.graphics().setDepth(20);
  }

  // frac: 0..1 across the whole race (all laps).
  draw(frac) {
    const g = this.g;
    g.clear();
    // rail
    g.fillStyle(0x0a0a14, 0.7);
    g.fillRect(this.x - 2, this.y - 2, this.w + 4, 10);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(this.x, this.y, this.w, 6);
    // filled progress
    g.fillStyle(0x00e5ff, 1);
    g.fillRect(this.x, this.y, this.w * Math.min(1, Math.max(0, frac)), 6);
    // lap ticks
    g.fillStyle(0xff2d95, 1);
    for (let l = 1; l < this.laps; l++) {
      g.fillRect(this.x + (this.w * l) / this.laps - 1, this.y - 3, 2, 12);
    }
    // marker: a little diamond riding the bar
    const mx = this.x + this.w * Math.min(1, Math.max(0, frac));
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(mx, this.y - 6, mx - 5, this.y - 12, mx + 5, this.y - 12);
  }
}