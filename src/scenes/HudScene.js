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
import { BoostGauge } from '../ui/BoostGauge.js';
import { OBSTACLES } from '../config/obstacles.js';
import { damageFeedbackState } from '../systems/DamageFeedback.js';

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
              : `/H≤${threshold.maximumDamageHits}`) +
            (threshold.maximumConesMissed == null
              ? ''
              : '/CONES')
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

    // Boost gauge: shown on any track that actually places pickups, not just
    // non-training modes — Redline (Training 3) is the first training track
    // that needs it, while Cone Control/Hazard Weave keep decoration.nitro
    // off and stay clutter-free.
    const hasAuthoredBoosts = this.gs.trackData?.objects?.some(
      (object) => object.kind === 'boost',
    );
    if (hasAuthoredBoosts || this.gs.trackData?.decoration?.nitro !== false) {
      this.boostGauge = new BoostGauge(this, w - 126, h - 92, 108, 14);
    }

    // Off-track flasher: its own element, impossible to miss, gone when moot.
    this.offTrack = this.add
      .text(w / 2, 66, 'OFF TRACK', { fontSize: '18px', fontStyle: 'bold', color: '#ff2d55', stroke: '#0a0a14', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false);

    if (this.gs.trackData?.trainingCues?.some(
      (cue) => cue.kind === 'airbrake-rehearsal'
    )) {
      this.createAirbrakeRehearsal();
    }

    // Windshield damage is the in-world condition read: training uses its
    // authored safe hit count, while normal modes mirror persistent hull.
    // Four crack clusters accumulate without obscuring the road center.
    this.crackStage = -1;
    if (this.gs.trainingDamageMax > 0 || !this.training) {
      this.crackGraphics = this.add.graphics().setDepth(100);
      this.drawCameraCracks(0);
    }
    this.createCriticalDamageWarning();
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

    const damageFeedback = damageFeedbackState({
      training: this.training,
      trainingHits: gs.trainingDamageHits,
      trainingMax: gs.trainingDamageMax,
      health: RACER.health,
      maxHealth: RACER.maxHealth,
      fatalDamage: OBSTACLES.rock.damage,
    });
    if (this.crackGraphics && this.crackStage !== damageFeedback.stage) {
      this.drawCameraCracks(damageFeedback.stage);
    }
    this.updateCriticalDamageWarning(time, damageFeedback);

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
    if (this.boostGauge) {
      const maxCeiling = TUNING.boostTierCeilings[TUNING.boostTierCeilings.length - 1];
      this.boostGauge.draw({
        slots: gs.boost.slots,
        tier: gs.boost.tier,
        ceilingMultiplier: gs.boost.ceilingMultiplier,
        overspeedCap: TUNING.overspeedCap,
        maxCeiling,
      });
    }

    // The medal-relevant read IS the speed number: an active boost tiers its
    // color (green/cyan/gold) over the plain "past the engine's ceiling" cyan.
    this.speedText.setText(`${Math.round(gs.player.speed / 100)}`);
    const tier = gs.boost?.tier ?? 0;
    const tierColor = tier === 3 ? '#ffcf3f' : tier === 2 ? '#00e5ff' : tier === 1 ? '#2ee56b' : null;
    this.speedText.setColor(
      tierColor ?? (gs.player.speed > TUNING.maxSpeed ? '#00e5ff' : '#ffffff'),
    );

    const off = !gs.player.airborne && Math.abs(gs.player.x) > 1;
    this.offTrack.setVisible(off && Math.floor(time / 250) % 2 === 0);
    this.updateAirbrakeRehearsal(time, gs.trainingTutorialView);
  }

  // Just-in-time rehearsal lives in unused sky at the upper right, leaving
  // the road and its cone line fully visible. The race is already frozen by
  // GameScene, so the player can supply the real input without consequence.
  createAirbrakeRehearsal() {
    const centerX = 650;
    const centerY = 170;
    const panel = this.add.rectangle(centerX, centerY, 286, 194, 0x0a0a14, 0.92)
      .setStrokeStyle(2, 0x00e5ff, 0.7);
    this.airbrakeTitle = this.add.text(centerX, centerY - 78, 'AIRBRAKE ASSIST', {
      fontSize: '18px', color: '#00e5ff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 3,
    }).setOrigin(0.5);
    const buttonStyle = {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold', align: 'center',
      backgroundColor: '#142235', padding: { x: 14, y: 9 },
      stroke: '#0a0a14', strokeThickness: 4,
    };
    this.airbrakeRows = [
      {
        label: this.add.text(centerX - 125, centerY - 24, 'VEER RIGHT  ▶', {
          fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#0a0a14', strokeThickness: 3,
        }).setOrigin(0, 0.5),
        button: this.add.text(centerX + 102, centerY - 24, 'R1', buttonStyle)
          .setOrigin(0.5),
      },
      {
        label: this.add.text(centerX - 125, centerY + 49, '◀  VEER LEFT', {
          fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#0a0a14', strokeThickness: 3,
        }).setOrigin(0, 0.5),
        button: this.add.text(centerX + 102, centerY + 49, 'L1', buttonStyle)
          .setOrigin(0.5),
      },
    ];
    this.airbrakeRehearsal = this.add.container(0, 0, [
      panel,
      this.airbrakeTitle,
      ...this.airbrakeRows.flatMap((row) => [row.label, row.button]),
    ]).setDepth(80).setAlpha(0).setVisible(false);
  }

  updateAirbrakeRehearsal(time, view) {
    if (!this.airbrakeRehearsal) return;
    const active = view?.kind === 'airbrake-rehearsal';
    const alpha = Phaser.Math.Linear(
      this.airbrakeRehearsal.alpha,
      active ? 1 : 0,
      active ? 0.24 : 0.18,
    );
    this.airbrakeRehearsal
      .setAlpha(alpha)
      .setVisible(alpha > 0.01 || active);
    if (!active) return;

    const keys = view.device === 'gamepad' ? ['R1', 'L1'] : ['X', 'Z'];
    const pulse = 1 + Math.sin(time / 90) * 0.06;
    this.airbrakeTitle
      .setText(view.complete ? 'READY!' : 'AIRBRAKE ASSIST')
      .setColor(view.complete ? '#2ee56b' : '#00e5ff');
    this.airbrakeRows.forEach((row, index) => {
      const complete = index < view.step || view.complete;
      const current = index === view.step && !view.complete;
      row.button.setText(keys[index]);
      row.label
        .setColor(complete ? '#2ee56b' : current ? '#ffcf3f' : '#63758a')
        .setScale(current ? pulse : 1);
      row.button
        .setBackgroundColor(complete ? '#2e8b57' : current ? '#b48315' : '#142235')
        .setColor(complete ? '#ffffff' : current ? '#0a0a14' : '#63758a')
        .setScale(current ? pulse : 1);
    });
  }

  createCriticalDamageWarning() {
    const w = this.scale.width;
    const h = this.scale.height;
    const panelX = w - 330;
    const panelY = 58;
    const panelH = 104;
    const stripW = 330 / 8;
    const blackAlpha = [0, 0.02, 0.05, 0.1, 0.18, 0.3, 0.48, 0.72];

    // Canvas-safe stepped gradient: transparent at the center edge, dense at
    // the outer glass. The warning reads as part of the windshield while the
    // road/horizon remain unobscured.
    this.criticalDamageBackdrop = this.add.graphics().setDepth(98);
    blackAlpha.forEach((alpha, index) => {
      const x = panelX + index * stripW;
      this.criticalDamageBackdrop.fillStyle(0x05050a, alpha);
      this.criticalDamageBackdrop.fillRect(x, panelY, Math.ceil(stripW), panelH);
      this.criticalDamageBackdrop.fillStyle(0xff2d55, alpha * 0.2);
      this.criticalDamageBackdrop.fillRect(x, panelY, Math.ceil(stripW), panelH);
    });

    // Only the warning chrome pulses. Text stays fully opaque so the player
    // can read it in one glance instead of chasing a flashing label.
    this.criticalDamagePulse = this.add.graphics().setDepth(101);
    this.criticalDamagePulse.fillStyle(0xff2d55, 0.22);
    this.criticalDamagePulse.fillRect(0, 0, w, 8);
    this.criticalDamagePulse.fillRect(0, h - 8, w, 8);
    this.criticalDamagePulse.fillRect(0, 0, 8, h);
    this.criticalDamagePulse.fillRect(w - 8, 0, 8, h);
    this.criticalDamagePulse.fillStyle(0xff2d55, 0.95);
    this.criticalDamagePulse.fillRect(w - 5, panelY, 5, panelH);
    this.criticalDamagePulse.fillTriangle(
      panelX + 20, panelY + 69,
      panelX + 47, panelY + 19,
      panelX + 74, panelY + 69,
    );
    this.criticalDamagePulse.fillStyle(0x0a0a14, 1);
    this.criticalDamagePulse.fillRect(panelX + 44, panelY + 36, 6, 19);
    this.criticalDamagePulse.fillCircle(panelX + 47, panelY + 62, 3);

    this.criticalDamageTitle = this.add.text(
      panelX + 78,
      panelY + 20,
      'CRITICAL DAMAGE',
      {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ff6b6b',
        stroke: '#0a0a14',
        strokeThickness: 4,
      },
    ).setDepth(102);
    this.criticalDamageDetail = this.add.text(
      panelX + 80,
      panelY + 57,
      '',
      {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0a0a14',
        strokeThickness: 3,
      },
    ).setDepth(102);
    this.criticalDamageParts = [
      this.criticalDamageBackdrop,
      this.criticalDamagePulse,
      this.criticalDamageTitle,
      this.criticalDamageDetail,
    ];
    this.criticalDamageParts.forEach((part) => part.setVisible(false));
    this.criticalDamageVisible = false;
  }

  updateCriticalDamageWarning(time, state) {
    const visible = state.critical;
    if (visible !== this.criticalDamageVisible) {
      this.criticalDamageVisible = visible;
      this.criticalDamageParts.forEach((part) => part.setVisible(visible));
      if (visible) {
        this.criticalDamageParts.forEach((part) => { part.x = 20; });
        this.tweens.add({
          targets: this.criticalDamageParts,
          x: 0,
          duration: 180,
          ease: 'Quad.out',
        });
      }
    }
    if (!visible) return;
    this.criticalDamagePulse.setAlpha(0.86 + Math.sin(time / 120) * 0.14);
    this.criticalDamageBackdrop.setAlpha(1);
    this.criticalDamageTitle.setAlpha(1);
    this.criticalDamageDetail.setAlpha(1);

    if (state.destroyed && this.training) {
      this.criticalDamageTitle.setText('GLASS SHATTERED');
      this.criticalDamageDetail.setText('TRAINING CONTINUES  •  NO TROPHY');
    } else if (this.training) {
      this.criticalDamageTitle.setText('GLASS CRITICAL');
      this.criticalDamageDetail.setText('NEXT ROCK SHATTERS IT');
    } else {
      this.criticalDamageTitle.setText('HULL CRITICAL');
      this.criticalDamageDetail.setText('NEXT ROCK WRECKS');
    }
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
