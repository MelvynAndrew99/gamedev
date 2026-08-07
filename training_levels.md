# Destruction Racer — Training Level Design

This document is the source of truth for building Training mode lessons. Read it
with [GAME_DESIGN.md](./GAME_DESIGN.md): the main brief defines the driving
language, while this brief defines how that language is introduced without
punishing a new player for learning it.

## Training promise

Training is play, not an exam. Each lesson gives the player a fast car, one
clear verb, immediate progress, and enough clean road to try again without a
restart. Difficulty comes from improving a line, not from damage, lost money,
or a fail screen.

- Teach one new action at a time.
- State the objective as a verb the player can perform now.
- Remove HUD systems and interactive objects that the lesson has not introduced.
- Keep the car moving; a mistake lowers the mastery result, not the run.
- Give scored lessons a fixed, stated endpoint so misses never create a sparse
  cleanup lap.
- Unlock the next lesson on completion. Use trophies for mastery and optional
  unlocks, not as a gate that stops a new player from continuing the curriculum.

Training mode is intentionally separate from Story mode on the title screen.
The first Story race is the Proving Ground: it reuses the Training Loop geometry
with campaign objects, rules, and reads so the player validates the learned
skills in a real race.

## Shared loop, focused lessons

`src/tracks/training-loop.json` owns the first lesson's authored targets.
`src/tracks/training-hazard-weave.json`,
`src/tracks/training-top-speed.json`, `src/tracks/training-airtime.json`, and
`src/tracks/training-validation.json` mirror its `pieces` for the rest of the
initial curriculum and the first Story race. Automated tests protect that
geometry parity.

Training lessons should reuse the same loop while changing only their objective,
interactive objects, instructions, and any explicitly introduced HUD systems.
If the curriculum eventually needs several variants, keep the shared `pieces`
in one code-level source rather than allowing copied JSON arrays to drift.

Non-collidable scenery, the timing gantry, and roadside speed pylons remain in
training. They establish place, show the lap boundary, and make speed readable;
“one interactive object” does not mean an empty world.

## Race and scoring contract

- A scored collection lesson has a fixed lap budget. Cone Control always ends
  after two completed laps.
- The result is based first on the taught behavior: cones hit. Time is a
  secondary record and must never compensate for missing the lesson objective.
- Completed targets stay consumed across laps; missed targets remain available.
- Per-target points ensure partial success is visible: Cone Control pays 100
  score per cone, up to 6000.
- Cone Control awards Bronze at 40, Silver at 54, and Gold at all 60 cones.
- Completing the two laps marks the lesson complete and can unlock the next
  lesson regardless of trophy. The best trophy contributes one, two, or three
  trophy stars toward future gear, mods, cosmetics, or optional tracks.
- Store only the best result per lesson. Replaying an earned trophy improves the
  record but cannot repeatedly farm its stars.
- Training awards no money, nitro, health, or campaign payout.

For the first lesson, each cone launches away, sheds pixel sparks, kicks the
camera, and plays one of five short composite impacts. Every impact layers a
low body thump, midrange plastic knock, and restrained high crack so it feels
full instead of chirpy. The pool changes each layer's tuning, filter, timbre,
level, and stereo position and never repeats the same balance twice in a row.
Each tenth cone escalates toward the chase camera; cone 60 receives the
completion hit. Objective points and the trophy result reward mastery without
turning contact into money or a speed buff.

At race start, an objective briefing animates onto the world view one row at a
time. Movement and the race clock remain paused, and the briefing stays visible
until the player presses A or Enter. It then dismisses into the persistent HUD
panel. The HUD replaces the old Fame panel across Training and Story, shows live
progress and points, checks off completed goals, and changes its header to
`FINISH THIS LAP` when an objective race is armed.

Training demonstrates a mechanic before explaining it at length, but it does
not interrupt a player who has already demonstrated understanding. Cone Control
first presents a long, clean `+8` diagnostic hairpin with no cones. At normal
training speed, even a well-timed ordinary-steering line starting in the
advantageous right lane crosses the road edge, while steering plus R1/X stays
inside it. Staying on the road
silently passes the check and the race continues. Touching the shoulder during
that bend schedules help on the following recovery straight: the first lap
freezes, recenters the car, restores a useful speed floor, and opens a short
input rehearsal in the upper-right sky. The player performs `VEER RIGHT` and
then `VEER LEFT` using R1/L1 on a connected pad or X/Z on keyboard. Large,
high-contrast button glyphs turn green for each real input. The road, cone line,
race clock, and car remain frozen until both inputs are demonstrated and
released. The assist then disappears and never returns on lap two. This
performance-gated practice is the lesson; text is an action label, not a
paragraph over the racing line.

## Lesson 1: Cone Control

**Player sentence:** Plow through the traffic-cone lines, then use lap two to
clean up whatever you missed.

**Skill:** smooth high-speed steering, early visual acquisition, controlled
lane changes, one shoulder-airbrake transfer, a committed airbrake hairpin, and
re-centering between inputs.

