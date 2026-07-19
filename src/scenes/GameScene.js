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
import { Controls } from '../systems/Controls.js';
import { Popularity } from '../systems/Popularity.js';
import { RACER } from '../systems/RacerState.js';
import { HealthBar } from '../ui/HealthBar.js';
import { ProgressBar } from '../ui/ProgressBar.js';
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
    this.pop = new Popularity(TUNING);
    this.done = false;

    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.scale.height - 70, 'car', 1)
      .setScale(1.8)
      .setDepth(10);

    this.controls = new Controls(this);
    this.input.keyboard.on('keydown-ESC', () => this.quitToTitle());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());

    this.hud = this.add
      .text(16, 16, '', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setDepth(20);
    this.healthBar = new HealthBar(this, this.scale.width - 200, 18);
    // Race progress bar — story only; endless has no "how far is left."
    this.progressBar = this.race ? new ProgressBar(this, this.race.laps) : null;
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
    // Result banners answer the controller: cross advances, circle bails.
    // Edge-detected poll, same reasoning as the title menu.
    const gp = this.input.gamepad;
    const pad = gp && gp.total > 0 ? gp.getPad(0) : null;
    const padNow = { a: !!(pad && pad.A), b: !!(pad && pad.B) };
    const padPrev = this.prevPad ?? { a: true, b: true };
    this.prevPad = padNow;

    if (this.done) {
      if (padNow.a && !padPrev.a) this.advance();
      if (padNow.b && !padPrev.b) this.quitToTitle();
      return; // banner is up; keyboard ENTER/ESC still work too
    }

    const dt = Math.min(delta, 50) / 1000;
    const input = this.controls.read(TUNING);

    this.player.update(dt, input, this.model);

    // Contact. Airborne clears everything below — that's the point of
    // flying. i-frames only gate hazards; candy always pays.
    this.pop.update(dt);
    if (!this.player.airborne) {
      const s = checkObstacleHit(this.player, this.model, TUNING);
      if (s) {
        if (s.def.kind === 'candy') this.onCandy(s.def);
        else if (s.def.kind === 'launch') this.onRamp(s.def);
        else if (this.iframes <= 0) this.onHit(s.def);
        else s.hit = false; // i-frames: hazard not consumed, just ghosted
      }
    }
    this.iframes = Math.max(0, this.iframes - dt);
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
    if (this.progressBar) {
      // (lap-1 + fraction-through-this-lap) / total laps. Position wraps
      // each lap, so the in-lap fraction is just position / trackLength.
      const inLap = this.player.position / this.model.trackLength;
      this.progressBar.draw((this.race.lap - 1 + inLap) / this.race.laps);
    }

    // Steering FRAMES (0=left, 1=straight, 2=right) — analog steer is
    // quantized; the thresholds keep small corrections from strobing the
    // sprite. Rotating pixel art smears it, hence frames not rotation.
    const s = this.player.steer;
    this.carSprite.setFrame(s < -0.25 ? 0 : s > 0.25 ? 2 : 1);
    // Jump arc: the sprite swells and lifts through a sine, then lands.
    const arc = this.player.airArc;
    this.carSprite.setScale(1.8 * (1 + 0.45 * arc));
    this.carSprite.y = this.scale.height - 70 - 46 * arc;
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;

    const speed = Math.round(this.player.speed / 100);
    const combo = this.pop.combo > 1 ? ` x${this.pop.combo}` : '';
    const fame = `FAME ${this.pop.total}${combo}`;
    if (this.mode === 'endless') {
      const dist = this.distanceM();
      const best = getScore('endless');
      this.hud.setText(
        `DIST ${dist}m${best ? `  BEST ${best}m` : ''}  ${fame}  SPEED ${speed}` +
          (!this.player.airborne && Math.abs(this.player.x) > 1 ? '  OFF TRACK' : '')
      );
    } else {
      this.hud.setText(
        `LAP ${this.race.lap}/${this.race.laps}  ${fmtTime(this.race.time)}  ${fame}  SPEED ${speed}` +
          (!this.player.airborne && Math.abs(this.player.x) > 1 ? '  OFF TRACK' : '')
      );
    }
  }

  distanceM() {
    return Math.floor(this.player.position / 100);
  }

  onCandy(def) {
    if (def.pop <= 0) return; // warning cone: knocked flat, no fanfare
    const earned = this.pop.add(def.pop);
    this.popup(`+${earned}`, '#ffcf3f');
  }

  onRamp(def) {
    const earned = this.pop.add(def.pop);
    this.player.launch();
    this.popup(`+${earned} AIR!`, '#00e5ff');
    this.cameras.main.shake(60, 0.003); // takeoff kick
  }

  onHit(def) {
    if (this.pop.bust()) this.popup('COMBO LOST', '#ff2d55');
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
      RACER.money += this.pop.cash; // the crowd tips even a spectacular ending
      this.showBanner(
        `WRECKED\n${dist}m${record ? '  NEW RECORD' : ''}\nTIPS $${this.pop.cash}\n\nENTER FOR TITLE`, 0);
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
    // The two careers, side by side on every receipt: racing income
    // (base + beating par) and fame income. Players see which one is
    // funding their garage — that's the payout screen teaching playstyle.
    const par = this.trackData.par ?? 120;
    const timeCash = TUNING.basePayout + Math.max(0, Math.round((par - t) * TUNING.parRate));
    const fameCash = this.pop.cash;
    RACER.money += timeCash + fameCash;
    const last = this.trackIndex >= TRACKS.length - 1;
    this.showBanner(
      `FINISH  ${fmtTime(t)}${record ? '  NEW RECORD' : ''}\n` +
        `RACING $${timeCash}  +  FAME $${fameCash}\n` +
        `WALLET $${RACER.money}\n\n` +
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
    // Walking away mid-run still banks the endless distance and tips.
    if (this.mode === 'endless' && !this.done) {
      submitScore('endless', this.distanceM(), 'max');
      RACER.money += this.pop.cash;
    }
    this.scene.start('TitleScene');
  }

  // Sub-300ms reward legibility: fame blooms at the car, not on a tally.
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

    hook('maxSpeed',      (v) => (TUNING.maxSpeed = v));
    hook('steerRate',     (v) => (TUNING.steerRate = v));
    hook('centrifugal',   (v) => (TUNING.centrifugal = v));
    hook('airbrakeForce', (v) => (TUNING.airbrakeForce = v));
    hook('steerExpo',     (v) => (TUNING.steerExpo = v));
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