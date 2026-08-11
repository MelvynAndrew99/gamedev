// RivalFx.js — pure intensity policy for a pooled combat presentation.
// The world layer owns particles/sprites; this module guarantees that a rub,
// deliberate slam, player hit, and takedown remain visually distinct.

const SPECS = Object.freeze({
  rub: Object.freeze({ particles: 4, duration: 0.18, shake: 0, flash: 0 }),
  slam: Object.freeze({ particles: 9, duration: 0.28, shake: 0.003, flash: 0.045 }),
  incoming: Object.freeze({ particles: 8, duration: 0.25, shake: 0.005, flash: 0.055 }),
  takedown: Object.freeze({ particles: 16, duration: 0.52, shake: 0.008, flash: 0.1 }),
});

export function rivalFxSpec(kind = 'rub', boosted = false) {
  const base = SPECS[kind] ?? SPECS.rub;
  return {
    kind: SPECS[kind] ? kind : 'rub',
    particles: Math.min(24, base.particles + (boosted ? 2 : 0)),
    duration: base.duration,
    shake: base.shake,
    flash: Math.min(0.12, base.flash + (boosted ? 0.015 : 0)),
    ghost: kind === 'takedown',
  };
}
