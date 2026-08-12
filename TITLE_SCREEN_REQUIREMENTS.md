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

The title scene has four views rather than one long list:

1. **Attract / main view** — animated logo tableau and four large mode cards:
   `Race School`, `Story`, `Trophy Room`, and `Endless`.
2. **Race School** — a tile grid containing every authored training course.
   Completed courses show their best Bronze/Silver/Gold trophy, the next course
   is visibly available, and later courses remain visible but locked.
3. **Story** — three large illustrated course cards visible together. Each card
   keeps the course's distinct environment image and contains a `Time Trial` /
   `Rival Race` switch. Rival Race stays visible but locked until that course's
   qualifier target is beaten. Results persist per course and event, and the
   finished course and event remain selected when the player returns. A first-
   place Rival finish earns Gold; winning while wrecking all three opponents
   earns Platinum and marks the course 100% complete.
4. **Trophy Room** — displays one pedestal/card per school course, earned trophy
   color and stars, total stars, and the all-Gold unlock teaser. Unearned trophies
   use readable silhouettes rather than disappearing.

`Escape`, keyboard Backspace, gamepad B, and an on-screen Back action return
from a submenu to the main view. Main-view Back does nothing.

## Interaction contract

- Keyboard, gamepad, and pointer are first-class inputs.
- Arrow keys / D-pad move spatially between cards or tiles.
- Enter / Space / gamepad A activates. Escape / Backspace / gamepad B backs out.
- The selected item is identified by more than color: border, cursor/chevrons,
  scale or elevation, and a changing description panel.
- No hidden left/right mode-changing behavior. Every destination and course is
  represented visually.
- Locked training courses cannot launch and explain how to unlock them.
- Current persistence semantics remain unchanged: completing a school course
  unlocks the next; trophies represent mastery and best result.
- Starting any playable mode resets the run exactly once and passes the same
  `mode` / `trackIndex` data consumed by `GameScene` today.

## Visual direction

- Target the composition discipline of strong SNES/N64 racing front ends, not
  a literal copy of any game, logo, character, or trade dress.
- Use a full-frame racing tableau: receding road, layered sky/city silhouettes,
  speed streaks, and the existing car sprite as the focal vehicle.
- Favor chunky panels, stepped pixel borders, 8-bit shadows, small all-caps
  labels, and a limited high-contrast palette drawn from the game: midnight
  violet, cyan, magenta, warm gold, white, and semantic green/red.
- Main navigation is composed as large illustrated cards along the lower third
  rather than a vertical or horizontal text list.
- The title remains legible at 800x600 and at integer-scaled presentation.
- Animation is restrained and purposeful: logo entrance, horizon movement,
  vehicle hover/suspension, selection pulse, and a short view transition.
- Keep important copy and selection UI inside a 24 px safe area. Avoid covering
  the focal car or making the background brighter than interactive objects.

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
- No new external art dependency. Compose the screen with Phaser text,
  graphics, particles/simple geometry, and existing project sprites.
- Keep this work localized to the title/front-end and small pure helpers/tests.

## Acceptance gate

The title screen can ship only when all of the following pass:

- Main view is not perceived as a list and exposes all four destinations.
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
