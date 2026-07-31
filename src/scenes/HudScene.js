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

const CAMERA_CRACKS = [
  [
    [[0, 0.18], [0.08, 0.22], [0.15, 0.2], [0.23, 0.28]],
    [[0.08, 0.22], [0.11, 0.31], [0.18, 0.36]],
    [[0.15, 0.2], [0.2, 0.13], [0.27, 0.1]],
  ],
  [
    [[1, 0.12], [0.92, 0.19], [0.85, 0.17], [0.77, 0.25]],
    [[0.92, 0.19], [0.9, 0.29], [0.83, 0.34]],
    [[0.85, 0.17], [0.8, 0.09], [0.73, 0.07]],
  ],
  [
    [[0.04, 1], [0.1, 0.89], [0.18, 0.86], [0.24, 0.76], [0.33, 0.73]],
    [[0.18, 0.86], [0.2, 0.95], [0.27, 1]],
    [[0.24, 0.76], [0.2, 0.68], [0.22, 0.61]],
  ],
  [
    [[0.56, 0], [0.53, 0.12], [0.57, 0.22], [0.52, 0.34], [0.58, 0.46]],
    [[0.57, 0.22], [0.66, 0.25], [0.71, 0.33]],
    [[0.52, 0.34], [0.43, 0.38], [0.37, 0.46]],
    [[0.58, 0.46], [0.64, 0.55], [0.62, 0.66]],
  ],
];

