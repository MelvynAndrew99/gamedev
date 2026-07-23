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
import { submitScore } from '../systems/HighScores.js';
import { checkObstacleHit } from '../systems/Collision.js';
import { Controls } from '../systems/Controls.js';
import { Popularity } from '../systems/Popularity.js';
import { RACER } from '../systems/RacerState.js';
import { buttonDown, getPrimaryPad } from '../systems/Gamepad.js';
import { TRACKS } from '../tracks/index.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // Scene launch data arrives here, before create().
  init(data) {
    this.mode = data.mode ?? 'story';
    this.trackIndex = data.trackIndex ?? 0;
    this.garageData = null;
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
    this.nitro = 0; // pocketed boosts (see TUNING.nitroMax)
    this.wasOnZipper = false;
    this.prevNitroHeld = false;
    this.done = false;

    // Bottom-anchored (origin 0.5,1): the sprite's y IS its rear-bumper
    // line, not its center. Center-anchoring was the actual "too close to
    // the bottom" bug — scaling up grew the car in BOTH directions, so a
    // bigger Car Size pushed the bottom half off-canvas along with making
    // the top bigger. Bottom-anchoring means Car Size only ever grows the
    // car upward into the road, never off the bottom edge.
    this.carBaselineY = this.scale.height - 24;
    this.carSprite = this.add
      .sprite(this.scale.width / 2, this.carBaselineY, 'car', 2)
      .setOrigin(0.5, 1)
      .setScale(TUNING.carScale)
      .setDepth(10);

    this.controls = new Controls(this);
    this.input.keyboard.on('keydown-ESC', () => this.quitToTitle());
    this.input.keyboard.on('keydown-ENTER', () => this.advance());

    this.iframes = 0; // post-hit invulnerability countdown
    this.boostCooldown = 0; // one pad = one kick, even if we overlap for 2 frames

    // Center-screen banner: race intro, lap flash, results.
    this.banner = this.add
      .text(this.scale.width / 2, 250, '', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#0a0a14',
        strokeThickness: 5,
        lineSpacing: 6,
        wordWrap: { width: this.scale.width - 120 }, // no more edge bleed
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (this.trackData) {
      this.showBanner(`${this.trackData.name}\n${this.trackData.intro}`, 3500);
    } else {
      this.showBanner('ENDLESS\nThe road never ends. You will.', 3000);
    }

    this.hookDebugPanel();

    // Instruments run in a parallel scene: own camera, immune to the
    // shakes and zooms this scene will accumulate. Stopped with us.
    this.scene.launch('HudScene');
    this.events.once('shutdown', () => this.scene.stop('HudScene'));
  }

  update(_time, delta) {
    // Result banners answer the controller: cross advances, circle bails.
    // Edge-detected poll, same reasoning as the title menu.
    const pad = getPrimaryPad(this.input.gamepad);
    const padNow = {
      a: buttonDown(pad, 0, 'A'),
      b: buttonDown(pad, 1, 'B'),
    };
    const padPrev = this.prevPad ?? { a: true, b: true };
    this.prevPad = padNow;

    if (this.done) {
      if (padNow.a && !padPrev.a) this.advance();
      if (padNow.b && !padPrev.b) this.quitToTitle();
      return; // banner is up; keyboard ENTER/ESC still work too
    }

    const dt = Math.min(delta, 50) / 1000;
    const input = this.controls.read(TUNING);

    // Nitro: edge-detected — one burn per press, if there's one to burn.
    if (input.nitro && !this.prevNitroHeld && this.nitro > 0) {
      this.nitro--;
      this.onBoost();
    }
    this.prevNitroHeld = input.nitro;

    this.player.update(dt, input, this.model);

    // Zipper crossings: edge-triggered per strip (kick on entry, re-arm on
    // exit), never consumed — the paint is permanent, the skill is lining
    // up on it lap after lap. Airborne cars aren't touching the road.
    {
      const seg = this.model.findSegment(this.player.position + TUNING.playerZ);
      const z = seg.zipper;
      const on = !!z && !this.player.airborne &&
        Math.abs(this.player.x - z.offset) < z.w + TUNING.playerW * 0.5;
      if (on && !this.wasOnZipper) {
        this.player.zip();
        const earned = this.pop.add(TUNING.zipPop); // zips build the combo
        this.popup(`ZIP +${earned}`, '#2ee56b');
      }
      this.wasOnZipper = on;
    }

    // Contact. Airborne clears everything below — that's the point of
    // flying. i-frames only gate hazards; candy always pays.
    this.pop.update(dt);
    if (!this.player.airborne) {
      const s = checkObstacleHit(this.player, this.model, TUNING);
      if (s) {
        if (s.def.kind === 'candy') this.onCandy(s.def);
        else if (s.def.kind === 'launch') this.onRamp(s.def);
        else if (s.def.kind === 'pickup') this.onPickup(s);
        else if (this.iframes <= 0) this.onHit(s.def);
        else s.hit = false; // i-frames: hazard not consumed, just ghosted
      }
    }
    this.iframes = Math.max(0, this.iframes - dt);
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.carSprite.setAlpha(this.iframes > 0 && Math.floor(this.iframes * 12) % 2 ? 0.4 : 1);

    if (this.mode === 'endless') {
      this.model.ensureAhead(this.player.position); // pave ahead of the car
    } else {
      const event = this.race.update(dt, this.player);
      if (event === 'lap') {
        this.model.resetLapSprites();
        this.showBanner(`LAP ${this.race.lap} / ${this.race.laps}`, 1200);
      } else if (event === 'finished') {
        this.finishRace();
      }
    }

    const speedPercent = this.player.speed / TUNING.maxSpeed;
    this.renderer.render(this.model, this.player, speedPercent);

    // Steering FRAMES: 0=hard-left, 1=left, 2=straight, 3=right, 4=hard-right.
    // Five buckets instead of three — needed once airbrakes are in the mix:
    // a shoulder-button bank needs to look visibly harder than a light stick
    // correction, and player.steer already blends stick + airbrake (see
    // Player.update), so one signal drives the whole 5-way read.
    const s = this.player.steer;
    const frame = s < -0.6 ? 0 : s < -0.2 ? 1 : s <= 0.2 ? 2 : s <= 0.6 ? 3 : 4;
    this.carSprite.setFrame(frame);
    // Jump arc: the sprite swells and lifts through a sine, then lands.
    const arc = this.player.airArc;
    this.carSprite.setScale(TUNING.carScale * (1 + 0.45 * arc));
    this.carSprite.y = this.carBaselineY - 46 * arc; // lift from the bumper line, not center
    this.carSprite.x =
      this.scale.width / 2 + this.player.steer * 6 * speedPercent;


  }

  distanceM() {
    return Math.floor(this.player.position / 100);
  }

  onPickup(sprite) {
    if (this.nitro >= TUNING.nitroMax) {
      sprite.hit = false; // pockets full — leave it for the next lap
      return;
    }
    this.nitro++;
    this.popup('+NITRO', '#2ee56b');
  }

  onBoost() {
    if (this.boostCooldown > 0) return;
    this.boostCooldown = 0.5;
    this.player.boost();
    this.popup('BOOST', '#2ee56b');
    this.cameras.main.shake(50, 0.002);
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
      this.garageData = {
        wrecked: true,
        retryTrackIndex: this.trackIndex,
        receipt: 'WRECKED — NO RACE PURSE',
      };
      this.showBanner('WRECKED\n\nENTER FOR GARAGE', 0);
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
    this.garageData = {
      nextTrackIndex: this.trackIndex + 1,
      complete: last,
      receipt: `RACING +$${timeCash}   FAME +$${fameCash}`,
    };
    this.showBanner(
      `FINISH  ${fmtTime(t)}${record ? '  NEW RECORD' : ''}\n` +
        `RACING $${timeCash}  +  FAME $${fameCash}\n` +
        `WALLET $${RACER.money}\n\n` +
        (last ? 'CAMPAIGN COMPLETE\nENTER FOR GARAGE' : 'ENTER FOR GARAGE'),
      0
    );
  }

  advance() {
    if (!this.done) return;
    if (this.mode === 'story' && this.garageData) {
      this.scene.start('GarageScene', this.garageData);
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
    hook('carScale',      (v) => (TUNING.carScale = v));
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
