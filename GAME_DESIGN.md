# Rhythmic Ride — Track Design Brief

## Core promise

Rhythmic Ride is a pseudo-3D, flow-first arcade racer. Controlling the
car at speed is the main pleasure. Track objects create readable decisions
without repeatedly stopping the player's momentum.

The handling target sits between F-Zero's high-speed line management and the
route-and-objective play of SSX Tricky and Tony Hawk:

- **Speed creates risk.** Curves, slopes, dirt, and narrow lines become harder
  when the player protects momentum.
- **The road offers choices.** Safe lines preserve a run; committed lines earn
  speed, airtime, score, or objective progress.
- **Mistakes cost a beat, not the whole song.** Hazards punish the immediate
  line and combo, then return control quickly.
- **Tracks become learnable.** Campaign geometry and object placement are
  stable between retries and repeat on each lap. Endless mode stays variable.

Campaign and Endless Mode are two implementations of the same game language.
A rule, object, asset, physics change, or readability improvement is not
finished until its effect on both modes has been considered.

[training_levels.md](./training_levels.md) is the source of truth for ordering,
authoring, scoring, and validating Training mode lessons. Training is a focused
introduction to this game language and may declare narrow, documented exceptions
before Story mode recombines the learned skills.

## Show, then tell only when needed

Gameplay communication should be visual, animated, audible, and responsive
before it becomes a paragraph. Demonstrate the desired action with road shape,
object motion, control graphics, camera language, sound, and immediate reaction
to the player's input. Short text may name or reinforce what the player just
saw; it must not carry a lesson that animation or level composition could teach.

- Introduce a control beside the situation that needs it, not in a detached
  manual screen.
- Animate the relevant button and the car/world response together.
- Change the demonstration when the player supplies the correct input so the
  game visibly acknowledges understanding.
- Prefer recognizable silhouettes, color, motion, and spatial staging over
  sentences that pause play.
- Keep accessibility fallbacks and concise labels. “Show, don't tell” reduces
  reading dependence; it does not remove useful reinforcement.

For a control the player must learn, prefer performance-gated assistance. Offer
a safe, readable diagnostic challenge first. If the player demonstrates the
skill, stay silent. If the outcome shows confusion, freeze on the following
recovery beat, display the action outside the critical road view, require the
real input, acknowledge success, restore a fair setup, and resume only after
release. Do it once; repetition should come from driving, not recurring panels.

## Object language

- **Story and Training cones are authored targets.** Every one has a stable ID,
  belongs to a visible objective, and rewards deliberate contact with progress,
  points, and impact feedback. They never act as warnings. Endless alone keeps
  ordinary warning cones: a line says rocks are closing that lane, never that a
  ramp, nitro pickup, or ground zipper follows. See
  [training_levels.md](./training_levels.md).
- **Rocks are momentum hazards.** They punish an unread or poorly executed
  line. They should not create unavoidable full-road walls.
- **Ramps are route offers.** A projected yellow/cyan runway may identify the
  approach, but the ramp itself remains a distinct raised object with its
  existing jump physics. A ramp should lead to a benefit: clearing a hazard,
  reaching a speed line, chaining score, or satisfying an objective.
- **Zippers are execution rewards.** Their line should be visible early enough
  to choose, then demand steering precision at speed. Green zipper paint and
  yellow ramp-approach paint never overlap in the same lane; combo lines
  separate them with a short clean-asphalt beat.
- **Nitro is stored agency.** Place it before a climb or demanding section,
  but let the player choose when to spend it. Spending is not a single flat
  kick: tapping the boost button repeatedly stacks a higher top-speed
  ceiling (up to 1.65x maxSpeed at a full 3-slot stack), while holding it
  instead sustains the current ceiling for longer. Both spend the same bank,
  so the choice between a bigger burst and a longer cruise is the player's.
  A live boost's ceiling is a temporary, self-decaying override — see
  `src/entities/Boost.js` — never a change to the shared `overspeedCap` that
  zippers and downhill grades still clamp to.
