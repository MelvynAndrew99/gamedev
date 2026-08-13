// TitleScene.js — controller-first, late-16-bit front end.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import {
  getTrainingResult,
  highestUnlockedTrainingIndex,
} from '../systems/TrainingProgress.js';
import { RACER } from '../systems/RacerState.js';
import {
  applyEmergencyTow,
  buyGarageItem,
  buyRepair,
  garageCatalog,
  repairQuote,
} from '../systems/Economy.js';
import { axisValue, buttonDown, dpadDown, getPrimaryPad } from '../systems/Gamepad.js';
import { carSpriteFrame } from '../systems/AirtimeFx.js';
import { TRACKS, TRAINING_TRACKS } from '../tracks/index.js';
import {
  getStoryProgress,
  isStoryCampaignPlatinum,
} from '../systems/StoryProgress.js';
import { achievementViews, getPlayerProfile } from '../systems/PlayerStats.js';
import { MUSIC } from '../audio/MusicEngine.js';
import { SHOP_THEME } from '../audio/tracks/shopTheme.js';
import { HIGH_SPEED_THEME } from '../audio/tracks/highSpeedTheme.js';
import { NEON_GULCH_THEME } from '../audio/tracks/neonGulchTheme.js';
import { REDLINE_GAUNTLET_THEME } from '../audio/tracks/redlineGauntletTheme.js';
import { SYNDICATE_RUN_THEME } from '../audio/tracks/syndicateRunTheme.js';
import { TRAINING_LOOP_THEME } from '../audio/tracks/trainingLoopTheme.js';
import { garageActionBlocked, garageItemBadge } from '../ui/GarageModel.js';
import {
  adjacentDiscoveredTrack,
  moveMusicSelection,
  musicLibraryEntries,
} from '../ui/MusicPlayerModel.js';
import {
  FRONT_END_VIEWS,
  MAIN_DESTINATIONS,
  STORY_PHASES,
  STORY_PAGES,
  TROPHY_PAGES,
  buildSchoolTiles,
  buildStoryCourseTiles,
  buildTrophySummary,
  cycleTrophyPage,
  cycleStoryPage,
  moveGridSelection,
  schoolTileDescription,
  shouldResetFrontEndLaunch,
  trophyStatusLabel,
} from '../ui/FrontEndModel.js';

export const GAME_TITLE = 'RHYTHMIC RIDE';

const WIDTH = 800;
const HEIGHT = 600;
const SAFE = 24;
const COLORS = Object.freeze({
  ink: 0x09051f,
  panel: 0x17113b,
  panelAlt: 0x24154c,
  white: 0xf8f6ff,
  muted: 0xb8b8c8,
  cyan: 0x00e5ff,
  magenta: 0xff2d95,
  gold: 0xffcf3f,
  green: 0x2ee56b,
  red: 0xff5468,
  bronze: 0xd88a4b,
  silver: 0xc9d4e6,
});

const VIEW_META = Object.freeze({
  [FRONT_END_VIEWS.SCHOOL]: {
    eyebrow: 'RACE SCHOOL',
    title: 'CHOOSE A COURSE',
    help: 'ARROWS / D-PAD MOVE   A / ENTER START   B / ESC BACK',
  },
  [FRONT_END_VIEWS.STORY]: {
    eyebrow: 'STORY — THE REMATCH CUP',
    title: 'CHOOSE A COURSE',
    help: 'L / R (Q / E) PAGE   ARROWS SELECT   A / ENTER   B / ESC BACK',
  },
  [FRONT_END_VIEWS.TROPHIES]: {
    eyebrow: 'RECORDS & REWARDS',
    title: 'TROPHY ROOM',
    help: 'L / R (Q / E) PAGE   ARROWS INSPECT   B / ESC BACK',
  },
});

const STYLE_RECORDS = Object.freeze([
  Object.freeze({ title: 'KILLER DRIVING!', trigger: 'CLEAR A CONE LINE', stat: 'conesSmashed', unit: 'TOTAL CONES' }),
  Object.freeze({ title: 'SPEED DEMON!', trigger: '3 SPEED LINES', stat: 'speedLinesCrossed', unit: 'TOTAL LINES' }),
  Object.freeze({ title: 'SKY HIGH!', trigger: '0.85s BOOSTED AIR', stat: 'boostedHangtimes', unit: 'EARNED' }),
  Object.freeze({ title: 'TRIPLE THREAT!', trigger: 'TIER 3 BOOST', stat: 'tierThreeBoosts', unit: 'EARNED' }),
  Object.freeze({ title: 'LONG BURN!', trigger: 'HOLD BOOST 1.05s', stat: 'longBurns', unit: 'EARNED' }),
]);

const GARAGE_PLAYLIST = Object.freeze([
  Object.freeze({ label: 'CHROME & CREDITS', track: SHOP_THEME, discovered: () => true }),
  Object.freeze({ label: 'HIGH SPEED', track: HIGH_SPEED_THEME,
    discovered: (scene) => Boolean(scene.storyTiles[0]?.qualifier.complete) }),
  Object.freeze({ label: 'NEON GULCH', track: NEON_GULCH_THEME,
    discovered: (scene) => Boolean(scene.storyTiles[1]?.qualifier.complete) }),
  Object.freeze({ label: 'SYNDICATE RUN', track: SYNDICATE_RUN_THEME,
    discovered: (scene) => Boolean(scene.storyTiles[2]?.qualifier.complete) }),
  Object.freeze({ label: 'REDLINE GAUNTLET', track: REDLINE_GAUNTLET_THEME,
    discovered: (scene) => scene.storyTiles.some((tile) => tile.rivals.complete) }),
  Object.freeze({ label: 'RACE SCHOOL', track: TRAINING_LOOP_THEME,
    discovered: (scene) => scene.schoolTiles.some((tile) => tile.completed) }),
]);

const GARAGE_ITEM_UI = Object.freeze({
  boost_pack: Object.freeze({
    category: 'BOOST LOADOUT', icon: 'boost', perRace: true, previewSlots: 2,
  }),
  extra_boost_slot: Object.freeze({
    category: 'BOOST LOADOUT', icon: 'boost', perRace: true, previewSlots: 4,
  }),
  pit_crew_1: Object.freeze({
    category: 'PIT CREW', icon: 'crew', crewLevel: 1,
  }),
  pit_crew_2: Object.freeze({
    category: 'PIT CREW', icon: 'crew', crewLevel: 2,
  }),
  music_player: Object.freeze({
    category: 'UNLOCKABLES', icon: 'music', jukebox: true,
  }),
});

