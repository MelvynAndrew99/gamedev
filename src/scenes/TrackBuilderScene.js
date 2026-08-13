import Phaser from 'phaser';
import {
  CUSTOM_ENVIRONMENTS,
  CUSTOM_GRID,
  CUSTOM_OBJECT_TOOLS,
  CUSTOM_ROAD_TOOLS,
  appendCustomRoad,
  compileCustomTrack,
  createCustomTrackDraft,
  customRouteLayout,
  cycleCustomEnvironment,
  loadCustomTracks,
  placeCustomObject,
  removeCustomObject,
  removeLastCustomRoad,
  saveCustomTrack,
  validateCustomTrack,
} from '../systems/CustomTracks.js';
import { MUSIC } from '../audio/MusicEngine.js';
import { SHOP_THEME } from '../audio/tracks/shopTheme.js';

const COLORS = Object.freeze({
  bg: 0x070b18,
  panel: 0x111a31,
  panel2: 0x172542,
  ink: 0x040711,
  cyan: 0x00e5ff,
  magenta: 0xff2d95,
  gold: 0xffcf3f,
  white: 0xf8f6ff,
  muted: 0x8796ad,
  green: 0x2ee56b,
  red: 0xff5468,
});

const GRID_X = 194;
const GRID_Y = 104;
const CELL = 48;