- **Dirt is a deliberate tempo change.** Use it for a short handling test or
  alternate route feeling, followed by clean pavement where speed can rebuild.

## Track pacing grammar

A strong section usually follows:

1. **Read** — reveal geometry, route objects, and any Endless warning cones.
2. **Choose** — present a safe line and a committed line.
3. **Execute** — curve, zipper, ramp, hazard, or surface test.
4. **Pay off** — speed, air, combo, shortcut feeling, or objective progress.
5. **Breathe** — give enough clean road to re-center and read the next event.

Avoid placing a new decision inside the recovery window of the previous one
unless the section is explicitly a late-game combo line.

## Campaign track roles

### Training mode and Proving Ground

Training mode teaches one verb at a time on the shared Training Loop geometry;
the detailed curriculum and level contract live in
[training_levels.md](./training_levels.md). Cone Control is the first lesson:
cone-only, asphalt-only, and a fixed two-lap scored attempt. Its cone layout uses
straight runs, gentle tapers, a staggered two-route work zone, one airbrake
transfer, an explicit two-lane lap-choice fork, a clean `+8` diagnostic hairpin,
a performance-gated airbrake assist, a cone-filled recovery/setup sector, and a
fixed right-lane `-8` cone hairpin. Competent players are never paused. Missed
cones persist for lap two and lower the trophy if they remain at finish.

Hazard Weave is Training Level 2. Sixty-two rocks form twelve compact two-lane
closures that force ten side changes while leaving readable recovery between
formations. Individual rocks are staggered longitudinally and laterally so the
closures read as debris rather than repeated grids. Four interstitial cones
reward ordinary lane transfers; only two revisit the learned `+8` right-airbrake
and `-8` left-airbrake lines. The final seven-pair corridor shifts gently from
the right side to center for a sustained thread-the-needle finish. All six cones
persist once claimed and can be collected anywhere across the complete two-lap
run. Gold requires all six and a clean windscreen; Silver
allows one crack and Bronze allows three. Four cracks forfeit the trophy but
never completion or progression. Rock contact adds one of four persistent
camera-glass crack stages without reducing training speed or hull. At three
cracks, the red perimeter supports a larger windshield warning graphic whose
backdrop fades toward the center to preserve the road view. At four, the graphic
explicitly says training continues and the trophy is lost. Story and Endless
show the corresponding hull warning at 25 health and still wreck on the next
rock.

Redline, Air School, and Rival School are Training Levels 3, 4, and 5 on that
same geometry.
Redline teaches the boost gauge — tapping stacks the top-speed ceiling,
holding sustains it — read by the speed number and graded Bronze/Silver/Gold
on the highest tier reached; see [training_levels.md](./training_levels.md)
for its full contract. Air School introduces measured airtime, finite
forward-short/back-long active-aero glide control, precision landings that bank
the next boost, and a physically speed-gated full-road rock jump. Its live HUD
shows airtime, glide direction, boost/speed readiness, and non-punitive retry
feedback; its trophies reward carrying speed across the two-lap lesson. World
feedback mirrors the control state through short/neutral/long aero silhouettes,
finite trails, an apex pulse, visual hangtime tiers, and landing responses that
defer to the final clear/miss outcome. Flight itself is deliberately silent:
one compact ramp swoosh hands the audio mix to a single collision-resolved
landing beat. Held-boost audio also yields at ramp contact while its physics
continue through flight. Same-frame boost
and ramp contact merge into one launch beat instead of stacking popups, shakes,
or risers. Training result screens explicitly offer Retry and Race School.
Completion returns to the course grid with the finished lesson selected rather
than launching the next lesson automatically.

