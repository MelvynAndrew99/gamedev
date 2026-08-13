// game.js — entry point. Note what's MISSING: no physics config. The
// pseudo-3D world is our own data; arcade physics never touches it.
// Collision later is a z-overlap + |offsetX| check in systems/Collision.js.

import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { GarageScene } from './scenes/GarageScene.js';
import { TrackBuilderScene } from './scenes/TrackBuilderScene.js';
import { TRACKS, TRAINING_TRACKS } from './tracks/index.js';
import { RACER } from './systems/RacerState.js';
import { presentationFpsLimit } from './systems/FrameRatePolicy.js';
import {
  installProjectionLabToggle,
  isEditableControl,
} from './systems/ProjectionLabShell.js';
import {
  AUDIO_SETTINGS,
  installAudioMuteShortcut,
} from './systems/AudioSettings.js';
import { MUSIC } from './audio/MusicEngine.js';

// Emergency presentation fallback for unusual display/browser combinations.
// Normal play follows requestAnimationFrame and uses smooth render-only rival
// poses. `?fps=60` caps the complete game loop without changing saved data.
const fpsLimit = presentationFpsLimit(window.location.search);

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  pixelArt: true, // nearest-neighbor scaling — pixel art stays sharp
  render: {
    // Phaser 4 defaults this to false. Keep Phaser 3's pixel positioning
    // behavior so sprites do not shimmer at fractional screen coordinates.
    roundPixels: true,
  },
  fps: {
    target: 60,
    limit: fpsLimit,
  },
  input: { gamepad: true },
  scene: [TitleScene, GameScene, GarageScene, TrackBuilderScene, HudScene],
  backgroundColor: '#0b0630',
};

AUDIO_SETTINGS.apply(MUSIC);
const game = new Phaser.Game(config);

const audioToast = document.getElementById('audio-toast');
let audioToastTimer = null;
installAudioMuteShortcut({
  windowTarget: window,
  settings: AUDIO_SETTINGS,
  engine: MUSIC,
  isEditable: isEditableControl,
  onChange: ({ musicEnabled, sfxEnabled }) => {
    if (!audioToast) return;
    const muted = !musicEnabled && !sfxEnabled;
    audioToast.textContent = muted ? 'AUDIO MUTED' : 'AUDIO ON';
    audioToast.classList.add('visible');
    clearTimeout(audioToastTimer);
    audioToastTimer = setTimeout(() => audioToast.classList.remove('visible'), 1200);
  },
});

const projectionLab = document.getElementById('debug-panel');
if (projectionLab) {
  installProjectionLabToggle({
    panel: projectionLab,
    body: document.body,
    windowTarget: window,
    search: window.location.search,
  });
}

// Projection Lab track picker (index.html #trackSelect) — a dev-tool
// shortcut that jumps straight into any track from any scene, without
// walking the title menu each time. Deliberately global (game.scene, not
// a scene instance's this.scene) so it works whether you're on the title
// screen, mid-race, or in the garage. TUNING lives outside any scene too
// (config/tuning.js), so whatever the sliders are set to survives the
// jump — that's the whole point of a "tweak without recoding" panel.
const trackSelect = document.getElementById('trackSelect');
if (trackSelect) {
  TRAINING_TRACKS.forEach((track, i) => {
    const opt = document.createElement('option');
    opt.value = `training:${i}`;
    opt.textContent = `TRAINING — ${track.name}` +
      (track.status === 'placeholder'
        ? ' [STAGED]'
        : track.status === 'coming_soon'
          ? ' [WIP — LAB ONLY]'
          : '');
    trackSelect.appendChild(opt);
  });
  TRACKS.forEach((track, i) => {
    const opt = document.createElement('option');
    opt.value = `story:${i}`;
    opt.textContent = `STORY — ${track.name}`;
    trackSelect.appendChild(opt);
  });
  const endlessOpt = document.createElement('option');
  endlessOpt.value = 'endless';
  endlessOpt.textContent = 'ENDLESS MODE';
  trackSelect.appendChild(endlessOpt);
  const builderOpt = document.createElement('option');
  builderOpt.value = 'track-builder';
  builderOpt.textContent = 'TOOLS — TRACK EDITOR';
  trackSelect.appendChild(builderOpt);

  trackSelect.addEventListener('change', () => {
    game.scene.getScenes(true).forEach((scene) => game.scene.stop(scene.scene.key));
    const [mode, index] = trackSelect.value.split(':');
    // Projection Lab is an authoring surface, so it intentionally bypasses
    // the player-facing completion unlock without changing that saved gate.
    // It is a scene destination rather than a disposable race attempt.
    if (mode === 'track-builder') {
      game.scene.start('TrackBuilderScene');
      return;
    }
    RACER.resetRun(); // fresh car for a race jump, same as the title menu
    const data = mode === 'endless'
      ? { mode: 'endless' }
      : { mode, trackIndex: Number(index) };
    game.scene.start('GameScene', data);
  });
}
