// TitleScene.js — controller-first, late-16-bit front end.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { getScore } from '../systems/HighScores.js';
import {
  getTrainingResult,
  highestUnlockedTrainingIndex,
} from '../systems/TrainingProgress.js';
import { RACER } from '../systems/RacerState.js';
import { axisValue, buttonDown, dpadDown, getPrimaryPad } from '../systems/Gamepad.js';
import { carSpriteFrame } from '../systems/AirtimeFx.js';
import { TRACKS, TRAINING_TRACKS } from '../tracks/index.js';
import {
  getStoryProgress,
  isStoryCampaignPlatinum,
} from '../systems/StoryProgress.js';
import { achievementViews, getPlayerProfile } from '../systems/PlayerStats.js';
import {
  FRONT_END_VIEWS,
  MAIN_DESTINATIONS,
  STORY_PHASES,
  TROPHY_PAGES,
  buildSchoolTiles,
  buildStoryCourseTiles,
  buildTrophySummary,
  cycleTrophyPage,
  moveGridSelection,
  schoolTileDescription,
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
    help: '← → COURSE   ↑ ↓ EVENT   A / ENTER START   B / ESC BACK',
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
  }

  create() {
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
      tabLeft: 'Q', tabRight: 'E',
    });

    this.padText = this.add.text(WIDTH - SAFE, HEIGHT - 11, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: colorCss(COLORS.cyan),
    }).setOrigin(1, 1).setDepth(30);

    this.renderView(true);
  }

  buildTableau() {
    const sky = this.add.graphics();
    const bands = TUNING.colors.skyBands;
    bands.forEach((color, index) => {
      sky.fillStyle(color, 1);
      sky.fillRect(0, index * (HEIGHT / bands.length), WIDTH, HEIGHT / bands.length + 1);
    });

    const moon = this.add.graphics();
    moon.fillStyle(COLORS.magenta, 0.5);
    moon.fillCircle(652, 124, 66);
    moon.fillStyle(0xff8bb6, 0.26);
    for (let y = 84; y < 162; y += 13) moon.fillRect(589, y, 126, 5);

    this.city = this.add.graphics();
    this.city.fillStyle(0x11082e, 1);
    const skyline = [
      [0, 48], [28, 70], [62, 42], [88, 80], [120, 58], [152, 92],
      [198, 64], [232, 76], [269, 49], [301, 88], [349, 61], [386, 74],
      [431, 53], [466, 84], [510, 67], [548, 94], [598, 58], [630, 78],
      [676, 49], [710, 90], [756, 62],
    ];
    skyline.forEach(([x, height], index) => {
      this.city.fillRect(x, 214 - height, index % 3 === 0 ? 44 : 32, height);
    });
    this.city.fillStyle(COLORS.cyan, 0.55);
    for (let x = 18; x < WIDTH; x += 47) this.city.fillRect(x, 174 + (x % 3) * 8, 3, 7);
    this.tweens.add({
      targets: this.city,
      x: -6,
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const road = this.add.graphics();
    road.fillStyle(0x160b32, 1);
    road.fillRect(0, 214, WIDTH, HEIGHT - 214);
    road.fillStyle(0x32313f, 1);
    road.fillTriangle(350, 214, 450, 214, 746, HEIGHT);
    road.fillTriangle(350, 214, 746, HEIGHT, 54, HEIGHT);
    road.lineStyle(8, COLORS.magenta, 0.9);
    road.lineBetween(350, 214, 54, HEIGHT);
    road.lineStyle(8, COLORS.cyan, 0.9);
    road.lineBetween(450, 214, 746, HEIGHT);
    road.lineStyle(2, COLORS.white, 0.22);
    road.lineBetween(384, 214, 305, HEIGHT);
    road.lineBetween(416, 214, 495, HEIGHT);

    this.roadMotion = this.add.graphics();
    this.speedStreaks = this.add.graphics();
    this.speedStreaks.lineStyle(2, COLORS.cyan, 0.34);
    [
      [34, 248, 112, 232], [688, 264, 772, 244], [22, 326, 145, 292],
      [668, 355, 792, 314], [84, 178, 178, 171], [611, 187, 744, 178],
    ].forEach((line) => this.speedStreaks.lineBetween(...line));
    this.tweens.add({
      targets: this.speedStreaks,
      alpha: { from: 0.35, to: 0.82 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    });

    this.logo = this.add.text(WIDTH / 2, 74, GAME_TITLE.replace(' ', '\n'), {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: '49px',
      fontStyle: 'bold',
      color: colorCss(COLORS.white),
      align: 'center',
      lineSpacing: -13,
      stroke: colorCss(COLORS.magenta),
      strokeThickness: 9,
      shadow: { offsetX: 5, offsetY: 6, color: '#08031c', blur: 0, fill: true },
    }).setOrigin(0.5).setDepth(8).setScale(0.82).setAlpha(0);
    this.logo.setData('cyanStroke', true);
    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 440,
      ease: 'Back.out',
    });
    this.logoAccent = this.add.graphics().setDepth(7);
    this.logoAccent.fillStyle(COLORS.cyan, 1);
    this.logoAccent.fillRect(277, 139, 246, 5);
    this.logoAccent.fillStyle(COLORS.gold, 1);
    this.logoAccent.fillRect(334, 147, 132, 3);

    this.car = this.add.sprite(WIDTH / 2, 230, 'car', carSpriteFrame(2, 0))
      .setScale(2.7)
      .setDepth(6);
    this.tweens.add({
      targets: this.car,
      y: '+=7',
      angle: { from: -0.7, to: 0.7 },
      duration: 820,
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
    this.drawRoadMotion(time);
    this.pollKeyboard();
    this.pollGamepad();
  }

  drawRoadMotion(time) {
    const shift = (time * 0.07) % 54;
    this.roadMotion.clear();
    for (let step = -1; step < 8; step += 1) {
      const depth = (step * 54 + shift) / 430;
      if (depth <= 0 || depth >= 1) continue;
      const y = 214 + depth * depth * 386;
      const half = 50 + depth * 295;
      this.roadMotion.lineStyle(2 + depth * 5, step % 2 ? COLORS.cyan : COLORS.magenta, 0.4);
      this.roadMotion.lineBetween(400 - half, y, 400 - half - 16 * depth, y + 10 + depth * 18);
      this.roadMotion.lineBetween(400 + half, y, 400 + half + 16 * depth, y + 10 + depth * 18);
    }
  }

  pollKeyboard() {
    const justDown = Phaser.Input.Keyboard.JustDown;
    if (justDown(this.keys.tabLeft)) this.switchTrophyPage('left');
    if (justDown(this.keys.tabRight)) this.switchTrophyPage('right');
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
      l: buttonDown(pad, 4, 'L1') || buttonDown(pad, 6, 'L2'),
      r: buttonDown(pad, 5, 'R1') || buttonDown(pad, 7, 'R2'),
    };
    const prev = this.prevPad ?? {
      up: false, down: false, left: false, right: false,
      a: true, b: true, l: true, r: true,
    };
    if (now.up && !prev.up) this.move('up');
    if (now.down && !prev.down) this.move('down');
    if (now.left && !prev.left) this.move('left');
    if (now.right && !prev.right) this.move('right');
    if (now.a && !prev.a) this.activate();
    if (now.b && !prev.b) this.back();
    if (now.l && !prev.l) this.switchTrophyPage('left');
    if (now.r && !prev.r) this.switchTrophyPage('right');
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
    RACER.resetRun();
    this.scene.start('GameScene', data);
  }

  openView(view) {
    this.view = view;
    this.renderView(true);
  }

  back() {
    if (this.transitioning || this.view === FRONT_END_VIEWS.MAIN) return;
    this.view = FRONT_END_VIEWS.MAIN;
    this.renderView(true);
  }

  renderView(transition = false) {
    if (this.ui) this.tweens.killTweensOf([this.ui, ...this.ui.list]);
    this.ui?.destroy(true);
    this.ui = this.add.container(0, 0).setDepth(20);
    const main = this.view === FRONT_END_VIEWS.MAIN;
    this.logo.setVisible(main);
    this.logoAccent.setVisible(main);
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
      const x = 28 + column * 382;
      const y = 342 + row * 76;
      this.drawMainCard(x, y, 362, 68, item, index, index === this.selection());
    });

    const selected = MAIN_DESTINATIONS[this.selection()];
    const best = getScore('endless');
    const extra = selected.id === 'endless' && best ? `  •  BEST ${best}m` : '';
    this.drawDescription(`${selected.description}${extra}`, 28, 502, 744, 48);
    this.text(WIDTH / 2, 564, 'ARROWS / D-PAD MOVE   A / ENTER SELECT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: colorCss(COLORS.muted),
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
    this.text(SAFE, 24, meta.eyebrow, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: colorCss(COLORS.gold),
    });
    this.text(SAFE, 41, meta.title, {
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