Air School remains the fourth normal sequential lesson, followed by Rival School.
A separate sixth course, Flight School, is the visible campaign-mastery unlock.
It remains locked until every Story Rival Race is Platinum: the player must
finish first and remove all three rivals on all three courses. Its focused tile
states `LOCKED — PLATINUM THE RIVAL RACES TO UNLOCK` until that condition is met.
Flight School adds a course-authored 2.4× lift multiplier to the existing finite
ramp flight, pitch, steering, airtime, and landing physics. It previews a more
flight-focused sequel while guaranteeing that every launch still returns to road.

The Trophy Room has two shoulder-tabbed pages. `L`/`R` (or keyboard `Q`/`E`)
switch between School Trophies and Player Records. The first page contains only
the six school results, stars, and all-Gold status. The second contains lifetime
totals, the complete style-reward reference, and achievement progress; zeroes are
shown explicitly rather than hiding records the player has not started.

Rival School introduces the Story campaign's moving opposition as a 35-second
base wreck score attack, not a boss or a lap-limited race. Exactly three
collision-capable rivals stay in circulation so the road retains passing space
and the encounter reads like a Burnout-style pack rather than a moving wall.
Players use familiar racing inputs: bank boost, line up a rival, and ram it
while boost is live for an instant wreck. As a lower-power alternative, two
committed non-boost side shunts against the same rival generation also wreck
it. The first side hit visibly staggers the car and announces that one hit
remains. No special attack-button timing is required. Ordinary rear contact
and passive rubbing produce a small physical ricochet but never accumulate
damage or earn credit. Each takedown awards one bounded boost slot.

Six one-shot green clock cones add two seconds each, up to 12 bonus seconds;
laps and checkpoints never add time. Five evenly distributed boost packs,
including one before the opening pack, keep the attack resource available
without granting permanent boost. A boosted wreck resolves as one short local
explosion—no barrel roll, detached car ghost, or cone-style secondary burst.
Its identity waits a seeded 2.2–3.4 seconds before
re-entering individually, never as a fixed formation. Most replacements appear
as distant quarry near the horizon; some approach from behind as challengers.
Entries are separated by at least 2.2 seconds, vary lane and distance, and keep
collision disabled during their fade. Passed rivals first chase back under
their own wheels and are repositioned only after falling genuinely off-camera.
Story races do not enable this training-only circulation director or its
proximity-staging fallback: passed rivals remain behind unless they drive back.
Contact debris clears before the next driving decision.

The course ribbon is a neutral loop locator showing the player and all three
living rivals by stable shape and color. TIME and TAKEDOWNS replace the
persistent objective checklist, lap count, and endpoint furniture. Every valid
wreck is exactly +1: Bronze is 2, Silver is 5, and Gold is 8. Zero earns no
trophy but still records completion and unlocks progression. Training attacks
use local windscreen feedback and a small momentum tax, never campaign hull or
a hard wreck. The score can exceed eight; the objective display may cap at its
authored goal, but results and persistence use the uncapped takedown count.

Proving Ground is the first Story course and the welcoming application of Race
School skills. It is a new long-form route rather than a copy of the school
loop. Its six boost-to-launch cycles introduce Story's authored cone targets,
mixed surfaces, optional committed lines, and broad passing zones.

Every Story course has two events on the same route. **Beat the Clock** is a
solo one-lap qualifier whose authored target unlocks that course's **Rival
Race**. Rival Race runs three laps and adds exactly three finite opponents:
lap one is the read, while later laps reward optimized boost and damage-free
lines. The player can win by
out-driving them or remove them with takedowns. Results persist separately and
both events return to the Story submenu instead of advancing automatically.
Winning the race earns Gold; winning while removing all three finite opponents
earns Platinum and marks the course 100% complete.
The live placement chip counts opponents left rather than reporting takedowns.

Story difficulty is physical rather than theatrical. Each course repeats
thread-the-needle rock gates between its launch cycles, every gate leaves a
traversable response, and collision avoidance matters because Story damage has
an immediate low crash, hull callout, speed loss, shake, and car flash. Speed
lines answer with an aerodynamic rush, screen streak bloom, camera kick, and a
short expanding energy ring. Manual boost uses a longer filtered wind swoosh
with a quiet rising engine bed rather than a spring or impact contour. Story
ramps retain the live airtime timer and landing value learned in Air School.

