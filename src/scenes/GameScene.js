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
import { checkObstacleHit, crossedRoadSegments } from '../systems/Collision.js';
import { Controls } from '../systems/Controls.js';
import { Popularity } from '../systems/Popularity.js';
import { shouldPlayBoostHold } from '../audio/AirtimeAudio.js';
import { ObjectiveState, formatObjectiveValue } from '../systems/ObjectiveState.js';
import { objectiveFeedbackEvent } from '../systems/ObjectiveFeedback.js';
import { trainingCueDecision } from '../systems/TrainingCue.js';
import {
  airtimeGapOutcome,
  shouldAnnounceGapMiss,
} from '../systems/AirtimeOutcome.js';
import {
  AIRTIME_COLORS,
  airtimeFxFrame,
  airtimeTier,
  carSpriteFrame,
  landingFxColor,
  landingFxStrength,
  nextAirtimePitch,
  nextGlideMode,
  shouldTriggerApex,
} from '../systems/AirtimeFx.js';
import {
  submitTrainingResult,
  trainingConeScore,
  trainingMetricUsage,
} from '../systems/TrainingProgress.js';
import { RACER } from '../systems/RacerState.js';
import {
  applyPitCrewService,
  awardStoryPayout,
  consumeRaceLoadout,
  raceLoadout,
  storyStyleBank,
} from '../systems/Economy.js';
import { Boost } from '../entities/Boost.js';
import { RivalPack } from '../entities/RivalPack.js';
import {
  attackIntent,
  classifyRivalContact,
  rivalHitResolution,
  rivalContactTraceEligible,
  rivalDamagePolicy,
  resolveRivalContact,
  sweptRivalContact,
} from '../systems/RivalContact.js';
import { createTrackDiscipline, updateTrackDiscipline } from '../systems/TrackDiscipline.js';
import { TimedElimination } from '../systems/TimedElimination.js';
import { TimedScoreAttack } from '../systems/TimedScoreAttack.js';
import { rivalFxSpec } from '../systems/RivalFx.js';
import { buttonDown, getPrimaryPad } from '../systems/Gamepad.js';
import { TRACKS, TRAINING_TRACKS } from '../tracks/index.js';
import {
  STORY_PAGES,
  STORY_PHASES,
  modeMenuTarget,
} from '../ui/FrontEndModel.js';
import {
  QualifierClock,
  RivalRaceOrder,
  objectivesForStoryPhase,
  remainingStoryOpponents,
} from '../systems/StoryEventState.js';
import {
  isStoryCampaignComplete,
  isStoryCampaignPlatinum,
  submitQualifierResult,
  submitRivalResult,
} from '../systems/StoryProgress.js';
import {
  STORY_STYLE_RULES,
  StoryStyleTracker,
  storyStyleRulesForTrack,
} from '../systems/StyleEvents.js';
import {
  HeldBoostAccumulator,
  createPlayerStatEvent,
  submitPlayerStatEvent,
} from '../systems/PlayerStats.js';
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

