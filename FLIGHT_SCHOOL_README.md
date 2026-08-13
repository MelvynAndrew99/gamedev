# Flight School — Post-Jam Handoff

Flight School is intentionally unavailable in the player-facing jam build. Its
Race School tile remains visible as `SOON`, but selecting it cannot start the
course. This is a release lock, not a deletion: the implementation, authored
track, generated environment, HUD, mechanics, tests, and music remain in the
repository.

## How to run the work-in-progress course

1. Start the development build with `npm run dev`.
2. Open **Projection Lab** beside the game canvas.
3. Choose **TRAINING — FLIGHT SCHOOL [WIP — LAB ONLY]**.

Projection Lab deliberately bypasses the release menu lock. Do not use its
availability as evidence that the jam-facing tile is unlocked.

The Music Player includes **Cloudline Promise** as a discovered track once the
player has purchased/unlocked the Music Player itself.

## Current design contract

- Flight School is a post-game thank-you and sequel preview, not a sixth normal
  driving lesson.
- It must never be added to Story, Endless, Air School, or normal ramp physics.
- The craft begins already airborne at cruise speed with automatic forward
  motion and three afterburner charges.
- Horizontal input banks, vertical input changes altitude, brake scrubs speed,
  and boost supplies afterburner thrust.
- Ten rings grade the route: Bronze at 6, Silver at 8, Gold at 10.
- Aurora Concourse is the authored building fly-through around rings 5 and 6.
- The Flight HUD is separate from Air School and contains no jump, landing,
  airtime, crosshair, start/finish, or road-racing language.
- The generated city transit spine is environmental art. Flight School draws no
  procedural road, alpha guide channel, roadside posts, checkered line, gantry,
  launch ramp, launch boosts, or chasm failure sequence.

## Important files

- `src/tracks/training-flight.json` — course data and release status.
- `src/systems/FlightSchool.js` — sustained-flight state, ring hits, and route cue.
- `src/systems/FlightPresentation.js` — flight-only craft and HUD policy.
- `src/scenes/GameScene.js` — runtime integration and completion sendoff.
- `src/scenes/HudScene.js` — dedicated flight instruments.
- `src/road/RoadRenderer.js` — projected rings and Aurora Concourse.
- `src/config/environments.js` and
  `public/assets/flight-school-city-v2.png` — Aurora Skyport presentation.
- `src/audio/tracks/flightSchoolTheme.js` — **Cloudline Promise**.
- `GAME_DESIGN.md` — canonical product and isolation rules.

## Known unfinished work

- Perform fresh human playtests for ring readability, altitude feel, braking,
  afterburner usefulness, and total course duration.
- Visually recapture the complete Aurora Concourse approach/entry/exit at
  800×600. Its aperture now expands around the viewport instead of framing the
  background as a small rectangle, but this latest correction still needs a
  full human gameplay pass.
- Replace or refine any remaining screen-space architecture that looks like a
  flat overlay instead of physical city mass.
- Tune the route after controller playtests and confirm every missed ring is
  recoverable without an unfair failure state.
- Polish the ending/sendoff only after the flight itself meets the sales-demo
  visual bar.

## Restoring Flight School after the jam

1. Finish the playtest and visual checklist above.
2. In `src/tracks/training-flight.json`, remove
   `"status": "coming_soon"`.
3. Restore the player-facing unlock copy to
   `LOCKED — PLATINUM THE RIVAL RACES TO UNLOCK` if Story Platinum remains the
   desired gate.
4. Update the front-end regression test so Story Platinum unlocks the tile.
5. Confirm Flight School once again contributes its intended three stars to the
   School collection—or deliberately keep it separate as sequel-preview mastery.
6. Run the focused flight tests, full test suite, production build, and an
   800×600 controller capture covering approach, rings, Concourse, and ending.

Do not reconnect the tile solely because the course runs. The release bar is a
cohesive, visually convincing flight demo that leaves players wanting the sequel.
