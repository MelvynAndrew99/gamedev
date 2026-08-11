// RivalFx.js — pure intensity policy for a pooled combat presentation.
// The world layer owns particles/sprites; this module guarantees that a rub,
// deliberate slam, player hit, and takedown remain visually distinct.

const SPECS = Object.freeze({
  rub: Object.freeze({ particles: 2, duration: 0.12, shake: 0, flash: 0.025 }),
  // A normal hit is a compact ricochet. The world car is displaced by the
  // collision response itself; presentation must not stretch or blur it.
  slam: Object.freeze({ particles: 5, duration: 0.2, shake: 0.001, flash: 0.035 }),
  incoming: Object.freeze({ particles: 9, duration: 0.28, shake: 0.005, flash: 0.06 }),
  // Boosted takedowns resolve as one local explosion. There is deliberately
  // no detached car ghost, barrel roll, or cone-style second animation.
  takedown: Object.freeze({ particles: 20, duration: 0.42, shake: 0.007, flash: 0.09 }),
});

export function rivalFxSpec(kind = 'rub', boosted = false) {
  const base = SPECS[kind] ?? SPECS.rub;
  return {
    kind: SPECS[kind] ? kind : 'rub',
    particles: Math.min(24, base.particles + (boosted ? 2 : 0)),
    duration: base.duration,
    shake: base.shake,
    flash: Math.min(0.12, base.flash + (boosted ? 0.015 : 0)),
    ghost: false,
  };
}
