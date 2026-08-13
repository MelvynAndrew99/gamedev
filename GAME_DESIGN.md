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
A separate sixth course, Flight School, remains visible in the jam build as a
`SOON` preview tile. It cannot be launched from the player-facing Race School
menu and is excluded from School trophy totals even when every Story Rival Race
is Platinum. Its implementation remains available through Projection Lab for
development, and its `Cloudline Promise` theme remains playable in the unlocked
Music Player. See `FLIGHT_SCHOOL_README.md` for the post-jam handoff and the
steps required to restore its original Story-Platinum release gate.
Flight School is not an extension of Air School and is never added to Endless,
Story, or the ordinary Race School courses. It is a self-contained post-game
thank-you and a playable preview of the paid sequel. The familiar car, boost,
music, precision language, and existing 5×3 steering/pitch sprite sheet carry
forward, but the player begins Flight School already airborne at cruise speed.
There is no downhill launch run, ramp, chasm, road-surface lesson, or missed-
takeoff restart. The course teaches flight from its first controllable frame.

Steering banks left/right, W/S or the vertical stick controls pitch and altitude,
Circle/B (or the normal brake input) scrubs airspeed, and the existing boost adds
afterburner thrust. The lesson begins with a full three-slot boost bank rather
than placing ground pickups before flight. Forward flight is automatic, so
throttle is not an extra lesson requirement. Ten large neon flight rings form the
complete objective route. Their early placements teach altitude gently before
later rings ask for combined vertical and lateral precision. A ring miss lowers
the result but does not destroy the player: Bronze requires six, Silver eight,
and Gold all ten.

Flight response is deliberately arcade-readable rather than simulated. Pitch
quickly commands a bounded climb or dive rate, then self-levels when released;
bank follows the horizontal input with stronger shoulder-airbrake commitment.
The craft retains forward momentum, familiar boost adds afterburner speed, and
the aerial brake trades that speed for setup time. The middle route passes
through Aurora Concourse, a wide open-atrium building with target rings fully
inside its entrance and exit. Flying through is the showcase line, while a
missed ring leaves a safe exterior route and costs only trophy progress.

Flight School takes place at Aurora Skyport, canonically separate from Race
School's coastal proving ground. It is an inhabited highland academy district,
not an open-sky race course: dark steel towers, habitat terraces, skybridges,
misty green terrain, and a narrow cyan transit spine all belong to the same
physical location. Aurora Concourse spans that route as a monumental open
atrium; the craft approaches, enters, and exits its solid projected frame while
following rings five and six. That transit spine exists only in the environment
art: Flight School draws no procedural road, translucent guide channel, roadside
posts, checkered line, or start/finish gantry over it.

The visual hierarchy uses near-black navy, graphite, steel blue, electric cyan,
ice white, and restrained amber windows. Violet, magenta, and coral are not the
level's dominant atmosphere. The project-owned generated plate is stored as
`public/assets/flight-school-city-v2.png`. It was generated with the two local
concept paintings as palette, architecture, and composition references while
explicitly excluding vehicles, HUD, text, rings, logos, floating light strips,
and recognizable third-party locations or trade dress. Live road projection,
architectural occlusion, rings, vehicle, motion, and HUD remain separate game
layers rather than being baked into the image.

Flight School has its own modern instrument layout instead of inheriting Air
School's coach card. A chamfered upper-left mode/ring read, thin top course
progress rail, and compact lower-right speed read keep the center flight
corridor open. The authored rings themselves are the flight targets; no central
crosshair or targeting reticle is drawn. During sustained flight, the existing atlas
bank and pitch poses plus continuous engine thrust communicate motion. Finite
jump squash/stretch, arc lift, ground shadow, apex halo, hang-time tiers,
active-aero vanes, landing burst, and `AIRTIME`/`LANDED` copy remain exclusive
to ordinary jumps and Air School.

When Flight School is restored after the jam, completing the one-run course
completes the game and displays a thank-you/sendoff
for *Rhythmic Ride*, followed by the original teaser: “THE ROAD WAS ONLY THE
BEGINNING… FLIGHT RETURNS IN RHYTHMIC RIDE 2.” Flight School awards its normal
training trophy but adds no repeatable economy payout and unlocks no further
content. Its purpose is to end this free game on a new mechanical promise and
leave players interested in the sequel, not to silently change the base game's
racing or Endless rules.

