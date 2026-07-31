// TitleScene.js — the front door: TRAINING / STORY / ENDLESS,
// arrow keys + ENTER. Shows the endless high score under its entry —
// score-chasing starts before the race does.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { getScore } from '../systems/HighScores.js';
import {
  getTrainingResult,
  highestUnlockedTrainingIndex,
} from '../systems/TrainingProgress.js';
import { RACER } from '../systems/RacerState.js';
import { axisValue, buttonDown, dpadDown, getPrimaryPad } from '../systems/Gamepad.js';
import { TRAINING_TRACKS } from '../tracks/index.js';

const ITEMS = [
  { label: 'TRAINING', data: { mode: 'training', trackIndex: 0 } },
  { label: 'STORY MODE', data: { mode: 'story', trackIndex: 0 } },
  { label: 'ENDLESS MODE', data: { mode: 'endless' } },
];

const MENU_Y = 386;
const MENU_GAP = 48;

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
      frameHeight: 56,
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

    // The machine, hovering. Use the same measured scale as the in-race car
    // so a sprite-sheet revision cannot leave the title presentation behind.
    const car = this.add
      .sprite(w / 2, 300, 'car', 2)
      .setScale(TUNING.carScale);
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
    this.maxTrainingTrackIndex = highestUnlockedTrainingIndex(TRAINING_TRACKS);
    this.trainingTrackIndex = this.maxTrainingTrackIndex;
    this.menuTexts = ITEMS.map((item, i) =>
      this.add
        .text(w / 2, MENU_Y + i * MENU_GAP, item.label, {
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );

    // Training best sits beside its entry: the trophy is a mastery record,
    // not a consumable reward that can be farmed by replaying the lesson.
    this.trainingSummary = this.add
      .text(w / 2 + 142, MENU_Y, '', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffcf3f',
        lineSpacing: 2,
      })
      .setOrigin(0, 0.5);

    // Endless best, sitting under its menu entry.
    const best = getScore('endless');
    const endlessIndex = ITEMS.findIndex((item) => item.data.mode === 'endless');
    this.add
      .text(w / 2, MENU_Y + endlessIndex * MENU_GAP + 23, best ? `BEST ${best}m` : '', {
        fontSize: '14px',
        color: '#00e5ff',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 560, '←→ LESSON   ↑↓ SELECT   ENTER START', {
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
    kb.on('keydown-LEFT', () => this.cycleTraining(-1));
    kb.on('keydown-RIGHT', () => this.cycleTraining(1));
    kb.on('keydown-ENTER', () => this.startSelected());
  }

  update() {
    const pad = getPrimaryPad(this.input.gamepad);
    if (!pad) {
      this.prevPad = null;
      this.padText.setText('');
      return;
    }
    this.padText.setText('CONTROLLER CONNECTED');
    const now = {
      up: dpadDown(pad, 'up') || axisValue(pad, 1) < -0.5,
      down: dpadDown(pad, 'down') || axisValue(pad, 1) > 0.5,
      left: dpadDown(pad, 'left') || axisValue(pad, 0) < -0.5,
      right: dpadDown(pad, 'right') || axisValue(pad, 0) > 0.5,
      a: buttonDown(pad, 0, 'A'),
    };
    // First sight of the pad: seed prev with a=true so the button press
    // that woke the browser's gamepad API doesn't instantly start a race.
    const prev = this.prevPad ?? {
      up: false, down: false, left: false, right: false, a: true,
    };
    if (now.up && !prev.up) this.move(-1);
    if (now.down && !prev.down) this.move(1);
    if (now.left && !prev.left) this.cycleTraining(-1);
    if (now.right && !prev.right) this.cycleTraining(1);
    if (now.a && !prev.a) this.startSelected();
    this.prevPad = now;
  }

  startSelected() {
    RACER.resetRun(); // fresh car for a fresh campaign/run — mid-campaign
                      // races do NOT reset (that's the whole economy)
    const data = { ...ITEMS[this.selected].data };
    if (data.mode === 'training') data.trackIndex = this.trainingTrackIndex;
    this.scene.start('GameScene', data);
  }

  move(dir) {
    this.selected =
      (this.selected + dir + ITEMS.length) % ITEMS.length;
    this.refreshMenu();
  }

  cycleTraining(dir) {
    if (ITEMS[this.selected].data.mode !== 'training') return;
    const count = this.maxTrainingTrackIndex + 1;
    this.trainingTrackIndex = (this.trainingTrackIndex + dir + count) % count;
    this.refreshMenu();
  }

  refreshMenu() {
    this.menuTexts.forEach((t, i) => {
      const active = i === this.selected;
      const label = ITEMS[i].data.mode === 'training'
        ? `TRAINING  ${this.trainingTrackIndex + 1}/${TRAINING_TRACKS.length}`
        : ITEMS[i].label;
      t.setColor(active ? '#ff2d95' : '#ffffff');
      t.setText(active ? `> ${label} <` : label);
    });
    const track = TRAINING_TRACKS[this.trainingTrackIndex];
    const best = getTrainingResult(track.id, track.scoring?.version ?? 1);
    const record = best
      ? `${best.trophy?.toUpperCase() ?? 'BEST'} ${best.bestProgress}/${best.total}`
      : 'UNPLAYED';
    this.trainingSummary.setText(`${track.name}\n${record}`);
  }
}