The lap is a roughly 2.8 km asphalt loop. Curve strength rises from broad `±1`
sweepers to `±2`, then the long cone-free `+8` check. A long recovery straight,
gentle `-3` bend, and second straight carry a cone setup line before the final
`-8` hairpin. The setup deliberately places the car in the outside-right lane:
even optimized ordinary steering loses the road, while left steering plus L1/Z
balances the car against the curve and holds one fixed right-lane cone line.
The stock car is not asked to cross the road mid-hairpin; tighter line changes
belong to future steering and airbrake upgrades. Straights separate the
diagnostic, feedback, setup, and final application.
There is no dirt, elevation test, nitro, zipper, ramp, or rock.

Sixty cones form seven recognizable traffic-control phrases instead of
identical gates: an eight-cone straight smash line, an eight-cone merge taper,
two four-cone staggered work-zone lines, a three-cone choice fork, a nine-cone
left-to-right transfer, a twelve-cone outside-lane setup, and a twelve-cone
right-lane hairpin line. The fork has one center entry followed by left and
right cones at the same distance; collision width makes them mutually exclusive
on one pass, guaranteeing a meaningful target for lap two.
Small offset changes in the straight, taper, and setup reward ordinary steering
rather than demanding an airbrake on every read. The transfer invites L1/R1;
the final hairpin validates left steering plus L1/Z under real corner pressure
without demanding an unsupported cross-track sweep.

The staggered work-zone section interleaves four cones on each side. Its seven-
segment spacing makes switching sides after every cone impractical, but the
cones are not paired at the same distance. The player chooses a satisfying line
on lap one and can take the complementary line on lap two. Misses elsewhere also
remain available, so lap two is genuine recovery rather than a second perfect
script. Do not refill the course procedurally: stable placements let the player
build route memory and attribute improvement to their own control.

**Active playtest response:** the earlier short diagnostic could be bypassed by
entering on the right, and its immediate cone turn did not leave enough time to
observe failure. The length-32 diagnostic is protected by a right-lane handling
test. The explicit two-lane fork guarantees a lap-two choice, while twelve setup
cones and twelve fixed-lane hairpin cones create a full play sector between
diagnosis and final application. Continue measuring second-lap density; the
added line should create meaningful cleanup, not merely raise the count.

## Lesson 2: Hazard Weave

**Player sentence:** Follow the open line through the weaving rocks and reach the
finish with a clean windscreen.

**Skill:** read a bending line of hazards, steer continuously to stay on its open
side, and recover after a clip.

