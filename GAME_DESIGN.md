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

- **Cones are indicators.** A line of cones says that something is coming in
  that lane. For now, the payload is always a rock, ramp, or ramp-and-rock
  formation. Cones never announce nitro pickups or ground zippers. Cones are
  harmless and grant no reward. They communicate location without revealing
  which hazard/route offer is coming, so the player must decide whether to
  commit or move.
- **Rocks are momentum hazards.** They punish an unread or poorly executed
  line. They should not create unavoidable full-road walls.
- **Ramps are route offers.** A ramp should lead to a benefit: clearing a
  hazard, reaching a speed line, chaining fame, or satisfying an objective.
- **Zippers are execution rewards.** Their line should be visible early enough
  to choose, then demand steering precision at speed.
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
- Introduce isolated warnings before mixing payloads.
- Favor center-lane reads and obvious safe alternatives.
- Objectives should teach one action at a time, such as hit one ramp or cross
  two zippers in a lap.

### Neon Gulch

Purpose: teach momentum management across hills, dirt, and stronger curves.

- Nitro before sustained climbs.
- Downhill speed should feed a readable curve or optional committed line.
- Alternate technical sections with fast release sections.
- Objectives can combine actions, such as maintain a speed threshold through a
  sector or chain a zipper into a ramp.

### Syndicate Run

Purpose: test route memory and chained execution.

- Denser events, but retain a valid clean line through every formation.
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
- Keep cone language identical to campaign mode: cones resolve into rocks or
  ramps, never boosts.
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

- every cone warning receives a rock or ramp payload;
- no unresolved cone warning points at nitro or a ground zipper;
- formations are fully built before becoming visible;
- absolute segment indices continue increasing after trims;
- generation cursors always advance and cannot enter an infinite loop;
- the retained segment count remains bounded during a long run;
- a traversable lane remains available through wide formations.

Randomness makes a single playthrough weak evidence. When changing generation,
test multiple seeds or use a fixed seed that reproduces the relevant case.

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