export class HudScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HudScene' });
  }

  create() {
    this.gs = this.scene.get('GameScene');
    this.training = this.gs.mode === 'training';
    this.cachedBest = getScore('endless'); // once — not a disk read per frame
    const w = this.scale.width;
    const h = this.scale.height;

    const chip = (x, y, cw, ch) => {
      const g = this.add.graphics();
      g.fillStyle(0x0a0a14, 0.6);
      g.fillRoundedRect(x, y, cw, ch, 8);
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.strokeRoundedRect(x, y, cw, ch, 8);
      return g;
    };

    // Top-left: lap + time (story) / distance + best (endless).
    chip(10, 10, 172, 46);
    this.line1 = this.add.text(22, 15, '', { fontSize: '18px', fontStyle: 'bold', color: '#ffffff' });
    this.line2 = this.add.text(22, 36, '', { fontSize: '13px', color: '#b8b8c8' });

    // Top-center: race progress, alone in its lane.
    this.progressBar = this.gs.race ? new ProgressBar(this, this.gs.race.laps, 30) : null;

    // Training never exposes campaign hull; Hazard Weave uses glass cracks.
    if (!this.training) this.healthBar = new HealthBar(this, w - 196, 22);

    // Bottom-left: objectives are now the global race language. The panel is
    // authored from track data and animates each newly completed row.
    this.objectiveDone = new Set();
    this.trophyGuide = null;
    if (this.gs.objectives.active) {
      const views = this.gs.objectives.views;
      const trophyThresholds = this.training
        ? this.gs.trackData.scoring?.thresholds
        : null;
      const panelH = 31 + views.length * 22 + (trophyThresholds ? 20 : 0);
      const panelY = h - panelH - 10;
      const objectiveChip = chip(10, panelY, 354, panelH).setAlpha(0);
      this.objectiveHeader = this.add.text(22, panelY + 7, '', {
        fontSize: '13px', fontStyle: 'bold', color: '#ff2d95',
      }).setAlpha(0);
      this.objectiveRows = views.map((_, index) =>
        this.add.text(22, panelY + 27 + index * 22, '', {
          fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
        }).setAlpha(0)
      );
      if (trophyThresholds) {
        const label = [...trophyThresholds]
          .sort((a, b) => a.minimum - b.minimum)
          .map((threshold) =>
            `${threshold.rank[0].toUpperCase()} ${threshold.minimum}` +
            (threshold.maximumDamageHits == null
              ? ''
              : `/H≤${threshold.maximumDamageHits}`)
          )
          .join('  •  ');
        this.trophyGuide = this.add.text(
          22,
          panelY + 27 + views.length * 22,
          `TROPHIES  ${label}`,
          { fontSize: '12px', fontStyle: 'bold', color: '#ffcf3f' },
        ).setAlpha(0);
      }
      this.tweens.add({
        targets: [
          objectiveChip,
          this.objectiveHeader,
          ...this.objectiveRows,
          ...(this.trophyGuide ? [this.trophyGuide] : []),
        ],
        alpha: 1,
        delay: 350,
        duration: 420,
        ease: 'Quad.out',
      });
    } else {
      chip(10, h - 56, 254, 44);
      this.add.text(22, h - 50, 'RUN OBJECTIVE', {
        fontSize: '13px', fontStyle: 'bold', color: '#ff2d95',
      });
      this.add.text(22, h - 30, 'DRIVE AS FAR AS YOU CAN', {
        fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
      });
    }

    // Bottom-right: the speedo. Big number, small label — read at a glance.
    chip(w - 148, h - 68, 136, 56);
    this.speedText = this.add
      .text(w - 26, h - 60, '', { fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(1, 0);
    this.add
      .text(w - 26, h - 28, 'SPEED', { fontSize: '11px', color: '#00e5ff' })
      .setOrigin(1, 0);

    // Nitro remains a driving resource, but no longer shares a fame panel.
    if (!this.training) {
      this.nitroText = this.add
        .text(w - 18, h - 88, '', {
          fontSize: '13px', fontStyle: 'bold', color: '#2ee56b',
          stroke: '#0a0a14', strokeThickness: 3,
        })
        .setOrigin(1, 0);
    }

    // Off-track flasher: its own element, impossible to miss, gone when moot.
    this.offTrack = this.add
      .text(w / 2, 66, 'OFF TRACK', { fontSize: '18px', fontStyle: 'bold', color: '#ff2d55', stroke: '#0a0a14', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false);

    // Training damage lives on the camera glass, not in a conventional hull
    // bar. Four authored crack clusters accumulate and never obscure the road
    // center completely; they communicate mistakes without ending the lesson.
    this.crackStage = -1;
    if (this.gs.trainingDamageMax > 0) {
      this.crackGraphics = this.add.graphics().setDepth(100);
      this.drawCameraCracks(0);
    }
  }

  update(time) {
    const gs = this.gs;
    if (!gs || !gs.player) return;

    if (gs.race) {
      this.line1.setText(`LAP ${gs.race.lap}/${gs.race.laps}`);
      this.line2.setText(fmtTime(gs.race.time));
      const inLap = gs.player.position / gs.model.trackLength;
      const raceProgress = gs.race.lap > gs.race.laps
        ? 1
        : (gs.race.lap - 1 + inLap) / gs.race.laps;
      this.progressBar.draw(raceProgress);
    } else {
      this.line1.setText(`${gs.distanceM()}m`);
      this.line2.setText(this.cachedBest ? `BEST ${this.cachedBest}m` : '');
    }

    if (this.healthBar) this.healthBar.draw(RACER.healthFrac);

    if (this.crackGraphics && this.crackStage !== gs.trainingDamageHits) {
      this.drawCameraCracks(gs.trainingDamageHits);
    }

    if (this.objectiveRows) {
      this.objectiveHeader.setText(gs.race?.finishArmed
        ? 'OBJECTIVES COMPLETE  •  FINISH THIS LAP'
        : `OBJECTIVES  •  ${gs.objectives.score} PTS`);
      gs.objectives.views.forEach((objective, index) => {
        const row = this.objectiveRows[index];
        const progress = objective.total > 1
          ? `  ${objective.progress}/${objective.total}`
          : '';
        row.setText(`${objective.complete ? '✓' : '○'}  ${objective.label}${progress}`);
        row.setColor(objective.complete ? '#2ee56b' : '#ffffff');
        if (objective.complete && !this.objectiveDone.has(objective.id)) {
          this.objectiveDone.add(objective.id);
          row.setScale(1.18);
          this.tweens.add({
            targets: row,
            scale: 1,
            duration: 420,
            ease: 'Back.out',
          });
        }
      });
    }
    if (this.nitroText) {
      this.nitroText.setText(gs.nitro > 0 ? '◆'.repeat(gs.nitro) + ' NITRO' : 'NITRO —');
    }

    // Cyan speedo = you are past the engine's ceiling: gravity's money.
    this.speedText.setText(`${Math.round(gs.player.speed / 100)}`);
    this.speedText.setColor(gs.player.speed > TUNING.maxSpeed ? '#00e5ff' : '#ffffff');

    const off = !gs.player.airborne && Math.abs(gs.player.x) > 1;
    this.offTrack.setVisible(off && Math.floor(time / 250) % 2 === 0);
  }

  drawCameraCracks(hits) {
    this.crackStage = hits;
    const graphics = this.crackGraphics;
    if (!graphics) return;
    graphics.clear();
    const draw = (width, color, alpha) => {
      graphics.lineStyle(width, color, alpha);
      CAMERA_CRACKS.slice(0, hits).flat().forEach((path) => {
        graphics.beginPath();
        graphics.moveTo(path[0][0] * this.scale.width, path[0][1] * this.scale.height);
        path.slice(1).forEach(([x, y]) => {
          graphics.lineTo(x * this.scale.width, y * this.scale.height);
        });
        graphics.strokePath();
      });
    };
    draw(5, 0x05050a, 0.7);
    draw(2, 0xd9f7ff, 0.78);
  }
}
