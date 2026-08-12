# Rhythmic Ride — Two-Phase Story Mode Requirements

Read this with `STORY_COURSE_RESEARCH.md`, `GAME_DESIGN.md`, and
`MUSIC_DESIGN.md`. The research contract defines the feel and rejection bar;
this document defines the product and data contract.

## Event structure

Every Story course has two selectable events:

1. **Beat the Clock** — a solo, one-lap qualifier. Finish before the authored
   target to unlock that course's Rival Race. Failure still records a best time
   and returns to the Story submenu.
2. **Rival Race** — a three-lap finite race against three opponents on the same course.
   Finish ahead of every surviving rival or take rivals out before the line.
   Wrecked rivals remain defeated for the event.

The Story submenu shows both event choices on every course card. Rival Race is
visible but locked until its qualifier is beaten. Qualifier and Rival Race
results persist independently. Returning from either result keeps the course
and event selected.

## Shared track-data contract

Each Story JSON file provides:

- `qualifier.targetSeconds` and `qualifier.laps` (normally one);
- `rivalRace.laps` (three; the long race turns the first lap into a course read
  and the later laps into route optimization and combat);
- `rivals` with exactly three finite, non-recycling opponents;
- five to eight authored flow cycles described in `design.cycles`;
- long-form `pieces` using straight, curve, hill, dirt, and chicane with clean
  recovery between at most two technical pieces;
- `patterns.placements` containing only cone-free Story-compatible kinds;
- authored `objects` for every objective cone and any deliberately placed
  boost/rock; and
- objectives for completing the event, cone mastery, ramps, and speed lines.

## Driving and object rules

- The recurring phrase is boost pickup or speed line → readable ramp → air
  choice → rewarding landing → airbrake/obstacle precision → recovery.
- Every ramp has a painted approach and an honest landing. Boost makes it more
  fun or more rewarding; a required jump cannot become an unexplained trap.
- Every Story cone has a unique ID, belongs to a `hit_all` objective, and is a
  target to smash. Story has zero warning cones.
- Rocks must read directly and always leave a traversable ground response unless
  a clearly optional ramp is the alternate response.
- Each course distributes at least four authored thread-the-needle rock gates
  across its cycles. Avoiding hull damage is a repeated route skill, not an
  occasional punishment.
- Rival attack zones belong on broad readable road, never required ramp faces,
  landing windows, objective-cone chains, blind crests, or narrow chicanes.
- Takedowns are advantageous and scored, not mandatory: first place can be
  earned by out-driving every opponent.
- Story rivals never proximity-stage or teleport after being passed. Limited
  off-screen pace easing may keep the field competitive, but every pass and
  finish position remains physically earned.

## Validation

Automated validation must prove:

- all three courses have both phases and three rivals;
- qualifiers have positive authored targets and Rival Races start locked;
- Story progress is stored per course and per phase;
- every Story cone is authored, objective-linked, and persistent;
- no Story pattern emits a warning cone;
- every ramp has an approach; rocks never form an unavoidable full-road wall;
- every course contains five to eight action cycles, meaningful surface and
  elevation changes, an opening read, and finish recovery; and
- course and event data remain deterministic across retries.

The final playability validator may reject a technically valid course that
lacks rhythm, readable choices, recovery, escalation, or a satisfying finish.
