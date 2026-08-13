// Controls.js — one input signal, many devices. The rest of the game never
// asks "keyboard or pad?"; it reads a normalized frame:
//   { steer: -1..1, glide: -1..1, throttle: 0..1, brake: 0..1,
//     airbrakeL, airbrakeR }
//
// Keyboard is digital (steer snaps to ±1); the stick is analog with a
// deadzone and an expo curve — steerExpo > 1 softens the center so small
// corrections are precise and full deflection still gets everything.
// This is the same shaping every flight/racing sim applies to sticks;
// linear response makes analog feel twitchier than digital, which is
// exactly backwards from what you paid for.
//
// Both XInput and a natively connected macOS DualSense use the browser's
// standard layout: axes 0/1 = left stick X/Y; buttons 6/7 = L2/R2;
// 4/5 = L1/R1. Flight uses its own W/S keyboard pair so holding the ordinary
// Up-arrow throttle never accidentally noses the car down on every jump.

import {
  axisValue,
  buttonDown,
  buttonValue,
  dpadDown,
  getPrimaryPad,
} from './Gamepad.js';

export class Controls {
  constructor(scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.keyZ = kb.addKey('Z'); // left airbrake
    this.keyX = kb.addKey('X'); // right airbrake
    this.keyC = kb.addKey('C'); // nitro
    this.keyW = kb.addKey('W'); // airborne nose-down: shorter, quicker arc
    this.keyS = kb.addKey('S'); // airborne nose-up: longer glide
  }

  get pad() {
    return getPrimaryPad(this.scene.input.gamepad);
  }

  read(tuning, options = {}) {
    let steer = 0, glide = 0, throttle = 0, brake = 0;
    let abL = false, abR = false, nitro = false;

    const pad = this.pad;
    if (pad) {
      const raw = axisValue(pad, 0);
      const dz = 0.12;
      const mag = Math.max(0, Math.abs(raw) - dz) / (1 - dz);
      steer = Math.sign(raw) * Math.pow(mag, tuning.steerExpo);
      const rawY = axisValue(pad, 1);
      const glideMag = Math.max(0, Math.abs(rawY) - dz) / (1 - dz);
      // Browser Y grows downward: forward is negative (shorter), back is
      // positive (longer), which is already the Player glide convention.
      glide = Math.sign(rawY) * Math.pow(glideMag, tuning.steerExpo);
      throttle = buttonValue(pad, 7, 'R2');
      brake = buttonValue(pad, 6, 'L2');
      abL = buttonDown(pad, 4, 'L1');
      abR = buttonDown(pad, 5, 'R1');
      nitro = buttonDown(pad, 2, 'X'); // Square on PlayStation, X on Xbox
      // Circle / B becomes an intuitive aerial brake only in the isolated
      // Flight School event. It remains a menu/back action everywhere else.
      if (options.flight) brake = Math.max(brake, buttonValue(pad, 1, 'B'));
      if (dpadDown(pad, 'left')) steer = -1;
      if (dpadDown(pad, 'right')) steer = 1;
      if (buttonDown(pad, 0, 'A')) throttle = Math.max(throttle, 1); // Cross / A
    }

    // Keyboard merges over the top — both devices always live.
    if (this.cursors.left.isDown) steer = -1;
    else if (this.cursors.right.isDown) steer = 1;
    if (this.cursors.up.isDown) throttle = 1;
    if (this.cursors.down.isDown) brake = 1;
    if (this.keyZ.isDown) abL = true;
    if (this.keyX.isDown) abR = true;
    if (this.keyC.isDown) nitro = true;
    if (this.keyW.isDown) glide = -1;
    else if (this.keyS.isDown) glide = 1;

    return {
      steer, glide, throttle, brake,
      airbrakeL: abL, airbrakeR: abR, nitro, connected: !!pad,
    };
  }
}
