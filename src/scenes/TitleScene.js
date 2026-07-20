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
      frameWidth: 64,
      frameHeight: 48,
    });
    this.load.image('cone', 'assets/cone.png');
    this.load.image('rock', 'assets/rock.png');
    this.load.image('post', 'assets/post.png');
    this.load.image('ramp', 'assets/ramp.png');
    this.load.image('boost', 'assets/boost.png');
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
    const car = this.add.sprite(w / 2, 300, 'car', 2).setScale(2.6);
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

    // Gamepad state for menu nav — POLLED in update(), not event-driven.
    // The browser only exposes a pad after its first button press, and that
    // press is eaten by the connection handshake, so 'down' events can miss.
    // Polling with edge detection sees every press after connection.
    this.prevPad = null;
    this.padText = this.add
      .text(this.scale.width - 12, this.scale.height - 10, '', {
        fontSize: '12px', color: '#00e5ff',
      })
      .setOrigin(1, 1);

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-ENTER', () => this.startSelected());
  }

  update() {
    const gp = this.input.gamepad;
    if (!gp || gp.total === 0) {
      this.prevPad = null;
      this.padText.setText('');
      return;
    }
    this.padText.setText('CONTROLLER CONNECTED');
    const pad = gp.getPad(0);
    const now = {
      up: pad.up || pad.leftStick.y < -0.5,
      down: pad.down || pad.leftStick.y > 0.5,
      a: !!pad.A,
    };
    // First sight of the pad: seed prev with a=true so the button press
    // that woke the browser's gamepad API doesn't instantly start a race.
    const prev = this.prevPad ?? { up: false, down: false, a: true };
    if (now.up && !prev.up) this.move(-1);
    if (now.down && !prev.down) this.move(1);
    if (now.a && !prev.a) this.startSelected();
    this.prevPad = now;
  }

  startSelected() {
    RACER.resetRun(); // fresh car for a fresh campaign/run — mid-campaign
                      // races do NOT reset (that's the whole economy)
    this.scene.start('GameScene', ITEMS[this.selected].data);
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