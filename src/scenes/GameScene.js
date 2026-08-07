// GameScene.js — orchestration for both modes. Owns the loop, wires input,
// HUD, debug panel. Mode differences select a track collection, race finish
// rule, and result flow; gameplay logic lives in road/, entities/, and systems/.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { EndlessTrack } from '../road/EndlessTrack.js';
import { RoadRenderer } from '../road/RoadRenderer.js';
import { Player } from '../entities/Player.js';
import { RaceState, fmtTime } from '../systems/RaceState.js';
import { submitScore } from '../systems/HighScores.js';
import { checkObstacleHit } from '../systems/Collision.js';
import { Controls } from '../systems/Controls.js';
import { Popularity } from '../systems/Popularity.js';
import { ObjectiveState } from '../systems/ObjectiveState.js';
import { trainingCueDecision } from '../systems/TrainingCue.js';
import { submitTrainingResult } from '../systems/TrainingProgress.js';
import { RACER } from '../systems/RacerState.js';
import { buttonDown, getPrimaryPad } from '../systems/Gamepad.js';
import { TRACKS, TRAINING_TRACKS } from '../tracks/index.js';
import { MUSIC } from '../audio/MusicEngine.js';
import { HIGH_SPEED_THEME } from '../audio/tracks/highSpeedTheme.js';
import { TRAINING_LOOP_THEME } from '../audio/tracks/trainingLoopTheme.js';
import { NEON_GULCH_THEME } from '../audio/tracks/neonGulchTheme.js';
import { SYNDICATE_RUN_THEME } from '../audio/tracks/syndicateRunTheme.js';

