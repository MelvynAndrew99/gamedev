// TitleScene.js — the front door, now a real menu: STORY / ENDLESS,
// arrow keys + ENTER. Shows the endless high score under its entry —
// score-chasing starts before the race does.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { getScore } from '../systems/HighScores.js';
import { RACER } from '../systems/RacerState.js';

const ITEMS = [
  { label: 'STORY MODE', data: { mode: 'story', trackIndex: 0 } },
  { label: 'ENDLESS MODE', data: { mode: 'endless' } },
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  // First scene in the boot order = the natural place to load shared assets.
  // (If the asset list grows past a handful, promote this to a PreloadScene
  // with a loading bar — same pattern as the HudScene deferral.)
  preload() {
    this.load.spritesheet('car', 'assets/car.png', {
      frameWidth: 48,
      frameHeight: 64,
    });
    this.load.image('cone', 'assets/cone.png');
    this.load.image('rock', 'assets/rock.png');
    this.load.image('post', 'assets/post.png');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const c = TUNING.colors;

    // Full-height sky gradient (the in-game one only fills to the horizon).
    const bands = c.skyBands;
    const bandH = h / bands.length;
    const g = this.add.graphics();
    bands.forEach((color, i) => {
      g.fillStyle(color, 1);
      g.fillRect(0, i * bandH, w, bandH + 1);
    });

    this.add
      .text(w / 2, 110, 'DESTRUCTION\nRACER', {
        fontSize: '56px',
        color: '#ff2d95',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#00e5ff',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // The machine, hovering. Frame 1 = straight.
    const car = this.add.sprite(w / 2, 290, 'car', 1).setScale(2.2);
    this.tweens.add({
      targets: car,
      y: '+=8',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Menu.
    this.selected = 0;
    this.menuTexts = ITEMS.map((item, i) =>
      this.add
        .text(w / 2, 400 + i * 52, item.label, {
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );

    // Endless best, sitting under its menu entry.
    const best = getScore('endless');
    this.add
      .text(w / 2, 400 + 1 * 52 + 24, best ? `BEST ${best}m` : '', {
        fontSize: '14px',
        color: '#00e5ff',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 560, '↑↓ SELECT   ENTER START', {
        fontSize: '16px',
        color: '#b8b8c8',
      })
      .setOrigin(0.5);

    this.refreshMenu();

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-ENTER', () => {
      RACER.resetRun(); // fresh car for a fresh campaign/run — mid-campaign
                        // races do NOT reset (that's the whole economy)
      this.scene.start('GameScene', ITEMS[this.selected].data);
    });
  }

  move(dir) {
    this.selected =
      (this.selected + dir + ITEMS.length) % ITEMS.length;
    this.refreshMenu();
  }

  refreshMenu() {
    this.menuTexts.forEach((t, i) => {
      const active = i === this.selected;
      t.setColor(active ? '#ff2d95' : '#ffffff');
      t.setText(active ? `> ${ITEMS[i].label} <` : ITEMS[i].label);
    });
  }
}