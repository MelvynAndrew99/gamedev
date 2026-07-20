// HudScene.js — the instrument panel, running PARALLEL to GameScene
// (scene.launch, not scene.start). Its own camera means it never shakes,
// zooms, or flashes with the world: the glass stays still while the road
// convulses. Pull-model: reads GameScene's public state every frame —
// one producer, one consumer, no event plumbing.
//
// Layout doctrine: corners, not a strip. Each instrument in its own
// translucent chip; center-top belongs to the progress bar alone.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { RACER } from '../systems/RacerState.js';
import { getScore } from '../systems/HighScores.js';
import { fmtTime } from '../systems/RaceState.js';
import { HealthBar } from '../ui/HealthBar.js';
import { ProgressBar } from '../ui/ProgressBar.js';

export class HudScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HudScene' });
  }

  create() {
    this.gs = this.scene.get('GameScene');
    this.cachedBest = getScore('endless'); // once — not a disk read per frame
    const w = this.scale.width;
    const h = this.scale.height;

    const chip = (x, y, cw, ch) => {
      const g = this.add.graphics();
      g.fillStyle(0x0a0a14, 0.6);
      g.fillRoundedRect(x, y, cw, ch, 8);
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.strokeRoundedRect(x, y, cw, ch, 8);
    };

    // Top-left: lap + time (story) / distance + best (endless).
    chip(10, 10, 172, 46);
    this.line1 = this.add.text(22, 15, '', { fontSize: '18px', fontStyle: 'bold', color: '#ffffff' });
    this.line2 = this.add.text(22, 36, '', { fontSize: '13px', color: '#b8b8c8' });

    // Top-center: race progress, alone in its lane.
    this.progressBar = this.gs.race ? new ProgressBar(this, this.gs.race.laps, 30) : null;

    // Top-right: hull.
    this.healthBar = new HealthBar(this, w - 196, 22);

    // Bottom-left: fame + combo.
    chip(10, h - 56, 196, 44);
    this.fameText = this.add.text(22, h - 50, '', { fontSize: '17px', fontStyle: 'bold', color: '#ffcf3f' });
    this.nitroText = this.add.text(22, h - 30, '', { fontSize: '14px', fontStyle: 'bold', color: '#2ee56b' });

    // Bottom-right: the speedo. Big number, small label — read at a glance.
    chip(w - 148, h - 68, 136, 56);
    this.speedText = this.add
      .text(w - 26, h - 60, '', { fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(1, 0);
    this.add
      .text(w - 26, h - 28, 'SPEED', { fontSize: '11px', color: '#00e5ff' })
      .setOrigin(1, 0);

    // Off-track flasher: its own element, impossible to miss, gone when moot.
    this.offTrack = this.add
      .text(w / 2, 66, 'OFF TRACK', { fontSize: '18px', fontStyle: 'bold', color: '#ff2d55', stroke: '#0a0a14', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false);
  }

  update(time) {
    const gs = this.gs;
    if (!gs || !gs.player) return;

    if (gs.race) {
      this.line1.setText(`LAP ${gs.race.lap}/${gs.race.laps}`);
      this.line2.setText(fmtTime(gs.race.time));
      const inLap = gs.player.position / gs.model.trackLength;
      this.progressBar.draw((gs.race.lap - 1 + inLap) / gs.race.laps);
    } else {
      this.line1.setText(`${gs.distanceM()}m`);
      this.line2.setText(this.cachedBest ? `BEST ${this.cachedBest}m` : '');
    }

    this.healthBar.draw(RACER.healthFrac);

    const combo = gs.pop.combo > 1 ? `  x${gs.pop.combo}` : '';
    this.fameText.setText(`FAME ${gs.pop.total}${combo}`);
    this.fameText.setColor(gs.pop.combo > 1 ? '#00e5ff' : '#ffcf3f');

    // Cyan speedo = you are past the engine's ceiling: gravity's money.
    this.speedText.setText(`${Math.round(gs.player.speed / 100)}`);
    this.nitroText.setText(gs.nitro > 0 ? '◆'.repeat(gs.nitro) + ` NITRO` : 'NITRO —');
    this.speedText.setColor(gs.player.speed > TUNING.maxSpeed ? '#00e5ff' : '#ffffff');

    const off = !gs.player.airborne && Math.abs(gs.player.x) > 1;
    this.offTrack.setVisible(off && Math.floor(time / 250) % 2 === 0);
  }
}