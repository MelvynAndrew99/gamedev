// GameScene.js — orchestration only. Owns the loop, wires input, HUD,
// and the debug panel. All the interesting logic lives in road/ and
// entities/. If this file grows past ~150 lines, something is in the
// wrong place.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { RoadRenderer } from '../road/RoadRenderer.js';
import { Player } from '../entities/Player.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Note: state lives HERE, not the constructor. scene.start() re-runs
    // create(), never the constructor — constructor state survives restarts
    // and goes stale.
    this.model = new RoadModel(TUNING);
    this.model.buildTestTrack();
    this.renderer = new RoadRenderer(this, TUNING);
    this.player = new Player(TUNING);

    Player.createTexture(this);
    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.scale.height - 70, 'player-car')
      .setScale(1.8)
      .setDepth(10);

    this.cursors = this.input.keyboard.createCursorKeys();

    // ESC = back to menu. scene.start() shuts this scene down: Phaser-owned
    // resources (keyboard handlers, timers, game objects) are auto-cleaned.
    // DOM listeners are NOT Phaser's — see hookDebugPanel for their teardown.
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('TitleScene');
    });

    this.hud = this.add
      .text(16, 16, '', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setDepth(20);

    this.hookDebugPanel();
  }

  update(_time, delta) {
    // Clamp dt: a background-tab hiccup shouldn't teleport the car.
    const dt = Math.min(delta, 50) / 1000;

    const input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
    };

    const seg = this.player.update(dt, input, this.model);
    this.renderer.render(this.model, this.player);

    // Car body language: lean into steering + get shoved by curves.
    const speedPercent = this.player.speed / TUNING.maxSpeed;
    this.carSprite.rotation =
      this.player.steer * 0.08 - seg.curve * speedPercent * 0.04;
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;

    this.hud.setText(
      `SPEED ${Math.round(this.player.speed / 100)}` +
        (Math.abs(this.player.x) > 1 ? '   OFF TRACK' : '')
    );
  }

  // Wire the HTML debug panel. Every hook is guarded — missing elements
  // are fine, so the panel and the game can evolve independently.
  //
  // Resource-ownership note: create() re-runs on every scene start, and DOM
  // listeners live outside Phaser's scene lifecycle — without teardown they'd
  // stack one copy per restart. The AbortController deregisters them all on
  // scene shutdown, same as you'd deregister an IRQ handler in a driver's
  // teardown path.
  hookDebugPanel() {
    const ac = new AbortController();
    this.events.once('shutdown', () => ac.abort());

    const hook = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const out = document.getElementById(id + 'Value');
      const apply = () => {
        const v = parseFloat(el.value);
        fn(v);
        if (out) out.textContent = el.value;
        TUNING.recalc();
      };
      el.addEventListener('input', apply, { signal: ac.signal });
      apply();
    };

    hook('maxSpeed',     (v) => (TUNING.maxSpeed = v));
    hook('fov',          (v) => (TUNING.fov = v));
    hook('cameraHeight', (v) => (TUNING.cameraHeight = v));
    hook('drawDistance', (v) => (TUNING.drawDistance = v));
    hook('fogDensity',   (v) => (TUNING.fogDensity = v));

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