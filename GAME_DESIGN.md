# Destruction Racer — Track Design Brief

## Core promise

Destruction Racer is a pseudo-3D, flow-first arcade racer. Controlling the
car at speed is the main pleasure. Track objects create readable decisions
without repeatedly stopping the player's momentum.

The handling target sits between F-Zero's high-speed line management and the
route-and-objective play of SSX Tricky and Tony Hawk:

- **Speed creates risk.** Curves, slopes, dirt, and narrow lines become harder
  when the player protects momentum.
- **The road offers choices.** Safe lines preserve a run; committed lines earn
  speed, airtime, fame, or objective progress.
- **Mistakes cost a beat, not the whole song.** Hazards punish the immediate
  line and combo, then return control quickly.
- **Tracks become learnable.** Campaign geometry and object placement are
  stable between retries and repeat on each lap. Endless mode stays variable.

Campaign and Endless Mode are two implementations of the same game language.
A rule, object, asset, physics change, or readability improvement is not
finished until its effect on both modes has been considered.

## Object language

- **Cones are danger indicators.** A line of cones says that rocks are closing
  that lane. Cones never announce ramps, nitro pickups, or ground zippers.
  Cones are harmless and grant no reward: they communicate where to move away
  from without becoming another collision tax.
- **Rocks are momentum hazards.** They punish an unread or poorly executed
  line. They should not create unavoidable full-road walls.
- **Ramps are route offers.** A projected yellow/cyan runway may identify the
  approach, but the ramp itself remains a distinct raised object with its
  existing jump physics. A ramp should lead to a benefit: clearing a hazard,
  reaching a speed line, chaining fame, or satisfying an objective.
- **Zippers are execution rewards.** Their line should be visible early enough
  to choose, then demand steering precision at speed. Green zipper paint and
  yellow ramp-approach paint never overlap in the same lane; combo lines
  separate them with a short clean-asphalt beat.
- **Nitro is stored agency.** Place it before a climb or demanding section,
  but let the player choose when to spend it.
- **Dirt is a deliberate tempo change.** Use it for a short handling test or
  alternate route feeling, followed by clean pavement where speed can rebuild.

## Track pacing grammar

A strong section usually follows:

1. **Read** — show geometry and cone warnings.
2. **Choose** — present a safe line and a committed line.
3. **Execute** — curve, zipper, ramp, hazard, or surface test.
4. **Pay off** — speed, air, combo, shortcut feeling, or objective progress.
5. **Breathe** — give enough clean road to re-center and read the next event.

Avoid placing a new decision inside the recovery window of the previous one
unless the section is explicitly a late-game combo line.

## Campaign track roles

### Training Loop

Purpose: teach the visual language and establish trust.

- Lowest event density and generous recovery space.
- Authored event rhythm: isolated rocks, isolated ramp, open-lane gate, then
  ramp-over-rocks. This teaches each read before combining them.
- Introduce isolated warnings before mixing payloads.
- Favor center-lane reads and obvious safe alternatives.
- Objectives should teach one action at a time, such as hit one ramp or cross
  two zippers in a lap.

### Neon Gulch

Purpose: teach momentum management across hills, dirt, and stronger curves.

- Nitro before sustained climbs.
- Alternate crest/sweeper and compact chicane sections with straight settling
  zones; its authored pattern sequence introduces the airborne combo line.
- Downhill speed should feed a readable curve or optional committed line.
- Alternate technical sections with fast release sections.
- Objectives can combine actions, such as maintain a speed threshold through a
  sector or chain a zipper into a ramp.

### Syndicate Run

Purpose: test route memory and chained execution.

- Denser events, but retain a valid clean line through every formation.
- Favor combo lines and open-lane gates, with shorter recovery spacing than
  Neon Gulch but no more than two technical geometry pieces back-to-back.
- Combo lines may require a mid-air lane change or quick return line.
- Use the sharpest curves after adequate sightline and braking room.
- Objectives can span a lap: ramps hit, hazards avoided, or a multi-part
  speed/air chain.

## Endless Mode

Purpose: turn the same readable racing language into an escalating survival
run. Endless Mode is not a separate ruleset or a dumping ground for random
objects. It should feel like campaign track grammar recombined under growing
pressure.

The implementation lives primarily in `src/road/EndlessTrack.js`. Shared road
construction, decoration, and object rules live in `src/road/RoadModel.js` and
`src/road/patterns.js`.

- Begin with a safe runway so the player can accelerate, confirm controls, and
  read the world before the first hazard.
- Generate far enough beyond the visible horizon that geometry and objects
  never appear in front of the player.
- Increase difficulty through sharper curves, shorter recovery spaces, fewer
  straights, stronger terrain, and tighter pattern spacing.
- Preserve at least one valid response to every formation, even at maximum
  difficulty.
- Keep cone language identical to campaign mode: cones resolve into rocks,
  never ramps or boosts.
