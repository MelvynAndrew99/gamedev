function clamp(value, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : min;
}

export function hapticSpec({ duration = 80, strong = 0, weak = 0.25 } = {}) {
  return Object.freeze({
    duration: Math.round(clamp(duration, 1, 1000)),
    strongMagnitude: clamp(strong, 0, 1),
    weakMagnitude: clamp(weak, 0, 1),
  });
}

// Phaser exposes the browser GamepadHapticActuator as pad.vibration. Some
// browsers/controllers only expose the older single-channel pulse method, so
// degrade safely instead of making rumble a gameplay dependency.
export function rumbleGamepad(pad, options = {}) {
  const spec = hapticSpec(options);
  const actuator = pad?.vibration ?? pad?.pad?.vibrationActuator ??
    pad?.pad?.hapticActuators?.[0];
  if (!actuator) return false;
  try {
    if (typeof actuator.playEffect === 'function') {
      const pending = actuator.playEffect('dual-rumble', spec);
      pending?.catch?.(() => {});
      return true;
    }
    if (typeof actuator.pulse === 'function') {
      const pending = actuator.pulse(
        Math.max(spec.strongMagnitude, spec.weakMagnitude),
        spec.duration,
      );
      pending?.catch?.(() => {});
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
