# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design brief

**Read [GAME_DESIGN.md](./GAME_DESIGN.md) before making gameplay, track, or object changes.** It is the
source of truth for the game's design language (cones/rocks/ramps/zippers/nitro/dirt), track pacing
grammar, campaign vs. Endless Mode parity rules, and the cross-mode change checklist. Any change to
world objects, rules, handling, or scoring is not finished until GAME_DESIGN.md's "Definition of done"
is satisfied.

## Commands

- `npm run dev` — start the Vite dev server (port 3000, opens browser)
- `npm run build` — production build to `dist/` (minified with terser)
- `npm run preview` — preview the production build
- `npm test` — run all tests (`node --test`, native Node test runner)
- Run a single test file: `node --test src/road/RoadModel.test.js`

Asset generation (regenerate pixel-art sprites into `public/assets/`):
- `node tools/gen-car.js` — car sprite (steering frames), needs `pngjs`
- `node tools/gen-props.js` — cone/rock/post sprites
- `tools/design.py` / `tools/CarRenderer.py` — Python helpers used when iterating on sprite layout

Nix users: `flake.nix` provides a devShell with node, git, and typescript.

## Architecture

This is a pseudo-3D (Outrun-style) racer built on Phaser 3, entry point `src/game.js`. There is
**no Phaser physics** — the road is our own data model and collision is a 1.5D interval-overlap test.
Reading the header comment of any file below explains its contract; they're intentionally dense.

**The pipeline: model → renderer → collision, kept strictly separate.**
- `src/road/RoadModel.js` — the track as pure data (no Phaser). A track is an array of segments, each
  with a `curve` value, edge heights (hills), and a surface (`road`/`dirt`). `buildFromData()`
  constructs campaign tracks from `src/tracks/*.json`.
- `src/road/RoadRenderer.js` — the projection pipeline. Walks segments from the camera outward,
  perspective-projects edges (`scale = cameraDepth / z`), and draws trapezoids front-to-back. Curves
  are a running `dx` offset accumulated while walking — nothing is actually curved in world space.
- `src/road/EndlessTrack.js` — a `RoadModel` subclass that generates road just-in-time ahead of the
  player and trims it behind (segment `index` is absolute; `trimOffset` maps index → array position).
  Difficulty ramps with distance over `RAMP_PIECES`.
- `src/road/patterns.js` — road formations/object placement grammar shared by campaign and Endless
  (`stampPattern`). Cones are lane-anchored warnings that resolve into rocks or ramps.
- `src/systems/Collision.js` — one interval-overlap test: same segment (z) + overlapping lateral (x)
  range = contact. No physics engine, no broadphase.

**Campaign vs. Endless Mode are two implementations of the same object language** (see GAME_DESIGN.md).
Changes to obstacles, pacing, or rules must be considered for both `src/tracks/*.json` (authored) and
`EndlessTrack.js` (procedural).

**State/config split:**
- `src/config/tuning.js` — every magic number (projection, road geometry, car physics) in one place;
  `TUNING.recalc()` must be called after mutating derived-input values.
- `src/config/obstacles.js` — the obstacle catalog; each entry's `kind` (`candy`/`hazard`/`launch`)
  tells `GameScene` what contact means.
- `src/systems/RacerState.js` — persistent racer condition (health, money) as a module-level singleton
  that survives scene restarts but not refresh. Health is deliberately **not** refilled between races —
  don't "fix" this.
- `src/systems/Economy.js`, `src/systems/Popularity.js` — pure transaction/scoring logic kept out of
  scenes so it's independently testable (see their `.test.js` files).
- `src/systems/RaceState.js` — lap/timer/finish logic; returns an event string per frame, presentation
  decisions stay in the scene.

**Scenes** (`src/scenes/`): `TitleScene` boots first, `GameScene` runs the race and launches
`HudScene` alongside it, `GarageScene` handles the shop/repair loop between races.

Sprites in `public/assets/` are procedurally generated pixel art (see `tools/`), not hand-drawn —
regenerate via the `tools/gen-*.js` scripts rather than editing PNGs directly.