Story also names repeatable skill sequences as **Style Rewards**: five distinct
cones, three distinct road Speed Lines, qualified boosted hangtime, a tier-three
boost, and a sustained Long Burn. Rewards use an ordered action-sports
celebration lane and feed versioned lifetime records shown in the Trophy Room.
The complete trigger, persistence, accessibility, and future asynchronous
multiplayer boundary is specified in `STYLE_REWARDS.md`.

### Neon Gulch

Purpose: teach momentum management across hills, dirt, and stronger curves.

- Nitro before sustained climbs.
- Alternate crest/sweeper and compact chicane sections with straight settling
  zones; its authored pattern sequence introduces the airborne combo line.
- Downhill speed should feed a readable curve or optional committed line.
- Alternate technical sections with fast release sections.
- Seven boost-to-air cycles build from readable crest launches into dirt
  transfers and linked airbrake choices.
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
- Eight long-form cycles create one substantial finale lap; route memory comes
  from how each landing sets up the next precision beat, not from repeating the
  same short lap.

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
- Keep Endless cone language internally consistent: its ordinary warning cones
  resolve into rocks, never ramps or boosts. Story and Training instead use
  stable-ID objective cones as defined above.
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
- The sheet contains three rows of five `64x56` frames: nose-down, neutral,
  and nose-up. Every row retains gameplay steering order—hard left, slight
  left, straight, slight right, hard right—and opposite steering silhouettes
  must remain mirrored. Airtime pitch eases toward the analog glide input and
  returns through neutral after contact; it never reuses screen-space roll as
  pitch because that would conflict with the steering read.
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

### Projection Lab

- Track, Audio, Physics, Handling, Camera, Graphics, and Status controls live in
  separate collapsible groups so the active tuning surface can remain visible.
- Music and SFX sliders update their independent audio buses during a race.
  Their values persist through scene and track changes for the current session.
- Keep control defaults synchronized with `TUNING`; a lab value must not silently
  change production behavior just because a race scene initializes its hooks.

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

### Music

- [MUSIC_DESIGN.md](./MUSIC_DESIGN.md) is the source of truth for composing,
  arranging, mixing, implementing, and reviewing the code-generated score.
  Read it before changing a theme or `MusicEngine.js`; the rules below are the
  non-negotiable summary shared with the wider game design.
- `src/audio/MusicEngine.js` synthesizes every track live (no audio files) —
  see its header comment for the scheduling model and the shared instrument
  set (bass, lead, keys, pad, kick, snare, hat) that every theme is built
  from.
- A racing track's loop (`bars.length * stepsPerBar` steps at its `bpm`) must
  run **at least 30 seconds**. Shorter loops read as visibly repetitive under
  several minutes of driving — the loop point becomes audible instead of
  disappearing into the background the way a racing score should.
- The garage is an explicit short-stay exception: its loop may run **16–24
  seconds** because repairs and upgrades usually finish quickly. A short shop
  cue still needs a complete harmonic phrase, an audible variation, and a
  deliberate turnaround so a longer visit never sounds like a broken loop.
- Each theme keeps its own key, chord progression, and melodic/bass material
  — reusing another theme's progression or riff, even for tracks that share
  a production brief (e.g. two synthwave-styled themes), collapses their
  identities into each other. Shared production techniques (a voice, a
  drum pattern, a mix trick) are fine to reuse; shared songwriting is not.
- **The score is futuristic first.** This is a futuristic racer; every
  theme's core identity comes from unapologetically synthetic sources —
  FM grit, detuned saw stacks, gated arps, sidechain pump, drum-machine
  transients. Voices that imitate acoustic instruments (guitar chugs,
  acoustic-kit snare character, and similar) may appear as accents inside
  a bar, but must never carry a theme's identity — a listener should never
  place the score in a past decade's garage or arena.
