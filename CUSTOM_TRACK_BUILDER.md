# Custom Track Builder

The jam builder turns the existing linear pseudo-3D road format into a visual
top-down construction toy. It intentionally does not create arbitrary road
graphs: every road tile connects to one highlighted open end, which guarantees
that a saved design can compile into `RoadModel` without branches, broken links,
or a second racing engine.

## Player flow

1. Finish the five released Race School courses. Score and trophy do not matter.
2. Attempt both Story events on all three tracks. A Rival event must be reached
   normally by qualifying first, but its finishing position does not matter.
3. Open the title carousel. **Track Builder** is always visible there as a
   locked completion reward; once the requirements above are met, select it to
   open **Custom Tracks**.
4. Select **Build a New Track**, drag road and object tiles onto the canvas,
   choose a Track Scene, then Save or Test Drive.

Saved tracks support Race, Edit, and Delete from the library. Six local slots
are available. Custom races are two laps, use isolated run damage, and do not
award wallet money, trophies, achievements, or campaign progression.

## Tile vocabulary

Road: Straight, Left Bend, Right Bend, Hill, Dirt, Chicane.

Objects: Cone, Rock, Boost pickup, Ramp. The pointer's position within a road
tile chooses left, center, or right lane. Dropping another object on the same
road tile replaces the old one; Remove Prop clears it.

Scenes: Coastal School, Midnight Circuit, Neon Gulch, Freight Belt.

## Implementation map

- `src/systems/CustomTracks.js` — unlock rule, route layout, validation,
  compiler, sanitization, and local persistence.
- `src/scenes/TrackBuilderScene.js` — drag/drop editor and Test Drive flow.
- `src/scenes/TitleScene.js` — locked title-carousel destination and
  saved-track library.
- `src/scenes/GameScene.js` — isolated custom-race launch, restart, results, and
  return path.
- `src/systems/CustomTracks.test.js` — unlock, geometry, compilation, RoadModel,
  persistence, and slot-cap regressions.

## Deliberate future work

Intersections, branching paths, route closure in the top-down drawing, reverse
layouts, share codes, online browsing, rival authoring, and terrain sculpting
are post-jam features. They should not be added by bypassing validation: each
requires an explicit runtime and save-format design.