- Maintain the read–choose–execute–payoff–breathe rhythm. Later difficulty may
  shorten the breath, but should not delete readability.
- Keep pickups useful and fair as the road is generated. A newly stamped
  pattern must reconcile with pickups and zippers that were placed earlier.
- Endless road coordinates and pattern cursors are absolute. Trimming old
  segments must not change cadence, repeat old content, move objects, or break
  collision lookup.
- Endless objects do not reset by lap because there are no laps. Passed road is
  eventually trimmed and discarded.
- Difficulty should plateau at a demanding but playable state rather than
  becoming mathematically unavoidable.

### Endless validation

Automated generation tests should cover growth and trimming over a meaningful
distance. Validate that:

- every cone warning receives a rock payload;
- every ramp has a visible yellow/cyan approach while remaining a raised
  launch object;
- no unresolved cone warning points at nitro or a ground zipper;
- formations are fully built before becoming visible;
- absolute segment indices continue increasing after trims;
- generation cursors always advance and cannot enter an infinite loop;
- the retained segment count remains bounded during a long run;
- a traversable lane remains available through wide formations.

Randomness makes a single playthrough weak evidence. When changing generation,
test multiple seeds or use a fixed seed that reproduces the relevant case.

## Visual presentation contracts

These presentation details are intentional parts of speed, readability, and
game feel. Treat them as design constraints when changing art, projection,
camera settings, HUD layout, or rendering—not as incidental implementation.

### World palette and depth

- Every campaign course has its own grounded near-future environment palette;
  Endless Mode uses the same system rather than a separate rendering rule.
- Atmospheric colors may change by course, but semantic driving colors do not:
  cyan/magenta mark powered road edges, green marks speed, yellow marks a ramp
  offer, and warm orange/red marks danger.
- Background contrast stays below road-object contrast. Windows and celestial
  lights should make the world feel inhabited without competing with a cone,
  zipper, runway, gantry, or pickup.
- Horizon scenery is deterministic code-native pixel art. Far and near layers
  follow projected road curves at different rates; their small travel drift
  must remain continuous across campaign lap wraps.
- Large trackside landmarks are anchored to absolute road segments and use the
  road projection, so they visibly approach and pass the player. Campaign
  landmarks repeat consistently each lap; Endless scenery cadence survives
  segment trimming. These objects are non-collidable and render below all
  gameplay props.
- Near-future landmarks favor recognizable infrastructure—renewables, power
  lines, commuter or freight corridors, and evolving city edges—over fantasy
  megastructures. The world should feel plausibly one generation ahead.

### Player car sprite

- `tools/gen-car.js` is the source of truth for `public/assets/car.png`.
  Regenerate the sheet from the low-poly model instead of painting individual
  frames, so every steering pose remains one coherent vehicle.
- The sheet contains five `64x56` frames in gameplay order: hard left, slight
  left, straight, slight right, hard right. Opposite steering silhouettes must
  remain mirrored.
- The car uses the game's low, directly-behind chase-camera perspective
  (`CAM_PITCH = 0`), not the overhead Mode-7 angle used by the F-Zero reference
  art. Every frame should remain substantially wider than it is tall, and the
  straight frame should clearly present the rear of the vehicle.
- The cockpit must read as glass at every yaw: a cyan teardrop dome with a
  visible reflection and a base that follows the sloping hull. Canopy rails,
  highlights, fins, or other accents must stay inside the vehicle silhouette;
  long floating bars or constant-height slabs become beaks, gun barrels, or
  disconnected overhangs in turning frames.
- The in-race car is bottom-anchored so scaling grows it upward onto the road,
  not below the canvas. `TUNING.carScale` is the shared size for gameplay and
  the title screen; the Projection Lab must initialize to the same value
  (currently `5`). A sprite with different visible bounds requires all three
  presentations to be checked together. Collision width remains the separate
  `TUNING.playerW` gameplay value.
- `tools/gen-car.test.js` protects the rear-view proportions, visible glass,
  frame dimensions, and left/right symmetry. Update the generator and its
  expectations together when deliberately changing the vehicle.

### Roadside speed pylons

- The paired roadside posts placed every ten segments are non-collidable speed
  markers shared by campaign and Endless Mode. Their repeated approach cadence
  helps the eye read velocity.
- Posts tagged `speedMarker` deliberately use same-scanline culling at the
  horizon. Their subtle wink as projected scanlines merge is an intentional
  speed effect. Gameplay objects and the start/finish gantry use strict
  occlusion and must remain stable.
- Do not replace both rules with one global sprite-culling rule: removing the
  post cadence weakens speed feel, while applying it to obstacles or the
  gantry makes important objects blink. Validate both behaviors after changing
  projection rounding, fog, draw distance, sprite pooling, or road culling.

### Start/finish line and timing gantry

- Campaign circuits have one start/finish landmark at segment `0`: a neon
  timing gantry plus checkered paint across the first three road segments.
  The same physical line is the rolling start, every lap crossing, and the
  finish. The first crossing begins lap one; later crossings complete laps.
