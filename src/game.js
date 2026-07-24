// game.js — entry point. Note what's MISSING: no physics config. The
// pseudo-3D world is our own data; arcade physics never touches it.
// Collision later is a z-overlap + |offsetX| check in systems/Collision.js.

import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { GarageScene } from './scenes/GarageScene.js';
import { installGamepadShutdownFix } from './systems/Gamepad.js';
import { TRACKS } from './tracks/index.js';
import { RACER } from './systems/RacerState.js';

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

const game = new Phaser.Game(config);

// Projection Lab track picker (index.html #trackSelect) — a dev-tool
// shortcut that jumps straight into any track from any scene, without
// walking the title menu each time. Deliberately global (game.scene, not
// a scene instance's this.scene) so it works whether you're on the title
// screen, mid-race, or in the garage. TUNING lives outside any scene too
// (config/tuning.js), so whatever the sliders are set to survives the
// jump — that's the whole point of a "tweak without recoding" panel.
const trackSelect = document.getElementById('trackSelect');
if (trackSelect) {
  TRACKS.forEach((track, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = track.name;
    trackSelect.appendChild(opt);
  });
  const endlessOpt = document.createElement('option');
  endlessOpt.value = 'endless';
  endlessOpt.textContent = 'ENDLESS MODE';
  trackSelect.appendChild(endlessOpt);

  trackSelect.addEventListener('change', () => {
    RACER.resetRun(); // fresh car for the jump, same as picking it from the title menu
    game.scene.getScenes(true).forEach((scene) => game.scene.stop(scene.scene.key));
    const data = trackSelect.value === 'endless'
      ? { mode: 'endless' }
      : { mode: 'story', trackIndex: Number(trackSelect.value) };
    game.scene.start('GameScene', data);
  });
}