function colorCss(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function trophyColor(rank) {
  return rank === 'gold'
    ? COLORS.gold
    : rank === 'silver'
      ? COLORS.silver
      : rank === 'bronze'
        ? COLORS.bronze
        : 0x4e4966;
}

function shortTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, '0')}`;
}

function shortPlace(place) {
  if (!Number.isFinite(place)) return '--';
  const suffix = place % 100 >= 11 && place % 100 <= 13
    ? 'TH'
    : place % 10 === 1
      ? 'ST'
      : place % 10 === 2
        ? 'ND'
        : place % 10 === 3
          ? 'RD'
          : 'TH';
  return `${place}${suffix}`;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  init(data = {}) {
    const validViews = Object.values(FRONT_END_VIEWS);
    this.entryView = validViews.includes(data.view)
      ? data.view
      : FRONT_END_VIEWS.MAIN;
    this.entrySelection = Number.isInteger(data.selection) && data.selection >= 0
      ? data.selection
      : 0;
    this.entryStoryPhase = data.storyPhase === STORY_PHASES.RIVALS
      ? STORY_PHASES.RIVALS
      : STORY_PHASES.QUALIFIER;
    this.entryStoryPage = data.storyPage === STORY_PAGES.GARAGE
      ? STORY_PAGES.GARAGE
      : STORY_PAGES.COURSES;
    this.entryGarageData = data.garageData ?? null;
  }

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
    this.load.image('title-city-bg', 'assets/title-city-bg-v2.png');
  }

  create() {
    // Returning from the disposable Endless attempt reveals the untouched
    // persistent Story hull before any garage/tow logic reads it.
    RACER.endEndlessRun();
    this.view = this.entryView;
    this.selectionByView = {
      [FRONT_END_VIEWS.MAIN]: 0,
      [FRONT_END_VIEWS.SCHOOL]: 0,
      [FRONT_END_VIEWS.STORY]: 0,
      [FRONT_END_VIEWS.TROPHIES]: 0,
    };
    this.launching = false;
    this.prevPad = null;
    this.trophyPage = TROPHY_PAGES.SCHOOL;
    this.storyPage = this.entryStoryPage;
    this.garageSelection = 0;
    this.garageMessage = '';
    this.garageTrackIndex = 0;
    this.garageNowPlaying = GARAGE_PLAYLIST[0].label;
    this.musicPlayerOpen = false;
    this.musicPlayerPlaying = true;
    this.musicPlayerMessage = '';
    this.garageData = this.entryGarageData;
    this.garageTowHealth = this.garageData?.wrecked
      ? applyEmergencyTow(RACER, TUNING)
      : 0;
    this.menuMusicPlaying = false;
    this.buildTableau();
    this.refreshProgress();

    const entryCount = this.countForView();
    this.selectionByView[this.view] = Math.min(
      this.entrySelection,
      Math.max(0, entryCount - 1),
    );
    this.storyPhaseByTrack = TRACKS.map(() => STORY_PHASES.QUALIFIER);
    if (this.view === FRONT_END_VIEWS.STORY) {
      this.storyPhaseByTrack[this.selectionByView[this.view]] = this.entryStoryPhase;
    }
    const originatingCard = MAIN_DESTINATIONS.findIndex(
      (destination) => destination.id === this.view,
    );
    if (originatingCard >= 0) {
      this.selectionByView[FRONT_END_VIEWS.MAIN] = originatingCard;
    }

    this.keys = this.input.keyboard.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      enter: 'ENTER', space: 'SPACE', escape: 'ESC', backspace: 'BACKSPACE',
      tabLeft: 'Q', tabRight: 'E', pauseMusic: 'P',
    });

    this.padText = this.add.text(WIDTH - SAFE, HEIGHT - 11, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(COLORS.cyan),
    }).setOrigin(1, 1).setDepth(30);

    this.renderView(true);
    this.events.once('shutdown', () => MUSIC.stop());
  }

  buildTableau() {
    // The detailed city is a purpose-built 4:3 plate. Keeping it separate
    // from the native title/car/menu layers preserves crisp, reliable input
    // geometry while allowing a far richer first impression than primitives.
    this.titleBackground = this.add.image(WIDTH / 2, HEIGHT / 2, 'title-city-bg')
      .setDisplaySize(WIDTH, HEIGHT)
      .setDepth(0);
    this.titleBackgroundBaseScale = {
      x: this.titleBackground.scaleX,
      y: this.titleBackground.scaleY,
    };
    this.titleRoadMotion = this.add.graphics().setDepth(5);

    this.logoExtrusion = this.add.text(WIDTH / 2 + 7, 82, GAME_TITLE.replace(' ', '\n'), {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '55px',
      fontStyle: 'bold italic',
      color: colorCss(COLORS.ink),
      align: 'center',
      lineSpacing: -14,
      stroke: colorCss(COLORS.ink),
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(7).setScale(0.86).setAlpha(0);
    this.logo = this.add.text(WIDTH / 2, 74, GAME_TITLE.replace(' ', '\n'), {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '55px',
      fontStyle: 'bold italic',
      color: colorCss(COLORS.white),
      align: 'center',
      lineSpacing: -14,
      stroke: colorCss(COLORS.magenta),
      strokeThickness: 7,
      shadow: { offsetX: 4, offsetY: 5, color: '#08031c', blur: 0, fill: true },
    }).setOrigin(0.5).setDepth(8).setScale(0.86).setAlpha(0);
    this.logo.setData('cyanStroke', true);
    this.tweens.add({
      targets: [this.logo, this.logoExtrusion],
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 440,
      ease: 'Back.out',
    });
    this.logoAccent = this.add.graphics().setDepth(7);

    // The visible pixels sit low inside the 64×56 source frame. Position the
    // frame so the tires—not its transparent bounds—meet the grid at y≈424.
    // A restrained contact shadow makes that road relationship unambiguous.
    this.carGrounding = this.add.graphics().setDepth(5);
    this.carGrounding.fillStyle(0x03020d, 0.72);
    this.carGrounding.fillEllipse(WIDTH / 2, 422, 122, 18);
    this.carGrounding.lineStyle(2, COLORS.magenta, 0.34);
    this.carGrounding.strokeEllipse(WIDTH / 2, 422, 112, 12);
    this.car = this.add.sprite(WIDTH / 2, 374, 'car', carSpriteFrame(2, 0))
      .setScale(2.7)
      .setDepth(6);
    this.tweens.add({
      targets: this.car,
      y: '+=1',
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  refreshProgress() {
    this.storyTiles = buildStoryCourseTiles(
      TRACKS,
      (track) => getStoryProgress(track.id, track.storyVersion ?? 1),
    );
    this.storyPlatinum = isStoryCampaignPlatinum(TRACKS);
    const highestUnlocked = highestUnlockedTrainingIndex(TRAINING_TRACKS);
    this.schoolTiles = buildSchoolTiles(
      TRAINING_TRACKS,
      highestUnlocked,
      (track) => getTrainingResult(track.id, track.scoring?.version ?? 1),
      { storyPlatinum: this.storyPlatinum },
    );
    this.trophySummary = buildTrophySummary(this.schoolTiles);
    this.playerProfile = getPlayerProfile();
    this.playerAchievements = achievementViews(this.playerProfile);
  }

  update(time) {
    this.drawTitleBackgroundMotion(time);
    this.pollKeyboard();
    this.pollGamepad();
  }

  drawTitleBackgroundMotion(time) {
    // A slow, nearly seamless camera push moves the whole city toward the
    // player. Connected perspective crossbars add readable road speed; unlike
    // the discarded free-floating dashes, every mark belongs to the pavement.
    const push = (time % 12000) / 12000;
    const scale = 1 + push * 0.012;
    this.titleBackground.setScale(
      this.titleBackgroundBaseScale.x * scale,
      this.titleBackgroundBaseScale.y * scale,
    );
    this.titleBackground.setY(HEIGHT / 2 + push * 2);

    this.titleRoadMotion.clear();
    const alpha = this.view === FRONT_END_VIEWS.MAIN ? 0.3 : 0.1;
    const travel = (time * 0.00016) % 1;
    for (let row = 0; row < 7; row += 1) {
      const phase = (row / 7 + travel) % 1;
      const depth = phase * phase;
      const y = 399 + depth * 201;
      const halfWidth = 8 + depth * 392;
      this.titleRoadMotion.lineStyle(
        1 + depth * 2,
        row % 2 ? COLORS.magenta : 0xa76cff,
        alpha * (0.35 + depth * 0.65),
      );
      this.titleRoadMotion.lineBetween(
        WIDTH / 2 - halfWidth,
        y,
        WIDTH / 2 + halfWidth,
        y,
      );
    }
  }

  pollKeyboard() {
    const justDown = Phaser.Input.Keyboard.JustDown;
    if (this.musicPlayerOpen) {
      if (justDown(this.keys.tabLeft)) this.skipGarageMusic('previous');
      if (justDown(this.keys.tabRight)) this.skipGarageMusic('next');
      if (justDown(this.keys.up)) this.moveMusicPlayer('up');
      if (justDown(this.keys.down)) this.moveMusicPlayer('down');
      if (justDown(this.keys.left)) this.moveMusicPlayer('left');
      if (justDown(this.keys.right)) this.moveMusicPlayer('right');
      if (justDown(this.keys.enter)) this.playSelectedGarageMusic();
      if (justDown(this.keys.space) || justDown(this.keys.pauseMusic)) {
        this.toggleGarageMusicPlayback();
      }
      if (justDown(this.keys.escape) || justDown(this.keys.backspace)) this.back();
      return;
    }
    if (justDown(this.keys.tabLeft)) this.switchSectionPage('left');
    if (justDown(this.keys.tabRight)) this.switchSectionPage('right');
    if (justDown(this.keys.up)) this.move('up');
    if (justDown(this.keys.down)) this.move('down');
    if (justDown(this.keys.left)) this.move('left');
    if (justDown(this.keys.right)) this.move('right');
    if (justDown(this.keys.enter) || justDown(this.keys.space)) this.activate();
    if (justDown(this.keys.escape) || justDown(this.keys.backspace)) this.back();
  }

  pollGamepad() {
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
      b: buttonDown(pad, 1, 'B'),
      x: buttonDown(pad, 2, 'X'),
      l: buttonDown(pad, 4, 'L1') || buttonDown(pad, 6, 'L2'),
      r: buttonDown(pad, 5, 'R1') || buttonDown(pad, 7, 'R2'),
    };
    const prev = this.prevPad ?? {
      up: false, down: false, left: false, right: false,
      a: true, b: true, x: true, l: true, r: true,
    };
    if (this.musicPlayerOpen) {
      if (now.up && !prev.up) this.moveMusicPlayer('up');
      if (now.down && !prev.down) this.moveMusicPlayer('down');
      if (now.left && !prev.left) this.moveMusicPlayer('left');
      if (now.right && !prev.right) this.moveMusicPlayer('right');
      if (now.a && !prev.a) this.playSelectedGarageMusic();
      if (now.x && !prev.x) this.toggleGarageMusicPlayback();
      if (now.b && !prev.b) this.back();
      if (now.l && !prev.l) this.skipGarageMusic('previous');
      if (now.r && !prev.r) this.skipGarageMusic('next');
      this.prevPad = now;
      return;
    }
    if (now.up && !prev.up) this.move('up');
    if (now.down && !prev.down) this.move('down');
    if (now.left && !prev.left) this.move('left');
    if (now.right && !prev.right) this.move('right');
    if (now.a && !prev.a) this.activate();
    if (now.b && !prev.b) this.back();
    if (now.l && !prev.l) this.switchSectionPage('left');
    if (now.r && !prev.r) this.switchSectionPage('right');
    this.prevPad = now;
  }

  selection() {
    return this.selectionByView[this.view] ?? 0;
  }

  countForView() {
    if (this.view === FRONT_END_VIEWS.MAIN) return MAIN_DESTINATIONS.length;
    if (this.view === FRONT_END_VIEWS.SCHOOL) return this.schoolTiles.length;
    if (this.view === FRONT_END_VIEWS.STORY) return this.storyTiles.length;
    if (this.view === FRONT_END_VIEWS.TROPHIES) return this.schoolTiles.length;
    return 0;
  }

  columnsForView() {
    if (this.view === FRONT_END_VIEWS.MAIN) return 2;
    if (this.view === FRONT_END_VIEWS.STORY) return 3;
    return 3;
  }

  move(direction) {
    if (this.transitioning) return;
    if (this.musicPlayerOpen) {
      this.moveMusicPlayer(direction);
      return;
    }
    if (this.view === FRONT_END_VIEWS.STORY && this.storyPage === STORY_PAGES.GARAGE) {
      const count = this.garageActions().length;
      const delta = direction === 'left' || direction === 'up' ? -1 : 1;
      this.garageSelection = (this.garageSelection + delta + count) % count;
      this.garageMessage = '';
      this.renderView();
      return;
    }
    if (
      this.view === FRONT_END_VIEWS.TROPHIES &&
      this.trophyPage === TROPHY_PAGES.RECORDS
    ) return;
    if (
      this.view === FRONT_END_VIEWS.STORY &&
      (direction === 'up' || direction === 'down')
    ) {
      this.toggleStoryPhase(this.selection());
      return;
    }
    const current = this.selection();
    const next = moveGridSelection(
      current,
      this.countForView(),
      this.columnsForView(),
      direction,
    );
    if (next === current) return;
    this.selectionByView[this.view] = next;
    this.renderView();
  }

  toggleStoryPhase(trackIndex, phase = null) {
    if (this.transitioning) return;
    const current = this.storyPhaseByTrack[trackIndex] ?? STORY_PHASES.QUALIFIER;
    this.storyPhaseByTrack[trackIndex] = phase ?? (
      current === STORY_PHASES.QUALIFIER ? STORY_PHASES.RIVALS : STORY_PHASES.QUALIFIER
    );
    this.selectionByView[FRONT_END_VIEWS.STORY] = trackIndex;
    this.renderView();
  }

  switchTrophyPage(direction) {
    if (this.transitioning || this.view !== FRONT_END_VIEWS.TROPHIES) return;
    const next = cycleTrophyPage(this.trophyPage, direction);
    if (next === this.trophyPage) return;
    this.trophyPage = next;
    this.renderView(true);
  }

  switchStoryPage(direction) {
    if (this.transitioning || this.view !== FRONT_END_VIEWS.STORY) return;
    const next = cycleStoryPage(this.storyPage, direction);
    if (next === this.storyPage) return;
    this.storyPage = next;
    this.renderView(true);
  }

  switchSectionPage(direction) {
    if (this.musicPlayerOpen) {
      this.skipGarageMusic(direction === 'left' ? 'previous' : 'next');
      return;
    }
    if (this.view === FRONT_END_VIEWS.TROPHIES) this.switchTrophyPage(direction);
    else if (this.view === FRONT_END_VIEWS.STORY) this.switchStoryPage(direction);
  }

  select(index) {
    if (this.transitioning) return;
    if (index === this.selection()) return;
    this.selectionByView[this.view] = index;
    this.renderView();
  }

  activate() {
    if (this.launching || this.transitioning) return;
    const selected = this.selection();
    if (this.view === FRONT_END_VIEWS.MAIN) {
      const destination = MAIN_DESTINATIONS[selected];
      if (destination.id === 'endless') {
        this.launch({ mode: 'endless' });
      } else {
        this.openView(destination.id);
      }
      return;
    }
    if (this.view === FRONT_END_VIEWS.SCHOOL) {
      if (this.schoolTiles[selected]?.locked) {
        this.renderView();
        return;
      }
      this.launch({ mode: 'training', trackIndex: selected });
      return;
    }
    if (this.view === FRONT_END_VIEWS.STORY) {
      if (this.storyPage === STORY_PAGES.GARAGE) {
        this.activateGarage();
        return;
      }
      const tile = this.storyTiles[selected];
      const phase = this.storyPhaseByTrack[selected] ?? STORY_PHASES.QUALIFIER;
      const event = phase === STORY_PHASES.RIVALS ? tile?.rivals : tile?.qualifier;
      if (event?.locked) {
        this.renderView();
        return;
      }
      this.launch({
        mode: 'story',
        trackIndex: tile.trackIndex,
        storyPhase: phase,
      });
    }
  }

  launch(data) {
    this.launching = true;
    // A Story result entering the integrated garage owns a live campaign
    // state. Repairs and remaining hull must survive the tab switch back to
    // Course Select; a fresh title-menu launch still starts clean.
    if (shouldResetFrontEndLaunch(data, Boolean(this.garageData))) RACER.resetRun();
    this.scene.start('GameScene', data);
  }

  openView(view) {
    this.view = view;
    this.musicPlayerOpen = false;
    if (view === FRONT_END_VIEWS.STORY) this.storyPage = STORY_PAGES.COURSES;
    this.renderView(true);
  }

  back() {
    if (this.transitioning || this.view === FRONT_END_VIEWS.MAIN) return;
    if (this.musicPlayerOpen) {
      this.musicPlayerOpen = false;
      this.musicPlayerMessage = '';
      this.renderView(true);
      return;
    }
    this.view = FRONT_END_VIEWS.MAIN;
    this.renderView(true);
  }

  renderView(transition = false) {
    this.syncMenuMusic();
    if (this.ui) this.tweens.killTweensOf([this.ui, ...this.ui.list]);
    this.ui?.destroy(true);
    this.ui = this.add.container(0, 0).setDepth(20);
    const main = this.view === FRONT_END_VIEWS.MAIN;
    this.logo.setVisible(main);
    this.logoExtrusion.setVisible(main);
    this.logoAccent.setVisible(main);
    this.carGrounding.setAlpha(main ? 1 : 0.12);
    this.car.setAlpha(main ? 1 : 0.18).setScale(main ? 2.7 : 2.55);

    if (main) this.renderMain();
    else if (this.view === FRONT_END_VIEWS.SCHOOL) this.renderSchool();
    else if (this.view === FRONT_END_VIEWS.STORY) this.renderStory();
    else if (this.view === FRONT_END_VIEWS.TROPHIES) this.renderTrophies();

    this.transitioning = transition;
    if (transition) {
      this.ui.setAlpha(0).setY(6);
      this.tweens.add({
        targets: this.ui,
        alpha: 1,
        y: 0,
        duration: 130,
        ease: 'Quad.out',
        onComplete: () => { this.transitioning = false; },
      });
    }
  }

  syncMenuMusic() {
    const shouldPlay = this.view === FRONT_END_VIEWS.STORY;
    if (shouldPlay && !this.menuMusicPlaying) {
      MUSIC.setVolume(TUNING.musicVolume);
      MUSIC.start(SHOP_THEME);
      this.menuMusicPlaying = true;
      this.musicPlayerPlaying = true;
      this.garageTrackIndex = 0;
      this.garageNowPlaying = GARAGE_PLAYLIST[0].label;
    } else if (!shouldPlay && this.menuMusicPlaying) {
      MUSIC.stop();
      this.menuMusicPlaying = false;
    }
  }

  uiAdd(object) {
    this.ui.add(object);
    return object;
  }

  text(x, y, content, style = {}) {
    return this.uiAdd(this.add.text(x, y, content, {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '16px',
      color: colorCss(COLORS.white),
      ...style,
    }));
  }

  graphics() {
    return this.uiAdd(this.add.graphics());
  }

  zone(x, y, width, height, onActivate, onHover = null) {
    const zone = this.uiAdd(this.add.zone(x, y, width, height));
    zone.setInteractive({ useHandCursor: true });
    if (onHover) zone.on('pointerover', onHover);
    zone.on('pointerdown', onActivate);
    return zone;
  }

  renderMain() {
    MAIN_DESTINATIONS.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 42 + column * 374;
      const y = 434 + row * 70;
      this.drawMainCard(x, y, 342, 62, item, index, index === this.selection());
    });

    this.text(WIDTH / 2, 582, 'ARROWS / D-PAD MOVE   A / ENTER SELECT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: colorCss(COLORS.white),
      stroke: colorCss(COLORS.ink),
      strokeThickness: 4,
    }).setOrigin(0.5);
  }

  drawMainCard(x, y, width, height, item, index, selected) {
    const g = this.graphics();
    this.drawPanel(g, x, y, width, height, selected);
    this.drawModeIcon(g, x + 36, y + height / 2, item.id, selected);
    this.text(x + 70, y + 12, item.kicker, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(selected ? COLORS.gold : COLORS.muted),
    });
    this.text(x + 70, y + 27, item.label, {
      fontSize: '20px',
      color: colorCss(selected ? COLORS.white : COLORS.silver),
    });
    if (selected) {
      this.drawSelectionChevrons(g, x, y, width, height);
      this.pulseSelection(g);
    }
    this.zone(
      x + width / 2,
      y + height / 2,
      width,
      height,
      () => { this.selectionByView[this.view] = index; this.activate(); },
      () => this.select(index),
    );
  }

  renderSubmenuHeader() {
    const meta = VIEW_META[this.view];
    const storyGarage = this.view === FRONT_END_VIEWS.STORY &&
      this.storyPage === STORY_PAGES.GARAGE;
    this.text(SAFE, 24, meta.eyebrow, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.gold),
    });
    this.text(SAFE, 41, storyGarage ? 'PIT GARAGE' : meta.title, {
      fontSize: '29px',
      color: colorCss(COLORS.white),
      stroke: colorCss(COLORS.magenta),
      strokeThickness: 5,
    });
    const g = this.graphics();
    g.fillStyle(COLORS.cyan, 1);
    g.fillRect(SAFE, 79, 308, 4);
  }

  renderSchool() {
    this.renderSubmenuHeader();
    this.schoolTiles.forEach((tile, index) => {
      const x = 28 + (index % 3) * 250;
      const y = 104 + Math.floor(index / 3) * 142;
      this.drawCourseCard(x, y, 232, 128, tile, index, index === this.selection());
    });
    this.drawDescription(schoolTileDescription(this.schoolTiles[this.selection()]), 28, 398, 744, 112);
    this.renderBackAction();
  }

  drawCourseCard(x, y, width, height, tile, index, selected) {
    const g = this.graphics();
    this.drawPanel(g, x, y, width, height, selected, tile.locked);
    this.text(x + 14, y + 11, `COURSE ${index + 1}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(tile.locked ? COLORS.muted : COLORS.gold),
    });
    this.text(x + 14, y + 29, tile.name, {
      fontSize: tile.name.length > 15 ? '16px' : '18px',
      color: colorCss(tile.locked ? COLORS.muted : COLORS.white),
      wordWrap: { width: width - 28 },
    });
    this.drawMiniRoad(g, x + 14, y + 61, width - 28, 35, tile.locked);
    const status = tile.locked
      ? '■ LOCKED'
      : tile.trophy
        ? `${tile.trophy.toUpperCase()} TROPHY  ${'★'.repeat(tile.stars)}`
        : tile.completed
          ? 'COMPLETE  •  NO TROPHY'
          : 'OPEN  •  UNPLAYED';
    this.text(x + 14, y + 104, status, {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: '10px',
      color: colorCss(
        tile.locked
          ? COLORS.muted
          : tile.trophy
            ? trophyColor(tile.trophy)
            : tile.completed
              ? COLORS.silver
              : COLORS.white,
      ),
    });
    if (selected) {
      this.drawSelectionChevrons(g, x, y, width, height);
      this.pulseSelection(g);
    }
    this.zone(
      x + width / 2,
      y + height / 2,
      width,
      height,
      () => { this.selectionByView[this.view] = index; this.activate(); },
      () => this.select(index),
    );
  }

  renderStory() {
    this.renderSubmenuHeader();
    this.renderStoryTabs();
    if (this.storyPage === STORY_PAGES.GARAGE) {
      this.renderGarage();
      this.renderBackAction();
      return;
    }
    this.storyTiles.forEach((tile, index) => {
      const x = 28 + index * 250;
      this.drawStoryCard(x, 104, 232, 264, tile, index, index === this.selection());
    });
    const tile = this.storyTiles[this.selection()];
    const phase = this.storyPhaseByTrack[this.selection()] ?? STORY_PHASES.QUALIFIER;
    const event = phase === STORY_PHASES.RIVALS ? tile.rivals : tile.qualifier;
    const target = tile.track.qualifier?.targetSeconds;
    const detail = phase === STORY_PHASES.QUALIFIER
      ? `${tile.track.intro}  •  SOLO TARGET ${shortTime(target)}`
      : event.locked
        ? 'LOCKED — BEAT THIS COURSE\'S CLOCK TO OPEN THE RIVAL RACE'
        : `${tile.track.intro}  •  ${tile.track.rivalRace?.laps ?? 3} LAPS  •  ` +
          'GOLD: WIN  •  PLATINUM: WIN + WRECK ALL THREE' +
          (event.bestPlace ? `  •  BEST ${shortPlace(event.bestPlace)}` : '');
    this.drawDescription(detail, 28, 390, 744, 120);
    this.renderBackAction();
  }

  renderStoryTabs() {
    const pages = [
      { id: STORY_PAGES.COURSES, x: 430, label: 'COURSE SELECT', cue: 'L' },
      { id: STORY_PAGES.GARAGE, x: 600, label: 'PIT GARAGE', cue: 'R' },
    ];
    const g = this.graphics();
    pages.forEach((page) => {
      const active = this.storyPage === page.id;
      g.fillStyle(active ? COLORS.panelAlt : COLORS.ink, 0.94);
      g.fillRect(page.x, 45, 158, 34);
      g.lineStyle(active ? 3 : 1, active ? COLORS.cyan : 0x5c5577, 1);
      g.strokeRect(page.x, 45, 158, 34);
      this.text(page.x + 79, 55, `${page.cue}  ${active ? '▶ ' : ''}${page.label}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: colorCss(active ? COLORS.white : COLORS.muted),
      }).setOrigin(0.5, 0);
      this.zone(page.x + 79, 62, 158, 34, () => {
        if (this.storyPage === page.id) return;
        this.storyPage = page.id;
        this.renderView(true);
      });
    });
  }

  garageActions() {
    const actions = [
      {
        id: 'patch',
        category: 'SERVICE',
        label: `PATCH +${TUNING.repairPackHealth} HULL`,
        cost: TUNING.repairPackCost,
        icon: 'repair',
        description: 'A quick service-bay repair for a damaged racer.',
        buy: () => buyRepair(RACER, TUNING, TUNING.repairPackHealth),
      },
      {
        id: 'full',
        category: 'SERVICE',
        label: 'FULL REPAIR',
        cost: repairQuote(RACER, TUNING, RACER.maxHealth).cost,
        icon: 'repair',
        description: 'Restore every missing hull point before the next event.',
        buy: () => buyRepair(RACER, TUNING, RACER.maxHealth),
      },
    ];
    garageCatalog(RACER).forEach((item) => {
      const presentation = GARAGE_ITEM_UI[item.id] ?? {};
      actions.push({
        ...item,
        ...presentation,
        category: presentation.category ?? (item.category === 'race' ? 'RACE PREP' :
          item.category === 'upgrade' ? 'SERVICE' : 'UNLOCKABLES'),
        lockReason: item.id === 'pit_crew_2'
          ? RACER.pitCrewLevel < 1
            ? 'ADD PIT CREW I FIRST'
            : 'WIN A RIVAL RACE FIRST'
          : null,
        armed: Boolean(item.armed),
        equipped: Boolean(item.armed),
        buy: () => buyGarageItem(RACER, item.id),
      });
    });
    if (this.garageData?.wrecked) {
      actions.push({
        id: 'retry',
        category: 'RACE CONTROL',
        label: 'RETRY LAST RACE',
        cost: null,
        icon: 'retry',
        badge: 'READY',
        description: 'Return with emergency tow hull and the current campaign state.',
        retry: true,
      });
    }
    return actions;
  }

  activateGarage() {
    const action = this.garageActions()[this.garageSelection];
    if (!action) return;
    if (action.jukebox && action.owned) {
      this.musicPlayerOpen = true;
      this.musicPlayerMessage = '';
      this.renderView(true);
      return;
    }
    if (action.retry) {
      this.launching = true;
      this.scene.start('GameScene', {
        mode: 'story',
        trackIndex: this.garageData.retryTrackIndex,
        storyPhase: this.garageData.storyPhase,
      });
      return;
    }
    const result = action.buy();
    this.garageMessage = this.garageTransactionMessage(action, result);
    this.renderView();
  }

  garageTransactionMessage(action, result) {
    if (result.ok && action.icon === 'repair') {
      return `REPAIRED +${result.health} HULL  •  $${result.cost} PAID`;
    }
    if (result.ok) {
      if (action.id === 'boost_pack') return '+1 STARTING BOOST ARMED  •  NEXT STORY RACE';
      if (action.id === 'extra_boost_slot') return '4TH BOOST SLOT LOADED  •  NEXT STORY RACE';
      if (action.id === 'pit_crew_1') return 'PIT CREW ADDED  •  UP TO 25% HULL AFTER A FINISH';
      if (action.id === 'pit_crew_2') return 'PIT CREW UPGRADED  •  UP TO 50% HULL AFTER A FINISH';
      if (action.id === 'music_player') return 'MUSIC PLAYER UNLOCKED  •  PRESS A TO OPEN LIBRARY';
      return `${action.label} PURCHASED`;
    }
    if (result.reason === 'FULL') return 'HULL ALREADY FULL';
    if (result.reason === 'FUNDS') return `NOT ENOUGH CREDITS  •  NEED $${result.cost}`;
    if (result.reason === 'ARMED') return 'ALREADY LOADED FOR THE NEXT STORY RACE';
    if (result.reason === 'OWNED') return 'UPGRADE ALREADY OWNED';
    if (result.reason === 'REQUIRES_PIT_CREW_1') return 'LOCKED  •  ADD PIT CREW I FIRST';
    if (result.reason === 'REQUIRES_RIVAL_WIN') return 'LOCKED  •  WIN A RIVAL RACE FIRST';
    if (result.reason === 'REQUIRES_TRIPLE_THREAT') return 'LOCKED  •  EARN TRIPLE THREAT FIRST';
    return 'SERVICE UNAVAILABLE';
  }

  cycleGarageMusic() {
    this.skipGarageMusic('next');
  }

  musicLibrary() {
    return musicLibraryEntries(GARAGE_PLAYLIST, this);
  }

  moveMusicPlayer(direction) {
    const entries = this.musicLibrary();
    this.garageTrackIndex = moveMusicSelection(
      this.garageTrackIndex,
      entries.length,
      direction,
    );
    this.musicPlayerMessage = entries[this.garageTrackIndex]?.discovered
      ? ''
      : 'LOCKED TRACK  •  DISCOVER IT BY PLAYING THE GAME';
    this.renderView();
  }

  skipGarageMusic(direction) {
    const entries = this.musicLibrary();
    const next = adjacentDiscoveredTrack(entries, this.garageTrackIndex, direction);
    if (next == null) return;
    this.garageTrackIndex = next;
    this.playSelectedGarageMusic();
  }

  playSelectedGarageMusic() {
    const selection = this.musicLibrary()[this.garageTrackIndex];
    if (!selection?.discovered) {
      this.musicPlayerMessage = 'LOCKED TRACK  •  DISCOVER IT BY PLAYING THE GAME';
      this.renderView();
      return;
    }
    MUSIC.setVolume(TUNING.musicVolume);
    MUSIC.start(selection.track);
    this.garageNowPlaying = selection.label;
    this.musicPlayerPlaying = true;
    this.musicPlayerMessage = `NOW PLAYING  •  ${selection.label}`;
    this.renderView();
  }

  toggleGarageMusicPlayback() {
    if (this.musicPlayerPlaying) {
      MUSIC.stop();
      this.musicPlayerPlaying = false;
      this.musicPlayerMessage = `PAUSED  •  ${this.garageNowPlaying}`;
    } else {
      const selected = this.musicLibrary()[this.garageTrackIndex];
      if (!selected?.discovered) {
        this.musicPlayerMessage = 'SELECT A DISCOVERED TRACK TO PLAY';
      } else {
        MUSIC.start(selected.track);
        this.garageNowPlaying = selected.label;
        this.musicPlayerPlaying = true;
        this.musicPlayerMessage = `NOW PLAYING  •  ${selected.label}`;
      }
    }
    this.renderView();
  }

  renderGarage() {
    const g = this.graphics();
    const receipt = this.garageData?.receipt ??
      'SERVICE BAY OPEN — REPAIR NOW OR SWITCH BACK TO COURSE SELECT.';

    // One compact status rail stays visible while the catalog and inspection
    // bay do the real work. This keeps price, condition, and purchase state in
    // the same eye path without turning the garage into a wall of cards.
    g.fillStyle(COLORS.ink, 0.93);
    g.fillRect(28, 96, 744, 70);
    g.fillStyle(COLORS.magenta, 1);
    g.fillRect(28, 96, 7, 70);
    this.text(48, 106, 'PIT STATUS', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: colorCss(COLORS.gold),
    });
    this.text(48, 124, `HULL  ${RACER.health} / ${RACER.maxHealth}`, {
      fontSize: '18px', color: colorCss(RACER.health < 30 ? COLORS.red : COLORS.white),
    });
    const hullFrac = Math.max(0, Math.min(1, RACER.health / RACER.maxHealth));
    g.fillStyle(0x312a4d, 1);
    g.fillRect(246, 128, 236, 11);
    g.fillStyle(hullFrac < 0.3 ? COLORS.red : hullFrac < 0.65 ? COLORS.gold : COLORS.green, 1);
    g.fillRect(246, 128, 236 * hullFrac, 11);
    g.lineStyle(1, COLORS.white, 0.35);
    g.strokeRect(246, 128, 236, 11);
    this.text(748, 107, `WALLET  $${RACER.money}`, {
      fontSize: '19px', color: colorCss(COLORS.green),
    }).setOrigin(1, 0);
    this.text(48, 148, receipt + (
      this.garageTowHealth > 0 ? `  •  TOW +${this.garageTowHealth} HULL` : ''
    ), {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: colorCss(COLORS.muted),
      wordWrap: { width: 690 },
    });

    if (this.musicPlayerOpen) {
      this.renderGarageMusicPlayer();
      return;
    }

    const actions = this.garageActions();
    if (this.garageSelection >= actions.length) this.garageSelection = actions.length - 1;
    const rowHeight = Math.min(49, 326 / Math.max(1, actions.length));
    actions.forEach((action, index) => this.drawGarageCatalogRow(
      28,
      180 + index * rowHeight,
      294,
      rowHeight - 3,
      action,
      index === this.garageSelection,
      index,
    ));
    const selected = actions[this.garageSelection];
    if (selected) this.drawGarageInspectionBay(selected, 338, 180, 434, 326);
  }

  renderGarageMusicPlayer() {
    const entries = this.musicLibrary();
    const selected = entries[this.garageTrackIndex] ?? entries[0];
    const g = this.graphics();
    const x = 28;
    const y = 180;
    const width = 744;
    const height = 326;

    g.fillStyle(COLORS.ink, 0.98);
    g.fillRect(x, y, width, height);
    g.lineStyle(2, COLORS.magenta, 1);
    g.strokeRect(x, y, width, height);
    this.text(x + 18, y + 14, 'MUSIC PLAYER', {
      fontSize: '22px', color: colorCss(COLORS.white),
    });
    this.text(x + width - 18, y + 17, 'GAME SOUNDTRACK', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: colorCss(COLORS.cyan),
    }).setOrigin(1, 0);

    entries.forEach((entry, index) => {
      const rowX = x + 18;
      const rowY = y + 54 + index * 38;
      const active = index === this.garageTrackIndex;
      const playing = entry.label === this.garageNowPlaying && this.musicPlayerPlaying;
      g.fillStyle(active ? COLORS.panelAlt : COLORS.panel, active ? 1 : 0.86);
      g.fillRect(rowX, rowY, 316, 32);
      g.lineStyle(active ? 2 : 1, active ? COLORS.cyan : 0x514869, 1);
      g.strokeRect(rowX, rowY, 316, 32);
      if (playing) {
        g.fillStyle(COLORS.green, 1);
        g.fillTriangle(rowX + 11, rowY + 9, rowX + 11, rowY + 23, rowX + 21, rowY + 16);
      } else if (!entry.discovered) {
        g.fillStyle(0x514869, 1);
        g.fillRect(rowX + 11, rowY + 11, 11, 11);
      }
      this.text(rowX + 31, rowY + 8,
        entry.discovered ? entry.label : `TRACK ${index + 1}  •  ??????`, {
          fontSize: entry.discovered ? '12px' : '11px',
          color: colorCss(entry.discovered ? COLORS.white : COLORS.muted),
        });
      this.text(rowX + 300, rowY + 10,
        entry.discovered ? `${entry.track.bpm} BPM` : 'LOCKED', {
          fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold',
          color: colorCss(entry.discovered ? COLORS.gold : COLORS.muted),
        }).setOrigin(1, 0);
      this.zone(rowX + 158, rowY + 16, 316, 32,
        () => {
          this.garageTrackIndex = index;
          this.playSelectedGarageMusic();
        },
        () => {
          if (this.garageTrackIndex === index) return;
          this.garageTrackIndex = index;
          this.musicPlayerMessage = entry.discovered
            ? ''
            : 'LOCKED TRACK  •  DISCOVER IT BY PLAYING THE GAME';
          this.renderView();
        });
    });

    const deckX = x + 358;
    const deckW = width - 376;
    g.fillStyle(COLORS.panel, 1);
    g.fillRect(deckX, y + 54, deckW, 222);
    g.lineStyle(1, 0x655a86, 1);
    g.strokeRect(deckX, y + 54, deckW, 222);
    this.text(deckX + 18, y + 70, selected?.discovered ? 'SELECTED TRACK' : 'UNKNOWN TRACK', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px',
      color: colorCss(selected?.discovered ? COLORS.gold : COLORS.muted),
    });
    this.text(deckX + 18, y + 90,
      selected?.discovered ? selected.label : '??????', {
        fontSize: selected?.discovered && selected.label.length > 18 ? '19px' : '23px',
        color: colorCss(selected?.discovered ? COLORS.white : COLORS.muted),
      });

    // A small animated-deck silhouette: the bars are deterministic shapes,
    // so the player reads "music" even with sound off or reduced motion.
    [22, 44, 30, 58, 38, 50, 26, 42].forEach((barHeight, index) => {
      g.fillStyle(index % 2 ? COLORS.magenta : COLORS.cyan,
        selected?.discovered ? 0.9 : 0.2);
      g.fillRect(deckX + 22 + index * 38, y + 189 - barHeight, 19, barHeight);
    });
    this.text(deckX + 18, y + 205,
      this.musicPlayerMessage ||
        `${this.musicPlayerPlaying ? 'PLAYING' : 'PAUSED'}  •  ${this.garageNowPlaying}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: colorCss(this.musicPlayerPlaying ? COLORS.green : COLORS.gold),
        wordWrap: { width: deckW - 36 },
      });

    const controls = [
      { label: '◀ PREV', x: deckX + 55, action: () => this.skipGarageMusic('previous') },
      { label: this.musicPlayerPlaying ? 'Ⅱ PAUSE' : '▶ PLAY', x: deckX + deckW / 2,
        action: () => this.toggleGarageMusicPlayback() },
      { label: 'NEXT ▶', x: deckX + deckW - 55, action: () => this.skipGarageMusic('next') },
    ];
    controls.forEach((control) => {
      g.fillStyle(0x083e4b, 1);
      g.fillRect(control.x - 48, y + 239, 96, 28);
      g.lineStyle(1, COLORS.cyan, 1);
      g.strokeRect(control.x - 48, y + 239, 96, 28);
      this.text(control.x, y + 247, control.label, {
        fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold',
        color: colorCss(COLORS.white),
      }).setOrigin(0.5, 0);
      this.zone(control.x, y + 253, 96, 28, control.action);
    });

    this.text(x + 18, y + height - 24,
      '↑↓ SELECT   A / ENTER PLAY   X / SPACE PAUSE   L/R OR Q/E SKIP   B / ESC CLOSE', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px',
        color: colorCss(COLORS.muted),
      });
    this.text(x + width - 18, y + height - 24, 'CLOSE  ×', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: colorCss(COLORS.cyan),
    }).setOrigin(1, 0);
    this.zone(x + width - 52, y + height - 18, 82, 30, () => this.back());
  }

  garageActionBadge(action) {
    return garageItemBadge(action, RACER.money);
  }

  garageBadgeColor(action, badge) {
    if (action.locked || badge === 'FUNDS LOW') return COLORS.red;
    if (action.owned || action.equipped || badge === 'READY' || badge === 'HULL FULL') {
      return COLORS.green;
    }
    return action.perRace ? COLORS.gold : COLORS.cyan;
  }

  drawGarageCatalogRow(x, y, width, height, action, selected, index) {
    const g = this.graphics();
    g.fillStyle(selected ? COLORS.panelAlt : COLORS.ink, selected ? 0.98 : 0.9);
    g.fillRect(x, y, width, height);
    g.lineStyle(selected ? 3 : 1, selected ? COLORS.cyan : 0x5c5577, 1);
    g.strokeRect(x, y, width, height);
    const categoryColor = action.category === 'SERVICE'
      ? COLORS.green
      : action.category === 'RACE PREP'
        ? COLORS.gold
        : action.category === 'UNLOCKABLES'
          ? COLORS.magenta
          : COLORS.cyan;
    g.fillStyle(selected ? COLORS.white : categoryColor, 1);
    g.fillRect(x, y, 6, height);
    this.drawGarageItemIcon(g, x + 25, y + height / 2, action, 0.56);
    this.text(x + 48, y + 5, action.label, {
      fontSize: action.label.length > 21 ? '12px' : '14px',
      color: colorCss(action.locked ? COLORS.muted : COLORS.white),
    });
    if (height >= 28) {
      this.text(x + 48, y + height - 11, action.category ?? 'GARAGE', {
        fontFamily: 'Arial, sans-serif', fontSize: '7px',
        color: colorCss(COLORS.muted),
      });
    }
    const badge = this.garageActionBadge(action);
    const badgeColor = this.garageBadgeColor(action, badge);
    this.text(x + width - 10, y + 9, badge, {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold',
      color: colorCss(badgeColor),
    }).setOrigin(1, 0);
    if (selected) {
      this.pulseSelection(g);
    }
    this.zone(x + width / 2, y + height / 2, width, height,
      () => { this.garageSelection = index; this.activateGarage(); },
      () => {
        if (this.garageSelection === index) return;
        this.garageSelection = index;
        this.garageMessage = '';
        this.renderView();
      });
  }

  drawGarageInspectionBay(action, x, y, width, height) {
    const g = this.graphics();
    g.fillStyle(COLORS.panel, 0.97);
    g.fillRect(x, y, width, height);
    g.lineStyle(2, 0x655a86, 1);
    g.strokeRect(x, y, width, height);
    g.fillStyle(COLORS.cyan, 0.12);
    g.fillRect(x + 12, y + 48, width - 24, 128);
    for (let line = 0; line < 5; line += 1) {
      g.lineStyle(1, COLORS.cyan, 0.15);
      g.lineBetween(x + 20, y + 70 + line * 23, x + width - 20, y + 70 + line * 23);
    }
    this.text(x + 18, y + 12, action.category ?? 'GARAGE', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px',
      color: colorCss(COLORS.gold),
    });
    const badge = this.garageActionBadge(action);
    const badgeColor = this.garageBadgeColor(action, badge);
    this.text(x + width - 18, y + 11, badge, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: colorCss(badgeColor),
    }).setOrigin(1, 0);

    this.drawGarageItemPreview(g, x + width / 2, y + 111, action);
    this.text(x + 20, y + 192, action.label, {
      fontSize: action.label.length > 22 ? '18px' : '22px',
      color: colorCss(COLORS.white),
    });
    const detail = this.garageMessage || action.description;
    this.text(x + 20, y + 226, detail, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px',
      color: colorCss(this.garageMessage ? COLORS.gold : COLORS.muted),
      wordWrap: { width: width - 40 }, lineSpacing: 3,
    });
    if (action.jukebox && action.owned && !this.garageMessage) {
      const discoveredCount = GARAGE_PLAYLIST.filter((entry) => entry.discovered(this)).length;
      this.text(x + 20, y + 264,
        `${discoveredCount} / ${GARAGE_PLAYLIST.length} TRACKS DISCOVERED  •  UNKNOWN TRACKS HIDDEN`, {
          fontFamily: 'Arial, sans-serif', fontSize: '9px',
          color: colorCss(COLORS.cyan),
        });
    }
    if (action.locked && action.lockReason) {
      this.text(x + 20, y + 264, `LOCKED  •  ${action.lockReason}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: colorCss(COLORS.red),
      });
    }

    const blocked = garageActionBlocked(action);
    const canAfford = action.cost == null || RACER.money >= action.cost;
    const prompt = action.retry
      ? 'A / ENTER  RACE AGAIN'
      : action.jukebox && action.owned
        ? `A / ENTER  OPEN PLAYER  •  ${this.garageNowPlaying}`
      : blocked
        ? badge
        : `${action.cost == null ? '' : `$${action.cost}  •  `}A / ENTER ${action.perRace ? 'LOAD' : 'BUY'}`;
    g.fillStyle(blocked || !canAfford ? 0x302b48 : 0x083e4b, 1);
    g.fillRect(x + 20, y + height - 48, width - 40, 32);
    g.lineStyle(2, blocked || !canAfford ? 0x655a86 : COLORS.cyan, 1);
    g.strokeRect(x + 20, y + height - 48, width - 40, 32);
    this.text(x + width / 2, y + height - 32, prompt, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: colorCss(blocked || !canAfford ? COLORS.muted : COLORS.white),
    }).setOrigin(0.5);
  }

  drawGarageItemIcon(g, x, y, action, scale = 1) {
    const color = action.locked ? COLORS.muted : action.perRace ? COLORS.gold : COLORS.cyan;
    g.lineStyle(3 * scale, color, 1);
    if (action.icon === 'retry') {
      g.strokeCircle(x, y, 13 * scale);
      g.lineBetween(x - 13 * scale, y, x - 5 * scale, y - 8 * scale);
      g.lineBetween(x - 13 * scale, y, x - 4 * scale, y + 7 * scale);
    } else if (action.icon === 'boost') {
      g.strokeTriangle(x - 12 * scale, y + 10 * scale, x + 2 * scale, y, x - 12 * scale, y - 10 * scale);
      g.strokeTriangle(x, y + 10 * scale, x + 14 * scale, y, x, y - 10 * scale);
    } else if (action.icon === 'crew') {
      g.strokeCircle(x, y - 7 * scale, 6 * scale);
      g.strokeRect(x - 10 * scale, y + 1 * scale, 20 * scale, 12 * scale);
    } else if (action.icon === 'music') {
      g.lineBetween(x - 5 * scale, y - 12 * scale, x - 5 * scale, y + 8 * scale);
      g.lineBetween(x - 5 * scale, y - 12 * scale, x + 10 * scale, y - 16 * scale);
      g.strokeCircle(x - 11 * scale, y + 10 * scale, 6 * scale);
      g.strokeCircle(x + 5 * scale, y + 6 * scale, 6 * scale);
    } else {
      g.lineBetween(x - 12 * scale, y, x + 12 * scale, y);
      g.lineBetween(x, y - 12 * scale, x, y + 12 * scale);
    }
  }

  drawGarageItemPreview(g, x, y, action) {
    this.drawGarageItemIcon(g, x, y - 7, action, 2.1);
    if (action.icon === 'crew') {
      // Tool arms flanking the car turn pit-crew levels into a visible bay
      // upgrade, not just another line of explanatory copy.
      g.lineStyle(4, COLORS.magenta, 0.9);
      g.lineBetween(x - 86, y + 36, x - 48, y + 10);
      g.lineBetween(x + 86, y + 36, x + 48, y + 10);
      g.strokeCircle(x - 89, y + 39, 8);
      g.strokeCircle(x + 89, y + 39, 8);
      if ((action.crewLevel ?? 0) >= 2) {
        g.fillStyle(COLORS.green, 0.9);
        g.fillCircle(x - 89, y + 39, 4);
        g.fillCircle(x + 89, y + 39, 4);
        g.lineStyle(2, COLORS.green, 0.8);
        g.strokeRect(x - 55, y + 29, 110, 25);
      }
    }
    if (action.icon === 'boost') {
      const slots = action.previewSlots ?? 1;
      for (let slot = 0; slot < 4; slot += 1) {
        g.fillStyle(slot < (action.previewSlots ?? 1) ? COLORS.gold : 0x433a63, 1);
        g.fillCircle(x - 45 + slot * 30, y + 43, slot < slots ? 8 : 6);
      }
    }
    if (action.icon === 'music' && action.owned) {
      GARAGE_PLAYLIST.forEach((entry, index) => {
        const discovered = entry.discovered(this);
        g.fillStyle(discovered ? (index % 2 ? COLORS.magenta : COLORS.cyan) : 0x302b48,
          discovered ? 0.9 : 1);
        g.fillRect(x - 69 + index * 24, y + 31, 17, 24);
        g.lineStyle(1, discovered ? COLORS.white : 0x655a86, 0.6);
        g.strokeRect(x - 69 + index * 24, y + 31, 17, 24);
      });
    }
  }

  drawStoryCard(x, y, width, height, tile, index, selected) {
    const g = this.graphics();
    const phase = this.storyPhaseByTrack[index] ?? STORY_PHASES.QUALIFIER;
    const event = phase === STORY_PHASES.RIVALS ? tile.rivals : tile.qualifier;
    this.drawPanel(g, x, y, width, height, selected, false);
    this.text(x + 14, y + 11, `COURSE ${tile.trackIndex + 1}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(COLORS.gold),
    });
    this.text(x + 14, y + 27, tile.track.name, {
      fontSize: tile.track.name.length > 15 ? '16px' : '18px',
      color: colorCss(COLORS.white),
    });
    this.drawStoryIllustration(g, x + 14, y + 52, width - 28, 92, index);

    const toggleY = y + 154;
    const toggleW = (width - 28) / 2;
    this.drawStoryToggle(g, x + 14, toggleY, toggleW, 34, 'TIME',
      phase === STORY_PHASES.QUALIFIER, false);
    this.drawStoryToggle(g, x + 14 + toggleW, toggleY, toggleW, 34, 'RIVALS',
      phase === STORY_PHASES.RIVALS, tile.rivals.locked);

    const state = event.locked
      ? '■ LOCKED'
      : phase === STORY_PHASES.QUALIFIER
        ? event.complete
          ? `QUALIFIED  •  ${shortTime(event.bestTime)}`
          : `TARGET ${shortTime(tile.track.qualifier?.targetSeconds)}`
        : event.complete
          ? `${event.award === 'platinum' ? 'PLATINUM  •  100% CLEAR' : 'GOLD  •  1ST PLACE'}`
          : event.bestPlace
            ? `BEST ${shortPlace(event.bestPlace)}  •  ${event.bestTakedowns} WRECKS`
            : `${tile.track.rivalRace?.laps ?? 3} LAPS  •  OPEN`;
    this.text(x + 14, y + 202, state, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: colorCss(event.locked
        ? COLORS.muted
        : event.award === 'platinum'
          ? COLORS.cyan
          : event.complete ? COLORS.gold : COLORS.silver),
    });
    this.text(x + 14, y + 225,
      phase === STORY_PHASES.QUALIFIER ? 'SOLO SPEED RUN' : 'GOLD: WIN  •  PLATINUM: WRECK ALL', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        color: colorCss(event.locked ? COLORS.muted : COLORS.cyan),
      });
    if (selected) {
      this.drawSelectionChevrons(g, x, y, width, height);
      this.pulseSelection(g);
    }
    this.zone(
      x + width / 2,
      y + 76,
      width - 8,
      144,
      () => { this.selectionByView[this.view] = index; this.activate(); },
      () => this.select(index),
    );
    this.zone(
      x + 14 + toggleW / 2,
      toggleY + 17,
      toggleW,
      34,
      () => this.toggleStoryPhase(index, STORY_PHASES.QUALIFIER),
      () => {
        const changed = this.selectionByView[this.view] !== index ||
          this.storyPhaseByTrack[index] !== STORY_PHASES.QUALIFIER;
        this.selectionByView[this.view] = index;
        this.storyPhaseByTrack[index] = STORY_PHASES.QUALIFIER;
        if (changed) this.renderView();
      },
    );
    this.zone(
      x + 14 + toggleW * 1.5,
      toggleY + 17,
      toggleW,
      34,
      () => this.toggleStoryPhase(index, STORY_PHASES.RIVALS),
      () => {
        const changed = this.selectionByView[this.view] !== index ||
          this.storyPhaseByTrack[index] !== STORY_PHASES.RIVALS;
        this.selectionByView[this.view] = index;
        this.storyPhaseByTrack[index] = STORY_PHASES.RIVALS;
        if (changed) this.renderView();
      },
    );
  }

  drawStoryToggle(g, x, y, width, height, label, active, locked) {
    g.fillStyle(active ? COLORS.panelAlt : COLORS.ink, 0.96);
    g.fillRect(x, y, width, height);
    g.lineStyle(active ? 3 : 1, active ? COLORS.cyan : 0x5c5675, 1);
    g.strokeRect(x + 1, y + 1, width - 2, height - 2);
    this.text(x + width / 2, y + 9, `${locked ? '■ ' : ''}${label}`, {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: '10px',
      color: colorCss(locked ? COLORS.muted : active ? COLORS.white : COLORS.silver),
    }).setOrigin(0.5, 0);
  }

  renderTrophies() {
    this.renderSubmenuHeader();
    this.renderTrophyTabs();
    if (this.trophyPage === TROPHY_PAGES.RECORDS) this.renderPlayerRecords();
    else this.renderSchoolTrophies();
    this.renderBackAction();
  }

  renderTrophyTabs() {
    const pages = [
      { id: TROPHY_PAGES.SCHOOL, x: 430, label: 'SCHOOL TROPHIES', cue: 'L' },
      { id: TROPHY_PAGES.RECORDS, x: 600, label: 'PLAYER RECORDS', cue: 'R' },
    ];
    const g = this.graphics();
    pages.forEach((page) => {
      const active = this.trophyPage === page.id;
      g.fillStyle(active ? COLORS.panelAlt : COLORS.ink, 0.94);
      g.fillRect(page.x, 45, 158, 34);
      g.lineStyle(active ? 3 : 1, active ? COLORS.cyan : 0x5c5577, 1);
      g.strokeRect(page.x, 45, 158, 34);
      this.text(
        page.x + 79,
        55,
        `${page.cue}  ${active ? '▶ ' : ''}${page.label}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: colorCss(active ? COLORS.white : COLORS.muted),
        },
      ).setOrigin(0.5, 0);
      this.zone(
        page.x + 79,
        62,
        158,
        34,
        () => {
          if (this.trophyPage === page.id) return;
          this.trophyPage = page.id;
          this.renderView(true);
        },
      );
    });
  }

  renderSchoolTrophies() {
    this.schoolTiles.forEach((tile, index) => {
      const x = 28 + (index % 3) * 250;
      const y = 118 + Math.floor(index / 3) * 126;
      this.drawTrophyCard(x, y, 232, 118, tile, index, index === this.selection());
    });

    const tile = this.schoolTiles[this.selection()];
    const rank = trophyStatusLabel(tile);
    this.drawDescription(
      tile.locked
        ? `${tile.name}  •  ${schoolTileDescription(tile)}`
        : `${tile.name}  •  ${rank}  •  ${tile.stars}/${tile.maxStars} STARS`,
      28, 376, 744, 54,
    );

    const rewardText = this.trophySummary.allGold
      ? 'ALL-GOLD REWARD READY'
      : 'LOCKED — EARN GOLD IN EVERY COURSE';
    const g = this.graphics();
    g.fillStyle(COLORS.ink, 0.92);
    g.fillRect(28, 440, 744, 78);
    g.lineStyle(3, this.trophySummary.allGold ? COLORS.gold : 0x5c5577, 1);
    g.strokeRect(28, 440, 744, 78);
    this.text(42, 451, 'RACE SCHOOL COLLECTION', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(COLORS.muted),
    });
    this.text(42, 472, `${this.trophySummary.stars}/${this.trophySummary.maxStars} SCHOOL STARS`, {
      fontSize: '20px',
      color: colorCss(COLORS.gold),
    });
    this.text(756, 476, rewardText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: colorCss(this.trophySummary.allGold ? COLORS.green : COLORS.muted),
    }).setOrigin(1, 0);
  }

  renderPlayerRecords() {
    const totals = this.playerProfile.totals;
    this.text(28, 104, 'LIFETIME TOTALS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.gold),
    });
    [
      ['CONES SMASHED', Math.floor(totals.conesSmashed)],
      ['AIRTIME', `${totals.airtimeSeconds.toFixed(1)}s`],
      ['RIVALS WRECKED', Math.floor(totals.rivalsWrecked)],
      ['SPEED LINES', Math.floor(totals.speedLinesCrossed)],
    ].forEach(([label, value], index) => {
      this.drawRecordStat(28 + index * 186, 122, 174, 65, label, value);
    });

    this.text(28, 201, 'STYLE REWARDS — HOW TO EARN THEM', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.gold),
    });
    STYLE_RECORDS.forEach((record, index) => {
      this.drawStyleRecord(28 + index * 148, 220, 140, 96, record, totals);
    });

    this.text(28, 332, 'ACHIEVEMENTS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.gold),
    });
    this.playerAchievements.forEach((achievement, index) => {
      this.drawAchievementRecord(28 + index * 186, 351, 174, 116, achievement);
    });
    this.text(28, 484,
      'TOTALS ALWAYS DISPLAY — YOUR FIRST RUN STARTS EVERY RECORD AT ZERO.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: colorCss(COLORS.muted),
      });
  }

  drawRecordStat(x, y, width, height, label, value) {
    const g = this.graphics();
    g.fillStyle(COLORS.ink, 0.92);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.cyan, 1);
    g.fillRect(x, y, 5, height);
    this.text(x + 14, y + 9, label, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: colorCss(COLORS.muted),
    });
    this.text(x + 14, y + 26, String(value), {
      fontSize: '24px', color: colorCss(COLORS.white),
    });
  }

  drawStyleRecord(x, y, width, height, record, totals) {
    const g = this.graphics();
    g.fillStyle(COLORS.panel, 0.96);
    g.fillRect(x, y, width, height);
    g.fillStyle(COLORS.magenta, 1);
    g.fillRect(x, y, width, 4);
    this.text(x + 10, y + 12, record.title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: record.title.length > 14 ? '10px' : '11px',
      fontStyle: 'bold',
      color: colorCss(COLORS.white),
      wordWrap: { width: width - 20 },
    });
    this.text(x + 10, y + 40, record.trigger, {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: colorCss(COLORS.gold),
      wordWrap: { width: width - 20 },
    });
    this.text(x + 10, y + 70,
      `${Math.floor(totals[record.stat])} ${record.unit}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '9px', color: colorCss(COLORS.muted),
      });
  }

  drawAchievementRecord(x, y, width, height, achievement) {
    const g = this.graphics();
    const earned = achievement.earned;
    g.fillStyle(earned ? COLORS.panelAlt : 0x121024, 0.97);
    g.fillRect(x, y, width, height);
    g.lineStyle(2, earned ? COLORS.cyan : 0x514b68, 1);
    g.strokeRect(x, y, width, height);
    this.text(x + 12, y + 13,
      `${earned ? '◆' : '◇'}  ${achievement.icon}  ${achievement.label}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: colorCss(earned ? COLORS.cyan : COLORS.white),
      });
    const formatted = achievement.stat === 'airtimeSeconds'
      ? `${achievement.progress.toFixed(1)} / ${achievement.threshold}s`
      : `${Math.floor(achievement.progress)} / ${achievement.threshold}`;
    const earnedDate = earned && achievement.earnedAt
      ? new Date(achievement.earnedAt).toLocaleDateString(undefined, {
        month: 'numeric', day: 'numeric',
      })
      : '';
    this.text(x + 12, y + 46,
      earned ? `EARNED${earnedDate ? `  ${earnedDate}` : ''}` : 'LOCKED', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: colorCss(earned ? COLORS.gold : COLORS.muted),
      });
    this.text(x + 12, y + 72, earned ? 'MILESTONE COMPLETE' : formatted, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: colorCss(COLORS.silver),
    });
  }

  drawTrophyCard(x, y, width, height, tile, index, selected) {
    const g = this.graphics();
    this.drawPanel(g, x, y, width, height, selected, tile.locked);
    this.drawTrophyIcon(g, x + 43, y + 57, tile.locked ? null : tile.trophy, 0.78);
    this.text(x + 82, y + 18, `${index + 1}. ${tile.name}`, {
      fontSize: tile.name.length > 15 ? '13px' : '15px',
      wordWrap: { width: width - 94 },
      color: colorCss(tile.locked ? COLORS.muted : tile.trophy ? COLORS.white : COLORS.muted),
    });
    this.text(x + 82, y + 63, trophyStatusLabel(tile), {
      fontFamily: 'Arial, sans-serif',
      fontSize: tile.completed && !tile.trophy ? '9px' : '11px',
      fontStyle: 'bold',
      color: colorCss(tile.locked ? COLORS.muted : tile.trophy ? trophyColor(tile.trophy) : COLORS.muted),
    });
    this.text(x + 82, y + 84, `${'★'.repeat(tile.stars)}${'☆'.repeat(tile.maxStars - tile.stars)}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: colorCss(tile.locked ? COLORS.muted : tile.trophy ? trophyColor(tile.trophy) : COLORS.muted),
    });
    if (selected) {
      this.drawSelectionChevrons(g, x, y, width, height);
      this.pulseSelection(g);
    }
    this.zone(
      x + width / 2,
      y + height / 2,
      width,
      height,
      () => { this.selectionByView[this.view] = index; this.renderView(); },
      () => this.select(index),
    );
  }

  renderBackAction() {
    const meta = VIEW_META[this.view];
    this.text(SAFE, 554, meta.help, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.muted),
    }).setOrigin(0, 0.5);
    const g = this.graphics();
    g.fillStyle(COLORS.panel, 0.96);
    g.fillRect(664, 535, 108, 37);
    g.lineStyle(2, COLORS.cyan, 1);
    g.strokeRect(664, 535, 108, 37);
    this.text(718, 553, '◀  BACK', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.zone(718, 553, 108, 37, () => this.back());
  }

  drawPanel(g, x, y, width, height, selected, locked = false) {
    const lift = selected ? -4 : 0;
    g.fillStyle(COLORS.ink, 0.72);
    g.fillRect(x + 7, y + 8 + lift, width, height);
    g.fillStyle(locked ? 0x121024 : selected ? COLORS.panelAlt : COLORS.panel, 0.97);
    g.fillRect(x, y + lift, width, height);
    g.lineStyle(selected ? 5 : 2, selected ? COLORS.cyan : 0x655a86, 1);
    g.strokeRect(x, y + lift, width, height);
    g.fillStyle(selected ? COLORS.magenta : 0x3d315d, 1);
    g.fillRect(x, y + lift, width, 5);
  }

  drawSelectionChevrons(g, x, y, width, height) {
    g.fillStyle(COLORS.gold, 1);
    g.fillTriangle(x + 5, y + height / 2 - 8, x + 13, y + height / 2, x + 5, y + height / 2 + 8);
    g.fillTriangle(x + width - 5, y + height / 2 - 8, x + width - 13, y + height / 2, x + width - 5, y + height / 2 + 8);
  }

  pulseSelection(target) {
    target.setAlpha(0.88);
    this.tweens.add({
      targets: target,
      alpha: 1,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  drawDescription(content, x, y, width, height) {
    const g = this.graphics();
    g.fillStyle(COLORS.ink, 0.92);
    g.fillRect(x, y, width, height);
    g.lineStyle(2, COLORS.magenta, 0.9);
    g.strokeRect(x, y, width, height);
    g.fillStyle(COLORS.gold, 1);
    g.fillRect(x + 12, y + 12, 5, height - 24);
    this.text(x + 30, y + height / 2, content, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: colorCss(COLORS.white),
      wordWrap: { width: width - 49 },
      lineSpacing: 4,
    }).setOrigin(0, 0.5);
  }

  drawModeIcon(g, x, y, mode, selected) {
    const color = selected ? COLORS.cyan : COLORS.muted;
    g.lineStyle(3, color, 1);
    if (mode === FRONT_END_VIEWS.SCHOOL) {
      g.strokeTriangle(x - 9, y + 12, x, y - 15, x + 9, y + 12);
      g.lineBetween(x - 12, y + 13, x + 12, y + 13);
      return;
    }
    if (mode === FRONT_END_VIEWS.STORY) {
      g.lineBetween(x - 10, y - 16, x - 10, y + 16);
      g.fillStyle(color, 1);
      g.fillTriangle(x - 8, y - 15, x + 15, y - 7, x - 8, y + 1);
      return;
    }
    if (mode === FRONT_END_VIEWS.TROPHIES) {
      this.drawTrophyIcon(g, x, y, selected ? 'gold' : 'silver', 0.46);
      return;
    }
    this.text(x, y, '∞', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '41px',
      fontStyle: 'bold',
      color: colorCss(color),
    }).setOrigin(0.5);
  }

  drawMiniRoad(g, x, y, width, height, locked) {
    g.fillStyle(locked ? 0x29263a : 0x353342, 1);
    g.fillTriangle(x + width * 0.42, y, x + width * 0.58, y, x + width * 0.82, y + height);
    g.fillTriangle(x + width * 0.42, y, x + width * 0.82, y + height, x + width * 0.18, y + height);
    g.lineStyle(2, locked ? 0x615c73 : COLORS.cyan, 0.8);
    g.lineBetween(x + width * 0.42, y, x + width * 0.18, y + height);
    g.lineStyle(2, locked ? 0x615c73 : COLORS.magenta, 0.8);
    g.lineBetween(x + width * 0.58, y, x + width * 0.82, y + height);
  }

  drawStoryIllustration(g, x, y, width, height, index) {
    const skies = [0x243c76, 0x8a315e, 0x24134f];
    const grounds = [0x132a52, 0x6a382f, 0x160d31];
    g.fillStyle(skies[index % skies.length], 1);
    g.fillRect(x, y, width, height);
    g.fillStyle(index === 1 ? COLORS.gold : index === 2 ? COLORS.magenta : COLORS.cyan, 0.7);
    g.fillCircle(x + width * 0.76, y + 24, index === 1 ? 22 : 16);
    g.fillStyle(grounds[index % grounds.length], 1);
    g.fillRect(x, y + 48, width, height - 48);

    if (index === 0) {
      g.fillStyle(0x0b1738, 1);
      for (let post = 0; post < 6; post += 1) {
        g.fillRect(x + 9 + post * 37, y + 25 + (post % 2) * 5, 4, 25);
        g.fillStyle(post % 2 ? COLORS.magenta : COLORS.cyan, 0.9);
        g.fillRect(x + 7 + post * 37, y + 25 + (post % 2) * 5, 8, 3);
        g.fillStyle(0x0b1738, 1);
      }
    } else if (index === 1) {
      g.fillStyle(0x54273f, 1);
      g.fillTriangle(x, y + 52, x + 42, y + 18, x + 82, y + 52);
      g.fillTriangle(x + 128, y + 52, x + 169, y + 13, x + width, y + 52);
      g.fillStyle(0xd27b49, 0.72);
      g.fillRect(x + 12, y + 42, 45, 5);
      g.fillRect(x + width - 70, y + 38, 52, 5);
    } else {
      g.fillStyle(0x0a0923, 1);
      const towers = [[5, 28], [31, 39], [62, 25], [145, 34], [175, 44], [204, 28]];
      towers.forEach(([dx, h], tower) => {
        g.fillRect(x + dx, y + 50 - h, 20, h);
        g.fillStyle(tower % 2 ? COLORS.magenta : COLORS.cyan, 0.8);
        g.fillRect(x + dx + 5, y + 22, 3, 5);
        g.fillStyle(0x0a0923, 1);
      });
    }

    g.fillStyle(0x15102d, 1);
    g.fillTriangle(x + width * 0.43, y + 43, x + width * 0.57, y + 43, x + width * 0.86, y + height);
    g.fillTriangle(x + width * 0.43, y + 43, x + width * 0.86, y + height, x + width * 0.14, y + height);
    g.lineStyle(3, COLORS.cyan, 1);
    g.lineBetween(x + width * 0.43, y + 43, x + width * 0.14, y + height);
    g.lineStyle(3, COLORS.magenta, 1);
    g.lineBetween(x + width * 0.57, y + 43, x + width * 0.86, y + height);
    for (let stripe = 0; stripe < 3; stripe += 1) {
      const stripeY = y + 55 + stripe * 12;
      const stripeW = 5 + stripe * 5;
      g.fillStyle(index === 1 ? COLORS.gold : COLORS.white, 0.72);
      g.fillRect(x + width / 2 - stripeW / 2, stripeY, stripeW, 5);
    }
  }

  drawTrophyIcon(g, x, y, rank, scale = 1) {
    const color = trophyColor(rank);
    const alpha = rank ? 1 : 0.45;
    g.fillStyle(color, alpha);
    g.fillRect(x - 13 * scale, y - 21 * scale, 26 * scale, 25 * scale);
    g.fillTriangle(
      x - 13 * scale, y + 3 * scale,
      x + 13 * scale, y + 3 * scale,
      x, y + 16 * scale,
    );
    g.fillRect(x - 4 * scale, y + 12 * scale, 8 * scale, 10 * scale);
    g.fillRect(x - 14 * scale, y + 21 * scale, 28 * scale, 6 * scale);
    g.lineStyle(4 * scale, color, alpha);
    g.strokeCircle(x - 14 * scale, y - 10 * scale, 9 * scale);
    g.strokeCircle(x + 14 * scale, y - 10 * scale, 9 * scale);
    if (!rank) {
      g.lineStyle(2, COLORS.muted, 0.65);
      g.lineBetween(x - 16 * scale, y - 22 * scale, x + 17 * scale, y + 27 * scale);
    }
  }
}
