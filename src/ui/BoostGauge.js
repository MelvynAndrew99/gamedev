// BoostGauge.js — the boost bank and its active burn, same chip/frame/neon
// convention as the course ribbon and speed chip. Three discrete cells show banked
// slots (green); a thin afterburner strip beneath fills with however far
// above the normal overspeed cap the LIVE ceiling currently sits, relative
// to the top tier. That strip IS the "gauge wears off" readout — it shrinks
// smoothly as Boost.js eases the ceiling back down, so no separate timer
// number is needed. Color rides the active tier (green/cyan/gold), never a
// boost-count label — the medal is read by speed, not by counting pickups.

const CELL_GAP = 4;

export class BoostGauge {
  constructor(scene, x, y, w = 108, h = 14, cells = 3) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.cells = cells;
    this.g = scene.add.graphics().setDepth(20);
  }

  draw({ slots, tier, ceilingMultiplier, overspeedCap, maxCeiling }) {
    const g = this.g;
    g.clear();
    const cellW = (this.w - CELL_GAP * (this.cells - 1)) / this.cells;

    for (let i = 0; i < this.cells; i++) {
      const cx = this.x + i * (cellW + CELL_GAP);
      g.fillStyle(0x0a0a14, 0.85);
      g.fillRect(cx - 2, this.y - 2, cellW + 4, this.h + 4);
      g.fillStyle(i < slots ? 0x2ee56b : 0x1a2233, 1);
      g.fillRect(cx, this.y, cellW, this.h);
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.strokeRect(cx - 2, this.y - 2, cellW + 4, this.h + 4);
    }

    const frac = Math.max(0, Math.min(
      1,
      (ceilingMultiplier - overspeedCap) / (maxCeiling - overspeedCap),
    ));
    if (frac > 0.001) {
      const color = tier >= 3 ? 0xffcf3f : tier >= 2 ? 0x00e5ff : 0x2ee56b;
      const stripY = this.y + this.h + 5;
      g.fillStyle(0x0a0a14, 0.7);
      g.fillRect(this.x - 2, stripY - 2, this.w + 4, 7);
      g.fillStyle(color, 1);
      g.fillRect(this.x, stripY, this.w * frac, 3);
    }
  }
}
