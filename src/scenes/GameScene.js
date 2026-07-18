// GameScene.js — orchestration for both modes. Owns the loop, wires input,
// HUD, debug panel. Mode differences are contained to create() (which model,
// which race rules) and one branch in update(). All interesting logic lives
// in road/, entities/, and systems/.

import Phaser from 'phaser';
import { TUNING } from '../config/tuning.js';
import { RoadModel } from '../road/RoadModel.js';
import { EndlessTrack } from '../road/EndlessTrack.js';
import { RoadRenderer } from '../road/RoadRenderer.js';
import { Player } from '../entities/Player.js';
import { RaceState, fmtTime } from '../systems/RaceState.js';
import { getScore, submitScore } from '../systems/HighScores.js';
import { checkObstacleHit } from '../systems/Collision.js';
import { RACER } from '../systems/RacerState.js';
import { HealthBar } from '../ui/HealthBar.js';
import { TRACKS } from '../tracks/index.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // Scene launch data arrives here, before create().
  init(data) {
    this.mode = data.mode ?? 'story';
    this.trackIndex = data.trackIndex ?? 0;
    this.retryOnAdvance = false;
  }

  create() {
    // State lives HERE, not the constructor — create() re-runs per start.
    if (this.mode === 'endless') {
      this.model = new EndlessTrack(TUNING);
      this.race = null;
      this.trackData = null;
    } else {
      this.trackData = TRACKS[this.trackIndex];
      this.model = new RoadModel(TUNING);
      this.model.buildFromData(this.trackData);
      this.race = new RaceState(this.model, this.trackData.laps ?? 3);
    }
    this.renderer = new RoadRenderer(this, TUNING);
    this.player = new Player(TUNING);
    this.done = false;

    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.scale.height - 70, 'car', 1)
      .setScale(1.8)
      .setDepth(10);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-ESC', () => this.quitToTitle());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());

    this.hud = this.add
      .text(16, 16, '', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setDepth(20);
    this.healthBar = new HealthBar(this, this.scale.width - 200, 18);
    this.iframes = 0; // post-hit invulnerability countdown

    // Center-screen banner: race intro, lap flash, results.
    this.banner = this.add
      .text(this.scale.width / 2, 240, '', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#0a0a14',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (this.trackData) {
      this.showBanner(`${this.trackData.name}\n${this.trackData.intro}`, 3500);
    } else {
      this.showBanner('ENDLESS\nThe road never ends. You will.', 3000);
    }

    this.hookDebugPanel();
  }

  update(_time, delta) {
    if (this.done) return; // race over: banner is up, ENTER/ESC handle exits

    const dt = Math.min(delta, 50) / 1000;
    const input = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
    };

    this.player.update(dt, input, this.model);

    // Obstacles. i-frames stop one rock cluster from being a death sentence.
    this.iframes = Math.max(0, this.iframes - dt);
    if (this.iframes <= 0) {
      const hitSprite = checkObstacleHit(this.player, this.model, TUNING);
      if (hitSprite) this.onHit(hitSprite.def);
    }
    this.carSprite.setAlpha(this.iframes > 0 && Math.floor(this.iframes * 12) % 2 ? 0.4 : 1);

    if (this.mode === 'endless') {
      this.model.ensureAhead(this.player.position); // pave ahead of the car
    } else {
      const event = this.race.update(dt, this.player);
      if (event === 'lap') {
        this.showBanner(`LAP ${this.race.lap} / ${this.race.laps}`, 1200);
      } else if (event === 'finished') {
        this.finishRace();
      }
    }

    const speedPercent = this.player.speed / TUNING.maxSpeed;
    this.renderer.render(this.model, this.player, speedPercent);
    this.healthBar.draw(RACER.healthFrac);

    // Steering FRAMES (0=left, 1=straight, 2=right) — rotating pixel art
    // smears it. The sideways shove stays.
    this.carSprite.setFrame(this.player.steer + 1);
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;

    const speed = Math.round(this.player.speed / 100);
    if (this.mode === 'endless') {
      const dist = this.distanceM();
      const best = getScore('endless');
      this.hud.setText(
        `DIST ${dist}m${best ? `   BEST ${best}m` : ''}   SPEED ${speed}` +
          (Math.abs(this.player.x) > 1 ? '   OFF TRACK' : '')
      );
    } else {
      this.hud.setText(
        `LAP ${this.race.lap}/${this.race.laps}   TIME ${fmtTime(this.race.time)}   SPEED ${speed}` +
          (Math.abs(this.player.x) > 1 ? '   OFF TRACK' : '')
      );
    }
  }

  distanceM() {
    return Math.floor(this.player.position / 100);
  }

  onHit(def) {
    this.player.speed *= def.slow;       // momentum is the immediate price
    const wrecked = RACER.damage(def.damage); // health is the long-term one
    this.iframes = TUNING.iframes;
    // Feedback within the same frame as the hit: shake scales with damage,
    // car flashes red. The player should FEEL the difference between a
    // cone and a rock before the health bar finishes updating.
    this.cameras.main.shake(140, def.damage >= 20 ? 0.012 : 0.004);
    this.carSprite.setTintFill(0xff4444);
    this.time.delayedCall(120, () => this.carSprite.clearTint());
    if (wrecked) this.onWrecked();
  }

  onWrecked() {
    this.done = true;
    if (this.mode === 'endless') {
      const dist = this.distanceM();
      const record = submitScore('endless', dist, 'max');
      this.showBanner(
        `WRECKED\n${dist}m${record ? '\nNEW RECORD' : ''}\n\nENTER FOR TITLE`, 0);
    } else {
      // Placeholder policy: retry restores full health. Once the shop
      // exists, wrecking should cost money instead — otherwise crashing
      // on purpose becomes a free repair (players WILL find that).
      this.retryOnAdvance = true;
      this.showBanner('WRECKED\n\nENTER TO RETRY RACE', 0);
    }
  }

  finishRace() {
    this.done = true;
    const t = this.race.time;
    const record = submitScore(this.trackData.id, t, 'min');
    const last = this.trackIndex >= TRACKS.length - 1;
    this.showBanner(
      `FINISH  ${fmtTime(t)}${record ? '\nNEW RECORD' : ''}\n\n` +
        (last ? 'CAMPAIGN COMPLETE\nENTER FOR TITLE' : 'ENTER FOR NEXT RACE'),
      0
    );
  }

  advance() {
    if (!this.done) return;
    if (this.retryOnAdvance) {
      RACER.health = RACER.maxHealth; // see onWrecked: placeholder policy
      this.scene.start('GameScene', { mode: 'story', trackIndex: this.trackIndex });
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

  quitToTitle() {
    // Endless has no finish line yet (nothing to crash into), so the run
    // banks its distance on exit. Once collisions land, game-over owns this.
    if (this.mode === 'endless') submitScore('endless', this.distanceM(), 'max');
    this.scene.start('TitleScene');
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