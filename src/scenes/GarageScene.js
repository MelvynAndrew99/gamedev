import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { RACER } from '../systems/RacerState.js';
import { applyEmergencyTow, buyRepair, repairQuote } from '../systems/Economy.js';

export class GarageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageScene' });
  }

  init(data) {
    this.nextTrackIndex = data.nextTrackIndex;
    this.retryTrackIndex = data.retryTrackIndex;
    this.complete = !!data.complete;
    this.receipt = data.receipt ?? '';
    this.wrecked = !!data.wrecked;
  }

  create() {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b0630, 0x0b0630, 0x40135f, 0x40135f, 1);
    g.fillRect(0, 0, w, h);

    let towHealth = 0;
    if (this.wrecked) towHealth = applyEmergencyTow(RACER, TUNING);

    this.add.text(w / 2, 58, 'PIT GARAGE', {
      fontSize: '42px', color: '#ff2d95', fontStyle: 'bold',
      stroke: '#00e5ff', strokeThickness: 2,
    }).setOrigin(0.5);
    this.add.text(w / 2, 125,
      this.receipt + (towHealth ? `\nEMERGENCY TOW +${towHealth} HULL` : ''), {
        fontSize: '18px', color: '#ffcf3f', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);

    this.status = this.add.text(w / 2, 220, '', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    this.message = this.add.text(w / 2, 280, '', {
      fontSize: '16px', color: '#b8b8c8',
    }).setOrigin(0.5);

    this.selected = 0;
    this.items = [
      { label: () => `PATCH +${TUNING.repairPackHealth} HULL  $${TUNING.repairPackCost}`,
        buy: () => buyRepair(RACER, TUNING, TUNING.repairPackHealth) },
      { label: () => {
          const q = repairQuote(RACER, TUNING, RACER.maxHealth);
          return `FULL REPAIR  $${q.cost}`;
        },
        buy: () => buyRepair(RACER, TUNING, RACER.maxHealth) },
      { label: () => this.complete ? 'FINISH CAMPAIGN' :
          this.wrecked ? 'RETRY RACE' : 'NEXT RACE',
        continue: true },
    ];
    this.menuTexts = this.items.map((_, i) =>
      this.add.text(w / 2, 340 + i * 52, '', {
        fontSize: '25px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    this.add.text(w / 2, h - 42, '↑↓ SELECT   ENTER BUY / CONTINUE', {
      fontSize: '15px', color: '#00e5ff',
    }).setOrigin(0.5);

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-ENTER', () => this.activate());
    this.prevPad = null;
    this.refresh();
  }

  update() {
    const gp = this.input.gamepad;
    if (!gp || gp.total === 0) {
      this.prevPad = null;
      return;
    }
    const pad = gp.getPad(0);
    const now = {
      up: pad.up || pad.leftStick.y < -0.5,
      down: pad.down || pad.leftStick.y > 0.5,
      a: !!pad.A,
    };
    const prev = this.prevPad ?? { up: false, down: false, a: true };
    if (now.up && !prev.up) this.move(-1);
    if (now.down && !prev.down) this.move(1);
    if (now.a && !prev.a) this.activate();
    this.prevPad = now;
  }

  move(dir) {
    this.selected = (this.selected + dir + this.items.length) % this.items.length;
    this.message.setText('');
    this.refresh();
  }

  activate() {
    const item = this.items[this.selected];
    if (item.continue) {
      if (this.complete) this.scene.start('TitleScene');
      else this.scene.start('GameScene', {
        mode: 'story',
        trackIndex: this.wrecked ? this.retryTrackIndex : this.nextTrackIndex,
      });
      return;
    }

    const result = item.buy();
    this.message.setText(result.ok ? `REPAIRED +${result.health}` :
      result.reason === 'FULL' ? 'HULL ALREADY FULL' : `NEED $${result.cost}`);
    this.message.setColor(result.ok ? '#2ee56b' : '#ff2d55');
    this.refresh();
  }

  refresh() {
    this.status.setText(`WALLET  $${RACER.money}\nHULL  ${RACER.health} / ${RACER.maxHealth}`);
    this.items.forEach((item, i) => {
      const active = i === this.selected;
      const label = item.label();
      this.menuTexts[i].setText(active ? `> ${label} <` : label);
      this.menuTexts[i].setColor(active ? '#ff2d95' : '#ffffff');
    });
  }
}
