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

## Object language

- **Cones are indicators.** A line of cones says that something is coming in
  that lane. Cones are harmless and grant no reward. They communicate
  location, not payload, so the player must decide whether to commit or move.
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
