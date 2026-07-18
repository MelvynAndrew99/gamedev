// game.js — entry point. Note what's MISSING: no physics config. The
// pseudo-3D world is our own data; arcade physics never touches it.
// Collision later is a z-overlap + |offsetX| check in systems/Collision.js.

import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  pixelArt: true, // nearest-neighbor scaling — pixel art stays sharp
  scene: [TitleScene, GameScene], // first in the list boots first
  backgroundColor: '#0b0630',
};

new Phaser.Game(config);