- Within that palette, pop energy is welcome: hooks, funk syncopation,
  major-key brightness, and danceable grooves are how themes get
  personality. "Futuristic" constrains the *timbre*, not the *fun*.

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

Track objectives are data, not scene-specific code. Training and Story may ship
a `hit_all` objective linked to authored cones by stable IDs. Story courses also
use `complete_laps` and `count_event` goals for ramps, speed lines, and rival
takedowns. Rival-only goals are hidden during the solo qualifier. Each objective
has a point value; normal objectives contribute it only when complete.
Collection lessons may use `pointsPerUnit` when partial progress is itself the
scored result.

```json
{
  "objectives": [
    { "id": "finish", "type": "complete_laps", "value": 3, "points": 1000 },
    {
      "id": "frequent-flyer",
      "type": "count_event",
      "event": "ramp_hit",
      "value": 3,
      "points": 750
    }
  ]
}
```

Persist completion by track ID and objective ID. Training stores completion and
the best trophy separately: completion unlocks the next lesson, while the best
Bronze/Silver/Gold result contributes one/two/three non-farmable trophy stars to
future optional gear, mods, cosmetics, or tracks. Runtime counters listen to
gameplay events (`object_hit`, `zipper_hit`, `ramp_hit`, and `lap_complete`);
future pickup, hazard, speed, and finish goals should extend that event language
rather than becoming track-ID branches.

Objectives animate into an acknowledged pre-race briefing. Movement and race
time remain paused until A or Enter dismisses it. The paused briefing may show
the complete goal and trophy requirements; those details do not remain on the
driving view. Time-based race cash remains separate from objective score until
the economy has enough playtest evidence to price goals. Briefings state
purpose; contextual animation teaches execution. If a briefing needs several
sentences to explain an input, the level is missing a demonstration.

Objective completion has one shared visual contract. Training lessons without
a dedicated live coach use white open markers; the completed row alone changes
to a green check and receives one restrained pulse. Air School and Story replace
the list with a short green edge confirmation so a checklist never competes
with live maneuver feedback. The checkmark carries the state without depending
on color alone. Scene restarts and reconstructed training HUDs derive checked
state from `ObjectiveState`, not from whether a one-time animation previously
ran. Any new training course must be audited against this contract.

### Driving HUD hierarchy

The active HUD follows a modern arcade hierarchy while retaining the game's
cyan/magenta/gold pixel language:

- Circuit races show one numbered START-to-FINISH ribbon. There is no duplicate
  persistent `LAP x/y` chip; authored Training lap-two instruction may appear
  briefly when the lesson changes.
- Endless shows distance and best distance instead of a finite-course ribbon or
  a static `DRIVE AS FAR AS YOU CAN` mission card.
- Speed stays bottom-right. The boost bank appears only where the track supports
  boost and communicates its live tier through shape, fill, color, sound, and
  vehicle response.
- No mode displays a hull bar. Windshield crack stages, collision response, and
  the conditional critical warning are the driving-view health language; exact
  hull and repair values belong in the Garage.
- Story objectives remain authoritative but are shown through course objects,
  maneuver feedback, and a short edge completion toast. They return in paused
  briefing and results views.
- Training may show one compact checklist only when no dedicated live lesson
  coach exists. Air School's timer/control/speed coach replaces its checklist.
- Trophy thresholds and objective point accounting never persist during active
  control. They belong in the paused briefing and result screen.

At the logical 800x600 resolution, persistent teaching UI stays inside the left
column `x=10..240`; the player/road corridor `x=250..550, y=170..600` is clear.
The course ribbon ends at `y=52`. Contextual completion lasts about one second,
and normal driving never places a panel over the car. Layout, font, scale, or
camera changes require this clearance contract to be rechecked.

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
