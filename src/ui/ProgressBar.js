// ProgressBar.js — the race banner: a horizontal ribbon across the top that
// reads left-to-right as START ▸ laps ▸ FINISH, so the player can SEE the
// length of the track and where they are in it. Not a minimap — position in a
// race is one number (distance done / distance total), so it gets one
// dimension of UI. Checkered flags bookend the ribbon, magenta ticks split it
// into laps (numbered), a rumble-strip edge echoes the road's stripes, and a
// car chevron rides the fill.
//
// Static furniture (flags, labels, rail, lap numbers) is built ONCE in the
// constructor; draw(frac) only repaints the moving parts (fill + marker) each
// frame. Same interface as before: new ProgressBar(scene, laps, y); .draw(0..1).

const CYAN = 0x00e5ff;
const MAGENTA = 0xff2d95;
const DARK = 0x0a0a14;
const RAIL = 0x3a3a46;
const WHITE = 0xffffff;
const DIM = 0xb8b8c8;

export function progressMarkerPoint({ x, width }, fraction) {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  return x + width * f;
}

export class ProgressBar {
  constructor(scene, laps, y = 30, { lapNumbers = true } = {}) {
    this.laps = Math.max(1, laps);
    this.lapNumbers = lapNumbers;
    // This is the circuit's sole persistent position/lap read. Corner space
    // remains available for truly mode-specific feedback, not duplicate lap
    // counters or a second health system.
    this.w = scene.scale.width * 0.42;
    this.x = (scene.scale.width - this.w) / 2;
    this.y = y; // centerline of the ribbon
    this.h = 8; // ribbon thickness

    this.gStatic = scene.add.graphics().setDepth(20);
    this.g = scene.add.graphics().setDepth(21); // moving parts on top

    this.buildStatic(scene);
  }

  // Everything that never changes during a race.
  buildStatic(scene) {
    const g = this.gStatic;
    const { x, y, w, h } = this;
    const top = y - h / 2;

    // Backing chip, matching the HUD's translucent-corner language.
    g.fillStyle(DARK, 0.6);
    g.fillRoundedRect(x - 20, y - 22, w + 40, 44, 8);
    g.lineStyle(1, CYAN, 0.35);
    g.strokeRoundedRect(x - 20, y - 22, w + 40, 44, 8);

    // The rail the fill runs in.
    g.fillStyle(DARK, 0.7);
    g.fillRect(x - 2, top - 2, w + 4, h + 4);
    g.fillStyle(RAIL, 1);
    g.fillRect(x, top, w, h);

    // Rumble-strip dashes under the rail — the road's own stripe cadence,
    // alternating magenta/cyan, so the banner reads as a length of track.
    const dashW = 10;
    for (let i = 0, dx = x; dx < x + w; i++, dx += dashW) {
      g.fillStyle(i % 2 === 0 ? MAGENTA : CYAN, 0.9);
      g.fillRect(dx, top + h + 1, Math.min(dashW, x + w - dx), 2);
    }

    // Lap dividers (magenta ticks) + centered lap numbers.
    for (let l = 0; l < this.laps; l++) {
      if (l > 0) {
        g.fillStyle(MAGENTA, 1);
        g.fillRect(x + (w * l) / this.laps - 1, top - 4, 2, h + 8);
      }
      if (this.lapNumbers) {
        const cx = x + (w * (l + 0.5)) / this.laps;
        scene.add
          .text(cx, y - 20, `${l + 1}`, { fontSize: '11px', fontStyle: 'bold', color: '#00e5ff' })
          .setOrigin(0.5, 0)
          .setDepth(21);
      }
    }

    // Bookend checkered flags.
    this.drawFlag(g, x, y, +1); // START: cloth waves right, into the track
    this.drawFlag(g, x + w, y, -1); // FINISH: cloth waves left, back over it

    scene.add
      .text(x, y + 12, 'START', { fontSize: '9px', fontStyle: 'bold', color: '#b8b8c8' })
      .setOrigin(0.5, 0)
      .setDepth(21);
    scene.add
      .text(x + w, y + 12, 'FINISH', { fontSize: '9px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setDepth(21);
  }

  // A little checkered flag on a pole, planted at (px, centerY). dir=+1 waves
  // the cloth to the right, dir=-1 to the left.
  drawFlag(g, px, centerY, dir) {
    const cell = 4;
    const cols = 3;
    const rows = 3;
    const clothH = cell * rows;
    const poleTop = centerY - 20;
    const poleH = 22;

    // pole
    g.fillStyle(DIM, 1);
    g.fillRect(px - 1, poleTop, 2, poleH);
    g.fillStyle(WHITE, 1);
    g.fillRect(px - 1, poleTop - 1, 2, 2); // finial

    // checkered cloth, hung from the top of the pole
    const startX = dir > 0 ? px + 1 : px - 1 - cols * cell;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle((r + c) % 2 === 0 ? WHITE : DARK, 1);
        g.fillRect(startX + c * cell, poleTop + r * cell, cell, cell);
      }
    }
    // outline so it reads over any road color
    g.lineStyle(1, CYAN, 0.6);
    g.strokeRect(startX, poleTop, cols * cell, clothH);
  }

  // frac: 0..1 across the whole race (all laps).
  draw(frac, markers = []) {
    const g = this.g;
    const { x, y, w, h } = this;
    const top = y - h / 2;
    const f = Math.min(1, Math.max(0, frac));

    g.clear();

    // filled progress
    g.fillStyle(CYAN, 1);
    g.fillRect(x, top, w * f, h);

    // Rival School reuses this course authority instead of adding a minimap.
    // A dark outline preserves all three identity colors against both the
    // filled and unfilled halves of the rail; shape remains readable without
    // relying on color alone.
    for (const marker of markers) {
      const rx = progressMarkerPoint({ x, width: w }, marker.fraction);
      const ry = y;
      g.lineStyle(2, DARK, 1);
      g.fillStyle(marker.color ?? WHITE, 1);
      if (marker.shape === 'diamond') {
        g.fillTriangle(rx, ry - 5, rx - 5, ry, rx, ry + 5);
        g.fillTriangle(rx, ry - 5, rx + 5, ry, rx, ry + 5);
        g.strokeTriangle(rx, ry - 5, rx - 5, ry, rx, ry + 5);
        g.strokeTriangle(rx, ry - 5, rx + 5, ry, rx, ry + 5);
      } else if (marker.shape === 'square') {
        g.fillRect(rx - 4, ry - 4, 8, 8);
        g.strokeRect(rx - 4, ry - 4, 8, 8);
      } else {
        g.fillCircle(rx, ry, 4);
        g.strokeCircle(rx, ry, 4);
      }
    }

    // marker: a car chevron riding the front of the fill
    const mx = x + w * f;
    g.fillStyle(WHITE, 1);
    g.fillTriangle(mx, top - 3, mx - 6, top - 12, mx + 6, top - 12);
    g.fillStyle(CYAN, 1);
    g.fillTriangle(mx, top - 5, mx - 4, top - 11, mx + 4, top - 11);
  }
}
