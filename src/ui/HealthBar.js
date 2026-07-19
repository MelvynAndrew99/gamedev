// HealthBar.js — the car's condition, always visible. Color communicates
// state faster than the number: green you ignore, yellow you notice,
// red you *feel*. (Legibility rule: the player should never have to read
// the HUD to know they're in trouble.)

export class HealthBar {
  constructor(scene, x, y, w = 180, h = 14) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.g = scene.add.graphics().setDepth(20);
  }

  draw(frac) {
    const g = this.g;
    g.clear();
    // frame
    g.fillStyle(0x0a0a14, 0.8);
    g.fillRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
    // fill
    const color = frac > 0.5 ? 0x2ee56b : frac > 0.25 ? 0xffcf3f : 0xff2d55;
    g.fillStyle(color, 1);
    g.fillRect(this.x, this.y, Math.max(0, this.w * frac), this.h);
    // neon trim, on brand
    g.lineStyle(1, 0x00e5ff, 0.7);
    g.strokeRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
  }
}