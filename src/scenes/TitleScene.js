// TitleScene.js — the front door. Matches the in-game palette so the
// transition into GameScene doesn't feel like changing channels.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';

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
      .text(w / 2, 120, 'DESTRUCTION\nRACER', {
        fontSize: '56px',
        color: '#ff2d95', // rumbleA — the palette is the brand
        fontStyle: 'bold',
        align: 'center',
        stroke: '#00e5ff', // rumbleB
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // The machine, hovering. Frame 1 = straight. Same sheet as in-game.
    const car = this.add.sprite(w / 2, 330, 'car', 1).setScale(2.4);
    this.tweens.add({
      targets: car,
      y: '+=8',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.add
      .text(w / 2, 440, 'Speed is free. Survival costs extra.', {
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(w / 2, 510, 'PRESS ENTER', {
        fontSize: '26px',
        color: '#00e5ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: 0.25,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      this.scene.start('GameScene');
    });
  }
}