The Trophy Room has two shoulder-tabbed pages. `L`/`R` (or keyboard `Q`/`E`)
switch between School Trophies and Player Records. The first page contains only
the six school results, stars, and all-Gold status. The second contains lifetime
totals, the complete style-reward reference, and achievement progress; zeroes are
shown explicitly rather than hiding records the player has not started.

Story uses the same shoulder-tabbed submenu pattern. `L`/`R` (keyboard `Q`/`E`)
switches between Course Select and Pit Garage without leaving the front end.
Both pages share the existing `Chrome & Credits` shop cue, which begins on
entry to Story and continues uninterrupted across tab changes. Story results
and wrecks return to this submenu with the Garage tab open; a wreck applies the
existing emergency tow once. Repairs, wallet, and remaining hull survive the
tab switch back to Course Select and the next Story launch; entering Story from
a fresh title-menu session retains the normal fresh-run reset.

Story hull damage persists through its Garage economy. Endless is deliberately
isolated: every distance attempt starts at full hull, damage lasts only for that
attempt, and returning to the title reveals the unchanged Story hull. Refreshing
or wrecking during Endless can never overwrite the saved Story condition.

During a live Story or Race School event, `Start`, `P`, or `Escape` opens the
pause overlay and freezes simulation, clocks, HUD motion, music, and sound. The
three actions are Resume, Restart Event, and Exit to Course Select; D-pad/arrows,
confirm/back, and pointer input all share the same selection. Restart preserves
the current Story hull and does not refund race-prep items already consumed at
the rolling start. Endless intentionally has no pause overlay: its single-run
distance challenge retains the existing immediate-exit behavior on `Escape`.

Buying the Music Player opens a full soundtrack library inside the Garage.
Discovered themes show their title and BPM; undiscovered themes remain anonymous
locked slots. The player supports cursor/pointer selection, play, pause,
previous/next shoulder shortcuts, and a close action. The current soundtrack is
generated live by the tracker engine rather than loaded from external audio
files, so choosing a theme starts its authored arrangement directly.
The Music Player contains one strongest production mix per composition.
Superseded drafts do not appear as near-duplicate soundtrack entries; the
garage uses the hook-forward `Chrome & Credits` production mix.

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
- Each environment combines two scales: frequent small infrastructure supplies
  peripheral speed cues, while rarer signature silhouettes provide memorable
  route identity. Signature objects stay farther outside the shoulders and
  may never obscure the driving line. Race School uses the same vocabulary at
  lower density and scale so it continues to read as a controlled lesson site.
- Near-future landmarks favor recognizable infrastructure—renewables, power
  lines, commuter or freight corridors, and evolving city edges—over fantasy
  megastructures. The world should feel plausibly one generation ahead.

### Player car sprite

- `art/pulsewing-concept-v1.png` is the original image-generated art-direction
  source for the Pulsewing hover racer. It is deliberately not shipped as a
  loose game sprite. `tools/gen-car.js` deterministically isolates, cleans,
  mirrors, anchors, and separates it into the synchronized runtime atlases
  `car-v2.png`, `car-v2-paint.png`, and `car-v2-detail.png`.
- Each runtime sheet is an exact `640x336`: three rows of five `128x112`
  frames. Source rows remain stable for deterministic generation; the runtime
  maps the visually verified upper/lower silhouettes to nose-up/nose-down so
  controller pitch agrees with the chase view. Columns remain hard left,
  soft left, straight, soft right, and hard right. Opposite steering poses are
  exact mirrors of one authored side, and all fifteen poses share one center
  and bottom contact anchor. Airtime pitch returns through neutral after
  contact and never substitutes screen-space roll for pitch.
- The vehicle uses a low rear-chase view: its stern, twin propulsion housings,
  integrated glass canopy, underbody, and shallow V tail are the first read.
  The hard-turn frames add an attached active-airbrake silhouette; the soft
  poses remain unmistakably between neutral and hard commitment.
- Rival identity is a material operation, not a whole-sprite tint. The
  grayscale paint atlas receives the livery color while the detail atlas keeps
  the canopy, engine cores and rings, pearl structure, gold tempo stripe, and
  dark outline unchanged. Player, title, and rivals all use the same layered
  sprite factory and the same frame policy.
