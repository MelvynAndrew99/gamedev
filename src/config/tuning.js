// tuning.js — every magic number in the game lives here.
// The debug panel mutates these at runtime; call TUNING.recalc()
// after changing anything marked (derived-input).

export const TUNING = {
  // ---- Projection (the "camera") -------------------------------------
  fov: 100,            // (derived-input) degrees. Wider = more speed sensation, more distortion at edges
  cameraHeight: 1000,  // world units above the road. Higher = more top-down, lower = more bumper-cam
  drawDistance: 200,   // segments rendered per frame. Your frame budget knob.
  fogDensity: 5,       // exponential fog falloff. Hides the draw-distance cutoff pop-in.

  // ---- Road geometry -------------------------------------------------
  segmentLength: 200,  // world units per segment. Smaller = smoother curves, more segments to draw
  rumbleLength: 3,     // segments per rumble-strip color band (the SNES "stripe" cadence)
  roadWidth: 2000,     // world units, HALF-width (center to edge)
  lanes: 3,

  // ---- Car physics (arcade-tuned, not simulated) ---------------------
  maxSpeed: 12000,     // (derived-input) world units/sec. 12000 = 1 segment per frame at 60fps
  centrifugal: 0.3,    // how hard curves fling you outward. THE core risk knob of the game.
  playerW: 0.14,       // car collision half-width in road-half units
  iframes: 0.9,        // seconds of post-hit invulnerability (no combo-wrecks by cluster)

  // ---- Speed feel ----------------------------------------------------
  fovSpeedBoost: 22,   // degrees added to fov at max speed. Dynamic FOV is the
                       // cheapest speed drug there is: the world stretches.

  // ---- Colors (F-Zero sunset / Wipeout neon) -------------------------
  colors: {
    skyBands: [0x0b0630, 0x1a0b45, 0x2c1157, 0x53207a, 0x8a2d8b, 0xe75480], // top -> horizon
    groundLight: 0x1a0f3c,
    groundDark:  0x140a2e,
    roadLight:   0x3a3a46,
    roadDark:    0x34343e,
    rumbleA:     0xff2d95, // magenta
    rumbleB:     0x00e5ff, // cyan
    lane:        0xb8b8c8,
    fog:         0x1a0b45, // matches a sky band so distance melts into the horizon
  },

  // Recompute derived values. Call after the debug panel changes fov,
  // cameraHeight, or maxSpeed.
  recalc() {
    // cameraDepth: distance from the camera to the projection plane for a
    // plane of height 1. Straight out of the perspective-projection triangle:
    // tan(fov/2) = 1 / depth  =>  depth = 1 / tan(fov/2)
    this.cameraDepth = 1 / Math.tan(((this.fov / 2) * Math.PI) / 180);

    // playerZ: how far in FRONT of the camera the car sits, chosen so the
    // car appears near the bottom of the screen at the road surface.
    this.playerZ = this.cameraHeight * this.cameraDepth;

    // Physics derived from maxSpeed so one slider retunes everything.
    this.accel        =  this.maxSpeed / 5;  // 0 -> max in ~5s
    this.braking      = -this.maxSpeed;      // max -> 0 in ~1s
    this.decel        = -this.maxSpeed / 5;  // engine braking / coasting
    this.offRoadDecel = -this.maxSpeed / 2;  // punish leaving the road
    this.offRoadLimit =  this.maxSpeed / 4;  // off-road won't slow you below this
  },
};

TUNING.recalc();