export class TrackBuilderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TrackBuilderScene' });
  }

  init(data = {}) {
    this.editId = data.trackId ?? null;
  }

  create() {
    // Keep Projection Lab truthful when the editor was opened from the title
    // carousel instead of from the Lab selector itself.
    const trackSelect = document.getElementById('trackSelect');
    if (trackSelect) trackSelect.value = 'track-builder';
    const saved = loadCustomTracks();
    this.draft = saved.find(({ id }) => id === this.editId) ??
      createCustomTrackDraft(saved.length + 1);
    this.selectedTool = CUSTOM_ROAD_TOOLS[0];
    this.message = 'DRAG A ROAD TILE TO THE PULSING NEXT CELL';
    this.messageTone = COLORS.cyan;
    this.dragGhost = null;
    this.keys = this.input.keyboard.addKeys({
      escape: 'ESC', undo: 'U', save: 'S', test: 'T',
      prevScene: 'Q', nextScene: 'E', rename: 'N',
      road1: 'ONE', road2: 'TWO', road3: 'THREE', road4: 'FOUR',
      road5: 'FIVE', road6: 'SIX',
    });
    this.input.keyboard.on('keydown-ESC', () => this.exitBuilder());
    this.input.keyboard.on('keydown-U', () => this.undoRoad());
    this.input.keyboard.on('keydown-S', () => this.saveDraft());
    this.input.keyboard.on('keydown-T', () => this.testDrive());
    this.input.keyboard.on('keydown-Q', () => this.changeEnvironment(-1));
    this.input.keyboard.on('keydown-E', () => this.changeEnvironment(1));
    this.input.keyboard.on('keydown-N', () => this.renameTrack());
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((key, index) => {
      this.input.keyboard.on(`keydown-${key}`, () => {
        this.selectedTool = CUSTOM_ROAD_TOOLS[index];
        this.render();
      });
    });
    this.input.on('dragstart', (_pointer, object) => this.beginDrag(object));
    this.input.on('drag', (_pointer, _object, dragX, dragY) => {
      this.dragGhost?.setPosition(dragX, dragY);
    });
    this.input.on('dragend', (pointer, object) => {
      this.dropTool(object.getData('tool'), pointer.x, pointer.y);
      this.dragGhost?.destroy(true);
      this.dragGhost = null;
    });
    MUSIC.start(SHOP_THEME);
    this.events.once('shutdown', () => MUSIC.stop());
    this.render();
  }

  update(time) {
    if (this.nextMarker?.active) {
      this.nextMarker.setAlpha(0.62 + Math.sin(time * 0.007) * 0.24);
    }
  }

  render() {
    this.children.removeAll(true);
    this.dragGhost = null;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1).fillRect(0, 0, 800, 600);
    g.fillStyle(0x0b1530, 1).fillRect(0, 0, 800, 82);
    g.fillStyle(COLORS.magenta, 1).fillRect(0, 78, 800, 4);
    this.add.text(22, 17, 'TRACK BUILDER', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '29px', color: '#ffffff',
      stroke: '#ff2d95', strokeThickness: 5,
    });
    this.add.text(22, 54, 'BUILD THE LINE  •  LAYER THE CHAOS  •  TEST IT NOW', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#ffcf3f',
      fontStyle: 'bold',
    });
    const name = this.add.text(776, 20, this.draft.name, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '18px', color: '#e9faff',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    name.on('pointerdown', () => this.renameTrack());
    this.add.text(776, 43, 'N / CLICK NAME TO RENAME', {
      fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#ffcf3f',
    }).setOrigin(1, 0);
    this.add.text(776, 59, `${this.draft.roads.length}/18 ROAD TILES  •  ${this.draft.objects.length} PROPS`, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#8da0b9',
    }).setOrigin(1, 0);

    this.drawPalette();
    this.drawGrid();
    this.drawActions();

    g.fillStyle(COLORS.panel, 1).fillRect(18, 548, 764, 34);
    g.lineStyle(1, this.messageTone, 0.8).strokeRect(18, 548, 764, 34);
    this.add.text(32, 558, this.message, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: `#${this.messageTone.toString(16).padStart(6, '0')}`,
    });
  }

  drawPalette() {
    this.panel(14, 94, 164, 438, 'TILE DECK');
    this.add.text(28, 121, 'ROAD', this.smallLabel());
    CUSTOM_ROAD_TOOLS.forEach((tool, index) => {
      this.paletteRow(tool, 26, 143 + index * 37, `${index + 1}`);
    });
    this.add.text(28, 372, 'OBJECTS', this.smallLabel());
    CUSTOM_OBJECT_TOOLS.forEach((tool, index) => {
      this.paletteRow(tool, 26, 394 + index * 31, '');
    });
    this.paletteRow({ id: 'erase', label: 'REMOVE PROP', color: COLORS.red }, 26, 518, '');
  }

  paletteRow(tool, x, y, shortcut) {
    const selected = this.selectedTool?.id === tool.id;
    const row = this.add.rectangle(x + 69, y + 14, 138, 28,
      selected ? COLORS.panel2 : COLORS.ink, 1)
      .setStrokeStyle(selected ? 2 : 1, selected ? COLORS.gold : 0x34425d, 1)
      .setInteractive({ useHandCursor: true, draggable: true });
    row.setData('tool', tool);
    this.input.setDraggable(row);
    row.on('pointerdown', () => {
      this.selectedTool = tool;
      this.message = tool.id === 'erase'
        ? 'DROP ON A ROAD TILE TO REMOVE ITS PROP'
        : `SELECTED ${tool.label}  •  DRAG IT ONTO THE MAP`;
      this.messageTone = tool.color;
    });
    this.add.rectangle(x + 10, y + 14, 10, 10, tool.color, 1);
    this.add.text(x + 21, y + 7, `${shortcut ? `${shortcut}  ` : ''}${tool.label}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#f8f6ff',
    });
  }

  beginDrag(object) {
    const tool = object.getData('tool');
    if (!tool) return;
    this.selectedTool = tool;
    this.dragGhost = this.add.container(object.x, object.y).setDepth(50);
    this.dragGhost.add(this.add.rectangle(0, 0, 104, 30, COLORS.ink, 0.92)
      .setStrokeStyle(2, tool.color, 1));
    this.dragGhost.add(this.add.text(0, 0, tool.label, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
  }

  drawGrid() {
    this.panel(186, 94, 404, 438, 'TOP-DOWN COURSE');
    const g = this.add.graphics();
    for (let y = 0; y < CUSTOM_GRID.rows; y++) {
      for (let x = 0; x < CUSTOM_GRID.columns; x++) {
        const px = GRID_X + x * CELL;
        const py = GRID_Y + y * CELL;
        g.fillStyle((x + y) % 2 ? 0x0a1327 : 0x0d1830, 1).fillRect(px, py, CELL - 2, CELL - 2);
        g.lineStyle(1, 0x20304b, 0.8).strokeRect(px, py, CELL - 2, CELL - 2);
      }
    }
    const layout = customRouteLayout(this.draft.roads);
    layout.cells.forEach((cell, index) => this.drawRoadCell(cell, index));
    if (layout.next.available && this.draft.roads.length < 18) {
      const px = GRID_X + layout.next.x * CELL;
      const py = GRID_Y + layout.next.y * CELL;
      this.nextMarker = this.add.graphics();
      this.nextMarker.fillStyle(COLORS.cyan, 0.2)
        .fillRect(px + 4, py + 4, CELL - 10, CELL - 10);
      this.nextMarker.lineStyle(3, COLORS.cyan, 1)
        .strokeRect(px + 3, py + 3, CELL - 8, CELL - 8);
      this.add.text(px + CELL / 2 - 1, py + CELL / 2 - 1, '+', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#00e5ff',
      }).setOrigin(0.5);
    }
    const hit = this.add.rectangle(GRID_X + 192, GRID_Y + 192, 384, 384, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer) => this.dropTool(this.selectedTool, pointer.x, pointer.y));
  }

  drawRoadCell(cell, index) {
    const tool = CUSTOM_ROAD_TOOLS.find(({ id }) => id === cell.type) ?? CUSTOM_ROAD_TOOLS[0];
    const x = GRID_X + cell.x * CELL + CELL / 2 - 1;
    const y = GRID_Y + cell.y * CELL + CELL / 2 - 1;
    const g = this.add.graphics();
    g.fillStyle(0x343b4a, 1).fillRoundedRect(x - 19, y - 19, 38, 38, 5);
    g.lineStyle(3, tool.color, 0.95).strokeRoundedRect(x - 19, y - 19, 38, 38, 5);
    g.lineStyle(2, 0xdce8f5, 0.65);
    const direction = CUSTOM_GRID_DIRECTION(cell.heading);
    g.lineBetween(x - direction.x * 17, y - direction.y * 17,
      x + direction.x * 17, y + direction.y * 17);
    if (cell.type === 'left' || cell.type === 'right') {
      const turn = cell.type === 'left' ? -1 : 1;
      const next = CUSTOM_GRID_DIRECTION((cell.heading + turn + 4) % 4);
      g.lineBetween(x, y, x + next.x * 17, y + next.y * 17);
    }
    if (index === 0) {
      this.add.text(x, y + 10, 'S', { fontFamily: 'Arial Black', fontSize: '9px', color: '#ffcf3f' })
        .setOrigin(0.5);
    }
    const object = this.draft.objects.find(({ roadIndex }) => roadIndex === index);
    if (object) {
      const prop = CUSTOM_OBJECT_TOOLS.find(({ id }) => id === object.kind);
      const lane = object.lane < 0 ? -10 : object.lane > 0 ? 10 : 0;
      this.add.circle(x + lane, y, object.kind === 'rock' ? 7 : 5, prop?.color ?? COLORS.white, 1)
        .setStrokeStyle(2, COLORS.ink, 1);
      this.add.text(x + lane, y, object.kind === 'ramp' ? '▲' : object.kind === 'boost' ? 'B' : '', {
        fontFamily: 'Arial Black', fontSize: '8px', color: '#07101c',
      }).setOrigin(0.5);
    }
  }

  drawActions() {
    this.panel(604, 94, 182, 438, 'BUILD BAY');
    const environment = CUSTOM_ENVIRONMENTS.find(({ id }) => id === this.draft.environment);
    this.add.text(620, 122, 'TRACK SCENE', this.smallLabel());
    this.add.text(695, 149, environment?.label ?? 'COASTAL SCHOOL', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '12px', color: '#ffffff',
      align: 'center', wordWrap: { width: 148 },
    }).setOrigin(0.5, 0);
    this.button(621, 188, 68, 30, 'Q  ◀', () => this.changeEnvironment(-1));
    this.button(700, 188, 68, 30, '▶  E', () => this.changeEnvironment(1));
    this.add.text(620, 231, 'ROUTE STATUS', this.smallLabel());
    const validation = validateCustomTrack(this.draft);
    this.add.text(620, 253, validation.valid ? 'READY TO RACE' : validation.errors[0], {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: validation.valid ? '#2ee56b' : '#ffcf3f', wordWrap: { width: 146 },
    });
    this.button(620, 293, 148, 34, 'U  UNDO ROAD', () => this.undoRoad());
    this.button(620, 335, 148, 34, 'CLEAR MAP', () => this.clearMap(), COLORS.red);
    this.button(620, 385, 148, 38, 'S  SAVE TRACK', () => this.saveDraft(), COLORS.cyan);
    this.button(620, 431, 148, 44, 'T  TEST DRIVE', () => this.testDrive(), COLORS.green);
    this.button(620, 487, 148, 30, 'ESC  EXIT', () => this.exitBuilder(), COLORS.muted);
  }

  dropTool(tool, pointerX, pointerY) {
    if (!tool) return;
    const x = Math.floor((pointerX - GRID_X) / CELL);
    const y = Math.floor((pointerY - GRID_Y) / CELL);
    if (x < 0 || x >= CUSTOM_GRID.columns || y < 0 || y >= CUSTOM_GRID.rows) {
      this.setMessage('DROP TILES INSIDE THE BUILD GRID', COLORS.red);
      return;
    }
    const layout = customRouteLayout(this.draft.roads);
    const roadCell = layout.cells.find((cell) => cell.x === x && cell.y === y);
    if (CUSTOM_ROAD_TOOLS.some(({ id }) => id === tool.id)) {
      if (!layout.next.available || layout.next.x !== x || layout.next.y !== y) {
        this.setMessage('ROAD TILES CONNECT ONLY AT THE PULSING NEXT CELL', COLORS.gold);
        return;
      }
      const result = appendCustomRoad(this.draft, tool.id);
      if (!result.ok) this.setMessage(result.reason, COLORS.red);
      else {
        this.draft = result.draft;
        this.setMessage(`${tool.label} CONNECTED  •  KEEP BUILDING THE LINE`, COLORS.green);
      }
      return;
    }
    if (!roadCell) {
      this.setMessage('DROP OBJECTS DIRECTLY ON A ROAD TILE', COLORS.gold);
      return;
    }
    if (tool.id === 'erase') {
      this.draft = removeCustomObject(this.draft, roadCell.index);
      this.setMessage('PROP REMOVED', COLORS.green);
      return;
    }
    const cellCenter = GRID_X + roadCell.x * CELL + CELL / 2;
    const lane = (pointerX - cellCenter) / (CELL * 0.5);
    const result = placeCustomObject(this.draft, roadCell.index, tool.id, lane);
    if (!result.ok) this.setMessage(result.reason, COLORS.red);
    else {
      this.draft = result.draft;
      this.setMessage(`${tool.label} PLACED  •  DROP AGAIN TO MOVE IT`, tool.color);
    }
  }

  undoRoad() {
    this.draft = removeLastCustomRoad(this.draft);
    this.setMessage('LAST ROAD TILE REMOVED', COLORS.gold);
  }

  clearMap() {
    this.draft = Object.freeze({ ...this.draft, roads: Object.freeze(['straight']), objects: Object.freeze([]) });
    this.setMessage('MAP CLEARED  •  START LINE PRESERVED', COLORS.gold);
  }

  renameTrack() {
    if (typeof globalThis.prompt !== 'function') return;
    const value = globalThis.prompt('Track name (20 characters)', this.draft.name);
    if (value == null) return;
    const name = String(value).replace(/[^A-Z0-9 -]/gi, '').trim().slice(0, 20);
    if (!name) {
      this.setMessage('TRACK NAME CANNOT BE EMPTY', COLORS.red);
      return;
    }
    this.draft = Object.freeze({ ...this.draft, name });
    this.setMessage(`TRACK RENAMED  •  ${name}`, COLORS.green);
  }

  changeEnvironment(direction) {
    this.draft = cycleCustomEnvironment(this.draft, direction);
    const environment = CUSTOM_ENVIRONMENTS.find(({ id }) => id === this.draft.environment);
    this.setMessage(`SCENE APPLIED  •  ${environment.label}`, COLORS.cyan);
  }

  saveDraft() {
    const result = saveCustomTrack(this.draft);
    if (!result.ok) this.setMessage(result.reason, COLORS.red);
    else {
      this.draft = result.track;
      this.setMessage('TRACK SAVED  •  READY IN CUSTOM TRACKS', COLORS.green);
    }
    return result.ok;
  }

  testDrive() {
    if (!this.saveDraft()) return;
    const track = compileCustomTrack(this.draft);
    this.scene.start('GameScene', {
      mode: 'custom', customTrack: track, customDraftId: this.draft.id,
    });
  }

  exitBuilder() {
    this.scene.start('TitleScene', {
      view: 'custom', selection: 0, menuOpen: true,
    });
  }

  setMessage(message, tone) {
    this.message = message;
    this.messageTone = tone;
    this.render();
  }

  panel(x, y, width, height, title) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.98).fillRect(x, y, width, height);
    g.lineStyle(2, 0x344d72, 1).strokeRect(x, y, width, height);
    g.fillStyle(COLORS.cyan, 1).fillRect(x, y, width, 3);
    this.add.text(x + 12, y + 10, title, this.smallLabel());
  }

  button(x, y, width, height, label, action, color = COLORS.cyan) {
    const button = this.add.rectangle(x + width / 2, y + height / 2, width, height, COLORS.ink, 1)
      .setStrokeStyle(2, color, 0.9).setInteractive({ useHandCursor: true });
    const text = this.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    button.on('pointerover', () => { button.setFillStyle(COLORS.panel2, 1); text.setColor('#ffcf3f'); });
    button.on('pointerout', () => { button.setFillStyle(COLORS.ink, 1); text.setColor('#ffffff'); });
    button.on('pointerdown', action);
  }

  smallLabel() {
    return { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#8da0b9' };
  }
}

function CUSTOM_GRID_DIRECTION(heading) {
  return [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
  ][heading] ?? { x: 0, y: -1 };
}