**Show, don't tell.** The intro is two clauses — *"Rocks cause damage. Avoid the
rocks."* — and never explains the mechanic. Rocks are strung one behind another
into long lines whose lateral offset marches back and forth across the lanes, so
the open racing line keeps sliding and the player has to keep steering to trace
it. Roughly a hundred rocks fill seven weaving runs across the whole loop
(gentler, lower-amplitude bends through the two hairpins so the corner and the
slalom don't fight), separated by short clear breathers, and they reset at the
line so both laps rehearse the same weave. There are no gates to thread and no
text telling the player which lane is open.

The mechanic is taught the way Lesson 1 rehearses the airbrake: only once the
player proves they need it. The first time the car actually clips a rock, a
one-time notification appears — *"Rocks crack your windscreen / Steer around them
to stay clean / Finish with no cracks for Gold."* A player who reads the line and
never touches a rock is never interrupted.

Two smaller touches sit on top of the weave. At three pinch points — where a rock
strand bulges out to one edge — a few cones are laid along the *open* edge to bait
the fast line, reusing Lesson 1's "drive here" cue as a lure rather than a
collectible (they carry no objective and no penalty). And the loop ends with a
short, gentle thread-the-needle corridor: parallel rock rails on the final
straight form a ~0.8-wide channel whose center drifts slightly, so the player
follows a lane down the middle. It sits on the easiest geometry (a straight) and
is deliberately roomy — a fun capstone that rewards a steady hand, not a
precision gate that punishes.

Rock contact has four visual stages drawn as cracks on the camera glass. It does
not reduce speed, campaign hull, money, objective score, or access to the finish,
and it never wrecks the player. The tiers grade only steering and damage:

- **Gold** — zero cracks *and* every edge cone collected on the finishing lap.
- **Silver** — zero cracks.
- **Bronze** — fewer than four cracks.

Four cracks earns no trophy but still completes and unlocks the next lesson, so
progression is never blocked. Cones only ever separate Silver from Gold — they
prove mastery of movement and damage and never gate anything else. The rest of
the track exists to teach one thing: rocks cause damage, so avoid them.

Cone contact now bursts and pops in every mode. The smash juice used to fire only
when a cone belonged to a sweep objective (Lesson 1); it is now a property of the
cone itself, so the loose warning cones in Endless and campaign — and Hazard
Weave's edge lures — all react when struck.

The finish result is the reward transition. It plays a short fanfare, bursts
confetti, calls out a perfect clear when appropriate, and records the best
trophy. An explicit result menu offers `Retry`, `Next Track`, and `Title` when a
finished successor exists. The final available lesson offers `Retry` and
`Title` while naming the next staged lesson as coming soon. Keyboard, controller,
and pointer input must expose the same choices.

## Staged lessons

Training Track 3, **Redline**, reuses the loop on clean asphalt and will teach
the player to reach and recognize top speed. It is currently a locked data
placeholder. Before enabling it, define how long maximum speed must be held,
author speed-retention trophy tiers, connect the `top_speed` event, and verify
that roadside motion, engine audio, and speed streaks communicate the state
without needing hazards.

Training Track 4, **Air School**, introduces ramps and an airtime objective.
Four gold/cyan ramp approaches are staged around the shared loop for the first
playtest. Before enabling it, score measured airtime rather than ramp contact,
tune landing feedback and trophy tiers, and verify that ordinary steering is
enough for the introductory route before asking for airborne airbraking.

`status: "placeholder"` keeps a staged track visible in the ordered curriculum
data while preventing normal completion progression from selecting or launching
it. Remove that status only when its gameplay event, HUD language, scoring, and
result copy are implemented and playtested.

## Cone semantics

Objective-linked cones are a Training mode exception to the campaign warning
grammar. Their objective is explicit in the intro and HUD, and contact is
harmless. They grant progress, objective points, and audiovisual contact
feedback but no economy reward.

In Story and Endless modes, ordinary cones remain danger warnings that resolve
to rocks. The Proving Ground must explicitly restate that warning meaning before
using it. If target cones ever appear alongside warning cones in one course,
they need a distinct visual treatment before that course can ship.

## Track data contract

A training course uses stable IDs so objective progress survives lap wraps:

```json
{
  "laps": 2,
  "finish": "laps",
  "objectives": [
    {
      "id": "cone-sweep",
      "type": "hit_all",
      "target": "cone",
      "label": "HIT ALL 60 CONES",
      "hudLabel": "HIT CONES",
      "pointsPerUnit": 100
    }
  ],
  "scoring": {
    "type": "trophy",
    "version": 3,
    "objective": "cone-sweep",
    "thresholds": [
      { "rank": "gold", "minimum": 60, "stars": 3 },
      { "rank": "silver", "minimum": 54, "stars": 2 },
      { "rank": "bronze", "minimum": 40, "stars": 1 }
    ]
  },
  "objects": [
    {
      "id": "straight-01",
      "at": 80,
      "kind": "cone",
      "offset": -0.1,
      "objective": "cone-sweep"
    }
  ]
}
```

- Objective IDs and object IDs must be unique and stable.
- `objective` links an authored object to one goal and makes its hit persistent.
- `at` is an exact segment; `offset` uses road-half coordinates.
- `finish: "laps"` ends the scored attempt at its authored lap count even when
  mastery remains incomplete.
- `pointsPerUnit` opts a collection objective into partial score; normal Story
  objectives still pay their authored `points` only when complete.
- `scoring.thresholds` owns trophy balance. UI and persistence read the data;
  never hard-code Cone Control thresholds in a scene.
- `scoring.version` invalidates an obsolete best result when target counts or
  trophy rules change during development.
- `maximumDamageHits` adds a damage ceiling to one trophy threshold without
  turning damage into a run-ending condition.
- `trainingDamage.maxHits` enables camera-glass cracks and clamps their visual
  stages; it never opts into campaign hull behavior.
- New objective types belong in the pure objective system and should consume
  gameplay events; do not add track-ID branches to `GameScene`.
- Disable unintroduced automatic decoration explicitly (`nitro`, `zippers`).

## Curriculum order

The initial Training mode track list is fixed in this order:

1. Cone Control — steering and line acquisition; cones only, no damage.
2. Hazard Weave — follow target cones through rocks and read camera damage.
3. Redline — reach top speed and learn its handling/audio/visual state.
4. Air School — acquire ramp approaches and build controlled airtime.

Warning reads, zippers, stored nitro, surface changes, and combo lines remain
future curriculum candidates. Proving Ground combines the completed curriculum
as the first Story race; it is not a fifth Training track.

Later lessons may add optional mastery targets, but their required objective
should still teach one new verb. Combining skills is validation, not introduction.

## Definition of done

A training lesson is ready when:

- its objective, target IDs, point values, finish-line behavior, HUD, and result
  copy agree;
- only introduced interactive objects and mechanics are active;
- missing a target never forces a restart;
- required targets cannot disappear on a lap reset;
- repeated contacts have distinct impact motion, sound, and milestone feedback;
- the objective briefing pauses the run and remains until explicit confirmation;
- a new control is demonstrated with motion, input graphics, and responsive
  feedback before relying on instructional prose;
- every fixed lap contains meaningful targets and no miss creates a cleanup lap;
- Gold is possible through a deliberate route and the one-lap exploit is not;
- completing the lesson and earning its trophy are recorded separately;
- training damage cannot reduce speed, hull, money, or access to completion;
- a completed lesson presents explicit retry, next-track, and title actions;
- placeholder lessons cannot become selectable through normal progression;
- Story validation reuses the geometry without silently changing its handling;
- focused tests and the production build pass;
- a new player can state what they learned after finishing.