let runSequence = 0;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // Scene launch data arrives here, before create().
  init(data) {
    this.mode = data.mode ?? 'story';
    this.trackIndex = data.trackIndex ?? 0;
    this.storyPhase = this.mode === 'story'
      ? data.storyPhase ?? STORY_PHASES.QUALIFIER
      : null;
    this.garageData = null;
  }

  create() {
    if (this.mode === 'endless') RACER.beginEndlessRun();
    else RACER.endEndlessRun();
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
      const storyEvent = this.mode === 'story'
        ? this.storyPhase === STORY_PHASES.RIVALS
          ? this.trackData.rivalRace
          : this.trackData.qualifier
        : null;
      this.race = new RaceState(this.model, storyEvent?.laps ?? this.trackData.laps ?? 3, {
        finishOnLapLimit: this.trackData.finish !== 'objectives',
      });
    }
    const objectiveDefinitions = this.mode === 'story'
      ? objectivesForStoryPhase(this.trackData?.objectives, this.storyPhase, this.race.laps)
      : this.trackData?.objectives;
    this.objectives = new ObjectiveState(objectiveDefinitions, this.model);
    this.objectiveHudSequence = 0;
    this.objectiveHudEvents = [];
    runSequence += 1;
    this.gameplayRunId = `run-${Date.now().toString(36)}-${runSequence}`;
    this.playerStatSequence = 0;
    this.heldBoostStats = new HeldBoostAccumulator(
      STORY_STYLE_RULES.longBurn.minimumHeldSeconds,
    );
    const styleBank = this.mode === 'story'
      ? storyStyleBank(
        RACER,
        this.trackData.id,
        this.trackData.storyVersion ?? 1,
        this.storyPhase,
      )
      : null;
    this.styleTracker = this.mode === 'story'
      ? new StoryStyleTracker({
        runId: this.gameplayRunId,
        rules: storyStyleRulesForTrack(this.trackData),
        cashAvailable: styleBank.remaining,
      })
      : null;
    this.renderer = new RoadRenderer(
      this,
      TUNING,
      this.trackData?.environment ?? this.trackData?.id ?? 'endless',
    );
    this.player = new Player(TUNING);
    const rivalConfig = this.mode !== 'story' || this.storyPhase === STORY_PHASES.RIVALS
      ? this.trackData?.rivals
      : null;
    this.rivalPack = rivalConfig
      ? new RivalPack(this.trackData.rivals, this.rivalTuning(), this.model)
      : null;
    // Racer count is an attempt contract, not a live despawn control. The Lab
    // can tune 1..5 and Retry to compare densities without making an active
    // clock unwinnable by hiding one of its target IDs mid-run.
    this.rivalAttemptCount = this.rivalPack
      ? Math.min(
        this.trackData.rivals.maxCount ?? 3,
        Math.max(1, Math.round(TUNING.rivalCount)),
      )
      : 0;
    this.rivalPack?.setCount(this.rivalAttemptCount);
    this.rivalMetrics = {
      deliberateHits: 0,
      takedowns: 0,
      boostedTakedowns: 0,
      damageHits: 0,
    };
    this.storyTakedownIds = new Set();
    this.rivalHudEvents = [];
    this.rivalHudSequence = 0;
    this.rivalAttackInput = { direction: 0, remaining: 0 };
    this.previousRivalInput = { airbrakeL: false, airbrakeR: false };
    this.rivalPlayerGrace = 0;
    this.rivalHintCooldown = 0;
    this.rivalPreviousViews = this.rivalPack?.rivals.map((rival) => ({
      id: rival.id,
      position: rival.position,
      x: rival.x,
      speed: rival.speed,
      airborne: rival.airborne,
    })) ?? [];
    this.trackDiscipline = createTrackDiscipline();
    this.timedElimination = this.trackData?.timedElimination && this.rivalPack
      ? new TimedElimination(
        this.trackData.timedElimination,
        this.rivalPack.rivals
          .slice(0, this.rivalAttemptCount)
          .map((rival) => rival.id),
      )
      : null;
    this.timedScoreAttack = this.trackData?.timedScoreAttack && this.rivalPack
      ? new TimedScoreAttack(this.trackData.timedScoreAttack)
      : null;
    this.rivalSchoolCompletePending = 0;
    this.rivalSchoolView = this.buildRivalSchoolView();
    this.qualifierClock = this.mode === 'story' && this.storyPhase === STORY_PHASES.QUALIFIER
      ? new QualifierClock(this.trackData.qualifier?.targetSeconds)
      : null;
    this.storyRaceOrder = this.mode === 'story' && this.storyPhase === STORY_PHASES.RIVALS
      ? new RivalRaceOrder({
        trackLength: this.model.trackLength,
        laps: this.race.laps,
        rivals: this.rivalPack?.rivals ?? [],
      })
      : null;
    this.storyEventView = this.buildStoryEventView();
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
    this.raceLoadout = this.mode === 'story'
      ? raceLoadout(RACER, TUNING.nitroMax)
      : { capacity: TUNING.nitroMax, startingSlots: 0, consumed: {} };
    this.raceLoadoutConsumed = this.mode !== 'story';
    this.boost = new Boost(TUNING, this.raceLoadout.capacity);
    for (let slot = 0; slot < this.raceLoadout.startingSlots; slot++) this.boost.collect();
    this.topSpeedTier = 0; // highest boost tier reached this race, feeds the top_speed objective
    this.boostHoldHandle = null; // active sustained hold-drone SFX, if any
    this.airtimeAudioHandle = null;
    this.pendingAirtimeLanding = null;
    this.jumpLaunchedThisFrame = false;
    this.speedLineBurst = 0; // ramp/boost streak-bloom, decays over speedLineBurstTime
    this.speedPadPulse = 0;
    this.wasOnZipper = false;
    this.trainingDamageHits = 0;
    this.trainingDamageMax = this.trackData?.trainingDamage?.maxHits ?? 0;
    this.trainingDamageTaught = false; // one-time "rocks damage you" notice, shown on first hit
    this.coneHits = 0;        // running index for loose-cone smash variety
    this.conesThisLap = 0;     // fallback score for lessons that re-arm cones
    this.trainingConeHits = 0; // cumulative score for full-run mastery tracks
    // A track with no cones leaves this at zero and never gates a trophy.
    this.trainingConeTotal = (this.trackData?.objects ?? [])
      .filter((object) => object.kind === 'cone').length;
    this.trainingTutorial = null;
    this.trainingTutorialView = null;
    this.completedTrainingCues = new Set();
    this.failedTrainingCues = new Set();
    // Air School telemetry is intentionally public/pull-based: HudScene reads
    // one small view model without owning physics or training decisions.
    this.airtimeTrainingConfig = this.mode === 'training'
      ? this.trackData?.airtimeTraining ?? null
      : null;
    this.airtimeGapAttempt = null;
    this.airtimeFeedback = null;
    this.airtimeTrainingView = this.airtimeTrainingConfig
      ? this.buildAirtimeTrainingView()
      : null;
    this.done = false;

    // Bottom-anchored (origin 0.5,1): the sprite's y IS its rear-bumper
    // line, not its center. Center-anchoring was the actual "too close to
    // the bottom" bug — scaling up grew the car in BOTH directions, so a
    // bigger Car Size pushed the bottom half off-canvas along with making
    // the top bigger. Bottom-anchoring means Car Size only ever grows the
    // car upward into the road, never off the bottom edge.
    this.carBaselineY = this.scale.height - 24;
    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.carBaselineY, 'car', carSpriteFrame(2, 0))
      .setOrigin(0.5, 1)
      .setScale(TUNING.carScale)
      .setDepth(10);
    this.createAirtimeVisuals();
    this.speedPadGraphics = this.add.graphics().setDepth(11);
    this.createRivalVisuals();

    this.controls = new Controls(this);
    this.input.keyboard.on('keydown-ESC', () => this.quitToTitle());
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-R', () => this.retryTraining());

    this.iframes = 0; // post-hit invulnerability countdown

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
    // The sustained hold-drone schedules its own stop far in the future —
    // MUSIC.stop() only halts the music scheduler, so a mid-hold scene exit
    // needs its own explicit stop or the drone plays on regardless.
    this.events.once('shutdown', () => this.boostHoldHandle?.stop());
    this.events.once('shutdown', () => this.airtimeAudioHandle?.stop());
    this.events.once('shutdown', () => this.flushHeldBoostStats());
  }

  update(time, delta) {
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
      this.renderer.render(
        this.model, this.player, 0, 0, this.sceneryDistance,
        this.rivalPack?.renderViews,
      );
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
        this.rivalPack?.renderViews,
      );
      return; // deliberate freeze: no race clock, movement, or collisions
    }

    const dt = Math.min(delta, 50) / 1000;
    const input = this.controls.read(TUNING);
    this.jumpLaunchedThisFrame = false;
    const previousPlayer = {
      position: this.player.position,
      x: this.player.x,
    };
    const previousRivalPlayer = {
      position: this.rivalRoadPosition(this.player.position),
      x: this.player.x,
      speed: this.player.speed,
      airborne: this.player.airborne,
    };

    // Boost: tapping stacks the ceiling, holding extends its duration — the
    // ceiling itself is enforced inside Player.update's own clamp (see
    // Boost.js and Player.js). Feed it in BEFORE update so it's live this frame.
    this.boost.update(dt, input.nitro);
    this.styleTracker?.update(dt, {
      boostHeld: this.boost.holding && input.nitro,
    });
    this.updateHeldBoostStats(dt, this.boost.holding && input.nitro);
    if (this.boost.justActivated > 0) {
      this.player.boost(TUNING.boostTierCeilings[this.boost.justActivated - 1]);
      if (this.boost.justActivated === 3) {
        this.styleTracker?.recordBoostTier(3);
        if (this.mode === 'story') RACER.afterburnerEligible = true;
        this.recordLifetimeStat('tierThreeBoosts');
      }
    } else if (this.boost.justExtended) {
      this.player.boost(TUNING.boostTierCeilings[this.boost.tier - 1]);
    }
    input.boostCeiling = this.boost.ceilingMultiplier;
    input.boostActive = this.boost.tier > 0;

    this.player.update(dt, input, this.model);
    this.updateRivals(dt, input, previousRivalPlayer);
    const storyFinishers = this.storyRaceOrder?.update(this.rivalPack?.rivals ?? []) ?? [];
    storyFinishers.forEach((id) => this.rivalPack?.retireFinisher(id));
    this.storyEventView = this.buildStoryEventView();
    this.updateRivalVisuals(dt);
    this.updateAirtimeAudio();
    this.updateAirtimeTraining(dt);
    this.recordTopSpeed();
    this.sceneryDistance += this.player.speed * dt;
    this.maybeStartTrainingTutorial(input);

    if (this.rivalPack) {
      const discipline = updateTrackDiscipline(this.trackDiscipline, dt, {
        x: this.player.x,
        airborne: this.player.airborne,
      });
      this.trackDiscipline = discipline.state;
      const metricUsage = trainingMetricUsage(this.trackData.scoring);
      if (discipline.justLostCleanLine && metricUsage.offTrack) {
        this.pushRivalHudEvent('CLEAN LINE LOST  •  GOLD GONE', 'warning');
      }
    }

    // Zipper crossings: edge-triggered per strip (kick on entry, re-arm on
    // exit), never consumed — the paint is permanent, the skill is lining
    // up on it lap after lap. Airborne cars aren't touching the road.
    {
      const on = !this.player.airborne && crossedRoadSegments(
        this.player,
        this.model,
        TUNING,
        previousPlayer,
      ).some(({ segment, x }) => {
        const z = segment.zipper;
        return !!z && Math.abs(x - z.offset) < z.w + TUNING.playerW * 0.5;
      });
      if (on && !this.wasOnZipper) {
        this.player.zip();
        MUSIC.playSpeedLine();
        this.speedLineBurst = 1;
        this.speedPadPulse = 1;
        this.cameras.main.shake(105, 0.006);
        if (this.mode === 'endless') this.pop.add(TUNING.zipPop);
        this.recordObjective('zipper_hit');
        const segment = this.model.findSegment(this.player.position + TUNING.playerZ);
        const speedLineId = `${this.race?.lap ?? 1}:${segment.index}`;
        this.styleTracker?.recordSpeedLine(speedLineId);
        this.recordLifetimeStat('speedLinesCrossed');
        this.popup('SPEED LINE!', '#2ee56b');
      }
      this.wasOnZipper = on;
    }

    // Contact. Airborne clears everything below — that's the point of
    // flying. i-frames only gate hazards; candy always pays.
    this.pop.update(dt);
    if (!this.player.airborne) {
      const s = checkObstacleHit(
        this.player,
        this.model,
        TUNING,
        previousPlayer,
      );
      if (s) {
        if (s.def.kind === 'candy') this.onCandy(s);
        else if (s.def.kind === 'launch') this.onRamp(s, input);
        else if (s.def.kind === 'pickup') this.onPickup(s);
        else if (this.iframes <= 0) this.onHit(s.def, s);
        else s.hit = false; // i-frames: hazard not consumed, just ghosted
      }
    }

    // Collision can turn an early gap landing into explicit safe-route
    // feedback, so publish telemetry after contact handling too.
    if (this.airtimeTrainingConfig) {
      this.airtimeTrainingView = this.buildAirtimeTrainingView();
    }
    // Resolve landing audio only after collision has had the opportunity to
    // turn a marginal rock-gap touchdown into a miss. A direct ramp chain
    // uses the new ramp strike as its contact beat instead of double-hitting.
    this.flushAirtimeLandingAudio();
    // Landing visuals resolve here for the same reason: collision gets final
    // say, so a short gap attempt cannot flash a clean-landing shockwave first.
    this.updateAirtimeVisualState(dt);
    this.reactToBoost();
    this.iframes = Math.max(0, this.iframes - dt);
    this.speedLineBurst = Math.max(0, this.speedLineBurst - dt / TUNING.speedLineBurstTime);
    this.speedPadPulse = Math.max(0, this.speedPadPulse - dt / 0.42);
    this.carSprite.setAlpha(this.iframes > 0 && Math.floor(this.iframes * 12) % 2 ? 0.4 : 1);

    if (this.mode === 'endless') {
      this.model.ensureAhead(this.player.position); // pave ahead of the car
    } else {
      const event = this.race.update(dt, this.player);
      if (event === 'start') {
        if (!this.raceLoadoutConsumed) {
          consumeRaceLoadout(RACER, TUNING.nitroMax);
          this.raceLoadoutConsumed = true;
        }
        this.timedScoreAttack?.start(this.rivalPack?.elapsed ?? 0);
        this.qualifierClock?.start();
        this.showBanner('GO!', 800);
      } else if (event === 'lap') {
        this.recordObjective('lap_complete');
        this.model.resetLapSprites();
        // Ordinary cones re-arm at the line; objective-linked mastery cones
        // persist and use trainingConeHits across the complete attempt.
        this.conesThisLap = 0;
        if (this.timedScoreAttack) {
          // Rival School earns time from authored clock cones, not passively
          // from completing laps.
        } else if (this.timedElimination) {
          const bonus = this.timedElimination.addLapBonus();
          if (bonus.awarded > 0) {
            MUSIC.playTimeBonus({ major: true });
            this.pushRivalHudEvent(
              `CHECKPOINT  +${Math.round(bonus.awarded)}s`,
              'success',
            );
          }
        } else if (this.mode === 'training') {
          const lessonMessage = this.trackData.lapMessages?.[this.race.lap];
          this.showBanner(
            lessonMessage ?? `LAP ${this.race.lap}`,
            lessonMessage ? 1800 : 1000,
          );
        }
      } else if (event === 'finished') {
        this.recordObjective('lap_complete');
        this.finishRace();
      }
    }

    if (
      this.qualifierClock && !this.done &&
      this.qualifierClock.update(dt, this.race.crossedStart) === 'expired'
    ) {
      this.race.finish();
      this.failStoryQualifier();
    }
    this.storyEventView = this.buildStoryEventView();

    if (this.timedElimination && !this.done) {
      if (this.rivalSchoolCompletePending > 0) {
        this.rivalSchoolCompletePending = Math.max(
          0,
          this.rivalSchoolCompletePending - dt,
        );
        if (this.rivalSchoolCompletePending === 0) {
          this.race.finish();
          this.finishRace();
        }
      } else if (this.timedElimination.update(dt, this.race.crossedStart) === 'expired') {
        this.failTimedElimination();
      }
      this.rivalSchoolView = this.buildRivalSchoolView();
    }
    if (this.timedScoreAttack && !this.done) {
      if (this.timedScoreAttack.update(
        this.rivalPack?.elapsed ?? 0,
        this.race.crossedStart,
      ) === 'expired') {
        this.race.finish();
        this.finishRace();
      }
      this.rivalSchoolView = this.buildRivalSchoolView();
    }

    const speedPercent = this.player.speed / TUNING.maxSpeed;
    this.renderer.render(
      this.model,
      this.player,
      speedPercent,
      this.speedLineBurst,
      this.sceneryDistance,
      this.rivalPack?.renderViews,
    );

    // Steering FRAMES: 0=hard-left, 1=left, 2=straight, 3=right, 4=hard-right.
    // Five buckets instead of three — needed once airbrakes are in the mix:
    // a shoulder-button bank needs to look visibly harder than a light stick
    // correction, and player.steer already blends stick + airbrake (see
    // Player.update), so one signal drives the whole 5-way read.
    const s = this.player.steer;
    const steerFrame = s < -0.6 ? 0 : s < -0.2 ? 1 : s <= 0.2 ? 2 : s <= 0.6 ? 3 : 4;
    this.carSprite.setFrame(carSpriteFrame(steerFrame, this.airVisual.pitch));
    // Physics supplies the arc; the visual policy adds readable compression,
    // pitch silhouette, and landing squash without rotating this rear-view
    // sprite into a steering-bank pose.
    const airFx = airtimeFxFrame({
      airborne: this.player.airborne,
      arc: this.player.airArc,
      glideMode: this.airVisual.glideMode,
      speedRatio: speedPercent,
      boosted: this.player.boostedLaunch,
      takeoff: this.airVisual.takeoffKick,
      landing: this.airVisual.landingKick,
      landingStrength: this.airVisual.landingStrength,
    });
    this.carSprite.setScale(
      TUNING.carScale * airFx.scaleX,
      TUNING.carScale * airFx.scaleY,
    );
    this.carSprite.y = this.carBaselineY - airFx.liftPx;
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;
    this.renderAirtimeVisuals(time, airFx);
    this.renderSpeedPadFx();
  }

  renderSpeedPadFx() {
    const g = this.speedPadGraphics;
    if (!g) return;
    g.clear();
    if (this.speedPadPulse <= 0) return;
    const progress = 1 - this.speedPadPulse;
    const cx = this.carSprite.x;
    const y = this.carBaselineY - 35;
    const radius = 44 + progress * 92;
    const alpha = this.speedPadPulse * 0.9;
    g.lineStyle(5 - progress * 3, 0x2ee56b, alpha);
    g.strokeEllipse(cx, y, radius * 2, radius * 0.8);
    g.lineStyle(3, 0xbfffd9, alpha * 0.85);
    for (const side of [-1, 1]) {
      g.lineBetween(cx + side * 34, y + 18, cx + side * (80 + progress * 65), y + 52);
      g.lineBetween(cx + side * 46, y - 2, cx + side * (98 + progress * 75), y + 12);
    }
  }

  createAirtimeVisuals() {
    this.airVisual = {
      wasAirborne: false,
      takeoffKick: 0,
      landingKick: 0,
      landingStrength: 0,
      apexPulse: 0,
      apexLatched: false,
      tierPulse: 0,
      tierLevel: 0,
      glideMode: 'neutral',
      pitch: 0,
      gapAttemptSeen: null,
    };
    // Persistent/pool-like graphics: flight never allocates trail particles.
    // World streaks remain under these at depth 8, local thrust at depth 9,
    // the car at 10, and active-aero vanes at 11.
    this.airTrailGraphics = this.add.graphics().setDepth(9);
    this.airAuraGraphics = this.add.graphics().setDepth(9);
    this.airAeroGraphics = this.add.graphics().setDepth(11);
  }

  updateAirtimeVisualState(dt) {
    const visual = this.airVisual;
    const airborne = this.player.airborne;

    if (airborne && !visual.wasAirborne) {
      visual.takeoffKick = 1;
      visual.apexLatched = false;
      visual.apexPulse = 0;
      visual.tierPulse = 0;
      visual.tierLevel = 0;
      visual.glideMode = 'neutral';
    }

    if (airborne) {
      visual.glideMode = nextGlideMode(visual.glideMode, this.player.glide);
      const tier = airtimeTier(this.player.jumpElapsed);
      if (tier.level > visual.tierLevel) {
        visual.tierLevel = tier.level;
        visual.tierPulse = 1;
      }
      if (shouldTriggerApex({
        airborne,
        arc: this.player.airArc,
        latched: visual.apexLatched,
      })) {
        visual.apexLatched = true;
        visual.apexPulse = 1;
        // A tiny chassis tremor makes the weightless beat tactile without
        // disturbing the road line the player is still steering toward.
        this.cameras.main.shake(32, 0.0008);
      }
    }

    if (this.player.justLanded) {
      const attempt = this.airtimeGapAttempt;
      const freshGapResult = attempt?.resolved && attempt !== visual.gapAttemptSeen;
      const mastery = freshGapResult && attempt.result === 'cleared';
      const miss = freshGapResult && attempt.result === 'short';
      if (freshGapResult) visual.gapAttemptSeen = attempt;
      visual.landingStrength = landingFxStrength({
        airtime: this.player.lastAirtime,
        launchSpeed: this.player.launchSpeed,
        maxSpeed: TUNING.maxSpeed,
        mastery,
      });
      visual.landingKick = 1;
      this.burstLandingFx(visual.landingStrength, {
        mastery,
        miss,
        glideMode: visual.glideMode,
      });
      // Preserve the final flight choice through contact, then return the
      // grounded silhouette to neutral on the next rendered frame.
      visual.glideMode = 'neutral';
    }

    visual.takeoffKick = Math.max(0, visual.takeoffKick - dt / 0.22);
    visual.landingKick = Math.max(0, visual.landingKick - dt / 0.28);
    visual.apexPulse = Math.max(0, visual.apexPulse - dt / 0.3);
    visual.tierPulse = Math.max(0, visual.tierPulse - dt / 0.24);
    visual.pitch = nextAirtimePitch(visual.pitch, {
      airborne,
      glide: this.player.glide,
      dt,
    });
    visual.wasAirborne = airborne;
    if (this.airtimeTrainingView) {
      this.airtimeTrainingView.glideMode = visual.glideMode;
    }
  }

  renderAirtimeVisuals(time, frame) {
    const trail = this.airTrailGraphics;
    const aura = this.airAuraGraphics;
    const aero = this.airAeroGraphics;
    trail.clear();
    aura.clear();
    aero.clear();

    if (this.done) {
      this.carSprite.setFrame(carSpriteFrame(2, 0));
      this.carSprite.setScale(TUNING.carScale);
      this.carSprite.y = this.carBaselineY;
      return;
    }

    const cx = this.carSprite.x;
    const bottom = this.carSprite.y - 3;
    const carW = Math.min(150, this.carSprite.displayWidth);
    const carH = Math.min(105, this.carSprite.displayHeight);
    const alpha = frame.trailIntensity;

    if (this.player.airborne && alpha > 0.01) {
      const lanes = this.player.boostedLaunch ? 4 : 3;
      for (let index = 0; index < lanes; index++) {
        const t = lanes === 1 ? 0 : index / (lanes - 1);
        const side = t * 2 - 1;
        const x = cx + side * carW * 0.3;
        const wobble = Math.sin(time / 52 + index * 2.1) * (2 + alpha * 3);
        const length = frame.trailLength * (0.82 + (index % 2) * 0.18);
        trail.lineStyle(index === 1 || index === 2 ? 3 : 2, frame.color, 0.3 + alpha * 0.55);
        trail.lineBetween(x, bottom, x + side * 7 + wobble, bottom + length);
      }
      if (this.player.boostedLaunch) {
        trail.lineStyle(3, AIRTIME_COLORS.long, 0.62 + alpha * 0.28);
        trail.lineBetween(cx, bottom - 2, cx, bottom + frame.trailLength * 1.08);
      }

      // Local air streaks fill the gap between world-speed lines and exhaust.
      // Four fixed lanes keep the effect capped and allocation-free.
      for (let index = 0; index < 4; index++) {
        const side = index < 2 ? -1 : 1;
        const row = index % 2;
        const x = cx + side * (carW * (0.55 + row * 0.16));
        const y = bottom - carH * (0.25 + row * 0.22) +
          Math.sin(time / 80 + index) * 5;
        trail.lineStyle(1 + Math.round(alpha), frame.color, 0.2 + alpha * 0.35);
        trail.lineBetween(x, y, x + side * 5, y + 14 + frame.trailLength * 0.18);
      }
    }

    const apex = Math.max(frame.apex, this.airVisual.apexPulse * 0.8);
    const tier = this.airVisual.tierPulse;
    if (apex > 0.01 || tier > 0.01) {
      const glow = Math.max(apex, tier * 0.7);
      aura.lineStyle(2 + Math.round(glow * 2), 0xffffff, glow * 0.65);
      aura.strokeEllipse(cx, bottom - carH * 0.46, carW * (1.05 + glow * 0.12), carH * 0.82);
      aura.lineStyle(1, frame.color, glow * 0.8);
      aura.strokeEllipse(cx, bottom - carH * 0.46, carW * (1.18 + glow * 0.18), carH * 0.96);
    }

    if (!this.player.airborne || frame.aero === 'neutral') return;
    const vaneY = bottom - carH * 0.38;
    const spread = carW * 0.38;
    if (frame.aero === 'short') {
      // Magenta upward chevrons: compact body, nose down, quicker return.
      aero.lineStyle(3, AIRTIME_COLORS.short, 0.92);
      for (const side of [-1, 1]) {
        const x = cx + side * spread;
        aero.lineBetween(x, vaneY + 7, x, vaneY - 11);
        aero.lineBetween(x, vaneY - 11, x - 5, vaneY - 4);
        aero.lineBetween(x, vaneY - 11, x + 5, vaneY - 4);
      }
    } else {
      // Gold downward chevrons and extended vanes: pull back, carry farther.
      aero.lineStyle(3, AIRTIME_COLORS.long, 0.92);
      aero.lineBetween(cx - spread, vaneY, cx - spread - 14, vaneY);
      aero.lineBetween(cx + spread, vaneY, cx + spread + 14, vaneY);
      for (const side of [-1, 1]) {
        const x = cx + side * (spread + 9);
        aero.lineBetween(x, vaneY - 8, x, vaneY + 10);
        aero.lineBetween(x, vaneY + 10, x - 5, vaneY + 3);
        aero.lineBetween(x, vaneY + 10, x + 5, vaneY + 3);
      }
    }
  }

  burstLandingFx(
    strength,
    { mastery = false, miss = false, glideMode = 'neutral' } = {},
  ) {
    const cx = this.carSprite.x;
    const y = this.carBaselineY - 3;
    const color = landingFxColor({ mastery, miss, glideMode });
    const ring = this.add.ellipse(cx, y, 72, 14)
      .setFillStyle(color, 0.08)
      .setStrokeStyle(mastery ? 4 : 2, color, 0.95)
      .setDepth(12);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8 + strength * 0.7,
      scaleY: 1.25 + strength * 0.35,
      alpha: 0,
      duration: mastery ? 340 : 250,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });

    if (mastery) {
      const crown = this.add.ellipse(cx, y - 3, 54, 10)
        .setStrokeStyle(3, AIRTIME_COLORS.long, 1)
        .setDepth(13);
      this.tweens.add({
        targets: crown,
        scaleX: 3,
        scaleY: 2,
        alpha: 0,
        duration: 430,
        ease: 'Quad.out',
        onComplete: () => crown.destroy(),
      });
      this.cameras.main.flash(90, 46, 229, 107);
    }

    const count = Math.min(14, Math.round(5 + strength * 5 + (mastery ? 3 : 0)));
    for (let index = 0; index < count; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const lane = Math.floor(index / 2);
      const spark = this.add.rectangle(
        cx + side * (18 + lane * 2),
        y - 5,
        mastery ? 5 : 4,
        mastery ? 5 : 3,
        index % 3 === 0 && mastery ? AIRTIME_COLORS.long : color,
      ).setDepth(13);
      this.tweens.add({
        targets: spark,
        x: spark.x + side * (44 + lane * 13) * strength,
        y: spark.y - (18 + (index % 4) * 9) * strength,
        angle: side * (180 + lane * 35),
        scale: 0.2,
        alpha: 0,
        duration: 230 + lane * 28,
        ease: 'Quad.out',
        onComplete: () => spark.destroy(),
      });
    }
    // Gap-miss collision already owns its stronger impact shake. The deferred
    // magenta ring/sparks add readability without stacking a second camera hit.
    if (!miss) {
      this.cameras.main.shake(
        Math.round(45 + strength * 24),
        0.0013 + strength * 0.0012,
      );
    }
  }

  createRivalVisuals() {
    this.rivalFxGraphics = null;
    this.rivalFxParticles = [];
    this.rivalFxPulse = null;
    if (!this.rivalPack) return;

    const colors = [0x00e5ff, 0xff2d95, 0xffcf3f, 0x2ee56b, 0xb58cff, 0xff7a45];
    this.rivalPack.rivals.forEach((rival, index) => {
      rival.color = colors[index % colors.length];
    });
    // Combat debris lives above rivals/road but below the player car. This
    // keeps a close takedown from pasting a large overlay over the player.
    this.rivalFxGraphics = this.add.graphics().setDepth(9);
    this.rivalFxParticles = Array.from({ length: 24 }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, total: 0,
      color: 0xffffff, size: 3,
    }));
  }

  startRivalFx(kind, rival, { boosted = false } = {}) {
    if (!this.rivalFxGraphics) return;
    const spec = rivalFxSpec(kind, boosted);
    const visible = rival?.screen?.visible;
    // Collision feedback must originate from the car the player actually saw.
    // An off-camera/stale contact keeps its audio but never fabricates a large
    // sprite at the player's position.
    if (!visible) return;
    const x = rival.screen.x;
    const y = rival.screen.y;
    const contactY = y - rival.screen.width * 0.12;
    const side = Math.sign(rival?.x - this.player.x) || 1;
    const color = kind === 'takedown' ? 0xffcf3f
      : kind === 'incoming' ? 0xff6b6b
        : kind === 'slam' ? 0x00e5ff : 0xffffff;

    let activated = 0;
    for (let index = 0; index < this.rivalFxParticles.length; index++) {
      const particle = this.rivalFxParticles[index];
      if (particle.active || activated >= spec.particles) continue;
      const row = Math.floor(activated / 2);
      const direction = activated % 2 === 0 ? side : -side;
      particle.active = true;
      particle.x = x + direction * (4 + row);
      particle.y = contactY;
      particle.vx = direction * (80 + row * 19) * (kind === 'takedown' ? 1.35 : 1);
      particle.vy = -(45 + (activated % 5) * 24);
      particle.life = spec.duration;
      particle.total = spec.duration;
      particle.color = activated % 3 === 0 && kind === 'takedown' ? 0x2ee56b : color;
      particle.size = kind === 'takedown' ? 5 : kind === 'rub' ? 2 : 3;
      activated += 1;
    }

    this.rivalFxPulse = {
      x, y: contactY, color, life: spec.flash, total: spec.flash,
      strength: kind === 'takedown' ? 1.8 : 1,
    };
    if (spec.shake > 0) {
      this.cameras.main.shake(kind === 'takedown' ? 120 : 70, spec.shake);
    }

  }

  updateRivalVisuals(dt) {
    if (!this.rivalFxGraphics) return;
    const graphics = this.rivalFxGraphics;
    graphics.clear();
    for (const particle of this.rivalFxParticles) {
      if (!particle.active) continue;
      particle.life = Math.max(0, particle.life - dt);
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 260 * dt;
      const alpha = particle.life / particle.total;
      graphics.fillStyle(particle.color, alpha);
      graphics.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    if (this.rivalFxPulse?.life > 0) {
      this.rivalFxPulse.life = Math.max(0, this.rivalFxPulse.life - dt);
      const progress = 1 - this.rivalFxPulse.life / this.rivalFxPulse.total;
      graphics.lineStyle(
        3,
        this.rivalFxPulse.color,
        1 - progress,
      );
      graphics.strokeCircle(
        this.rivalFxPulse.x,
        this.rivalFxPulse.y,
        (8 + progress * 34) * this.rivalFxPulse.strength,
      );
    }
  }

  rivalTuning() {
    const policy = this.trackData?.rivals?.policy ?? {};
    const finiteStoryRace = this.mode === 'story' &&
      this.storyPhase === STORY_PHASES.RIVALS &&
      !this.trackData?.rivals?.recycleWrecks;
    return {
      maxSpeed: TUNING.maxSpeed,
      basePace: finiteStoryRace
        ? this.trackData.rivals.racePace ?? 1.08
        : TUNING.rivalPace,
      segmentLength: TUNING.segmentLength,
      catchUpLimit: TUNING.rivalCatchupCap,
      slowDownLimit: policy.maximumSlowDown ?? 0.08,
      localPaceRadiusSegments: policy.localPaceRadiusSegments ?? 18,
      fullPaceCorrectionSegments: 40,
      stagingRadiusSegments: policy.stagingRadiusSegments ?? 90,
      stagingBehindRadiusSegments: policy.stagingBehindRadiusSegments ?? 24,
      stagingTargetSegments: policy.stagingTargetSegments ?? 24,
      stagingTargetSpacingSegments: policy.stagingTargetSpacingSegments ?? 7,
      stagingGraceSeconds: policy.stagingGraceSeconds ?? 1,
      wreckSeconds: policy.wreckSeconds ?? 0.7,
      attackTellSeconds: TUNING.rivalTelegraph,
      contactCooldownSeconds: TUNING.rivalContactCooldown,
      minimumAttackInterval: TUNING.rivalAttackCooldown,
      // Story's opponents are a finite race field, not replenishing targets.
      // A car the player passes must stay behind unless it drives back under
      // its own power; otherwise finishing order is only theatre.
      stagingEnabled: !finiteStoryRace,
    };
  }

  buildRivalSchoolView() {
    const clock = this.timedScoreAttack ?? this.timedElimination;
    if (!clock || !this.rivalPack) return null;
    return {
      ...clock.view,
      takedowns: this.timedScoreAttack?.takedowns ?? this.rivalMetrics.takedowns,
      lap: this.race?.lap ?? 1,
      rivals: this.rivalPack.renderViews
        .filter((rival) => rival.active && !rival.eliminated)
        .map((rival) => ({
          id: rival.id,
          generation: rival.generation,
          position: rival.renderPosition,
          state: rival.state,
          color: rival.color,
          active: rival.active,
          eliminated: rival.eliminated,
        })),
    };
  }

  buildStoryEventView() {
    if (this.mode !== 'story') return null;
    if (this.storyPhase === STORY_PHASES.QUALIFIER) {
      return {
        phase: this.storyPhase,
        targetSeconds: this.qualifierClock?.targetSeconds ??
          this.trackData?.qualifier?.targetSeconds ?? 0,
        elapsedSeconds: this.qualifierClock?.elapsedSeconds ?? 0,
        remainingSeconds: this.qualifierClock?.remainingSeconds ??
          this.trackData?.qualifier?.targetSeconds ?? 0,
      };
    }
    const rivals = this.rivalPack?.rivals ?? [];
    const opponentCount = Math.max(1, this.rivalAttemptCount ??
      this.trackData?.rivals?.count ?? 3);
    const takedowns = this.rivalMetrics?.takedowns ?? 0;
    return {
      phase: this.storyPhase,
      place: this.storyRaceOrder?.livePlace(
        this.player?.position ?? 0,
        this.race?.completedLaps ?? 0,
        rivals,
        this.race?.crossedStart ?? false,
      ) ?? 1,
      fieldSize: (this.rivalAttemptCount ?? 0) + 1,
      takedowns,
      opponentsLeft: remainingStoryOpponents(opponentCount, takedowns),
      rivals: this.rivalPack?.renderViews ?? [],
    };
  }

  failStoryQualifier() {
    this.stopActiveFeedbackLoops();
    this.done = true;
    const target = this.trackData.qualifier.targetSeconds;
    submitQualifierResult(this.trackData, target, target, false);
    this.showBanner(
      `TIME UP\nTARGET ${fmtTime(target)}\n\nENTER FOR STORY`,
      0,
    );
  }

  failTimedElimination() {
    this.stopActiveFeedbackLoops();
    this.race?.finish();
    this.done = true;
    this.trainingAdvanceTo = null;
    const view = this.timedElimination.view;
    const target = this.objectives.views.find(
      (objective) => objective.id === this.trackData.scoring.objective,
    ) ?? this.objectives.primary;
    const result = submitTrainingResult(
      this.trackData,
      target.progress,
      this.timedElimination.elapsedSeconds,
      {
        damageHits: this.trainingDamageHits,
        offTrackEvents: this.trackDiscipline.offTrackEvents,
        total: target.total,
      },
    );
    const trophy = result.trophy
      ? `${result.trophy.rank.toUpperCase()} TROPHY  ${'★'.repeat(result.trophy.stars)}`
      : 'NO TROPHY  •  TRAINING RECORDED';
    this.rivalSchoolView = this.buildRivalSchoolView();
    this.showBanner(
      `TIME UP\n${view.carsRemaining} CAR${view.carsRemaining === 1 ? '' : 'S'} LEFT` +
      `\n${trophy}\n\nRAM FROM BEHIND OR PUSH WIDE\nX / R  RETRY`,
      0,
    );
    this.showTrainingResultActions();
  }

  rivalRoadPosition(cameraPosition = this.player.position) {
    const length = this.model.trackLength;
    return ((cameraPosition + TUNING.playerZ) % length + length) % length;
  }

  pushRivalHudEvent(label, tone = 'info') {
    this.rivalHudSequence += 1;
    this.rivalHudEvents.push({
      sequence: this.rivalHudSequence,
      label,
      tone,
    });
    // HUD consumers advance by sequence. Keeping a small tail prevents an
    // unattended Lab session from turning transient feedback into a log.
    if (this.rivalHudEvents.length > 16) this.rivalHudEvents.shift();
  }

  updateRivals(dt, input, previousPlayer) {
    const pack = this.rivalPack;
    if (!pack) return;

    pack.setCount(this.rivalAttemptCount);
    const finiteStoryRace = this.mode === 'story' &&
      this.storyPhase === STORY_PHASES.RIVALS &&
      !this.trackData?.rivals?.recycleWrecks;
    pack.setAggression(finiteStoryRace
      ? this.trackData.rivals.aggression
      : TUNING.rivalAggression);
    pack.t.maxSpeed = TUNING.maxSpeed;
    pack.t.segmentLength = TUNING.segmentLength;
    pack.setBasePace(finiteStoryRace
      ? this.trackData.rivals.racePace ?? 1.08
      : TUNING.rivalPace);
    pack.t.catchUpLimit = Math.min(0.12, Math.max(0, TUNING.rivalCatchupCap));
    pack.t.attackTellSeconds = Math.max(0.65, TUNING.rivalTelegraph);
    pack.t.contactCooldownSeconds = Math.max(0.75, TUNING.rivalContactCooldown);
    pack.t.minimumAttackInterval = Math.max(2.5, TUNING.rivalAttackCooldown);

    const freshAttack = attackIntent(input, this.previousRivalInput);
    this.previousRivalInput = {
      airbrakeL: input.airbrakeL,
      airbrakeR: input.airbrakeR,
    };
    if (freshAttack) {
      this.rivalAttackInput.direction = freshAttack;
      this.rivalAttackInput.remaining = TUNING.rivalAttackWindow;
    } else {
      this.rivalAttackInput.remaining = Math.max(
        0,
        this.rivalAttackInput.remaining - dt,
      );
      if (this.rivalAttackInput.remaining === 0) this.rivalAttackInput.direction = 0;
    }
    this.rivalPlayerGrace = Math.max(0, this.rivalPlayerGrace - dt);
    this.rivalHintCooldown = Math.max(0, this.rivalHintCooldown - dt);

    const player = {
      position: this.rivalRoadPosition(),
      x: this.player.x,
      speed: this.player.speed,
      airborne: this.player.airborne,
      air: this.player.air,
    };
    for (const snapshot of this.rivalPreviousViews) {
      const rival = pack.rivals.find((candidate) => candidate.id === snapshot.id);
      if (!rival) continue;
      snapshot.position = rival.position;
      snapshot.x = rival.x;
      snapshot.speed = rival.speed;
      snapshot.airborne = rival.airborne;
    }
    pack.update(dt, { previousPlayer, player });

    for (const event of pack.consumeEvents()) {
      if (event.type !== 'rival_threat') continue;
      MUSIC.playRivalThreat({ pan: (event.side || 0) * 0.7 });
      this.pushRivalHudEvent(
        `${event.side < 0 ? '◀' : '▶'} RIVAL ATTACK  •  DODGE`,
        'warning',
      );
    }

    // Rival bodies advance on a fixed 60Hz clock. On a 120Hz render frame
    // with no simulation step, testing the moving player against a stale
    // rival creates an early phantom ram. Contact is resolved only after a
    // real rival step; the swept test still covers every intervening segment.
    if (pack.lastStepCount === 0) return;

    // Consume every fixed body interval in chronological order. A 30Hz frame
    // contains two 60Hz traces, while 120Hz alternates one/zero; this makes the
    // actual contact step identical rather than quantizing it to render rate.
    // Stable-ID order remains the simultaneous-contact tie breaker. Resolve
    // at most one result per fixed physics step—not per rendered frame—so a
    // 30Hz frame containing two legitimate 60Hz contacts cannot discard the
    // second result that 60/120Hz would process.
    for (let stepIndex = 0; stepIndex < pack.contactStepCount; stepIndex += 1) {
      const step = pack.contactSteps[stepIndex];
      for (const rival of pack.views) {
        const tracedRival = step.rivals.find((candidate) => candidate.id === rival.id);
        if (!rivalContactTraceEligible(tracedRival, rival)) continue;
      const contact = sweptRivalContact(
        step.previousPlayer,
        step.player,
        tracedRival.previous,
        tracedRival.current,
        {
          trackLength: this.model.trackLength,
          dt: 1 / 60,
          playerHalfWidth: TUNING.playerW,
          rivalHalfWidth: TUNING.playerW,
          longitudinalRadius: TUNING.segmentLength * 0.72,
        },
      );
      const outcome = classifyRivalContact(contact, {
        attackDirection: this.rivalAttackInput.direction,
        steeringDirection: Math.sign(this.player.steer),
        lateralCommitment: Math.abs(this.player.steer),
        boostActive: input.boostActive,
        contactCooldown: tracedRival.current.contactCooldown,
        lowRelativeSpeed: TUNING.maxSpeed * (
          input.boostActive ? 0.02 : TUNING.rivalTakedownAdvantage
        ),
        highRelativeSpeed: TUNING.maxSpeed * 0.1,
        rivalAttacking: tracedRival.current.state === 'attack',
        rivalAttackSide: tracedRival.current.attackSide,
      });
      if (!outcome) continue;

      resolveRivalContact(this.player, rival, outcome, {
        playerHalfWidth: TUNING.playerW,
        rivalHalfWidth: TUNING.playerW,
        contactCooldownSeconds: Math.max(0.75, TUNING.rivalContactCooldown),
        minimumSeparation: TUNING.playerW * 2.25,
        roadLimit: 1.7,
      });
      this.rivalAttackInput.remaining = 0;
      this.rivalAttackInput.direction = 0;

      if (outcome.deliberate) {
        this.rivalMetrics.deliberateHits += 1;
        this.recordObjective('rival_hit');
        // Boost remains the clean one-hit finish. A committed non-boost side
        // shunt uses the rival's existing two-point stability: the first hit
        // visibly staggers it and says one remains; the second finishes it.
        // Rear bumps and passive rubs never feed this route.
        const hitResolution = rivalHitResolution(
          outcome,
          input.boostActive,
          rival.stability,
        );
        const decisive = hitResolution.takedown;
        const scoreTime = step.time;
        const scoreOpen = !this.timedScoreAttack ||
          this.timedScoreAttack.canScoreAt(scoreTime);
        if (decisive && scoreOpen && pack.takeDown(rival.id, {
          elapsedSince: Math.max(0, pack.elapsed - scoreTime),
        })) {
          const generation = tracedRival.current.generation ?? rival.generation;
          if (this.timedScoreAttack && !this.timedScoreAttack.recordTakedown(
            rival.id,
            generation,
            scoreTime,
          )) continue;
          this.rivalMetrics.takedowns += 1;
          if (this.mode === 'story') this.storyTakedownIds.add(rival.id);
          this.recordLifetimeStat('rivalsWrecked');
          if (input.boostActive) this.rivalMetrics.boostedTakedowns += 1;
          this.recordObjective('rival_takedown');
          if (!this.timedScoreAttack && this.timedElimination?.eliminate(rival.id)) {
            this.rivalSchoolCompletePending = this.timedElimination.complete ? 0.7 : 0;
          }
          this.boost.collect();
          this.player.hitRecovery = Math.max(this.player.hitRecovery, 0.7);
          MUSIC.playRivalImpact({
            kind: 'takedown',
            pan: outcome.side * 0.65,
            strength: input.boostActive ? 1 : 0.82,
          });
          this.startRivalFx('takedown', rival, { boosted: input.boostActive });
          this.speedLineBurst = Math.max(this.speedLineBurst, 1);
          const finiteRivalsLeft = pack.rivals.filter((candidate) =>
            candidate.active && !candidate.eliminated && candidate.state !== 'wrecked'
          ).length;
          this.pushRivalHudEvent(
            this.timedScoreAttack
              ? `WRECK +1  •  ${this.timedScoreAttack.takedowns} TOTAL`
              : this.timedElimination
                ? `WRECKED  •  ${this.timedElimination.carsRemaining} LEFT`
                : `WRECKED  •  ${finiteRivalsLeft} RACING`,
            'success',
          );
        } else {
          const stagger = pack.stagger(rival.id, {
            side: outcome.side,
            force: hitResolution.sideDamage ? 1 : 0.85,
            damage: hitResolution.stabilityDamage > 0,
          });
          MUSIC.playRivalImpact({
            kind: 'slam',
            pan: outcome.side * 0.6,
            strength: 0.62,
          });
          this.startRivalFx('slam', rival);
          if (this.rivalHintCooldown <= 0) {
            this.pushRivalHudEvent(
              hitResolution.sideDamage && stagger?.stability === 1
                ? 'SIDE HIT  •  ONE MORE TO WRECK'
                : 'RICOCHET  •  BOOST OR HIT THE SIDE',
              hitResolution.sideDamage ? 'warning' : 'info',
            );
            this.rivalHintCooldown = 1.2;
          }
        }
      } else if (outcome.kind === 'incoming_attack') {
        pack.cancelAttack(rival);
        if (this.rivalPlayerGrace <= 0) {
          this.rivalMetrics.damageHits += 1;
          const damage = rivalDamagePolicy(this.mode, TUNING.rivalCampaignDamage);
          if (damage.trainingHits > 0) {
            this.trainingDamageHits = Math.min(
              this.trainingDamageMax || Infinity,
              this.trainingDamageHits + damage.trainingHits,
            );
          } else {
            if (this.mode === 'endless') this.pop.bust();
            const wrecked = RACER.damage(damage.persistentHullDamage);
            if (wrecked) this.onWrecked();
          }
          this.player.speed *= 1 - Math.min(0.15, TUNING.rivalContactStrength);
          this.player.hitRecovery = Math.max(this.player.hitRecovery, TUNING.hitRecoveryTime);
          this.player.x = Math.max(-1.7, Math.min(1.7,
            this.player.x - (rival.attackSide || outcome.side || 1) * 0.14));
          this.rivalPlayerGrace = 0.8;
          MUSIC.playRivalImpact({
            kind: 'incoming',
            pan: outcome.side * 0.65,
            strength: 0.8,
          });
          this.startRivalFx('incoming', rival);
          this.pushRivalHudEvent('RIVAL HIT  •  RECOVER', 'failure');
        }
      } else {
        this.player.speed *= 0.98;
        const ricochet = outcome.kind === 'shunt';
        if (ricochet) {
          pack.stagger(rival.id, { side: outcome.side, force: 0.65, damage: false });
        }
        MUSIC.playRivalImpact({
          kind: ricochet ? 'slam' : 'rub',
          pan: outcome.side * 0.45,
          strength: ricochet ? 0.55 : 0.4,
        });
        this.startRivalFx(ricochet ? 'slam' : 'rub', rival);
        if (this.rivalHintCooldown <= 0 && contact?.playerCatching) {
          this.pushRivalHudEvent(
            Math.abs(contact.lateralDistance ?? 0) > 0.2
              ? 'LINE UP BEHIND THEM'
              : 'NEED MORE SPEED  •  TRY BOOST',
            'warning',
          );
          this.rivalHintCooldown = 1.5;
        }
      }
        break;
      }
    }
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
    this.carSprite.setFrame(carSpriteFrame(2, 0));
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
        this.carSprite.setFrame(carSpriteFrame(2, 0));
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
        this.carSprite.setFrame(carSpriteFrame(2, 0));
      }
    } else if (correctHeld) {
      this.carSprite.setFrame(carSpriteFrame(direction > 0 ? 4 : 0, 0));
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
    if (this.boost.full) {
      sprite.hit = false; // pockets full — leave it for the next lap
      return;
    }
    this.boost.collect();
    MUSIC.playBoostPickup();
    this.popup('+BOOST', '#2ee56b');
  }

  setAirtimeFeedback(message, tone = 'success', seconds = 1.4) {
    if (!this.airtimeTrainingConfig) return;
    this.airtimeFeedback = { message, tone, remaining: seconds };
  }

  updateAirtimeTraining(dt) {
    if (!this.airtimeTrainingConfig) return;
    if (this.airtimeFeedback) {
      this.airtimeFeedback.remaining -= dt;
      if (this.airtimeFeedback.remaining <= 0) this.airtimeFeedback = null;
    }

    if (this.player.justLanded) {
      const scale = this.airtimeTrainingConfig.objectiveUnitsPerSecond ?? 10;
      this.recordObjective('airtime', {
        amount: Math.max(1, Math.round(this.player.lastAirtime * scale)),
      });

      const gap = this.airtimeTrainingConfig.gap;
      const segment = this.model.findSegment(
        this.player.position + TUNING.playerZ,
      ).index;
      if (gap && this.airtimeGapAttempt && !this.airtimeGapAttempt.resolved) {
        const outcome = airtimeGapOutcome({
          ready: this.airtimeGapAttempt.ready,
          landingSegment: segment,
          rockEndSegment: gap.rockEndSegment,
        });
        const cleared = outcome === 'cleared';
        this.airtimeGapAttempt.resolved = true;
        this.airtimeGapAttempt.result = outcome;
        if (this.pendingAirtimeLanding) {
          this.pendingAirtimeLanding.gapResult = this.airtimeGapAttempt.result;
        }
        this.setAirtimeFeedback(
          cleared
            ? `GAP CLEARED!  •  ${this.player.lastAirtime.toFixed(2)}s AIR`
            : 'NEED MORE SPEED  •  NEXT LAP',
          cleared ? 'success' : 'failure',
          cleared ? 1.8 : 1.6,
        );
        if (cleared) this.recordObjective('speed_gap_clear');
      } else {
        this.setAirtimeFeedback(
          `LANDED  •  ${this.player.lastAirtime.toFixed(2)}s AIR`,
          'success',
        );
      }
    }

    this.airtimeTrainingView = this.buildAirtimeTrainingView();
  }

  buildAirtimeTrainingView() {
    const config = this.airtimeTrainingConfig;
    if (!config || !this.player) return null;
    const gap = config.gap;
    const segment = this.model.findSegment(
      this.player.position + TUNING.playerZ,
    ).index;
    const requiredSpeed = gap
      ? TUNING.maxSpeed * gap.requiredSpeedMultiplier
      : 0;
    const onGapApproach = !!gap && segment >= gap.approachStartSegment &&
      segment <= gap.rockEndSegment;
    const phase = this.player.airborne
      ? 'airborne'
      : onGapApproach
        ? 'gap'
        : this.airtimeFeedback
          ? 'landed'
          : 'approach';
    return {
      phase,
      flightAssist: Boolean(this.trackData?.flightTraining),
      currentAirSeconds: this.player.airborne ? this.player.jumpElapsed : 0,
      bestAirSeconds: this.player.bestAirtime,
      glide: this.player.glide,
      speed: this.player.speed,
      requiredSpeed,
      gapReady: gap
        ? (this.boost?.tier ?? 0) > 0 && this.player.speed >= requiredSpeed
        : true,
      message: this.airtimeFeedback?.message ?? '',
      messageTone: this.airtimeFeedback?.tone ?? 'info',
    };
  }

  isAirtimeGapRock(sprite) {
    return !!this.airtimeTrainingConfig &&
      sprite?.trackObjectId?.startsWith('air-gap-rock-');
  }

  updateAirtimeAudio() {
    if (this.player.airborne) {
      this.airtimeAudioHandle?.update({
        progress: this.player.airTotal > 0
          ? 1 - this.player.air / this.player.airTotal
          : 0,
        glide: this.player.glide,
        elapsed: this.player.jumpElapsed,
        currentSpeedRatio: this.player.speed / TUNING.maxSpeed,
      });
      return;
    }
    if (!this.player.justLanded) return;

    this.recordLifetimeStat('airtimeSeconds', this.player.lastAirtime);
    if (this.player.boostedLaunch) {
      const qualified = this.styleTracker?.recordLanding({
        boosted: true,
        seconds: this.player.lastAirtime,
      }) ?? this.player.lastAirtime >= 0.85;
      if (qualified) this.recordLifetimeStat('boostedHangtimes');
    }

    const control = this.airtimeAudioHandle?.getControl?.() ?? 'neutral';
    this.airtimeAudioHandle?.stop();
    this.airtimeAudioHandle = null;
    this.pendingAirtimeLanding = {
      seconds: this.player.lastAirtime,
      boosted: this.player.boostedLaunch,
      control,
      gapResult: null,
    };
  }

  flushAirtimeLandingAudio() {
    const landing = this.pendingAirtimeLanding;
    if (!landing) return;
    this.pendingAirtimeLanding = null;
    if (this.jumpLaunchedThisFrame) return;
    if (landing.gapResult === 'cleared') {
      MUSIC.playAirtimeMasteryClear();
      return;
    }
    if (landing.gapResult === 'short') {
      MUSIC.playAirtimeGapMiss();
      return;
    }
    MUSIC.playAirtimeLanding(landing);
  }

  stopActiveFeedbackLoops() {
    this.airtimeAudioHandle?.stop();
    this.airtimeAudioHandle = null;
    this.pendingAirtimeLanding = null;
    this.boostHoldHandle?.stop();
    this.boostHoldHandle = null;
  }

  recordLifetimeStat(stat, amount = 1) {
    this.playerStatSequence += 1;
    return submitPlayerStatEvent(createPlayerStatEvent(
      this.gameplayRunId,
      this.playerStatSequence,
      stat,
      amount,
      Date.now(),
    ));
  }

  updateHeldBoostStats(dt, held) {
    const result = this.heldBoostStats.update(dt, held);
    if (result.longBurn) this.recordLifetimeStat('longBurns');
    if (result.completedSeconds > 0) {
      this.recordLifetimeStat('heldBoostSeconds', result.completedSeconds);
    }
  }

  flushHeldBoostStats() {
    const result = this.heldBoostStats.breakSegment();
    if (result.completedSeconds > 0) {
      this.recordLifetimeStat('heldBoostSeconds', result.completedSeconds);
    }
  }

  // Reacts once per frame to what Boost.update() just reported. Physics was
  // applied before Player.update so movement, contacts, and rendering all see
  // the same speed; this method is presentation only.
  reactToBoost() {
    const boost = this.boost;
    if (boost.justActivated > 0) {
      const tier = boost.justActivated;
      this.speedLineBurst = 1; // the pop reads as speed even from a standstill
      // The ramp takeoff sweep carries the same-frame boost beat; playing
      // both maximal risers together masks the contact and clips the mix.
      if (!this.jumpLaunchedThisFrame) MUSIC.playBoostApply(tier);
      const label = tier === 3 ? 'BOOST!! x3' : tier === 2 ? 'BOOST! x2' : 'BOOST';
      const color = tier === 3 ? '#ffcf3f' : tier === 2 ? '#00e5ff' : '#2ee56b';
      if (!this.jumpLaunchedThisFrame) {
        this.popup(label, color);
        this.cameras.main.shake(50 + tier * 30, 0.002 + tier * 0.0015);
      }
    } else if (boost.justExtended) {
      this.speedLineBurst = Math.max(this.speedLineBurst, 0.5);
      if (!this.jumpLaunchedThisFrame) {
        MUSIC.playBoostApply(boost.tier, { extend: true });
      }
    }

    const boostHoldAudible = shouldPlayBoostHold({
      holding: boost.holding,
      airborne: this.player.airborne,
    });
    if (boostHoldAudible && !this.boostHoldHandle) {
      this.boostHoldHandle = MUSIC.startBoostHold();
    } else if (!boostHoldAudible && this.boostHoldHandle) {
      this.boostHoldHandle.stop();
      this.boostHoldHandle = null;
    }
  }

  // Grade actual attained speed, not button presses. A player who burns the
  // bank while crawling still gets the punch, but Redline's medals require
  // carrying momentum and physically reaching each tier's redline.
  recordTopSpeed() {
    const speedMultiplier = this.player.speed / TUNING.maxSpeed;
    let reached = 0;
    for (let tier = 1; tier <= TUNING.boostTierCeilings.length; tier++) {
      if (speedMultiplier + 1e-6 >= TUNING.boostTierCeilings[tier - 1]) {
        reached = tier;
      }
    }
    if (reached <= this.topSpeedTier) return;
    this.recordObjective('top_speed', { amount: reached - this.topSpeedTier });
    this.topSpeedTier = reached;
  }

  onCandy(sprite) {
    const { def } = sprite;
    const result = this.objectives.record('object_hit', { sprite });
    const objective = result?.changes[0];
    // Smashing a cone always looks and sounds like a hit — the juice is a
    // property of the object, not of an objective. When a cone belongs to a
    // sweep objective the burst also carries progress/milestone weight; when
    // it's a loose warning or edge lure (Endless and campaign) it
    // still pops. `coneHits` gives loose cones the running index the burst
    // needs for variety.
    this.coneHits++;
    this.conesThisLap++;
    const coneId = `${this.race?.lap ?? 1}:` +
      `${sprite.trackObjectId ?? sprite.objectiveId ?? this.coneHits}`;
    this.styleTracker?.recordCone(coneId);
    this.recordLifetimeStat('conesSmashed');
    if (this.mode === 'training') this.trainingConeHits++;
    this.juiceConeHit(sprite, {
      index: objective ? objective.progress : this.coneHits,
      milestone: objective ? (objective.complete || objective.progress % 10 === 0) : false,
      complete: objective ? objective.complete : false,
    });
    const bonusClock = this.timedScoreAttack ?? this.timedElimination;
    if (bonusClock && sprite.timeBonusSeconds > 0) {
      const bonus = this.timedScoreAttack
        ? this.timedScoreAttack.addTime(
          sprite.timeBonusSeconds,
          this.rivalPack?.elapsed ?? 0,
        )
        : this.timedElimination.addTime(sprite.timeBonusSeconds, 'cone');
      if (bonus.awarded > 0) {
        MUSIC.playTimeBonus();
        this.pushRivalHudEvent(`CLOCK CONE  +${Math.round(bonus.awarded)}s`, 'success');
      }
      this.rivalSchoolView = this.buildRivalSchoolView();
    }
    if (objective) {
      if (
        result.allComplete &&
        this.trackData.finish === 'objectives' &&
        !this.race.finishArmed
      ) {
        this.race.armFinish();
      }
    }
    if (def.pop <= 0) return; // no economy reward; objectives already gave feedback
    if (this.mode === 'endless') {
      const earned = this.pop.add(def.pop);
      this.popup(`+${earned}`, '#ffcf3f');
    }
  }

  onRamp(sprite, input = {}) {
    const def = sprite.def ?? sprite;
    if (this.mode === 'endless') this.pop.add(def.pop);
    this.recordObjective('ramp_hit');
    const boosted = !!input.boostActive;
    // Boost remains physically active through the jump, but its held engine
    // bed yields at ramp contact so flight never inherits the vacuum-like
    // sustained tone. The grounded policy may resume it after landing.
    this.boostHoldHandle?.stop();
    this.boostHoldHandle = null;
    const liftMultiplier = this.trackData?.flightTraining?.liftMultiplier ?? 1;
    this.player.launch({ boosted, liftMultiplier });
    if (liftMultiplier > 1) this.popup('LIFT WINGS ONLINE', '#00e5ff');
    this.jumpLaunchedThisFrame = true;
    this.airtimeAudioHandle?.stop();
    const speedRatio = this.player.launchSpeed / TUNING.maxSpeed;
    MUSIC.playRampTakeoff({ boosted, speedRatio });
    this.airtimeAudioHandle = MUSIC.startAirtimeFlight({ boosted, speedRatio });
    const rampSegment = this.model.segments.find(
      (segment) => segment.sprites.includes(sprite),
    )?.index;
    const gap = this.airtimeTrainingConfig?.gap;
    if (gap && rampSegment === gap.rampSegment) {
      const requiredSpeed = TUNING.maxSpeed * gap.requiredSpeedMultiplier;
      const ready = boosted && this.player.launchSpeed >= requiredSpeed;
      this.airtimeGapAttempt = { ready, resolved: false };
      this.setAirtimeFeedback(
        ready ? 'SPEED READY  •  PULL ↓' :
          'NEED MORE SPEED  •  NEXT LAP',
        ready ? 'success' : 'warning',
      );
    }
    this.speedLineBurst = 1; // takeoff streaks: the ramp was the fast line
    this.cameras.main.shake(60, 0.003); // takeoff kick
  }

  onHit(def, sprite = null) {
    // A collision ends the current style line. Completed rewards stay banked,
    // but partial cone/speed/hold streaks must be rebuilt cleanly.
    this.styleTracker?.breakStreaks();
    this.flushHeldBoostStats();
    if (this.isAirtimeGapRock(sprite)) {
      // The collision sweep covers the entire landing frame. A successful
      // flight may cross the last rock segment while airborne and touch down
      // just beyond it in that same frame; do not retroactively turn that
      // authoritative clear into a hit.
      if (this.airtimeGapAttempt?.result === 'cleared') {
        sprite.hit = false;
        return;
      }
      // The final lesson asks for commitment without making a failed first
      // read expensive. The rock visibly catches the short landing, but
      // training preserves speed, hull, and the next-lap retry.
      const announceMiss = shouldAnnounceGapMiss(this.airtimeGapAttempt, {
        landingNow: this.player.justLanded,
      });
      if (announceMiss) {
        this.airtimeGapAttempt = { ready: false, resolved: true, result: 'short' };
        if (this.pendingAirtimeLanding) {
          this.pendingAirtimeLanding.gapResult = 'short';
        } else {
          MUSIC.playAirtimeGapMiss();
          this.burstLandingFx(0.65, { miss: true });
        }
        this.setAirtimeFeedback(
          'NEED MORE SPEED  •  NEXT LAP',
          'failure',
        );
      }
      this.iframes = TUNING.iframes;
      this.cameras.main.shake(90, 0.004);
      if (announceMiss) this.popup('SHORT LANDING', '#ff6b6b');
      return;
    }
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
          'ROCKS CRACK YOUR WINDSCREEN\nSteer around them to stay clean\nCones mark the mastery line\nCLEAN + ALL CONES FOR GOLD',
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
    MUSIC.playDamageImpact({ severity: Math.max(0.7, def.damage / 20) });
    this.popup(`HULL -${def.damage}`, '#ff5555');
    // Story writes the persistent garage hull; Endless is scoped by
    // RacerState to this single distance attempt.
    const wrecked = RACER.damage(def.damage);
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
    this.stopActiveFeedbackLoops();
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
        storyPhase: this.storyPhase,
        receipt: 'WRECKED — NO RACE PURSE',
      };
      this.showBanner('WRECKED\n\nENTER FOR GARAGE', 0);
    } else {
      this.showBanner('TRAINING ENDED\n\nENTER FOR TITLE', 0);
    }
  }

  finishRace() {
    this.stopActiveFeedbackLoops();
    this.done = true;
    // The rival clock starts at the rolling line; its mastery time must use
    // the same origin instead of including the pre-start grid approach.
    const t = this.timedScoreAttack?.elapsedSeconds ??
      this.timedElimination?.elapsedSeconds ?? this.race.time;
    if (this.mode === 'training') {
      const target = this.objectives.views.find(
        (objective) => objective.id === this.trackData.scoring.objective,
      ) ?? this.objectives.primary;
      // Cones gate the trophy only when a threshold says so (Hazard Weave).
      // Where cones ARE the objective (Cone Control) they reset each lap and
      // the objective row tracks unique hits, so the finishing-lap tally must
      // not feed the trophy or the perfect flag.
      const metricUsage = trainingMetricUsage(this.trackData.scoring);
      const coneGated = metricUsage.cones;
      const coneScore = trainingConeScore(this.trackData, {
        allHits: this.trainingConeHits,
        lastLapHits: this.conesThisLap,
      });
      const conesMissed = coneGated ? coneScore.missed : 0;
      const scoredProgress = this.timedScoreAttack
        ? this.timedScoreAttack.takedowns
        : target.progress;
      const result = submitTrainingResult(this.trackData, scoredProgress, t, {
        damageHits: this.trainingDamageHits,
        conesMissed,
        offTrackEvents: this.trackDiscipline.offTrackEvents,
        boostedTakedowns: this.rivalMetrics.boostedTakedowns,
        total: target.total,
      });
      const firstTrophy = [...this.trackData.scoring.thresholds]
        .sort((a, b) =>
          a.minimum - b.minimum ||
          (b.maximumDamageHits ?? Infinity) -
            (a.maximumDamageHits ?? Infinity) ||
          (b.maximumConesMissed ?? Infinity) -
            (a.maximumConesMissed ?? Infinity)
        )[0];
      const trophyLine = result.trophy
        ? `${result.trophy.rank.toUpperCase()} TROPHY  ${'★'.repeat(result.trophy.stars)}`
        : `NO TROPHY  •  ${firstTrophy.rank.toUpperCase()} AT ` +
          `${formatObjectiveValue(firstTrophy.minimum, target.display)}` +
          (firstTrophy.maximumDamageHits == null
            ? ''
            : ` / ${firstTrophy.maximumDamageHits} HITS MAX`);
      const goldTarget = this.trackData.scoring?.thresholds
        ?.find((threshold) => threshold.rank === 'gold')?.minimum ?? target.total;
      const perfect = result.trophy?.rank === 'gold';
      const nextTrack = TRAINING_TRACKS[this.trackIndex + 1];
      const nextNeedsStoryPlatinum = nextTrack?.unlock?.type === 'story_platinum';
      const nextMasteryUnlocked = !nextNeedsStoryPlatinum ||
        isStoryCampaignPlatinum(TRACKS);
      this.trainingAdvanceTo = nextTrack &&
        nextTrack.status !== 'placeholder' && nextMasteryUnlocked
        ? this.trackIndex + 1
        : null;
      const damageLine = metricUsage.damage && this.trainingDamageMax > 0
        ? `WINDSCREEN ${this.trainingDamageHits} / ${this.trainingDamageMax} HITS\n`
        : '';
      // Surface a cones tally only when cones gate the trophy (Hazard Weave);
      // when cones ARE the objective the objective row already reports them.
      const coneLine = coneGated && coneScore.target > 0
        ? `CONES ${coneScore.hits} / ${coneScore.target}\n`
        : '';
      const rivalLine = this.rivalPack
        ? `TAKEDOWNS ${this.rivalMetrics.takedowns}\n` +
          (metricUsage.offTrack
            ? `CLEAN LINE ${this.trackDiscipline.offTrackEvents === 0 ? 'YES' : 'LOST'}\n`
            : '') +
          (this.timedScoreAttack
            ? `RUN TIME ${Math.round(this.timedScoreAttack.elapsedSeconds)}s\n` +
              (this.timedScoreAttack.bonusSeconds > 0
                ? `CLOCK BONUS +${Math.round(this.timedScoreAttack.bonusSeconds)}s\n`
                : '')
            : this.timedElimination
            ? `TIME LEFT ${Math.ceil(this.timedElimination.remainingSeconds)}s\n`
            : '')
        : '';
      const nextLine = this.trainingAdvanceTo == null
        ? (nextTrack
          ? nextNeedsStoryPlatinum
            ? `NEXT: ${nextTrack.name} — PLATINUM ALL THREE RIVAL RACES`
            : `NEXT: ${nextTrack.name} — COMING SOON`
          : 'TRAINING TRACK COMPLETE')
        : `LEVEL ${this.trainingAdvanceTo + 1} UNLOCKED: ` +
          `${TRAINING_TRACKS[this.trainingAdvanceTo].name}`;
      this.showBanner(
        `${perfect ? 'PERFECT CLEAR!' : 'TRAINING COMPLETE'}\n` +
          `${target.hudLabel}  ${scoredProgress}` +
          `${this.timedScoreAttack ? '' : ` / ${target.totalLabel}`}\n` +
          damageLine +
          coneLine +
          rivalLine +
          `${trophyLine}\n${fmtTime(t)}  •  ${this.objectives.score} PTS` +
          `${result.newBest ? '  •  NEW BEST' : ''}\n\n` +
          nextLine,
        0,
      );
      this.celebrateTrainingFinish(perfect, result.trophy?.stars ?? 0);
      this.showTrainingResultActions();
      return;
    }
    if (this.mode === 'story' && this.storyPhase === STORY_PHASES.QUALIFIER) {
      const target = this.trackData.qualifier.targetSeconds;
      const elapsed = this.qualifierClock?.elapsedSeconds ?? this.race.time;
      const result = submitQualifierResult(this.trackData, elapsed, target, true);
      if (result.qualified) this.recordLifetimeStat('qualifiersCleared');
      const payout = awardStoryPayout(RACER, {
        trackId: this.trackData.id,
        version: this.trackData.storyVersion ?? 1,
        phase: STORY_PHASES.QUALIFIER,
        attemptNumber: result.progress.qualifierAttempts,
        won: result.qualified,
        styleCash: this.styleTracker?.cashEarned ?? 0,
      });
      const crew = result.qualified
        ? applyPitCrewService(RACER)
        : { level: RACER.pitCrewLevel, health: 0 };
      this.garageData = {
        completedTrackIndex: this.trackIndex,
        storyPhase: this.storyPhase,
        receipt: `${payout.claim ?? 'NO PURSE'} +$${payout.purse}   STYLE +$${payout.style}` +
          `${payout.spending?.total > 0 ? `   GARAGE -$${payout.spending.total}` : ''}` +
          `${crew.health > 0 ? `   PIT CREW +${crew.health} HULL` : ''}`,
      };
      this.showBanner(
        `${result.qualified ? 'QUALIFIED!' : 'TIME MISSED'}\n` +
          `${fmtTime(elapsed)}  •  TARGET ${fmtTime(target)}` +
          `${result.newBest ? '\nNEW BEST' : ''}` +
          `${result.qualified ? `\n${payout.claim} $${payout.purse}` +
            `  •  STYLE $${payout.style}\nWALLET $${RACER.money}` : ''}` +
          '\n\nENTER FOR GARAGE',
        0,
      );
      return;
    }
    const record = submitScore(this.trackData.id, t, 'min');
    const place = this.storyRaceOrder?.playerPlace(this.race.lastCrossingFraction) ?? 1;
    const rivalResult = this.mode === 'story' && this.storyPhase === STORY_PHASES.RIVALS
      ? submitRivalResult(this.trackData, {
        place,
        time: t,
        takedowns: this.rivalMetrics.takedowns,
      })
      : null;
    if (rivalResult?.won) this.recordLifetimeStat('rivalWins');
    const payout = awardStoryPayout(RACER, {
      trackId: this.trackData.id,
      version: this.trackData.storyVersion ?? 1,
      phase: STORY_PHASES.RIVALS,
      attemptNumber: rivalResult?.progress.rivalAttempts ?? 0,
      won: rivalResult?.won,
      fullClear: rivalResult?.fullClear,
      styleCash: this.styleTracker?.cashEarned ?? 0,
      rivalIds: [...this.storyTakedownIds],
    });
    const crew = applyPitCrewService(RACER);
    const campaignComplete = Boolean(rivalResult?.award) && isStoryCampaignComplete(TRACKS);
    this.garageData = {
      nextTrackIndex: this.trackIndex + 1,
      completedTrackIndex: this.trackIndex,
      storyPhase: this.storyPhase,
      complete: Boolean(campaignComplete),
      receipt: `${payout.claim ?? 'NO PURSE'} +$${payout.purse}` +
        `   STYLE +$${payout.style}   TAKEDOWNS +$${payout.bounties}` +
        `${payout.spending?.total > 0 ? `   GARAGE -$${payout.spending.total}` : ''}` +
        `${crew.health > 0 ? `   PIT CREW +${crew.health} HULL` : ''}`,
    };
    const storyAward = rivalResult?.award?.toUpperCase() ?? null;
    const opponentsLeft = remainingStoryOpponents(
      this.rivalAttemptCount ?? this.trackData?.rivals?.count ?? 3,
      this.rivalMetrics?.takedowns ?? 0,
    );
    this.showBanner(
      `${rivalResult ? `${storyAward ? `${storyAward}  •  ` : ''}${place === 1 ? 'VICTORY' : `${place}${place === 2 ? 'ND' : place === 3 ? 'RD' : 'TH'} PLACE`}  •  ` : 'FINISH  '}` +
        `${fmtTime(t)}${record ? '  NEW RECORD' : ''}\n` +
        `${rivalResult ? `${opponentsLeft} OPPONENT${opponentsLeft === 1 ? '' : 'S'} LEFT\n` : ''}` +
        `OBJECTIVES ${this.objectives.completedCount}/${this.objectives.views.length}` +
        `  •  ${this.objectives.score} PTS\n` +
        `${payout.claim ?? 'NO PURSE'} $${payout.purse}` +
        `  •  STYLE $${payout.style}  •  TAKEDOWNS $${payout.bounties}\n` +
        `WALLET $${RACER.money}\n\n` +
        (campaignComplete ? 'CAMPAIGN COMPLETE\nENTER FOR GARAGE' : 'ENTER FOR GARAGE'),
      0
    );
  }

  advance() {
    if (!this.done) return;
    if (this.mode === 'training') {
      this.returnToModeMenu();
      return;
    }
    if (this.mode === 'story' && this.garageData) {
      const focusIndex = this.garageData.completedTrackIndex ??
        this.garageData.retryTrackIndex ?? this.trackIndex;
      this.scene.start('TitleScene', {
        ...modeMenuTarget(
          'story',
          focusIndex,
          this.garageData.storyPhase ?? this.storyPhase,
          STORY_PAGES.GARAGE,
        ),
        garageData: this.garageData,
      });
      return;
    }
    if (this.mode === 'story') {
      this.returnToModeMenu();
    } else {
      this.scene.start('TitleScene');
    }
  }

  returnToModeMenu() {
    this.scene.start(
      'TitleScene',
      modeMenuTarget(this.mode, this.trackIndex, this.storyPhase),
    );
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

  recordObjective(event, payload = {}) {
    const result = this.objectives.record(event, payload);
    if (result?.newlyCompleted.length) {
      result.newlyCompleted.forEach((objective) => {
        this.objectiveHudSequence += 1;
        this.objectiveHudEvents.push(objectiveFeedbackEvent(
          this.objectiveHudSequence,
          objective,
        ));
      });
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

  showTrainingResultActions() {
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

    makeButton(285, 'X / R  RETRY', '#7a2458', () => this.retryTraining());
    makeButton(
      515,
      'A / ENTER  RACE SCHOOL',
      '#244c7a',
      () => this.returnToModeMenu(),
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
    const storyEventLabel = this.mode === 'story'
      ? this.storyPhase === STORY_PHASES.RIVALS
        ? '  •  RIVAL RACE'
        : '  •  BEAT THE CLOCK'
      : '';
    const title = this.add.text(
      centerX + 70,
      panelTop + 30,
      `${this.trackData.name}${storyEventLabel}`,
      {
      fontSize: '25px', color: '#ff2d95', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 4,
      },
    ).setOrigin(0.5).setAlpha(0).setDepth(41);
    const storyIntro = this.mode === 'story' && this.storyPhase === STORY_PHASES.QUALIFIER
      ? `${this.trackData.intro}\nBEAT ${fmtTime(this.trackData.qualifier.targetSeconds)}`
      : this.trackData.intro;
    const intro = this.add.text(centerX + 70, panelTop + 69, storyIntro, {
      fontSize: '16px', color: '#ffffff', align: 'center',
      stroke: '#0a0a14', strokeThickness: 4,
      wordWrap: { width: this.scale.width - 180 },
    }).setOrigin(0.5).setAlpha(0).setDepth(41);
    const header = this.add.text(centerX + 70, panelTop + 113, 'OBJECTIVES', {
      fontSize: '14px', color: '#00e5ff', fontStyle: 'bold',
      stroke: '#0a0a14', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(41);
    const rows = this.objectives.views.map((objective, index) => {
      return (
      this.add.text(centerX + 90, panelTop + 143 + index * 30,
        `○  ${objective.label}`, {
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
          if (!lapFinish) {
            reqs.push(formatObjectiveValue(
              threshold.minimum,
              scoringObjective?.display,
            ));
          }
          if (threshold.maximumDamageHits != null) {
            reqs.push(threshold.maximumDamageHits === 0
              ? 'No damage'
              : `Under ${threshold.maximumDamageHits + 1} hits`);
          }
          if (threshold.maximumConesMissed === 0) reqs.push('all cones');
          if (threshold.maximumOffTrackEvents === 0) reqs.push('clean line');
          if (threshold.minimumBoostedTakedowns != null) {
            reqs.push(`${threshold.minimumBoostedTakedowns} boosted takedown` +
              `${threshold.minimumBoostedTakedowns === 1 ? '' : 's'}`);
          }
          if (threshold.maximumTime != null) {
            reqs.push(`under ${Math.round(threshold.maximumTime)}s`);
          }
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
    hook('rivalCount', (v) => (TUNING.rivalCount = Math.round(v)), {
      format: (v) => `${Math.round(v)}`,
    });
    hook('rivalPace', (v) => (TUNING.rivalPace = v), {
      transform: (v) => v / 100, format: (v) => `${Math.round(v)}%`,
    });
    hook('rivalAggression', (v) => (TUNING.rivalAggression = v), {
      transform: (v) => v / 100, format: (v) => `${Math.round(v)}%`,
    });
    hook('rivalTelegraph', (v) => (TUNING.rivalTelegraph = v), {
      transform: (v) => v / 1000, format: (v) => `${Math.round(v)}ms`,
    });
    hook('rivalCatchupCap', (v) => (TUNING.rivalCatchupCap = v), {
      transform: (v) => v / 100, format: (v) => `${Math.round(v)}%`,
    });
    hook('rivalTakedownAdvantage', (v) => (TUNING.rivalTakedownAdvantage = v), {
      transform: (v) => v / 100, format: (v) => `${Math.round(v)}%`,
    });
    hook('rivalContactStrength', (v) => (TUNING.rivalContactStrength = v), {
      transform: (v) => v / 100, format: (v) => `${Math.round(v)}%`,
    });

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
    const rivalsActive = document.getElementById('rivalsActive');
    const rivalAttacker = document.getElementById('rivalAttacker');
    const rivalPool = document.getElementById('rivalPool');
    if (fps || rivalsActive || rivalAttacker || rivalPool) {
      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          if (fps) fps.textContent = Math.round(this.game.loop.actualFps);
          if (rivalsActive) rivalsActive.textContent = `${this.rivalPack?.views.length ?? 0}`;
          if (rivalAttacker) rivalAttacker.textContent = this.rivalPack?.attackerId ?? 'NONE';
          if (rivalPool) rivalPool.textContent = `${this.renderer.rivalPool.length} FIXED`;
        },
      });
    }
  }
}
