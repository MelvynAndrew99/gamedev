// tuning.js — every magic number in the game lives here.
// The debug panel mutates these at runtime; call TUNING.recalc()
// after changing anything marked (derived-input).

export const TUNING = {
  // ---- Projection (the "camera") -------------------------------------
  fov: 100,            // (derived-input) degrees. Wider = more speed sensation, more distortion at edges
  maxDynamicFov: 135,  // hard lens limit: perspective flips inside-out at 180 degrees
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
  carScale: 5,          // on-screen size of the car sprite. The rear-view canopy
                        // sheet has a tighter visible silhouette than the earlier
                        // sprite; 5 is the measured-by-eye Projection Lab value.
  iframes: 0.9,        // seconds of post-hit invulnerability (no combo-wrecks by cluster)

  // ---- Handling feel (all live on the debug panel) --------------------
  steerRate: 2.0,      // base steering authority: road-widths/sec at max speed
  steerExpo: 1.6,      // analog stick response curve (1 = linear, higher = softer center)
  airbrakeForce: 2.2,  // extra lateral authority while an airbrake is held

  // ---- Rivals / takedowns (live in the Projection Lab) ---------------
  rivalCount: 3,             // captured per Rival School attempt; Lab supports 1..6
  rivalPace: 0.96,           // shared base-speed multiplier before profiles
  rivalAggression: 0.2,      // changes attack frequency, never attack physics
  rivalTelegraph: 0.75,      // seconds of visible intent before lateral attack
  rivalCatchupCap: 0.12,     // far-only pace help; disabled near contact
  rivalTakedownAdvantage: 0.04, // forgiving but real closing-speed edge for a rear ram
  rivalContactStrength: 0.08,   // training incoming-hit speed tax (8%)
  rivalCampaignDamage: 10,      // persistent hull cost when Story enables rivals
  rivalContactCooldown: 0.8,    // pair immunity after one resolved contact
  rivalAttackCooldown: 3.5,     // per-rival minimum time between attempts
  rivalAttackWindow: 0.22,      // one-sided airbrake tap commitment window
  rivalMaxCount: 6,             // renderer/system stress cap; production uses three

  // ---- Terrain physics ------------------------------------------------
  overspeedCap: 1.25,  // the overspeed ceiling: HUD 150 — the top of the fun band Melvyn found (140-150). Everything that grants speed clamps here.
  torqueLow: 3.6,      // engine multiplier at standstill. Sized to BEAT gravity on
                       // the steepest authored grade (~0.14 → 6720 u/s²): accel*3.6 =
                       // 8640 > 6720, so a standing hill-start pulls away cleanly
                       // rather than merely holding. 3.6 is Melvyn's dialed-in feel
                       // from the debug panel. Only touches the low end — the curve
                       // still tapers to torqueHigh at maxSpeed, so top-end grind is
                       // unchanged.
  torqueHigh: 0.6,     // engine multiplier near maxSpeed (top end pulls like a loaded truck)
  climbFloor: 0.28,    // under throttle, grades can't drag you below this fraction of max
  nitroMax: 3,         // pocket size for boost pickups
  boostTierCeilings: [1.35, 1.5, 1.65], // overspeed ceiling multiplier per tap-stack tier
                       // (bronze/silver/gold) — a temporary ceiling that only
                       // applies while a boost is actively burning; see Boost.js
                       // and Player.js's per-frame clamp. Never touches overspeedCap.
  boostChainWindow: 0.6,       // seconds after release a follow-up tap still stacks tier
  boostHoldThreshold: 0.22,    // press duration before "tap" becomes continuous "hold"
  boostBurnDuration: 1.3,      // seconds one spent slot keeps its tier's ceiling active
  boostHoldDrainInterval: 1.3, // seconds between hold-drain slot spends (one full burn per slot)
  boostDecayTail: 1.1,         // seconds the ceiling eases back to overspeedCap once boost ends
  hitRecoveryTime: 2.0,   // seconds of grace after a hit — mistakes cost the moment, not the minute
  hitRecoveryAccel: 1.9,  // engine multiplier during recovery
  hitRecoveryShield: 0.35,// gravity multiplier during recovery — the real fix: authored hills peak
                          // near 0.14 grade (the ease's midpoint runs ~1.57x steeper than its own
                          // average), too steep for accel alone to beat. Shielding gravity AND
                          // boosting the engine together guarantees recovery wins on any grade we
                          // actually author, not just gentle ones.
  zipPop: 5,             // fame per zipper crossing — zips feed the combo (Tony Hawk foundation)
  zipperKick: 0.22,    // per-crossing shove: a clean chain PINS the ceiling; one miss and decay starts reclaiming it
  zipperW: 0.22,       // zipper half-width in road-half units
  minBoostSlope: 0.04, // uphill grade that earns boost pads (rise/run)
  dirtSpeed: 0.72,     // dirt won't let you hold more than this fraction of max
  dirtSteer: 0.85,     // steering authority multiplier on dirt (loose surface)

  // ---- Terrain physics ------------------------------------------------

  // ---- Popularity economy --------------------------------------------
  comboWindow: 3.0,    // seconds to chain the next act before the combo lapses
  comboMax: 8,         // multiplier cap
  popPayoutRate: 1.0,  // money per fame point at payout
  basePayout: 300,     // showing up money (story races)
  parRate: 25,         // money per second under par
  repairPackHealth: 10,// garage purchase size: small enough to leave a real choice
  repairPackCost: 50,  // $5 per hull point; base pay repairs 60% of a car
  emergencyHealth: 25, // free tow floor prevents a broke/wrecked campaign lock

  // ---- Race start -----------------------------------------------------
  gridSetback: 6000,   // world units the car sits BEHIND the start/finish line
                       // on the grid (~30 segments). Traditional rolling start:
                       // the gantry is ahead and visible, and you drive THROUGH
                       // it to begin — that first crossing starts lap 1, it isn't
                       // a completed lap (see RaceState.crossedStart).

  // ---- Jumps ----------------------------------------------------------
  jumpMinAir: 0.35,    // seconds airborne at crawl speed
  jumpMaxAir: 0.55,    // ADDITIONAL seconds at max speed (total ~0.9s)
  jumpBoostAir: 0.18,  // live nitro at takeoff adds lift as well as raw speed
  glideShortenRate: 1.35, // stick forward/nose-down spends the flight timer faster
  glideExtendRate: 0.78,  // stick back/nose-up stretches it, but can never stall forever


  // ---- Speed feel ----------------------------------------------------
  fovSpeedBoost: 28,   // degrees added to fov at max speed. Dynamic FOV is the
                       // cheapest speed drug there is: the world stretches.
  speedLineFloor: 0.5, // speedPercent where warp streaks begin. Below cruise the
                       // screen stays clean; the smear is a HIGH-speed reward.
  speedLineColor: 0xbfffff, // cool white — reads over the neon road without fighting it.
  speedLineBurstTime: 0.9,  // seconds a ramp/boost streak-bloom takes to fade. The burst
                            // fires the streaks even below the passive floor, so a speed
                            // reward always READS as one — that's the route-optimization
                            // carrot: you SEE the payoff of a well-hit ramp or a nitro pop.

  // ---- Audio -----------------------------------------------------------
  musicVolume: 0.16,   // internal 0..1 gain; Projection Lab presents 16%
  sfxVolume: 1.0,      // internal 0..1 gain; playtest-approved 100% feedback

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
    // Dirt: desaturated, no neon — the road stops glowing when the
    // pavement ends. Edges are dusty, not electric.
    zipperA:     0x2ee56b, // zipper paint (band-alternates with B: free scroll animation)
    zipperB:     0x18b04b,
    zipperGlow:  0xbfffd9,
    launchA:     0xffcf3f, // ramp runway: reward yellow, distinct from orange cones
    launchB:     0x8a6615,
    launchEdge:  0x00e5ff, // cyan rails terminate at the ramp's cyan beacons
    dirtLight:   0x4a3a35,
    dirtDark:    0x423330,
    dirtEdgeA:   0x6b4f35,
    dirtEdgeB:   0x5a4230,
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
    this.airbrakeDrag  = -this.maxSpeed / 8; // airbrakes trade a little speed for the turn
    this.slopeAccel    =  this.maxSpeed * 4;  // gravity along the road: beats the engine on steep grades — that's the boost-pad economy
    this.overspeedDecay= -this.maxSpeed / 6;  // above maxSpeed, drag pulls you back (unless gravity wins)
    this.boostKick      =  this.maxSpeed * 0.08; // immediate Burnout-style punch per spent slot
    this.boostAccel     =  this.maxSpeed * 0.9;  // sustained thrust toward the active tier ceiling
    this.dirtDrag      = -this.maxSpeed / 3;  // drain on dirt above the dirt speed ceiling
  },
};

TUNING.recalc();
