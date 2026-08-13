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
import { ProgressBar } from '../ui/ProgressBar.js';
import { BoostGauge } from '../ui/BoostGauge.js';
import { OBSTACLES } from '../config/obstacles.js';
import {
  damageNoticeView,
  damageFeedbackState,
} from '../systems/DamageFeedback.js';
import {
  airtimeCoachView,
} from '../systems/AirtimeCoach.js';
import { hudVisibilityPolicy } from '../systems/HudPolicy.js';
import {
  rivalCourseMarkers,
  rivalEventHudView,
} from '../systems/RivalHud.js';
import { nextObjectiveFeedback } from '../systems/ObjectiveFeedback.js';
import { styleRewardView } from '../systems/StyleEvents.js';
import { MUSIC } from '../audio/MusicEngine.js';
import {
  objectivePanelLayout,
  objectiveRowView,
} from '../systems/ObjectivePresentation.js';
import { flightHudView } from '../systems/FlightPresentation.js';

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
    // Phaser reuses this Scene instance after stop/start. Optional HUD
    // objects from the previous mode have already been destroyed, but their
    // JavaScript references survive unless we clear them. A stale objective
    // row from Story/Training, for example, makes Endless call setText() on a
    // destroyed canvas texture and crash inside Text.updateText/drawImage.
    // Reset every mode-conditional reference before constructing this run.
    this.line1 = null;
    this.line2 = null;
    this.progressBar = null;
    this.objectiveHeader = null;
    this.objectiveRows = null;
    this.objectivePanelParts = null;
    this.objectiveAccent = null;
    this.objectiveToastParts = null;
    this.objectiveToastSequence = 0;
    this.objectiveToastBusy = false;
    this.rivalToastParts = null;
    this.rivalToastSequence = 0;
    this.rivalToastBusy = false;
    this.rivalEventParts = null;
    this.storyTimerText = null;
    this.storyStatusText = null;
    this.storyAirtimeText = null;
    this.storyAirtimeHoldUntil = 0;
    this.styleRewardParts = null;
    this.styleRewardBusy = false;
    this.boostGauge = null;
    this.flightHudParts = null;
    this.flightHudGraphics = null;
    this.airtimeCoachPanel = null;
    this.airtimeCoachParts = null;
    this.airtimeCoachLayout = null;
    this.airbrakeRehearsal = null;
    this.airbrakeRows = null;
    this.crackGraphics = null;
    this.criticalDamageParts = null;
    this.criticalDamageContainer = null;
    this.criticalDamageStage = -1;
    this.criticalDamageUntil = 0;
    this.pendingCriticalDamageState = null;

    this.gs = this.scene.get('GameScene');
    this.training = this.gs.mode === 'training';
    this.cachedBest = getScore('endless'); // once — not a disk read per frame
    const w = this.scale.width;
    const h = this.scale.height;
    const hasAuthoredBoosts = this.gs.trackData?.objects?.some(
      (object) => object.kind === 'boost',
    );
    const hasBoostCapability = hasAuthoredBoosts ||
      this.gs.trackData?.decoration?.nitro !== false;
    this.hudPolicy = hudVisibilityPolicy({
      mode: this.gs.mode,
      hasRace: !!this.gs.race,
      hasObjectives: this.gs.objectives.active,
      trackId: this.gs.trackData?.id,
      hasBoostCapability,
      trainingDamageMax: this.gs.trainingDamageMax,
    });

    const chip = (x, y, cw, ch) => {
      const g = this.add.graphics();
      g.fillStyle(0x0a0a14, 0.6);
      g.fillRoundedRect(x, y, cw, ch, 8);
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.strokeRoundedRect(x, y, cw, ch, 8);
      return g;
    };

    // Endless has no finite course ribbon, so distance/best is its single run
    // read. Circuit races use the numbered ribbon and do not repeat LAP x/y.
    if (this.hudPolicy.endlessDistance) {
      chip(10, 10, 230, 46);
      this.line1 = this.add.text(22, 15, '', {
        fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      });
      this.line2 = this.add.text(22, 36, '', {
        fontSize: '11px', color: '#b8b8c8',
      });
    }

    // Top-center: race progress, alone in its lane.
    this.progressBar = this.hudPolicy.courseProgress
      ? new ProgressBar(
        this,
        this.hudPolicy.rivalEventHud ? 1 : this.gs.race.laps,
        30,
        {
          lapNumbers: !this.hudPolicy.rivalEventHud,
          // This is a looping hunt, not a finite race. Removing endpoint
          // furniture gives three packed target markers an unobscured lane.
          endpointLabels: !this.hudPolicy.rivalEventHud,
          showProgressFill: !this.hudPolicy.rivalEventHud,
        },
      )
      : null;

    // Rival School is a fixed-time score attack. Two compact corner reads
    // replace its generic objective stack; the center remains a neutral loop
    // locator rather than implying lap or endpoint progress.
    if (this.hudPolicy.rivalEventHud) this.createRivalEventHud();
    if (this.hudPolicy.storyEventHud) {
      chip(10, 8, 144, 44);
      chip(646, 8, 144, 44);
      this.storyTimerText = this.add.text(82, 12, '', {
        fontSize: '19px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5, 0);
      this.storyStatusText = this.add.text(718, 12, '', {
        fontSize: '14px', fontStyle: 'bold', color: '#ffcf3f', align: 'center',
      }).setOrigin(0.5, 0);
      this.storyAirtimeText = this.add.text(400, 62, '', {
        fontSize: '18px', fontStyle: 'bold', color: '#00e5ff',
        stroke: '#080812', strokeThickness: 5,
        backgroundColor: '#080812cc', padding: { x: 9, y: 4 },
      }).setOrigin(0.5, 0).setDepth(95).setVisible(false);
    }

    // Training lessons without a dedicated live coach retain one compact
    // checkable list in the safe left column. Story objectives are expressed
    // through the world and a brief completion toast instead of a checklist.
    // A reconstructed HUD must reflect authoritative completion without
    // replaying old confirmation pulses. New completions are added below on
    // the same update that changes their row to a green check.
    this.objectiveDone = new Set(
      this.gs.objectives.views
        .filter((objective) => objective.complete)
        .map((objective) => objective.id),
    );
    if (this.hudPolicy.objectiveRows) {
      const views = this.gs.objectives.views;
      const layout = objectivePanelLayout(views.length);
      const panelX = layout.x;
      const panelY = layout.y;
      const panelW = layout.width;
      const panelH = layout.height;
      const objectiveChip = this.add.graphics().setAlpha(0);
      objectiveChip.fillStyle(0x080812, 0.86);
      objectiveChip.fillRect(panelX, panelY, panelW, panelH);
      objectiveChip.lineStyle(2, 0x00e5ff, 0.7);
      objectiveChip.strokeRect(panelX, panelY, panelW, panelH);
      this.objectiveAccent = this.add.rectangle(
        panelX + 5,
        panelY + panelH / 2,
        6,
        panelH - 10,
        0xff2d95,
        0.95,
      ).setAlpha(0);
      this.objectiveHeader = this.add.text(panelX + 16, panelY + 7, '', {
        fontSize: '12px', fontStyle: 'bold', color: '#ff2d95',
        stroke: '#080812', strokeThickness: 3,
      }).setAlpha(0);
      this.objectiveRows = views.map((_, index) =>
        this.add.text(panelX + 16, panelY + 27 + index * layout.rowGap, '', {
          fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
          stroke: '#080812', strokeThickness: 3,
        }).setAlpha(0)
      );
      this.objectivePanelParts = [
        objectiveChip,
        this.objectiveAccent,
        this.objectiveHeader,
        ...this.objectiveRows,
      ];
      this.tweens.add({
        targets: this.objectivePanelParts,
        alpha: 1,
        delay: 220,
        duration: 320,
        ease: 'Quad.out',
      });
    }

    if (this.hudPolicy.objectiveToast) this.createObjectiveToast();
    if (this.hudPolicy.rivalToast) this.createRivalToast();
    if (this.hudPolicy.styleRewards) this.createStyleReward();

    if (this.hudPolicy.flightHud) {
      this.createFlightHud();
    } else {
      // Bottom-right: the speedo. Big number, small label — read at a glance.
      chip(w - 148, h - 68, 136, 56);
      this.speedText = this.add
        .text(w - 26, h - 60, '', { fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(1, 0);
      this.add
        .text(w - 26, h - 28, 'SPEED', { fontSize: '11px', color: '#00e5ff' })
        .setOrigin(1, 0);
    }

    // Boost gauge: shown on any track that actually places pickups, not just
    // non-training modes — Redline (Training 3) is the first training track
    // that needs it, while Cone Control/Hazard Weave keep decoration.nitro
    // off and stay clutter-free.
    if (this.hudPolicy.boostGauge) {
      this.boostGauge = new BoostGauge(
        this, w - 126, h - 92, 108, 14, this.gs.boost.capacity,
      );
    }

    // Off-track flasher: its own element, impossible to miss, gone when moot.
    this.offTrack = this.add
      .text(w / 2, 66, 'OFF TRACK', { fontSize: '18px', fontStyle: 'bold', color: '#ff2d55', stroke: '#0a0a14', strokeThickness: 4 })
      .setOrigin(0.5)
      .setVisible(false);

    // Training 4 teaches a continuous input, not a one-time button press. Its
    // coach replaces—not accompanies—the generic objective checklist.
    if (this.hudPolicy.airtimeCoach) {
      this.createAirtimeCoach();
    }

    if (this.gs.trackData?.trainingCues?.some(
      (cue) => cue.kind === 'airbrake-rehearsal'
    )) {
      this.createAirbrakeRehearsal();
    }

    // Windshield damage is the in-world condition read: training uses its
    // authored safe hit count, while normal modes mirror persistent hull.
    // Four crack clusters accumulate without obscuring the road center.
    this.crackStage = -1;
    if (this.hudPolicy.windshieldDamage) {
      this.crackGraphics = this.add.graphics().setDepth(100);
      this.drawCameraCracks(0);
      this.createCriticalDamageWarning();
    }
  }

  update(time) {
    const gs = this.gs;
    if (!gs || !gs.player) return;

    if (gs.race) {
      const inLap = gs.player.position / gs.model.trackLength;
      const raceProgress = gs.race.lap > gs.race.laps
        ? 1
        : (gs.race.lap - 1 + inLap) / gs.race.laps;
      const rivalPublicView = gs.rivalSchoolView ?? gs.storyEventView ?? {};
      const rivals = rivalPublicView.rivals ?? gs.rivalPack?.views ?? [];
      const showRivalMarkers = this.hudPolicy.rivalCourseMarkers ||
        (this.hudPolicy.storyRivalMarkers && rivalPublicView.phase === 'rivals');
      const markers = showRivalMarkers
        ? rivalCourseMarkers({
          rivals,
          playerPosition: gs.player.position,
          playerRaceProgress: inLap,
          trackLength: gs.model.trackLength,
          laps: this.hudPolicy.rivalEventHud ? 1 : gs.race.laps,
          loop: this.hudPolicy.rivalEventHud,
          ribbonWidth: this.progressBar?.w,
        })
        : [];
      this.progressBar?.draw(
        this.hudPolicy.rivalEventHud ? inLap : raceProgress,
        markers,
      );
      if (this.flightHudParts) this.updateFlightHud(time, raceProgress);
      if (this.rivalEventParts) {
        this.updateRivalEventHud(rivalPublicView, rivals, time);
      }
      if (this.storyTimerText) {
        if (rivalPublicView.phase === 'qualifier') {
          this.storyTimerText.setText(formatStoryTime(rivalPublicView.remainingSeconds));
          this.storyStatusText.setText(
            `QUALIFY ${formatStoryTime(rivalPublicView.targetSeconds)}\n` +
            `GOLD ${formatStoryTime(rivalPublicView.goldSeconds)}`,
          );
          this.storyTimerText.setColor(
            rivalPublicView.remainingSeconds <= 5 ? '#ff6b6b' : '#ffffff',
          );
        } else {
          this.storyTimerText.setText(formatStoryTime(gs.race.time));
          const place = Math.max(1, rivalPublicView.place ?? 1);
          const opponentsLeft = Math.max(0, rivalPublicView.opponentsLeft ?? 3);
          this.storyStatusText.setText(
            `${place}${ordinalSuffix(place)} PLACE\n` +
            `${opponentsLeft} OPPONENT${opponentsLeft === 1 ? '' : 'S'} LEFT`,
          );
          this.storyTimerText.setColor('#ffffff');
        }
      }
    } else if (this.line1) {
      this.line1.setText(`${gs.distanceM()}m`);
      const level = gs.endlessStage
        ? `L${gs.endlessStage.level} ${gs.endlessStage.name}`
        : '';
      this.line2.setText(
        `${level}${this.cachedBest ? `  •  BEST ${this.cachedBest}m` : ''}`,
      );
    }

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
    if (this.criticalDamageParts) {
      this.updateCriticalDamageWarning(time, damageFeedback);
    }

    if (this.objectiveRows) {
      this.objectiveHeader.setText(gs.race?.finishArmed
        ? 'FINISH THIS LAP'
        : 'TRAINING GOALS');
      gs.objectives.views.forEach((objective, index) => {
        const row = this.objectiveRows[index];
        const presentation = objectiveRowView(objective);
        row.setText(presentation.text);
        row.setColor(presentation.color);
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
    this.updateObjectiveToast();
    this.updateRivalToast();
    this.updateStyleReward(time);
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
    this.speedText?.setText(`${Math.round(gs.player.speed / 100)}`);
    const tier = gs.boost?.tier ?? 0;
    const tierColor = tier === 3 ? '#ffcf3f' : tier === 2 ? '#00e5ff' : tier === 1 ? '#2ee56b' : null;
    this.speedText?.setColor(
      tierColor ?? (gs.player.speed > TUNING.maxSpeed ? '#00e5ff' : '#ffffff'),
    );

    const off = !gs.player.airborne && Math.abs(gs.player.x) > 1;
    this.offTrack.setVisible(off && Math.floor(time / 250) % 2 === 0);
    this.updateAirtimeCoach(time, gs.airtimeTrainingView);
    this.updateStoryAirtime(time, gs.player);
    this.updateAirbrakeRehearsal(time, gs.trainingTutorialView);
  }

  updateStoryAirtime(time, player) {
    if (!this.storyAirtimeText) return;
    if (player.airborne) {
      this.storyAirtimeHoldUntil = time + 650;
      this.storyAirtimeText
        .setText(`AIR  ${player.jumpElapsed.toFixed(1)}s`)
        .setColor('#00e5ff')
        .setVisible(true);
      return;
    }
    if (player.justLanded) {
      this.storyAirtimeHoldUntil = time + 650;
      this.storyAirtimeText
        .setText(`AIR  ${player.lastAirtime.toFixed(1)}s`)
        .setColor('#ffcf3f')
        .setVisible(true);
      return;
    }
    this.storyAirtimeText.setVisible(time < this.storyAirtimeHoldUntil);
  }

  createFlightHud() {
    const cyan = 0x22d8ff;
    const dark = 0x05111f;
    this.flightHudGraphics = this.add.graphics().setDepth(82);
    this.flightControlsHideAt = this.time.now + 6000;

    // Chamfered left instrument bay. A single grouped read replaces Air
    // School's jump card and the generic objective list.
    const left = this.add.graphics().setDepth(82);
    left.fillStyle(dark, 0.76);
    left.lineStyle(1, cyan, 0.72);
    left.beginPath();
    left.moveTo(16, 16);
    left.lineTo(184, 16);
    left.lineTo(202, 34);
    left.lineTo(202, 152);
    left.lineTo(184, 170);
    left.lineTo(16, 170);
    left.closePath();
    left.fillPath();
    left.strokePath();

    this.flightModeText = this.add.text(32, 30, 'FLIGHT MODE', {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '17px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#05111f', strokeThickness: 4,
    }).setDepth(84);
    this.flightRingsText = this.add.text(32, 58, 'RINGS', {
      fontSize: '11px', fontStyle: 'bold', color: '#67e8ff',
      stroke: '#05111f', strokeThickness: 3,
    }).setDepth(84);
    this.flightRingsValue = this.add.text(184, 51, '0/10', {
      fontSize: '23px', fontStyle: 'bold', color: '#67e8ff',
      stroke: '#05111f', strokeThickness: 4,
    }).setOrigin(1, 0).setDepth(84);
    this.flightObjectiveLabel = this.add.text(32, 88, 'OBJECTIVE', {
      fontSize: '9px', fontStyle: 'bold', color: '#7897ab',
    }).setDepth(84);
    this.flightObjectiveText = this.add.text(32, 105, '', {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '15px', fontStyle: 'bold', color: '#ffffff', lineSpacing: -2,
      stroke: '#05111f', strokeThickness: 3,
    }).setDepth(84);
    this.flightAltitudeText = this.add.text(32, 146, 'ALT 00', {
      fontSize: '11px', fontStyle: 'bold', color: '#67e8ff',
      stroke: '#05111f', strokeThickness: 3,
    }).setDepth(84);

    this.flightProgressValue = this.add.text(400, 42, '0%', {
      fontSize: '9px', fontStyle: 'bold', color: '#67e8ff',
      stroke: '#05111f', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(84);

    this.flightSpeedText = this.add.text(736, 510, '0', {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '38px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#05111f', strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(84);
    this.flightSpeedLabel = this.add.text(736, 554, 'SPEED', {
      fontSize: '10px', fontStyle: 'bold', color: '#67e8ff',
      stroke: '#05111f', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(84);
    this.flightControlsText = this.add.text(400, 576, '', {
      fontSize: '9px', fontStyle: 'bold', color: '#b5cad6',
      stroke: '#05111f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(84);
    this.flightHudParts = [
      left, this.flightHudGraphics,
      this.flightModeText, this.flightRingsText, this.flightRingsValue,
      this.flightObjectiveLabel, this.flightObjectiveText,
      this.flightAltitudeText, this.flightProgressValue,
      this.flightSpeedText, this.flightSpeedLabel, this.flightControlsText,
    ];
    this.speedText = this.flightSpeedText;
  }

  updateFlightHud(time, progress) {
    const gs = this.gs;
    const device = gs.controls?.pad ? 'gamepad' : 'keyboard';
    const view = flightHudView({
      state: gs.flightSchool,
      progress,
      speed: gs.player.speed,
      maxSpeed: TUNING.maxSpeed,
      device,
    });
    this.flightRingsValue.setText(view.rings);
    this.flightObjectiveText.setText(view.objective);
    this.flightAltitudeText.setText(view.altitude);
    this.flightProgressValue.setText(view.progressLabel);
    this.flightControlsText
      .setText(view.controls)
      .setAlpha(view.showControls && time < this.flightControlsHideAt ? 1 : 0);

    const g = this.flightHudGraphics;
    g.clear();
    // Top transit ribbon: clipped-corner glass and a luminous navigation rail.
    g.fillStyle(0x05111f, 0.7);
    g.fillRoundedRect(210, 14, 380, 36, 7);
    g.lineStyle(1, 0x22d8ff, 0.62);
    g.strokeRoundedRect(210, 14, 380, 36, 7);
    g.fillStyle(0x102a3b, 0.94);
    g.fillRect(224, 25, 352, 8);
    g.fillStyle(0x22d8ff, 0.28);
    g.fillRect(224, 23, 352 * view.progress, 12);
    g.fillStyle(0x67e8ff, 1);
    g.fillRect(224, 25, 352 * view.progress, 8);

    // The circular speed read echoes the concept without eating the route.
    const cx = 736;
    const cy = 542;
    const pulse = view.phase === 'flight' ? 0.74 + Math.sin(time / 130) * 0.12 : 0.58;
    g.fillStyle(0x05111f, 0.68);
    g.fillCircle(cx, cy, 51);
    g.lineStyle(7, 0x0e3852, 0.82);
    g.strokeCircle(cx, cy, 45);
    g.lineStyle(3, 0x22d8ff, pulse);
    g.beginPath();
    g.arc(cx, cy, 45, Math.PI * 0.68,
      Math.PI * (0.68 + Math.min(1, view.speedRatio / 1.35) * 1.64));
    g.strokePath();
    g.lineStyle(1, 0x67e8ff, 0.5);
    g.strokeCircle(cx, cy, 51);
  }

  createObjectiveToast() {
    const x = 10;
    const y = this.hudPolicy.airtimeCoach ? 150 : 68;
    const w = 230;
    const h = 38;
    const panel = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x080812, 0.88)
      .setStrokeStyle(1, 0x2ee56b, 0.85)
      .setDepth(88);
    const accent = this.add.rectangle(x + 3, y + h / 2, 6, h, 0x2ee56b, 1)
      .setDepth(89);
    this.objectiveToastText = this.add.text(x + 15, y + 10, '', {
      fontSize: '13px', fontStyle: 'bold', color: '#2ee56b',
      stroke: '#080812', strokeThickness: 3,
    }).setDepth(90);
    this.objectiveToastParts = [panel, accent, this.objectiveToastText];
    this.objectiveToastParts.forEach((part) => part.setAlpha(0));
    this.objectiveToastSequence = 0;
  }

  updateObjectiveToast() {
    if (!this.objectiveToastParts) return;
    // Critical damage has priority in this same physical slot. Objective
    // events remain in the authoritative array and are consumed afterward.
    if (this.criticalDamageVisible) return;
    if (this.objectiveToastBusy) return;
    const event = nextObjectiveFeedback(
      this.gs.objectiveHudEvents,
      this.objectiveToastSequence,
    );
    if (!event) return;
    this.objectiveToastSequence = event.sequence;
    this.objectiveToastBusy = true;
    this.tweens.killTweensOf(this.objectiveToastParts);
    this.objectiveToastText.setText(`✓  ${event.hudLabel ?? event.label}`);
    this.objectiveToastParts.forEach((part) => part.setAlpha(1));
    this.tweens.add({
      targets: this.objectiveToastParts,
      alpha: 0,
      delay: 800,
      duration: 240,
      ease: 'Quad.in',
      onComplete: () => { this.objectiveToastBusy = false; },
    });
  }

  createStyleReward() {
    const x = 10;
    const y = 110;
    const width = 230;
    const height = 58;
    this.styleRewardIcon = this.add.graphics().setDepth(92);
    this.styleRewardTitle = this.add.text(x + 52, y + 5, '', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#080812', strokeThickness: 5,
    }).setDepth(93);
    this.styleRewardDetail = this.add.text(x + 53, y + 36, '', {
      fontSize: '13px', fontStyle: 'bold', color: '#ffcf3f',
      stroke: '#080812', strokeThickness: 3,
    }).setDepth(93);
    this.styleRewardLayout = { x, y, width, height };
    this.styleRewardParts = [
      this.styleRewardIcon,
      this.styleRewardTitle,
      this.styleRewardDetail,
    ];
    this.styleRewardParts.forEach((part) => part.setAlpha(0));
    this.reducedMotion = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches === true;
  }

  drawStyleRewardChrome(view) {
    const { x, y } = this.styleRewardLayout;
    const icon = this.styleRewardIcon;
    icon.clear();
    icon.lineStyle(4, view.color, 1);
    const cx = x + 30;
    const cy = y + 29;
    if (view.icon === 'cones') {
      icon.strokeTriangle(cx - 10, cy + 13, cx, cy - 14, cx + 10, cy + 13);
      icon.lineBetween(cx - 7, cy + 5, cx + 7, cy + 5);
    } else if (view.icon === 'chevrons') {
      [-8, 4].forEach((offset) => {
        icon.lineBetween(cx + offset - 7, cy - 12, cx + offset + 4, cy);
        icon.lineBetween(cx + offset + 4, cy, cx + offset - 7, cy + 12);
      });
    } else if (view.icon === 'wings') {
      icon.lineBetween(cx, cy + 9, cx, cy - 12);
      icon.lineBetween(cx, cy - 2, cx - 14, cy - 10);
      icon.lineBetween(cx, cy - 2, cx + 14, cy - 10);
      icon.lineBetween(cx, cy + 6, cx - 11, cy + 1);
      icon.lineBetween(cx, cy + 6, cx + 11, cy + 1);
    } else if (view.icon === 'triple') {
      [-9, 0, 9].forEach((offset) => {
        icon.lineBetween(cx + offset, cy + 12, cx + offset, cy - 12);
        icon.lineBetween(cx + offset, cy - 12, cx + offset - 4, cy - 5);
      });
    } else {
      icon.strokeTriangle(cx - 11, cy + 13, cx + 3, cy - 15, cx + 10, cy + 13);
      icon.strokeCircle(cx + 1, cy + 6, 6);
    }
    icon.lineStyle(2, view.color, 0.72);
    icon.lineBetween(x + 50, y + 56, x + 178, y + 56);
    icon.lineBetween(x + 184, y + 56, x + 211, y + 56);
    // Higher Endless chains add more rails around the same borderless reward
    // silhouette. The tier therefore survives grayscale without becoming a
    // large opaque panel over the road.
    for (let tier = 1; tier < Math.min(5, view.spectacle); tier += 1) {
      const railY = y + 56 - tier * 5;
      icon.lineStyle(1 + tier * 0.35, view.color, 0.35 + tier * 0.1);
      icon.lineBetween(x + 54 + tier * 7, railY, x + 211 - tier * 4, railY);
    }
  }

  updateStyleReward() {
    if (!this.styleRewardParts || !this.gs.styleTracker) return;
    if (!this.styleRewardBusy && !this.criticalDamageVisible) {
      const event = this.gs.styleTracker.takeReward();
      const view = styleRewardView(event);
      if (view) this.presentStyleReward(view);
    }
    if (this.styleRewardBusy) return;
    this.styleRewardParts.forEach((part) => part.setAlpha(0));
  }

  presentStyleReward(view) {
    this.styleRewardBusy = true;
    this.drawStyleRewardChrome(view);
    this.styleRewardTitle
      .setText(view.title)
      .setFontSize(view.title.length > 14 ? 19 : 22)
      .setColor('#ffffff')
      .setScale(this.reducedMotion ? 1 : 0.78);
    this.styleRewardDetail.setText(view.detail).setColor(
      `#${view.color.toString(16).padStart(6, '0')}`,
    );
    this.styleRewardParts.forEach((part) => part.setAlpha(1));
    MUSIC.playStyleReward(view.styleId);
    if (view.cash > 0) MUSIC.playCashReward();
    if (!this.reducedMotion) {
      const payoffScale = Math.min(1.24, 1.06 + view.spectacle * 0.035);
      this.tweens.add({
        targets: this.styleRewardTitle,
        scale: payoffScale,
        duration: 150 + view.spectacle * 18,
        ease: 'Back.out',
        yoyo: true,
      });
    }
    this.tweens.add({
      targets: this.styleRewardParts,
      alpha: 0,
      delay: this.reducedMotion ? 1250 : 1050,
      duration: this.reducedMotion ? 1 : 260,
      ease: 'Quad.in',
      onComplete: () => {
        this.styleRewardBusy = false;
        this.styleRewardTitle.setScale(1);
      },
    });
  }

  createRivalToast() {
    const x = 10;
    const y = this.hudPolicy.objectiveToast ? 110 : 68;
    const w = 230;
    const h = 38;
    this.rivalToastPanel = this.add.rectangle(
      x + w / 2, y + h / 2, w, h, 0x080812, 0.88,
    ).setStrokeStyle(1, 0x00e5ff, 0.8).setDepth(88);
    this.rivalToastAccent = this.add.rectangle(
      x + 3, y + h / 2, 6, h, 0x00e5ff, 1,
    ).setDepth(89);
    this.rivalToastText = this.add.text(x + 15, y + 10, '', {
      fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#080812', strokeThickness: 3,
    }).setDepth(90);
    this.rivalToastParts = [
      this.rivalToastPanel, this.rivalToastAccent, this.rivalToastText,
    ];
    this.rivalToastParts.forEach((part) => part.setAlpha(0));
  }

  createRivalEventHud() {
    const makePanel = (x) => this.add.rectangle(
      x + 72, 30, 144, 44, 0x080812, 0.82,
    ).setStrokeStyle(1, 0x00e5ff, 0.5).setDepth(60);

    this.rivalTimerPanel = makePanel(10);
    this.rivalTimerLabel = this.add.text(20, 14, 'TIME', {
      fontSize: '10px', fontStyle: 'bold', color: '#b8b8c8',
      stroke: '#080812', strokeThickness: 3,
    }).setDepth(61);
    this.rivalTimerText = this.add.text(144, 22, '--:--', {
      fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#080812', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(61);

    this.rivalCarsPanel = makePanel(this.scale.width - 154);
    this.rivalCarsLabel = this.add.text(this.scale.width - 144, 14, 'TAKEDOWNS', {
      fontSize: '10px', fontStyle: 'bold', color: '#b8b8c8',
      stroke: '#080812', strokeThickness: 3,
    }).setDepth(61);
    this.rivalCarsText = this.add.text(this.scale.width - 20, 20, '0', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#080812', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(61);

    this.rivalEventParts = [
      this.rivalTimerPanel,
      this.rivalTimerLabel,
      this.rivalTimerText,
      this.rivalCarsPanel,
      this.rivalCarsLabel,
      this.rivalCarsText,
    ];
  }

  updateRivalEventHud(publicView, rivals, time) {
    const startingCars = publicView.startingCars ??
      this.gs.trackData?.rivals?.count ?? 3;
    const visibleCars = rivals.filter((rival) =>
      rival?.active !== false && rival?.eliminated !== true &&
      rival?.state !== 'wrecked'
    ).length;
    const view = rivalEventHudView({
      timeRemainingSeconds: publicView.timeRemainingSeconds ??
        this.gs.rivalTimeRemaining,
      carsRemaining: publicView.carsRemaining ?? visibleCars,
      startingCars,
      takedowns: publicView.takedowns,
      scoreAttack: !!publicView.scoreAttack,
      lap: publicView.lap ?? this.gs.race?.lap,
    });
    const timerColor = view.critical ? '#ff6b6b'
      : view.urgent ? '#ffcf3f' : '#ffffff';
    this.rivalTimerText
      .setText(view.timeText)
      .setColor(timerColor)
      .setAlpha(view.critical ? 0.72 + Math.sin(time / 90) * 0.28 : 1);
    this.rivalTimerPanel.setStrokeStyle(
      1,
      view.critical ? 0xff6b6b : view.urgent ? 0xffcf3f : 0x00e5ff,
      view.urgent ? 0.9 : 0.5,
    );
    this.rivalCarsLabel.setText(view.counterLabel);
    this.rivalCarsText
      .setText(view.carsText)
      .setColor(view.cleared ? '#2ee56b' : '#ffffff');
    this.rivalCarsPanel.setStrokeStyle(
      1,
      view.cleared ? 0x2ee56b : 0x00e5ff,
      view.cleared ? 0.9 : 0.5,
    );
  }

  updateRivalToast() {
    if (!this.rivalToastParts || this.rivalToastBusy) return;
    const event = nextObjectiveFeedback(
      this.gs.rivalHudEvents,
      this.rivalToastSequence,
    );
    if (!event) return;
    this.rivalToastSequence = event.sequence;
    this.rivalToastBusy = true;
    const color = event.tone === 'success' ? '#2ee56b'
      : event.tone === 'danger' || event.tone === 'failure' ? '#ff6b6b'
        : event.tone === 'warning' ? '#ffcf3f' : '#00e5ff';
    const numeric = Phaser.Display.Color.HexStringToColor(color).color;
    this.tweens.killTweensOf(this.rivalToastParts);
    this.rivalToastText.setText(event.label).setColor(color);
    this.rivalToastPanel.setStrokeStyle(1, numeric, 0.8);
    this.rivalToastAccent.setFillStyle(numeric, 1);
    this.rivalToastParts.forEach((part) => part.setAlpha(1));
    this.tweens.add({
      targets: this.rivalToastParts,
      alpha: 0,
      delay: 720,
      duration: 220,
      ease: 'Quad.in',
      onComplete: () => { this.rivalToastBusy = false; },
    });
  }

  createAirtimeCoach() {
    // This single teaching chip owns the safe left column. It never competes
    // with an objective stack or crosses into the rising car's screen area.
    const panelX = 10;
    const panelY = 66;
    const panelW = 230;
    const panelH = 76;
    this.airtimeCoachLayout = { panelX, panelY, panelW, panelH };

    this.airtimeCoachPanel = this.add.rectangle(
      panelX + panelW / 2,
      panelY + panelH / 2,
      panelW,
      panelH,
      0x0a0a14,
      0.82,
    ).setStrokeStyle(1, 0x00e5ff, 0.5).setDepth(70);
    this.airtimeCoachAccent = this.add.rectangle(
      panelX + 3,
      panelY + panelH / 2,
      5,
      panelH - 10,
      0x00e5ff,
      0.9,
    ).setDepth(71);
    this.airtimeCoachTitle = this.add.text(panelX + 12, panelY + 7, '', {
      fontSize: '11px', color: '#00e5ff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 3,
    }).setDepth(72);
    this.airtimeCoachValue = this.add.text(panelX + panelW - 10, panelY + 4, '', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(72);
    this.airtimeCoachDetail = this.add.text(panelX + 12, panelY + 28, '', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 3,
    }).setDepth(72);

    this.airtimeMeterBack = this.add.rectangle(
      panelX + panelW / 2,
      panelY + 48,
      panelW - 24,
      6,
      0x3a3a46,
      1,
    ).setDepth(72).setVisible(false);
    this.airtimeMeterFill = this.add.rectangle(
      panelX + 12,
      panelY + 48,
      1,
      6,
      0xffcf3f,
      1,
    ).setOrigin(0, 0.5).setDepth(73).setVisible(false);
    this.airtimeCoachControls = this.add.text(
      panelX + panelW / 2,
      panelY + panelH - 13,
      '',
      {
        fontSize: '9px', color: '#b8b8c8', fontStyle: 'bold',
        align: 'center', stroke: '#0a0a14', strokeThickness: 3,
      },
    ).setOrigin(0.5).setDepth(72);

    this.airtimeCoachParts = [
      this.airtimeCoachPanel,
      this.airtimeCoachAccent,
      this.airtimeCoachTitle,
      this.airtimeCoachValue,
      this.airtimeCoachDetail,
      this.airtimeMeterBack,
      this.airtimeMeterFill,
      this.airtimeCoachControls,
    ];
    this.airtimeCoachParts.forEach((part) => part.setAlpha(0));
    this.tweens.add({
      targets: this.airtimeCoachParts,
      alpha: 1,
      delay: 180,
      duration: 360,
      ease: 'Quad.out',
    });
  }

  updateAirtimeCoach(time, telemetry) {
    if (!this.airtimeCoachPanel) return;
    const device = this.gs.controls?.pad ? 'gamepad' : 'keyboard';
    const view = airtimeCoachView(telemetry, device);
    const color = Phaser.Display.Color.HexStringToColor(view.color).color;

    this.airtimeCoachTitle.setText(view.title).setColor(view.color);
    this.airtimeCoachValue.setText(view.value).setColor(view.color);
    this.airtimeCoachDetail.setText(view.detail);
    this.airtimeCoachControls.setText(view.controls);
    this.airtimeCoachAccent.setFillStyle(color, 0.9);

    const hasMeter = view.meter != null;
    this.airtimeMeterBack.setVisible(hasMeter);
    this.airtimeMeterFill
      .setVisible(hasMeter)
      .setDisplaySize((this.airtimeCoachLayout.panelW - 24) * (view.meter ?? 0), 6)
      .setFillStyle(color, 1);
    this.airtimeCoachDetail.y = this.airtimeCoachLayout.panelY + 28;

    // Pulse the accent, never the instructions: success/readiness should be
    // noticeable in peripheral vision without making the help hard to read.
    this.airtimeCoachAccent.setAlpha(
      view.pulse ? 0.7 + Math.sin(time / 105) * 0.3 : 0.9,
    );
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
    // Damage and objective confirmations share one bounded upper-left slot.
    // The cracks carry persistent state; this compact card only announces a
    // state change, then gives training goals their space back.
    const panel = this.add.graphics();
    panel.fillStyle(0x080812, 0.92);
    panel.fillRect(0, 0, 230, 38);
    panel.fillStyle(0xff2d55, 1);
    panel.fillRect(0, 0, 6, 38);

    this.criticalDamageAccent = this.add.graphics();
    this.criticalDamageAccent.lineStyle(2, 0xff6b6b, 1);
    this.criticalDamageAccent.strokeTriangle(10, 29, 19, 8, 28, 29);
    this.criticalDamageAccent.lineBetween(19, 14, 19, 22);
    this.criticalDamageAccent.fillStyle(0xff6b6b, 1);
    this.criticalDamageAccent.fillCircle(19, 26, 1.5);

    this.criticalDamageTitle = this.add.text(36, 2, 'CRITICAL DAMAGE', {
      fontSize: '15px', fontStyle: 'bold', color: '#ff6b6b',
      stroke: '#080812', strokeThickness: 3,
    });
    this.criticalDamageDetail = this.add.text(36, 21, '', {
      fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#080812', strokeThickness: 2,
    });
    this.criticalDamageContainer = this.add.container(
      10, 68,
      [panel, this.criticalDamageAccent, this.criticalDamageTitle, this.criticalDamageDetail],
    ).setDepth(102).setVisible(false);
    this.criticalDamageParts = [this.criticalDamageContainer];
    this.criticalDamageVisible = false;
  }

  updateCriticalDamageWarning(time, state) {
    const stageChanged = state.stage !== this.criticalDamageStage;
    this.criticalDamageStage = state.stage;
    if (!state.critical) {
      this.pendingCriticalDamageState = null;
      this.criticalDamageUntil = 0;
    } else if (stageChanged) {
      this.pendingCriticalDamageState = { ...state };
    }

    // A confirmation already visible in the same slot finishes first. Its
    // event is never erased by damage arriving on the same frame.
    if (this.pendingCriticalDamageState && !this.objectiveToastBusy) {
      const view = damageNoticeView({
        state: this.pendingCriticalDamageState,
        training: this.training,
        thresholds: this.gs.trackData?.scoring?.thresholds,
        hits: this.gs.trainingDamageHits,
      });
      this.pendingCriticalDamageState = null;
      if (view) {
        this.criticalDamageTitle.setText(view.title);
        this.criticalDamageDetail.setText(view.detail);
        this.criticalDamageUntil = time + view.durationMs;
        this.tweens.killTweensOf(this.criticalDamageContainer);
        this.criticalDamageContainer.setX(-8).setVisible(true).setAlpha(1);
        this.tweens.add({
          targets: this.criticalDamageContainer,
          x: 10,
          duration: 160,
          ease: 'Quad.out',
        });
      }
    }

    const visible = time < this.criticalDamageUntil;
    if (visible !== this.criticalDamageVisible) {
      this.criticalDamageVisible = visible;
      this.criticalDamageContainer.setVisible(visible);
      this.objectivePanelParts?.forEach((part) => part.setVisible(!visible));
    }
    if (!visible) return;
    // At most ~1.3 gentle pulses/second—far below a flashing hazard.
    this.criticalDamageAccent.setAlpha(0.75 + Math.sin(time / 240) * 0.25);
    if (state.destroyed && this.training) {
      const refreshed = damageNoticeView({
        state,
        training: true,
        thresholds: this.gs.trackData?.scoring?.thresholds,
        hits: this.gs.trainingDamageHits,
      });
      this.criticalDamageDetail.setText(refreshed?.detail ?? 'GOALS STILL TRACKED');
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

function formatStoryTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const wholeSeconds = Math.ceil(safe);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function ordinalSuffix(place) {
  if (place % 100 >= 11 && place % 100 <= 13) return 'TH';
  return place % 10 === 1 ? 'ST' : place % 10 === 2 ? 'ND' : place % 10 === 3 ? 'RD' : 'TH';
}
