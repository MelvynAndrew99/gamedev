// Gamepad.js — the small compatibility layer between Phaser and gameplay.
//
// Phaser's getPad(n) looks up the browser-assigned hardware index, not "the
// nth connected controller." Assuming index 0 works on many Windows setups
// but fails after reconnects and on Macs that assign a DualSense another
// index. pad1 is Phaser's actual first connected controller.

export function getPrimaryPad(plugin) {
  if (!plugin || plugin.total <= 0) return null;
  return plugin.pad1 ?? plugin.gamepads?.find(Boolean) ?? null;
}

export function axisValue(pad, index) {
  const axis = pad?.axes?.[index];
  if (axis && typeof axis.getValue === 'function') return axis.getValue();
  return Number(pad?.pad?.axes?.[index] ?? 0);
}

export function buttonValue(pad, index, phaserName) {
  const named = phaserName ? pad?.[phaserName] : undefined;
  if (typeof named === 'number') return named;
  if (typeof named === 'boolean') return named ? 1 : 0;

  const button = pad?.buttons?.[index] ?? pad?.pad?.buttons?.[index];
  if (typeof button === 'number') return button;
  return Number(button?.value ?? (button?.pressed ? 1 : 0));
}

export function buttonDown(pad, index, phaserName) {
  return buttonValue(pad, index, phaserName) > 0.5;
}

export function dpadDown(pad, direction) {
  const map = {
    up: [12, 'up'],
    down: [13, 'down'],
    left: [14, 'left'],
    right: [15, 'right'],
  };
  const [index, name] = map[direction];
  return buttonDown(pad, index, name);
}

// Phaser 3.90 stores pads by their browser hardware index, which makes the
// array sparse when macOS assigns a DualSense index other than zero. Its
// stopListeners() implementation does not guard empty slots and crashes on a
// scene transition. Patch only that lifecycle method, leaving pad discovery
// and updates owned by Phaser.
export function installGamepadShutdownFix(GamepadPlugin) {
  const proto = GamepadPlugin?.prototype;
  if (!proto || proto.gamepadSparseArrayFixInstalled) return;

  proto.stopListeners = function stopListenersSafely() {
    this.target?.removeEventListener('gamepadconnected', this.onGamepadHandler);
    this.target?.removeEventListener('gamepaddisconnected', this.onGamepadHandler);
    this.sceneInputPlugin?.pluginEvents?.off('update', this.update);

    for (const pad of this.gamepads ?? []) {
      pad?.removeAllListeners();
    }
  };

  Object.defineProperty(proto, 'gamepadSparseArrayFixInstalled', {
    value: true,
  });
}
