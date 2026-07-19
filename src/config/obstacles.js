// obstacles.js — the catalog of everything that can occupy the road.
// Each entry has a `kind` that tells GameScene what contact means:
//   candy  — no damage; smashing it pays popularity. Cones.
//   hazard — damage + combo bust. Rocks.
//   launch — throws the car airborne; pays popularity. Ramps.
// Widths are in road-half units (same coordinate as player.x), so
// collision math never touches pixels.

export const OBSTACLES = {
  cone: {
    key: 'cone',
    kind: 'candy',
    pop: 10,      // fame per cone, multiplied by the current combo
    damage: 0,
    slow: 1.0,    // smashing candy is FREE — friction here kills the fun
    w: 0.07,
    view: 0.16,
  },
  rock: {
    key: 'rock',
    kind: 'hazard',
    pop: 0,
    damage: 25,
    slow: 0.35,   // momentum death — the real punishment
    w: 0.11,
    view: 0.22,
  },
  ramp: {
    key: 'ramp',
    kind: 'launch',
    pop: 50,      // the jackpot at the end of the breadcrumb trail
    damage: 0,
    slow: 1.0,
    w: 0.13,
    view: 0.3,
  },
};

// Roadside decoration — can't be hit.
export const ROADSIDE = {
  post: { key: 'post', w: 0, view: 0.09 },
};