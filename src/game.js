// game.js — entry point. Note what's MISSING: no physics config. The
// pseudo-3D world is our own data; arcade physics never touches it.
// Collision later is a z-overlap + |offsetX| check in systems/Collision.js.

import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { GarageScene } from './scenes/GarageScene.js';
import { installGamepadShutdownFix } from './systems/Gamepad.js';

// Must be installed before the first Scene input plugin starts.
installGamepadShutdownFix(Phaser.Input.Gamepad.GamepadPlugin);

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  pixelArt: true, // nearest-neighbor scaling — pixel art stays sharp
  input: { gamepad: true },
  scene: [TitleScene, GameScene, GarageScene, HudScene], // first boots; Hud is launched by GameScene
  backgroundColor: '#0b0630',
};

new Phaser.Game(config);