- The in-race and title vehicles are bottom-anchored so scale grows upward onto
  the road. Their display scales are independently calibrated from the same
  measured opaque hull width because their compositions have different space;
  rival perspective sizing uses that hull ratio rather than transparent frame
  width. A road-bound contact shadow shrinks and fades as the car rises so jump
  height remains readable while the chassis never looks pasted onto the road.
  Collision width remains the independent `TUNING.playerW` gameplay value.
- `tools/gen-car.test.js` protects deterministic regeneration, atlas order,
  hard alpha, rear-view proportions, twin propulsion, canopy/detail survival,
  mirrored yaw, distinct pitch, active-airbrake cues, shared anchors, and the
  paint/detail partition. `VehicleSprite.test.js` protects frame synchronization
  and material-safe livery/damage tint restoration.

### Projection Lab

- Track, Audio, Physics, Handling, Camera, Graphics, and Status controls live in
  separate collapsible groups so the active tuning surface can remain visible.
- The Course selector also exposes `TOOLS — TRACK EDITOR`. This developer-only
  shortcut opens `TrackBuilderScene` directly and deliberately bypasses the
  player-facing completion gate; it does not unlock Track Builder in saved
  progression or create a race attempt.
- Music and SFX sliders update their independent audio buses during a race.
  Their values persist through scene and track changes for the current session.
- Keep control defaults synchronized with `TUNING`; a lab value must not silently
  change production behavior just because a race scene initializes its hooks.

### Custom Track Builder

- Track Builder is a visible destination in the title carousel alongside the
  other modes. It remains locked until the player finishes all five
  released Race School lessons and has completed at least one attempt of both
  Story event types on all three courses. Trophy rank, finish position, and
  takedown count do not affect this unlock. Endless and the `SOON` Flight School
  preview are deliberately excluded because neither has a normal completion.
- The builder is a top-down tile deck over an 8×8 canvas. Road tiles are dragged
  onto the one pulsing open connection, guaranteeing a single bounded route the
  pseudo-3D renderer can race without intersections or branching. Straight,
  left bend, right bend, hill, dirt, and chicane tiles compile into the existing
  `pieces` schema; this is presentation over the established linear road model,
  not a second incompatible track engine.
- Cones, rocks, boost pickups, and ramps layer onto any placed road tile. The
  horizontal drop point selects left, center, or right lane. One gameplay prop
  occupies a tile so every result stays readable at racing speed.
- Authors choose Coastal School, Midnight Circuit, Neon Gulch, or Freight Belt
  independently from geometry. The selected environment supplies scenery,
  palette, and compatible music while gameplay colors retain their standard
  meaning.
- A route needs 6–18 road tiles. Up to six sanitized, versioned drafts persist
  locally. Saved tracks may be raced, reopened for editing, renamed, or deleted;
  Test Drive saves first and immediately launches an isolated two-lap custom
  race. Custom damage never changes the Story garage hull, and custom races
  award no campaign money, trophies, or progression.
- The freeform map is intentionally a jam scope boundary. Intersections,
  branches, reverse routes, online sharing, enemy placement, and arbitrary
  terrain sculpting would require new runtime systems and are not implied by
  the top-down editor.

### Title carousel art lessons

- Design mode emblems for their final rendered size. Review the selected center
  item and the smaller adjacent item at 800x600 before accepting source art.
- Put the gameplay promise in the largest shapes. The revised Story icon makes
  three rival craft the primary silhouette and reduces its track to a short
  context wedge; the earlier detailed circuit was attractive but hid the idea.
- Use shared material language—navy metal, pearl and gold structure, cyan and
  magenta reflected light—to unify icons without adding boxes or badges.
- Preserve each emblem's natural aspect ratio and simplify internal detail
  before increasing display size. Readability comes from silhouette, value,
  separation, and hierarchy rather than raw resolution.
- Locked rewards remain visually desirable. Tint and alpha communicate state,
  while an explicit text label carries the accessibility requirement.

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
- Keep road-object communication inside the racing world. Hazards use a clear
  physical silhouette and contrast against the surface; speed pads and other
  pickups use distinctive authored art or road paint. Do not surround routine
  objects with floating rings, brackets, or targeting chrome—the object itself
  should provide the driving read unless the mechanic is explicitly a scanner
  or lock-on system.
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
