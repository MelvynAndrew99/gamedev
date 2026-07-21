// Controls.js — one input signal, many devices. The rest of the game never
// asks "keyboard or pad?"; it reads a normalized frame:
//   { steer: -1..1, throttle: 0..1, brake: 0..1, airbrakeL, airbrakeR, nitro }
//
// Keyboard is digital (steer snaps to ±1); the stick is analog with a
// deadzone and an expo curve — steerExpo > 1 softens the center so small
// corrections are precise and full deflection still gets everything.
// This is the same shaping every flight/racing sim applies to sticks;
// linear response makes analog feel twitchier than digital, which is
// exactly backwards from what you paid for.
//
// DS4Windows presents the DualSense as XInput = the browser's "standard
// mapping": axes[0] = left stick X, L2/R2 analog triggers, L1/R1 bumpers.

export class Controls {
  constructor(scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.keyZ = kb.addKey('Z'); // left airbrake
    this.keyX = kb.addKey('X'); // right airbrake
    this.keySpace = kb.addKey('SPACE'); // spend one pocketed nitro
  }

  get pad() {
    const gp = this.scene.input.gamepad;
    return gp && gp.total > 0 ? gp.getPad(0) : null;
  }

  read(tuning) {
    let steer = 0, throttle = 0, brake = 0, abL = false, abR = false, nitro = false;

    const pad = this.pad;
    if (pad) {
      const raw = pad.axes.length ? pad.axes[0].getValue() : 0;
      const dz = 0.12;
      const mag = Math.max(0, Math.abs(raw) - dz) / (1 - dz);
      steer = Math.sign(raw) * Math.pow(mag, tuning.steerExpo);
      throttle = pad.R2 ?? 0;
      brake = pad.L2 ?? 0;
      abL = !!pad.L1;
      abR = !!pad.R1;
      nitro = !!pad.B; // circle on PlayStation / B on Xbox-style pads
      if (pad.left) steer = -1;   // d-pad works too
      if (pad.right) steer = 1;
      if (pad.A) throttle = Math.max(throttle, 1); // cross = gas, for the lazy thumb
    }

    // Keyboard merges over the top — both devices always live.
    if (this.cursors.left.isDown) steer = -1;
    else if (this.cursors.right.isDown) steer = 1;
    if (this.cursors.up.isDown) throttle = 1;
    if (this.cursors.down.isDown) brake = 1;
    if (this.keyZ.isDown) abL = true;
    if (this.keyX.isDown) abR = true;
    if (this.keySpace.isDown) nitro = true;

    return { steer, throttle, brake, airbrakeL: abL, airbrakeR: abR, nitro, connected: !!pad };
  }
}
