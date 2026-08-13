# Title Screen / Front-End Requirements

## Product goal

Present Rhythmic Ride with a polished, controller-first
front end that reads immediately as a late-generation 16-bit racing game while
remaining practical for a one-day game-jam finish. The front end should imply
the tortoise-and-hare rematch and a future escalation from road cars to space
racers without promising story content that is not yet in the build.

Game title: **Rhythmic Ride**. Keep the title in one constant so later naming
changes remain inexpensive.

## Information architecture

The title scene separates box-art spectacle from its compact mode carousel:

1. **Attract view** — animated logo, city road, and grounded hero vehicle with
   a single prompt. It contains no mode menu.
2. **Main carousel** — five illustrated, boxless destinations arranged on the
   road's perspective axis: `Race School`, `Story`, `Trophy Room`, `Endless`,
   and the visible completion reward `Track Builder`. The selected emblem is
   largest at center; immediate neighbours remain identifiable at reduced size.
3. **Race School** — a tile grid containing every authored training course.
   Completed courses show their best Bronze/Silver/Gold trophy, the next course
   is visibly available, and later courses remain visible but locked.
4. **Story** — three large illustrated course cards visible together. Each card
   keeps the course's distinct environment image and contains a `Time Trial` /
   `Rival Race` switch. Rival Race stays visible but locked until that course's
   qualifier target is beaten. Results persist per course and event, and the
   finished course and event remain selected when the player returns. A first-
   place Rival finish earns Gold; winning while wrecking all three opponents
   earns Platinum and marks the course 100% complete.
5. **Trophy Room** — displays one pedestal/card per school course, earned trophy
   color and stars, total stars, and the all-Gold unlock teaser. Unearned trophies
   use readable silhouettes rather than disappearing.

`Endless` launches directly. `Track Builder` opens its saved-track library only
after its authored completion requirements are met; before then its desirable
icon remains visible with an explicit `LOCKED` label.

`Escape`, keyboard Backspace, gamepad B, and an on-screen Back action return
from a submenu to the main carousel. Back from the carousel restores the clean
attract view; Back on the attract view does nothing.

## Interaction contract

- Keyboard, gamepad, and pointer are first-class inputs.
- Arrow keys / D-pad move spatially between cards or tiles.
- Enter / Space / gamepad A activates. Escape / Backspace / gamepad B backs out.
- The selected item is identified by more than color: center placement, larger
  scale, side chevrons, a two-tone underline, and a larger explicit label.
- Left/right moves through the visible carousel; mode changes are never hidden
  behind an unrelated card or submenu. Every destination and course is
  represented visually.
- Locked training courses cannot launch and explain how to unlock them.
- Current persistence semantics remain unchanged: completing a school course
  unlocks the next; trophies represent mastery and best result.
- Starting any playable race resets the run exactly once and passes the same
  `mode` / `trackIndex` data consumed by `GameScene` today. Opening Track
  Builder is a scene transition, not a race reset.

## Visual direction

- Target the composition discipline of strong SNES/N64 racing front ends, not
  a literal copy of any game, logo, character, or trade dress.
- Use a full-frame racing tableau: receding road, layered sky/city silhouettes,
  speed streaks, and the existing car sprite as the focal vehicle.
- Favor chunky panels, stepped pixel borders, 8-bit shadows, small all-caps
  labels, and a limited high-contrast palette drawn from the game: midnight
  violet, cyan, magenta, warm gold, white, and semantic green/red.
- Main navigation is a boxless illustrated carousel between the title and hero
  vehicle rather than a vertical list or a row of opaque cards.
- The title remains legible at 800x600 and at integer-scaled presentation.
- Animation is restrained and purposeful: logo entrance, horizon movement,
  vehicle hover/suspension, selection pulse, and a short view transition.
- Keep important copy and selection UI inside a 24 px safe area. Avoid covering
  the focal car or making the background brighter than interactive objects.

### Carousel icon lessons learned

- Judge every emblem at its smallest shipped carousel size, not only in its
  full-resolution source. Detail that looks impressive at source size can turn
  into visual noise after reduction.
- The mode's defining subject must own the silhouette. Environment and context
  are supporting shapes. The Story emblem improved when its three rivals became
  larger than the track instead of appearing as decoration on a detailed road.
- Prefer one bold subject hierarchy and a few large pixel clusters over many
  equally weighted details. Small icons need separation between major forms,
  strong value contrast, and a recognizable outer contour.
- Preserve aspect ratio when fitting generated art. Do not squeeze every emblem
  through a generic square display box; give wide or tall subjects an authored
  display rectangle.
- A carousel is a depth hierarchy: the selected emblem may carry the most
  detail, but immediate neighbours must still communicate their mode without
  relying on their labels. Validate both center and neighbour positions at
  800x600.
- Keep the set cohesive through shared materials and lighting rather than an
  enclosing badge. Rhythmic Ride uses navy structure, pearl/gold hardware, and
  cyan/magenta edge light while allowing each subject its own silhouette.
- Lock treatment must not erase the reward being advertised. Desaturate and
  lower contrast enough to communicate unavailable state, retain readable art,
  and pair it with the explicit `LOCKED` label.

## Narrative and naming constraints

- The rematch is an original tortoise-versus-hare rivalry. Do not use `Peppy
  Hare`, `Star Fox`, `Arwing`, their likenesses, or franchise-specific wording
  in shipped content.
- Menu copy may hint at “an old rivalry,” “the rematch,” and progression beyond
  the road, but should not invent cutscenes or mechanics not present today.
- The final title should be short, pronounceable, legible as a two-line pixel
  logo, searchable, and broad enough for both cars and future spacecraft.

## Trophy room rules

- Read existing results through `getTrainingResult`; do not introduce a second
  save format for the menu.
- Bronze, Silver, and Gold must be distinguishable by label as well as color.
- Show earned stars out of the maximum possible authored school stars.
- The all-Gold reward is a teaser only for this jam pass: display `LOCKED — EARN
  GOLD IN EVERY COURSE` until achieved and `ALL-GOLD REWARD READY` afterward.
- Do not promise a specific vehicle/ship unlock unless that reward is actually
  implemented elsewhere.

## One-day scope guardrails

- No new story engine, character art pipeline, settings screen, save migration,
  or trophy reward implementation.
- Generated carousel emblems are committed local assets with transparent
  backgrounds. Do not add a runtime network dependency or remote asset fetch.
- Keep this work localized to the title/front-end and small pure helpers/tests.

## Acceptance gate

The title screen can ship only when all of the following pass:

- Main carousel is not perceived as a list and exposes all five destinations
  through one centered selection and four visible neighbours.
- Race School and Story use selectable tiles and launch the correct track.
- Training lock state and trophies match current persisted results.
- Trophy Room accurately represents all six school courses and the all-Gold
  condition.
- Every action is operable by keyboard and gamepad; every visible card/tile and
  Back action is operable by pointer.
- Selection and locked/earned state do not rely on color alone.
- No menu control leaks or duplicates after changing views.
- Existing automated tests pass; new pure navigation/progress logic is tested.
- A production build succeeds with no missing assets.
- Screenshots at 800x600 show readable hierarchy, no overlaps, no clipped copy,
  and a coherent late-16-bit racing-game silhouette.