- This is an intentional campaign-only feature. Endless Mode has no laps or
  finish and therefore does not create a gantry.
- The rolling grid begins `TUNING.gridSetback` behind the line (currently
  `6000` world units), making the landmark visible before the race starts.
  Changes to the setback must preserve that initial read and race-state wrap
  semantics.
- Gantry geometry must use the road segment's projected coordinates so its
  feet remain planted at the road edges through curves, hills, FOV changes,
  and lap wrapping. It uses strict road occlusion; rounded screen coordinates
  landing on the same scanline must not make it blink.
- Preserve the world-layer order: road below roadside props, gantry graphics
  at depth `6`, gantry label at `7`, speed streaks at `8`, and player car at
  `10`. The HUD runs in its own scene above the world.
- The current HUD-safe proportions are `1.55` times the projected road
  half-width for pylon height and `0.38` times it for beam height. At the
  `800x600` rolling grid, the beam begins around screen `y=126`, leaving about
  `60px` below the HUD's lower edge. If camera height, FOV, grid setback, HUD
  height, or gantry proportions change, recheck this clearance at race start
  and while approaching the line. The landmark should frame the road without
  owning the instrument band.
- Keep the angular dark-metal frame, cyan power cores, magenta/cyan edge
  lighting, checkered endcaps, and readable `START / FINISH` nameplate aligned
  with the game's neon road palette.

## Cross-mode change checklist

Use this checklist whenever changing the world, assets, or gameplay rules:

### World and track geometry

- Check authored campaign construction in `src/tracks/` and
  `RoadModel.buildFromData()`.
- Check procedural construction, difficulty scaling, horizon generation, and
  trimming in `EndlessTrack`.
- Confirm hills return cleanly on campaign loops and remain bounded in endless
  terrain.

### Obstacles, pickups, and track enhancements

- Add or update the shared definition and collision behavior.
- Add the asset to loading/rendering and verify its scale at near and far
  projection distances.
- Decide explicitly how campaign tracks place it.
- Decide explicitly how Endless Mode generates it and how its frequency scales.
- Check interactions with cones, zippers, ramps, rocks, dirt, airborne state,
  recovery time, and overlapping lanes.
- Update deterministic campaign tests and long-run endless tests.

### Rules, handling, and scoring

- Test the rule in both story races and Endless Mode.
- Decide whether it resets per contact, per lap, per race, or never.
- Confirm HUD, result screens, persistence, payouts, and wreck behavior in both
  modes.
- Check low speed, normal speed, overspeed, dirt, hills, airborne control, and
  post-impact recovery.

### Visual and audio assets

- Confirm the asset is loaded before every scene that uses it.
- Verify projection scale, anchor, collision width, visibility in fog, and
  palette contrast on road and dirt.
- For car changes, regenerate all five frames and recheck chase perspective,
  glass readability, steering symmetry, bottom anchoring, gameplay scale,
  Projection Lab default, title-screen scale, and collision independence.
- For roadside-post changes, preserve their intentional horizon cadence in
  both campaign and Endless Mode without making gameplay objects blink.
- For start/finish changes, verify stable culling, road-edge anchoring, layer
  order, rolling-start/lap/finish semantics, and HUD clearance at the grid and
  during approach.
- Ensure the silhouette communicates whether the object is harmless, helpful,
  optional, or dangerous before collision distance.
- Check repeated procedural use in Endless Mode for visual noise and
  performance, not only a single authored placement.

### Definition of done

A cross-mode change is complete when campaign behavior, Endless behavior,
automated tests, player-facing instructions, and this design brief agree.
If a feature intentionally belongs to only one mode, document that exception
where the rule is introduced.

## Objective and persistence direction

Track objectives should be data, not scene-specific code. A future track entry
can define stable objective IDs and typed rules such as:

```json
{
  "objectives": [
    { "id": "speed-demon", "type": "reach_speed", "value": 1.2 },
    { "id": "frequent-flyer", "type": "hit_ramps", "value": 3 }
  ]
}
```

Persist completion by track ID and objective ID. Runtime counters should listen
to gameplay events (`zip`, `ramp`, `pickup`, `hazard_hit`, speed samples, lap,
finish) so new objective types do not become hard-coded track exceptions.

## Playtest questions

- Can a first-time player explain what cones mean after one encounter?
- Can the player see at least one valid response before a payload arrives?
- Does every ramp lead to a payoff rather than arbitrary airtime?
- After a rock hit, is the player making interesting decisions again quickly?
- Does each track have a recognizable rhythm without relying on its name?
- Can a skilled player describe and deliberately repeat a faster line?
- Does Endless Mode preserve the same object language without producing
  unavoidable or visually contradictory combinations?
- After several minutes in Endless Mode, is difficulty coming from execution
  pressure rather than unreadable generation?