// Theme identities can be shared by geometry variants (Training Loop and its
// Story validation race). Endless keeps the original high-speed score.
const CAMPAIGN_THEMES = {
  'training-loop': TRAINING_LOOP_THEME,
  'neon-gulch': NEON_GULCH_THEME,
  'syndicate-run': SYNDICATE_RUN_THEME,
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // Scene launch data arrives here, before create().
  init(data) {
    this.mode = data.mode ?? 'story';
    this.trackIndex = data.trackIndex ?? 0;
    this.garageData = null;
  }

  create() {
    // State lives HERE, not the constructor — create() re-runs per start.
    if (this.mode === 'endless') {
      this.model = new EndlessTrack(TUNING);
      this.race = null;
      this.trackData = null;
    } else {
      const trackList = this.mode === 'training' ? TRAINING_TRACKS : TRACKS;
      this.trackData = trackList[this.trackIndex];
      this.model = new RoadModel(TUNING);
      this.model.buildFromData(this.trackData);
      this.race = new RaceState(this.model, this.trackData.laps ?? 3, {
        finishOnLapLimit: this.trackData.finish !== 'objectives',
      });
    }
    this.objectives = new ObjectiveState(this.trackData?.objectives, this.model);
    this.renderer = new RoadRenderer(
      this,
      TUNING,
      this.trackData?.environment ?? this.trackData?.id ?? 'endless',
    );
    this.player = new Player(TUNING);
    // Player.position wraps at a campaign lap line. Scenery distance does not,
    // so background drift remains continuous rather than snapping each lap.
    this.sceneryDistance = 0;

    // Rolling grid start: sit the car behind the start/finish line so the
    // gantry is ahead and visible at the lights, then drive THROUGH it to
    // begin. The line stays at position 0 (the lap-count wrap boundary), so
    // crossing it and completing a lap are the same event on the same gate.
    if (this.race) {
      this.player.position = this.model.trackLength - TUNING.gridSetback;
      this.race.prevPos = this.player.position; // don't misread the spawn as a wrap
    }
    this.pop = new Popularity(TUNING);
    this.nitro = 0; // pocketed boosts (see TUNING.nitroMax)
    this.speedLineBurst = 0; // ramp/boost streak-bloom, decays over speedLineBurstTime
    this.wasOnZipper = false;
    this.prevNitroHeld = false;
    this.trainingDamageHits = 0;
    this.trainingDamageMax = this.trackData?.trainingDamage?.maxHits ?? 0;
    this.trainingDamageTaught = false; // one-time "rocks damage you" notice, shown on first hit
    this.coneHits = 0;        // running index for loose-cone smash variety
    this.conesThisLap = 0;    // cones collected on the current lap (reset each lap)
    // Cones reset at the line, so the finishing lap is the fair "did you get
    // them" check. A track with no cones leaves this at zero and never gates.
    this.trainingConeTotal = (this.trackData?.objects ?? [])
      .filter((object) => object.kind === 'cone').length;
    this.trainingTutorial = null;
    this.trainingTutorialView = null;
    this.completedTrainingCues = new Set();
    this.failedTrainingCues = new Set();
    this.done = false;

    // Bottom-anchored (origin 0.5,1): the sprite's y IS its rear-bumper
    // line, not its center. Center-anchoring was the actual "too close to
    // the bottom" bug — scaling up grew the car in BOTH directions, so a
    // bigger Car Size pushed the bottom half off-canvas along with making
    // the top bigger. Bottom-anchoring means Car Size only ever grows the
    // car upward into the road, never off the bottom edge.
    this.carBaselineY = this.scale.height - 24;
    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.carBaselineY, 'car', 2)
      .setOrigin(0.5, 1)
      .setScale(TUNING.carScale)
      .setDepth(10);

    this.controls = new Controls(this);
    this.input.keyboard.on('keydown-ESC', () => this.quitToTitle());
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-R', () => this.retryTraining());

    this.iframes = 0; // post-hit invulnerability countdown
    this.boostCooldown = 0; // one pad = one kick, even if we overlap for 2 frames

    // Center-screen banner: race intro, lap flash, results.
    this.banner = this.add
      .text(this.scale.width / 2, 250, '', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#0a0a14',
        strokeThickness: 5,
        lineSpacing: 6,
        wordWrap: { width: this.scale.width - 120 }, // no more edge bleed
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (this.trackData) {
      if (this.objectives.active) this.showObjectiveIntro();
      else this.showBanner(`${this.trackData.name}\n${this.trackData.intro}`, 3500);
    } else {
      this.showBanner('ENDLESS\nThe road never ends. You will.', 3000);
    }

    this.hookDebugPanel();

    // Keep the briefing visually clean. The parallel HUD comes online when
    // the player acknowledges the objectives and the race clock can start.
    this.hudLaunched = false;
    if (!this.awaitingBriefing) this.launchHud();
    this.events.once('shutdown', () => this.scene.stop('HudScene'));

    // Procedural score — synthesized live, not a loaded file (see
    // audio/MusicEngine.js). Starting it here rides the ENTER/click that
    // got us into this scene, which satisfies browsers' audio-autoplay
    // gesture requirement.
    MUSIC.setVolume(TUNING.musicVolume);
    MUSIC.setSfxVolume(TUNING.sfxVolume);
    const themeId = this.trackData?.music ?? this.trackData?.id;
    const theme = this.trackData ? CAMPAIGN_THEMES[themeId] ?? HIGH_SPEED_THEME : HIGH_SPEED_THEME;
    MUSIC.start(theme);
    this.events.once('shutdown', () => MUSIC.stop());
  }

  update(_time, delta) {
    // Result banners answer the controller: cross advances, circle bails.
    // Edge-detected poll, same reasoning as the title menu.
    const pad = getPrimaryPad(this.input.gamepad);
    const padNow = {
      a: buttonDown(pad, 0, 'A'),
      b: buttonDown(pad, 1, 'B'),
      x: buttonDown(pad, 2, 'X'),
    };
    const padPrev = this.prevPad ?? { a: true, b: true, x: true };
    this.prevPad = padNow;

    if (this.done) {
      if (padNow.a && !padPrev.a) this.advance();
      if (padNow.b && !padPrev.b) this.quitToTitle();
      if (padNow.x && !padPrev.x) this.retryTraining();
      return; // banner is up; keyboard ENTER/ESC still work too
    }

    if (this.awaitingBriefing) {
      if (
        padNow.a && !padPrev.a &&
        this.time.now >= this.briefingAcceptAt
      ) this.dismissObjectiveIntro();
      if (padNow.b && !padPrev.b) this.quitToTitle();
      this.renderer.render(this.model, this.player, 0, 0, this.sceneryDistance);
      return; // no movement, collisions, or race time behind the briefing
    }

    if (this.trainingTutorial) {
      const tutorialInput = this.controls.read(TUNING);
      this.updateTrainingTutorial(tutorialInput);
      const speedPercent = this.player.speed / TUNING.maxSpeed;
      this.renderer.render(
        this.model,
        this.player,
        speedPercent,
        this.speedLineBurst,
        this.sceneryDistance,
      );
      return; // deliberate freeze: no race clock, movement, or collisions
    }

    const dt = Math.min(delta, 50) / 1000;
    const input = this.controls.read(TUNING);

    // Nitro: edge-detected — one burn per press, if there's one to burn.
    if (input.nitro && !this.prevNitroHeld && this.nitro > 0) {
      this.nitro--;
      this.onBoost();
    }
    this.prevNitroHeld = input.nitro;

    this.player.update(dt, input, this.model);
    this.sceneryDistance += this.player.speed * dt;
    this.maybeStartTrainingTutorial(input);

    // Zipper crossings: edge-triggered per strip (kick on entry, re-arm on
    // exit), never consumed — the paint is permanent, the skill is lining
    // up on it lap after lap. Airborne cars aren't touching the road.
    {
      const seg = this.model.findSegment(this.player.position + TUNING.playerZ);
      const z = seg.zipper;
      const on = !!z && !this.player.airborne &&
        Math.abs(this.player.x - z.offset) < z.w + TUNING.playerW * 0.5;
      if (on && !this.wasOnZipper) {
        this.player.zip();
        if (this.mode === 'endless') this.pop.add(TUNING.zipPop);
        this.recordObjective('zipper_hit');
        this.popup('SPEED LINE!', '#2ee56b');
      }
      this.wasOnZipper = on;
    }

    // Contact. Airborne clears everything below — that's the point of
    // flying. i-frames only gate hazards; candy always pays.
    this.pop.update(dt);
    if (!this.player.airborne) {
      const s = checkObstacleHit(this.player, this.model, TUNING);
      if (s) {
        if (s.def.kind === 'candy') this.onCandy(s);
        else if (s.def.kind === 'launch') this.onRamp(s.def);
        else if (s.def.kind === 'pickup') this.onPickup(s);
        else if (this.iframes <= 0) this.onHit(s.def);
        else s.hit = false; // i-frames: hazard not consumed, just ghosted
      }
    }
    this.iframes = Math.max(0, this.iframes - dt);
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.speedLineBurst = Math.max(0, this.speedLineBurst - dt / TUNING.speedLineBurstTime);
    this.carSprite.setAlpha(this.iframes > 0 && Math.floor(this.iframes * 12) % 2 ? 0.4 : 1);

    if (this.mode === 'endless') {
      this.model.ensureAhead(this.player.position); // pave ahead of the car
    } else {
      const event = this.race.update(dt, this.player);
      if (event === 'start') {
        this.showBanner('GO!', 800);
      } else if (event === 'lap') {
        this.recordObjective('lap_complete');
        this.model.resetLapSprites();
        this.conesThisLap = 0; // cones re-arm at the line; grade the finishing lap
        if (this.mode === 'training') {
          const lessonMessage = this.trackData.lapMessages?.[this.race.lap];
          this.showBanner(
            lessonMessage ?? `LAP ${this.race.lap}`,
            lessonMessage ? 1800 : 1000,
          );
        } else {
          this.showBanner(`LAP ${this.race.lap} / ${this.race.laps}`, 1200);
        }
      } else if (event === 'finished') {
        this.recordObjective('lap_complete', {}, false);
        this.finishRace();
      }
    }

    const speedPercent = this.player.speed / TUNING.maxSpeed;
    this.renderer.render(
      this.model,
      this.player,
      speedPercent,
      this.speedLineBurst,
      this.sceneryDistance,
    );

    // Steering FRAMES: 0=hard-left, 1=left, 2=straight, 3=right, 4=hard-right.
    // Five buckets instead of three — needed once airbrakes are in the mix:
    // a shoulder-button bank needs to look visibly harder than a light stick
    // correction, and player.steer already blends stick + airbrake (see
    // Player.update), so one signal drives the whole 5-way read.
    const s = this.player.steer;
    const frame = s < -0.6 ? 0 : s < -0.2 ? 1 : s <= 0.2 ? 2 : s <= 0.6 ? 3 : 4;
    this.carSprite.setFrame(frame);
    // Jump arc: the sprite swells and lifts through a sine, then lands.
    const arc = this.player.airArc;
    this.carSprite.setScale(TUNING.carScale * (1 + 0.45 * arc));
    this.carSprite.y = this.carBaselineY - 46 * arc; // lift from the bumper line, not center
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;


  }

  distanceM() {
    return Math.floor(this.player.position / 100);
  }

  // Adaptive onboarding: a clean bend silently measures the result. Staying
  // on the road skips instruction; touching the shoulder schedules a safe,
  // freeze-frame rehearsal on the recovery straight before the cone chicane.
  maybeStartTrainingTutorial(input) {
    const cues = this.trackData?.trainingCues ?? [];
    if (
      cues.length === 0 ||
      !this.race?.crossedStart ||
      this.race.lap !== 1 ||
      this.trainingTutorial
    ) return;
    const segment = this.model.findSegment(
      this.player.position + TUNING.playerZ,
    );
    const cue = cues.find(
      (candidate) =>
        candidate.kind === 'airbrake-rehearsal' &&
        candidate.lap === this.race.lap &&
        !this.completedTrainingCues.has(candidate.id),
    );
    if (!cue) return;

    const decision = trainingCueDecision(cue, {
      lap: this.race.lap,
      segmentIndex: segment.index,
      offRoad: Math.abs(this.player.x) > 1,
      failed: this.failedTrainingCues.has(cue.id),
    });
    if (decision.failed) {
      this.failedTrainingCues.add(cue.id);
    }
    if (decision.action === 'none') return;
    if (decision.action === 'pass') {
      this.completedTrainingCues.add(cue.id); // demonstrated through play
      return;
    }

    this.trainingTutorial = {
      cue,
      step: 0, // road order: right shoulder, then left shoulder
      waitingForRelease: true,
      acceptAt: this.time.now + 250,
      completeAt: null,
      device: input.connected ? 'gamepad' : 'keyboard',
    };
    // Training assistance restores a fair setup instead of carrying the miss
    // into the teaching corner. It is help, never an extra punishment beat.
    this.player.x = 0;
    this.player.speed = Math.max(this.player.speed, TUNING.maxSpeed * 0.8);
    this.carSprite.setFrame(2);
    this.syncTrainingTutorialView(false);
  }

  updateTrainingTutorial(input) {
    const tutorial = this.trainingTutorial;
    if (!tutorial) return;
    tutorial.device = input.connected ? 'gamepad' : 'keyboard';
    const anyHeld = input.airbrakeL || input.airbrakeR;

    if (tutorial.completeAt != null) {
      if (this.time.now >= tutorial.completeAt && !anyHeld) {
        this.completedTrainingCues.add(tutorial.cue.id);
        this.trainingTutorial = null;
        this.trainingTutorialView = null;
        this.carSprite.setFrame(2);
      } else {
        this.syncTrainingTutorialView(false);
      }
      return;
    }

    const direction = tutorial.step === 0 ? 1 : -1;
    const correctHeld = direction > 0 ? input.airbrakeR : input.airbrakeL;
    if (tutorial.waitingForRelease) {
      if (!anyHeld && this.time.now >= tutorial.acceptAt) {
        tutorial.waitingForRelease = false;
        this.carSprite.setFrame(2);
      }
    } else if (correctHeld) {
      this.carSprite.setFrame(direction > 0 ? 4 : 0);
      tutorial.step++;
      tutorial.waitingForRelease = true;
      tutorial.acceptAt = this.time.now + 160;
      if (tutorial.step >= 2) tutorial.completeAt = this.time.now + 450;
    }
    this.syncTrainingTutorialView(correctHeld);
  }

  syncTrainingTutorialView(pressed) {
    const tutorial = this.trainingTutorial;
    if (!tutorial) return;
    this.trainingTutorialView = {
      id: tutorial.cue.id,
      kind: tutorial.cue.kind,
      step: tutorial.step,
      device: tutorial.device,
      pressed,
      complete: tutorial.completeAt != null,
    };
  }

  onPickup(sprite) {
    if (this.nitro >= TUNING.nitroMax) {
      sprite.hit = false; // pockets full — leave it for the next lap
      return;
    }
    this.nitro++;
    this.popup('+NITRO', '#2ee56b');
  }

  onBoost() {
    if (this.boostCooldown > 0) return;
    this.boostCooldown = 0.5;
    this.player.boost();
    this.speedLineBurst = 1; // the pop reads as speed even from a standstill
    this.popup('BOOST', '#2ee56b');
    this.cameras.main.shake(50, 0.002);
  }

  onCandy(sprite) {
    const { def } = sprite;
    const result = this.objectives.record('object_hit', { sprite });
    const objective = result?.changes[0];
    // Smashing a cone always looks and sounds like a hit — the juice is a
    // property of the object, not of an objective. When a cone belongs to a
    // sweep objective the burst also carries progress/milestone weight; when
    // it's a loose warning or edge lure (Endless, campaign, Hazard Weave) it
    // still pops. `coneHits` gives loose cones the running index the burst
    // needs for variety.
    this.coneHits++;
    this.conesThisLap++;
    this.juiceConeHit(sprite, {
      index: objective ? objective.progress : this.coneHits,
      milestone: objective ? (objective.complete || objective.progress % 10 === 0) : false,
      complete: objective ? objective.complete : false,
    });
    if (objective) {
      this.popup(`CONE  ${objective.progress} / ${objective.total}`, '#ffcf3f');
      if (
        result.allComplete &&
        this.trackData.finish === 'objectives' &&
        !this.race.finishArmed
      ) {
        this.race.armFinish();
        this.showBanner(
          `${objective.total} / ${objective.total} CONES\nOBJECTIVE COMPLETE\nFINISH THIS LAP`,
          2200,
        );
      }
    }
    if (def.pop <= 0) return; // no economy reward; objectives already gave feedback
    if (this.mode === 'endless') {
      const earned = this.pop.add(def.pop);
      this.popup(`+${earned}`, '#ffcf3f');
    }
  }

  onRamp(def) {
    if (this.mode === 'endless') this.pop.add(def.pop);
    this.recordObjective('ramp_hit');
    this.player.launch();
    this.speedLineBurst = 1; // takeoff streaks: the ramp was the fast line
    this.popup('AIR!', '#00e5ff');
    this.cameras.main.shake(60, 0.003); // takeoff kick
  }

  onHit(def) {
    if (this.mode === 'training' && this.trainingDamageMax > 0) {
      this.trainingDamageHits = Math.min(
        this.trainingDamageMax,
        this.trainingDamageHits + 1,
      );
      this.iframes = TUNING.iframes;
      MUSIC.playGlassCrack(this.trainingDamageHits);
      this.popup(
        `WINDSCREEN  ${this.trainingDamageHits} / ${this.trainingDamageMax}`,
        '#ff6b6b',
      );
      // Show, don't tell: the intro never mentions damage. The player only
      // learns how it works once they prove they need to — the same adaptive
      // rule as Lesson 1's airbrake rehearsal, which stays silent until a
      // player drifts off the road.
      if (!this.trainingDamageTaught) {
        this.trainingDamageTaught = true;
        this.showBanner(
          'ROCKS CRACK YOUR WINDSCREEN\nSteer around them to stay clean\nFinish with no cracks for GOLD',
          3200,
        );
      }
      // Training damage is communication, not punishment: no speed loss,
      // campaign hull damage, wreck, or restart. The cracks affect the medal.
      this.cameras.main.shake(140, 0.01);
      this.carSprite.setTint(0xff5555).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(120, () => this.carSprite.clearTint());
      return;
    }
    if (this.mode === 'endless') this.pop.bust();
    this.player.speed *= def.slow;       // momentum is the immediate price
    const wrecked = RACER.damage(def.damage); // health is the long-term one
    this.iframes = TUNING.iframes;
    // Feedback within the same frame as the hit: shake scales with damage,
    // car flashes red. The player should FEEL the difference between a
    // cone and a rock before the health bar finishes updating.
    this.cameras.main.shake(140, def.damage >= 20 ? 0.012 : 0.004);
    this.carSprite
      .setTint(0xff4444)
      .setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(120, () => this.carSprite.clearTint());
    if (wrecked) this.onWrecked();
  }

  onWrecked() {
    this.done = true;
    if (this.mode === 'endless') {
      const dist = this.distanceM();
      const record = submitScore('endless', dist, 'max');
      RACER.money += this.pop.cash; // the crowd tips even a spectacular ending
      this.showBanner(
        `WRECKED\n${dist}m${record ? '  NEW RECORD' : ''}\nTIPS $${this.pop.cash}\n\nENTER FOR TITLE`, 0);
    } else if (this.mode === 'story') {
      this.garageData = {
        wrecked: true,
        retryTrackIndex: this.trackIndex,
        receipt: 'WRECKED — NO RACE PURSE',
      };
      this.showBanner('WRECKED\n\nENTER FOR GARAGE', 0);
    } else {
      this.showBanner('TRAINING ENDED\n\nENTER FOR TITLE', 0);
    }
  }

  finishRace() {
    this.done = true;
    const t = this.race.time;
    if (this.mode === 'training') {
      const target = this.objectives.views.find(
        (objective) => objective.id === this.trackData.scoring.objective,
      ) ?? this.objectives.primary;
      // Cones gate the trophy only when a threshold says so (Hazard Weave).
      // Where cones ARE the objective (Cone Control) they reset each lap and
      // the objective row tracks unique hits, so the finishing-lap tally must
      // not feed the trophy or the perfect flag.
      const coneGated = this.trackData.scoring?.thresholds?.some(
        (threshold) => threshold.maximumConesMissed != null,
      );
      const conesMissed = coneGated
        ? Math.max(0, this.trainingConeTotal - this.conesThisLap)
        : 0;
      const result = submitTrainingResult(this.trackData, target.progress, t, {
        damageHits: this.trainingDamageHits,
        conesMissed,
        total: target.total,
      });
      const firstTrophy = [...this.trackData.scoring.thresholds]
        .sort((a, b) => a.minimum - b.minimum)[0];
      const trophyLine = result.trophy
        ? `${result.trophy.rank.toUpperCase()} TROPHY  ${'★'.repeat(result.trophy.stars)}`
        : `NO TROPHY  •  ${firstTrophy.rank.toUpperCase()} AT ${firstTrophy.minimum}` +
          (firstTrophy.maximumDamageHits == null
            ? ''
            : ` / ${firstTrophy.maximumDamageHits} HITS MAX`);
      const perfect = target.complete && this.trainingDamageHits === 0 && conesMissed === 0;
      const nextTrack = TRAINING_TRACKS[this.trackIndex + 1];
      this.trainingAdvanceTo = nextTrack && nextTrack.status !== 'placeholder'
        ? this.trackIndex + 1
        : null;
      const damageLine = this.trainingDamageMax > 0
        ? `WINDSCREEN ${this.trainingDamageHits} / ${this.trainingDamageMax} HITS\n`
        : '';
      // Surface a cones tally only when cones gate the trophy (Hazard Weave);
      // when cones ARE the objective the objective row already reports them.
      const coneLine = coneGated && this.trainingConeTotal > 0
        ? `CONES ${this.conesThisLap} / ${this.trainingConeTotal}\n`
        : '';
      const nextLine = this.trainingAdvanceTo == null
        ? (nextTrack
          ? `NEXT: ${nextTrack.name} — COMING SOON`
          : 'TRAINING TRACK COMPLETE')
        : `LEVEL ${this.trainingAdvanceTo + 1} UNLOCKED: ` +
          `${TRAINING_TRACKS[this.trainingAdvanceTo].name}`;
      this.showBanner(
        `${perfect ? 'PERFECT CLEAR!' : 'TRAINING COMPLETE'}\n` +
          `${target.hudLabel}  ${target.progress} / ${target.total}\n` +
          damageLine +
          coneLine +
          `${trophyLine}\n${fmtTime(t)}  •  ${this.objectives.score} PTS` +
          `${result.newBest ? '  •  NEW BEST' : ''}\n\n` +
          nextLine,
        0,
      );
      this.celebrateTrainingFinish(perfect, result.trophy?.stars ?? 0);
      this.showTrainingResultActions(this.trainingAdvanceTo != null);
      return;
    }
    const record = submitScore(this.trackData.id, t, 'min');
    // Race cash remains time-based while the new course score comes from
    // completed objectives. Objective points can be balanced independently
    // without turning every stunt contact into currency.
    const par = this.trackData.par ?? 120;
    const timeCash = TUNING.basePayout + Math.max(0, Math.round((par - t) * TUNING.parRate));
    RACER.money += timeCash;
    const last = this.trackIndex >= TRACKS.length - 1;
    this.garageData = {
      nextTrackIndex: this.trackIndex + 1,
      complete: last,
      receipt: `RACING +$${timeCash}   OBJECTIVES ${this.objectives.score} PTS`,
    };
    this.showBanner(
      `FINISH  ${fmtTime(t)}${record ? '  NEW RECORD' : ''}\n` +
        `OBJECTIVES ${this.objectives.completedCount}/${this.objectives.views.length}` +
        `  •  ${this.objectives.score} PTS\n` +
        `RACING $${timeCash}\n` +
        `WALLET $${RACER.money}\n\n` +
        (last ? 'CAMPAIGN COMPLETE\nENTER FOR GARAGE' : 'ENTER FOR GARAGE'),
      0
    );
  }

  advance() {
    if (!this.done) return;
    if (this.mode === 'training') {
      if (this.trainingAdvanceTo != null) {
        this.scene.start('GameScene', {
          mode: 'training',
          trackIndex: this.trainingAdvanceTo,
        });
      } else {
        this.scene.start('TitleScene');
      }
      return;
    }
    if (this.mode === 'story' && this.garageData) {
      this.scene.start('GarageScene', this.garageData);
      return;
    }
    const last = this.trackIndex >= TRACKS.length - 1;
    if (this.mode === 'story' && !last) {
      this.scene.start('GameScene', {
        mode: 'story',
        trackIndex: this.trackIndex + 1,
      });
    } else {
      this.scene.start('TitleScene');
    }
  }

  confirm() {
    if (this.awaitingBriefing) {
      if (this.time.now >= this.briefingAcceptAt) this.dismissObjectiveIntro();
      return;
    }
    this.advance();
  }

  retryTraining() {
    if (!this.done || this.mode !== 'training') return;
    this.scene.start('GameScene', {
      mode: 'training',
      trackIndex: this.trackIndex,
    });
  }

  quitToTitle() {
    // Walking away mid-run still banks the endless distance and tips.
    if (this.mode === 'endless' && !this.done) {
      submitScore('endless', this.distanceM(), 'max');
      RACER.money += this.pop.cash;
    }
    this.scene.start('TitleScene');
  }

  recordObjective(event, payload = {}, announce = true) {
    const result = this.objectives.record(event, payload);
    if (announce && result?.newlyCompleted.length) {
      const objective = result.newlyCompleted[0];
      this.showBanner(`OBJECTIVE COMPLETE\n${objective.label}\n+${objective.points} PTS`, 1400);
    }
    return result;
  }

  // A cone should leave the world with the same decisiveness that a coin
  // leaves a kart racer: physical motion, sparks, sound, and a larger beat at
  // each ten-count milestone and the final target. Milestones fly toward the
  // chase camera; ordinary hits kick off-road so dense lines retain variation.
  juiceConeHit(sprite, { index = 0, milestone = false, complete = false } = {}) {
    MUSIC.playConeHit({ milestone, complete });

    const x = this.carSprite.x + (sprite.offset - this.player.x) * 22;
    const y = this.carSprite.y - 34;
    const cone = this.add.image(x, y, 'cone')
      .setDisplaySize(26, 34)
      .setDepth(milestone ? 38 : 24);
    const baseScaleX = cone.scaleX;
    const baseScaleY = cone.scaleY;
    const side = index % 2 === 0 ? 1 : -1;

    if (milestone) {
      this.tweens.add({
        targets: cone,
        x: this.scale.width / 2 + side * (complete ? 0 : 72),
        y: this.scale.height * 0.42,
        angle: side * (complete ? 900 : 620),
        scaleX: baseScaleX * (complete ? 5.5 : 3.6),
        scaleY: baseScaleY * (complete ? 5.5 : 3.6),
        alpha: 0,
        duration: complete ? 620 : 500,
        ease: 'Cubic.in',
        onComplete: () => cone.destroy(),
      });
    } else {
      this.tweens.add({
        targets: cone,
        x: x + side * (130 + (index % 3) * 24),
        y: y - 135,
        angle: side * 540,
        scaleX: baseScaleX * 0.35,
        scaleY: baseScaleY * 0.35,
        alpha: 0,
        duration: 480,
        ease: 'Cubic.out',
        onComplete: () => cone.destroy(),
      });
    }

    const colors = [0xff8a32, 0xffcf3f, 0x00e5ff];
    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7 + index * 0.23;
      const spark = this.add.rectangle(x, y, 4, 4, colors[i % colors.length])
        .setDepth(37);
      const distance = milestone ? 92 : 54;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: 0.2,
        alpha: 0,
        duration: milestone ? 440 : 300,
        ease: 'Quad.out',
        onComplete: () => spark.destroy(),
      });
    }
    this.cameras.main.shake(milestone ? 90 : 45, milestone ? 0.005 : 0.002);
    if (complete) this.cameras.main.flash(120, 255, 207, 63);
  }

  celebrateTrainingFinish(perfect, stars) {
    MUSIC.playTrainingComplete({ perfect, stars });
    this.cameras.main.flash(perfect ? 260 : 150, 255, 207, 63);
    const colors = [0xffcf3f, 0xff2d95, 0x00e5ff, 0x2ee56b, 0xffffff];
    const count = perfect ? 44 : 24;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const radius = 30 + (i % 5) * 7;
      const confetti = this.add.rectangle(
        this.scale.width / 2 + Math.cos(angle) * radius,
        250 + Math.sin(angle) * radius,
        5 + i % 4,
        8 + i % 3,
        colors[i % colors.length],
      ).setAngle(i * 37).setDepth(45);
      this.tweens.add({
        targets: confetti,
        x: confetti.x + Math.cos(angle) * (190 + (i % 4) * 34),
        y: confetti.y + Math.sin(angle) * 130 + 180,
        angle: confetti.angle + 540 * (i % 2 ? 1 : -1),
        alpha: 0,
        duration: 900 + (i % 5) * 90,
        ease: 'Quad.out',
        onComplete: () => confetti.destroy(),
      });
    }
  }

  showTrainingResultActions(hasNext) {
    const makeButton = (x, label, color, action) => {
      const button = this.add.text(x, 520, label, {
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: color,
        padding: { x: 12, y: 9 },
        stroke: '#0a0a14',
        strokeThickness: 3,
      })
        .setOrigin(0.5)
        .setDepth(60)
        .setInteractive({ useHandCursor: true });
      button.on('pointerover', () => button.setScale(1.06));
      button.on('pointerout', () => button.setScale(1));
      button.on('pointerdown', action);
      return button;
    };

    makeButton(hasNext ? 190 : 285, 'X / R  RETRY', '#7a2458', () => this.retryTraining());
    if (hasNext) {
      makeButton(400, 'A / ENTER  NEXT', '#146b4a', () => this.advance());
    }
    makeButton(
      hasNext ? 620 : 515,
      hasNext ? 'B / ESC  TITLE' : 'A / ENTER  TITLE',
      '#244c7a',
      () => this.quitToTitle(),
    );
  }

  showObjectiveIntro() {
    if (!this.objectives.active) return;
    const centerX = this.scale.width / 2;
    const trophyThresholds = this.trackData.scoring?.thresholds;
    const trophyBlockH = trophyThresholds
      ? 30 + trophyThresholds.length * 22
      : 0;
    const panelH = 230 + this.objectives.views.length * 30 + trophyBlockH;
    const panelTop = (this.scale.height - panelH) / 2;
    const panel = this.add.rectangle(
      centerX,
      panelTop + panelH / 2,
      this.scale.width - 120,
      panelH,
      0x0a0a14,
      0.9,
    ).setStrokeStyle(2, 0x00e5ff, 0.65).setAlpha(0).setDepth(40);
    const title = this.add.text(centerX + 70, panelTop + 30, this.trackData.name, {
      fontSize: '25px', color: '#ff2d95', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(41);
    const intro = this.add.text(centerX + 70, panelTop + 69, this.trackData.intro, {
      fontSize: '16px', color: '#ffffff', align: 'center',
      stroke: '#0a0a14', strokeThickness: 4,
      wordWrap: { width: this.scale.width - 180 },
    }).setOrigin(0.5).setAlpha(0).setDepth(41);
    const header = this.add.text(centerX + 70, panelTop + 113, 'OBJECTIVES', {
      fontSize: '14px', color: '#00e5ff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(41);
    const rows = this.objectives.views.map((objective, index) => {
      const reward = objective.unitPoints
        ? `${objective.unitPoints} PTS EACH`
        : `+${objective.points} PTS`;
      return (
      this.add.text(centerX + 90, panelTop + 143 + index * 30,
        `○  ${objective.label}   ${reward}`, {
          fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#0a0a14', strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(41)
      );
    });
    // Trophy tiers as a labelled, color-coded stack — one plain-language line
    // per rank. Reads as a scoreboard, not a debug string, and can't overflow
    // the panel the way a single joined line did.
    let trophyEls = [];
    if (trophyThresholds) {
      const rankColor = { gold: '#ffce54', silver: '#cdd6e2', bronze: '#d08a4e' };
      const scoringObjective = this.trackData.objectives?.find(
        (objective) => objective.id === this.trackData.scoring?.objective,
      );
      const lapFinish = !scoringObjective ||
        scoringObjective.type === 'complete_laps';
      const trophyTop = panelTop + 149 + rows.length * 30;
      const trophyHeader = this.add.text(centerX + 90, trophyTop, 'TROPHIES', {
        fontSize: '14px', color: '#ffcf3f', fontStyle: 'bold',
        stroke: '#0a0a14', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0).setDepth(41);
      const tiers = [...trophyThresholds]
        .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
        .map((threshold, index) => {
          const reqs = [];
          if (!lapFinish) reqs.push(`${threshold.minimum}`);
          if (threshold.maximumDamageHits != null) {
            reqs.push(threshold.maximumDamageHits === 0
              ? 'No damage'
              : `Under ${threshold.maximumDamageHits + 1} hits`);
          }
          if (threshold.maximumConesMissed === 0) reqs.push('all cones');
          if (reqs.length === 0) reqs.push('Finish');
          return this.add.text(
            centerX + 90,
            trophyTop + 24 + index * 22,
            `${threshold.rank.toUpperCase()}   ${reqs.join('  ·  ')}`,
            {
              fontSize: '16px', color: rankColor[threshold.rank] ?? '#ffcf3f',
              fontStyle: 'bold', stroke: '#0a0a14', strokeThickness: 4,
            },
          ).setOrigin(0.5).setAlpha(0).setDepth(41);
        });
      trophyEls = [trophyHeader, ...tiers];
    }
    const prompt = this.add.text(
      centerX,
      panelTop + panelH - 27,
      'PRESS A / ENTER TO START',
      {
        fontSize: '16px', color: '#2ee56b', fontStyle: 'bold',
        stroke: '#0a0a14', strokeThickness: 4,
      },
    ).setOrigin(0.5).setAlpha(0).setDepth(41);
    const lines = [title, intro, header, ...rows, ...trophyEls];
    this.objectiveIntroElements = [panel, ...lines, prompt];
    this.awaitingBriefing = true;
    // Prevent the title-screen confirm that opened the race from also
    // dismissing the briefing in the same input beat.
    this.briefingAcceptAt = this.time.now + 350;
    this.tweens.add({ targets: panel, alpha: 1, duration: 240, ease: 'Quad.out' });
    lines.forEach((line, index) => {
      this.tweens.add({
        targets: line,
        x: centerX,
        alpha: 1,
        delay: 100 + index * 90,
        duration: 320,
        ease: 'Back.out',
      });
    });
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.45, to: 1 },
      delay: 200 + lines.length * 90,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  dismissObjectiveIntro() {
    if (!this.awaitingBriefing) return;
    this.awaitingBriefing = false;
    const elements = this.objectiveIntroElements ?? [];
    this.tweens.killTweensOf(elements);
    this.tweens.add({
      targets: elements,
      alpha: 0,
      duration: 220,
      ease: 'Quad.in',
      onComplete: () => elements.forEach((element) => element.destroy()),
    });
    this.launchHud();
    this.showBanner('GET READY', 800);
  }

  launchHud() {
    if (this.hudLaunched) return;
    this.hudLaunched = true;
    // Own camera: instruments remain immune to game-world shakes and flashes.
    this.scene.launch('HudScene');
  }

  // Sub-300ms reward legibility: feedback blooms at the car, not on a tally.
  popup(text, color) {
    const p = this.add
      .text(this.carSprite.x, this.carSprite.y - 50, text, {
        fontSize: '20px', color, fontStyle: 'bold',
        stroke: '#0a0a14', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({
      targets: p, y: p.y - 44, alpha: 0, duration: 700,
      ease: 'Cubic.out', onComplete: () => p.destroy(),
    });
  }

  showBanner(text, ms) {
    this.banner.setText(text).setAlpha(1);
    if (this.bannerTimer) this.bannerTimer.remove();
    if (ms > 0) {
      this.bannerTimer = this.time.delayedCall(ms, () => {
        this.tweens.add({ targets: this.banner, alpha: 0, duration: 400 });
      });
    }
  }

  // Wire the HTML debug panel. Guarded — missing elements are fine.
  // DOM listeners outlive scene restarts unless torn down: the
  // AbortController deregisters them all on shutdown, same as
  // deregistering an IRQ handler in a driver's teardown path.
  hookDebugPanel() {
    const ac = new AbortController();
    this.events.once('shutdown', () => ac.abort());

    const hook = (id, fn, options = {}) => {
      const el = document.getElementById(id);
      if (!el) return;
      const out = document.getElementById(id + 'Value');
      const apply = () => {
        const raw = parseFloat(el.value);
        fn(options.transform ? options.transform(raw) : raw);
        if (out) {
          out.textContent = options.format ? options.format(raw) : el.value;
        }
        TUNING.recalc();
      };
      el.addEventListener('input', apply, { signal: ac.signal });
      apply();
    };

    hook('maxSpeed',      (v) => (TUNING.maxSpeed = v));
    hook('torqueLow',     (v) => (TUNING.torqueLow = v));
    hook('steerRate',     (v) => (TUNING.steerRate = v));
    hook('centrifugal',   (v) => (TUNING.centrifugal = v));
    hook('airbrakeForce', (v) => (TUNING.airbrakeForce = v));
    hook('steerExpo',     (v) => (TUNING.steerExpo = v));
    hook('carScale',      (v) => (TUNING.carScale = v));
    hook('fov',          (v) => (TUNING.fov = v));
    hook('cameraHeight', (v) => (TUNING.cameraHeight = v));
    hook('drawDistance', (v) => (TUNING.drawDistance = v));
    hook('fogDensity',   (v) => (TUNING.fogDensity = v));
    hook('musicVolume',  (v) => {
      TUNING.musicVolume = v;
      MUSIC.setVolume(v);
    }, { transform: (v) => v / 100, format: (v) => `${Math.round(v)}%` });
    hook('sfxVolume',    (v) => {
      TUNING.sfxVolume = v;
      MUSIC.setSfxVolume(v);
    }, { transform: (v) => v / 100, format: (v) => `${Math.round(v)}%` });

    // Sync the track picker to however we actually got here (title menu,
    // garage "next race", or the picker itself) so it never shows a stale
    // selection. Not a `hook()` control — it drives scene changes rather
    // than a live TUNING value, so it's read-only sync here, not two-way.
    const trackSelect = document.getElementById('trackSelect');
    if (trackSelect) {
      trackSelect.value = this.mode === 'endless'
        ? 'endless'
        : `${this.mode}:${this.trackIndex}`;
    }

    const fps = document.getElementById('fps');
    if (fps) {
      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => (fps.textContent = Math.round(this.game.loop.actualFps)),
      });
    }
  }
}
