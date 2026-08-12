# Title-screen research and requirements audit

Research pass: 2026-08-11. This is design guidance, not an instruction to copy
another game's art, logo, characters, layout, or trade dress. It supplements
`TITLE_SCREEN_REQUIREMENTS.md`; it does not replace it.

## Current title decision

**Rhythmic Ride** supersedes the initial `Grid to Galaxy` recommendation. Its
alliteration and plain action words better express the game's central promise:
catchy music, physical rhythm, and fast arcade driving. The spelling is
intentionally **Rhythmic**, not `Rythmic`. `Retrowave` was rejected because an
existing commercial arcade racing game already uses that exact title.

## Recommendation in one screen

Keep the animated title, vehicle, road, and horizon as one strong racing
tableau. Put the four destinations in a coarse 2x2 or 4-across spatial layout,
not a menu column. Selecting a card should change a concise description strip.
Race School and Story should then become their own visual tile screens. This is
the useful shared grammar of the references: spectacle first, one clear choice
per layer, a strong non-color cursor, and persistent progress displayed directly
on the object being selected.

For the jam build, do not add a separate mandatory `PRESS START` screen. F-Zero
X used one, but an extra gate does not buy enough to justify another state. The
main screen can preserve title-screen spectacle while exposing the four cards.

## Evidence-backed patterns

### 1. Separate the fantasy from the choice, but keep both visible

- **F-Zero X** explicitly goes from Title screen to Main Menu, then mode, class,
  cup, and machine. More importantly for this project, selecting a Cup produces
  a short course explanation at the bottom. Its manual also establishes a
  consistent `A/Start = confirm`, `B = previous screen` contract. This supports
  the proposed card/tile focus plus changing description panel without asking
  the player to decode hidden left/right state. [Official Nintendo F-Zero X
  manual](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_8/Manual_Nintendo64_FZeroX_EN.pdf)
- **Crazy Taxi**'s front-end sequence is title, mode selection, then cab/driver;
  the title sells attitude while later screens own the decisions. Its useful
  influence here is the loud, immediate arcade energy, not its exact typography
  or yellow-checker identity. [Crazy Taxi screenshot
  sequence](https://www.mobygames.com/game/3575/crazy-taxi/screenshots/)
- **Rock n' Roll Racing** uses nearly the whole 256x223 title frame for logo and
  thematic illustration. At SNES resolution, one bold silhouette and a few
  large color masses outperform many small decorations. [Archived SNES title
  screenshot](https://www.mobygames.com/game/11544/rock-n-roll-racing/screenshots/snes/105272/)

**Apply:** title/logo at the top, car and receding road as the middle silhouette,
four destination cards as the lower decision band. The background may move,
but card contrast must remain stronger than scenery contrast.

### 2. Use chunky visual groups and progress marks, not a disguised list

- **Super Mario Kart** progresses from title to character selection to race/cup
  selection. The cup screen uses a thick patterned frame, large colored labels,
  and grouped choices that read at a glance at native SNES resolution. The
  gallery confirms title, character, and race-select as distinct screens. [SNES
  screenshot gallery](https://www.mobygames.com/game/6590/super-mario-kart/screenshots/)
  and [official Nintendo manual](https://www.nintendo.co.jp/clvs/manuals/common/pdf/CLV-P-SAAFE.pdf)
- **Uniracers** similarly moves Main Menu -> player/unicycle -> Tour -> Track.
  Its eight Tours are an especially useful precedent for a visual curriculum
  layer before individual tracks, though this jam only needs five course tiles.
  [Uniracers manual transcription](https://www.world-of-nintendo.com/manuals/super_nes/uniracers.shtml)
  and [screen sequence](https://www.mobygames.com/game/8085/uniracers/screenshots/)
- **Top Gear** shows how few elements are needed: framed selection content,
  strong yellow/blue contrast, and a road/car background. It is evidence for a
  limited palette and borders, not for reproducing its option list. [Scanned
  SNES manual](https://www.retrogames.cz/manualy/SNES/Top_Gear_-_SNES_-_Manual.pdf)

**Apply:** each Race School tile should always show course number, short name,
one visual lesson glyph, and one explicit state (`GOLD`, `SILVER`, `BRONZE`,
`COMPLETE`, `NEXT`, or `LOCKED`). Do not make lock state a padlock tint alone.

### 3. Let the select screen carry progress and anticipation

- **F-Zero X** places a persistent `X` mark on Course Select for Cup wins; those
  marks also drive later machine unlocks. It demonstrates the value of putting
  mastery on the selection object rather than burying it in a statistics page.
  The same manual says the selected Cup gets a brief description at screen
  bottom. [F-Zero X manual](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_8/Manual_Nintendo64_FZeroX_EN.pdf)
- **Wave Race 64** makes progression legible in selection flow: only Normal is
  initially available, later difficulties unlock after clearing the Final
  Course, unreached courses cannot be selected, and the Course Introduction
  screen states the advancement target. [Official Nintendo Wave Race 64
  manual](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_8/Manual_Nintendo64_WaveRace64_EN.pdf)
- **Beetle Adventure Racing** ties finishing first to opening the next track and
  is remembered for shortcuts, bonuses, and unlocks rather than a flat course
  list. Its useful lesson is to keep locked destinations visible enough to
  create anticipation. [Manual/archive page](https://www.gamesdatabase.org/game/nintendo-n64/beetle-adventure-racing.aspx)

**Apply:** show all six school courses. The first unavailable tile after the
player's progress is `NEXT — COMPLETE THE PRIOR COURSE`; later ones are
`LOCKED`. Trophy Room repeats the same five-course order, so the player's mental
map carries over.

### 4. Borrow modern arcade force as motion and copy tone, not UI density

- **Burnout 3** makes `WORLD TOUR`, `SINGLE EVENT`, and progress/reward records
  separate top-level destinations, and gives each mode an action sentence. That
  supports Story, Endless, and Trophy Room as peer cards plus a one-line
  description. [Burnout 3 manual](https://oldgamesdownload.com/wp-content/uploads/Burnout_3_Takedown_Manual_Xbox_EN.pdf)
- **Crazy Taxi** contributes quick cuts, oversized type, assertive color, and
  verbs. Use that energy in the logo entrance, selection bump, speed streaks,
  and terse descriptions. Do not copy its checker pattern, logo construction,
  licensed attitude, or character presentation. [Screenshot
  gallery](https://www.mobygames.com/game/3575/crazy-taxi/screenshots/)

**Apply:** a selected card can rise 3-5 px, gain a stepped white/cyan border and
side chevrons, and swap the bottom sentence. Avoid perpetual scaling large
enough to make adjacent cards collide.

## Current-build findings

- `src/scenes/TitleScene.js` is currently exactly the failure case described by
  the brief: three centered text rows, with training lesson choice hidden behind
  left/right input.
- It has Enter and gamepad-A activation, but no Space, Backspace/B navigation,
  pointer activation, or visible submenu Back action.
- The current side summary collapses completion and mastery into a small label;
  it cannot express all five courses, locks, no-trophy completion, or the
  all-Gold goal.
- The authored content is six school courses and three Story courses. Every
  school course currently has a three-star Gold maximum, so the current authored
  maximum is **18 stars**. That value should still be derived from authored
  thresholds rather than hard-coded.
- `highestUnlockedTrainingIndex()` and version-aware `getTrainingResult()` are
  the existing persistence authority. The front end should consume them rather
  than infer completion from stars or create a second save key.

## Requirements gaps and recommended decisions

These are gaps in the written contract, not reasons to block a sensible jam
implementation.

1. **The view count is inconsistent.** The document says “three views” and then
   enumerates Main, Race School, Story, and Trophy Room: four views. Call it
   four front-end views, with Endless as a direct launch.
2. **Story launch semantics need an explicit decision.** `TRACKS` has three
   courses, while the current campaign normally advances through the garage and
   preserves racer condition. A chapter-select tile that directly resets and
   starts tracks 1 or 2 can bypass that campaign flow. Safest jam decision:
   expose all three as visual chapters, but make only Chapter 1 a live launch
   unless a tested “start at chapter” contract already exists. If all three must
   launch, explicitly accept the fresh-run/economy consequence.
3. **“Story mode and campaign” is ambiguous.** The request can be read as two
   destinations; the requirements treat Story/Campaign as one three-race cup.
   Keep one `STORY` card for jam scope and label its submenu `CAMPAIGN` or
   `THREE-RACE CUP` so the relationship is obvious.
4. **No-trophy completion is a real state.** Progress allows a lesson to be
   completed with no Bronze/Silver/Gold. Race School and Trophy Room must
   distinguish `COMPLETE — NO TROPHY` from `UNPLAYED` and `LOCKED`.
5. **Spatial navigation behavior is underspecified.** Decide and test whether
   edge movement clamps or wraps, where focus lands on entering a view, and
   whether Back restores the previously selected main card. Recommended: clamp
   grids, remember selection per view, restore the originating main card.
6. **Pointer focus behavior is underspecified.** Pointer hover/focus should
   update the same single selection model and description as keyboard/gamepad;
   pointer down activates. Do not maintain a separate hover-only highlight.
7. **Endless behaves differently from its peers.** Three cards open views while
   Endless launches immediately. Its description should say `START AN ENDLESS
   RUN` and the other three should say `OPEN ...` to set the expectation before
   activation.
8. **The trophy total should be version-aware.** Earned stars and all-Gold must
   use each course's current `scoring.version`; stale persisted mastery cannot
   satisfy the teaser. Maximum stars should be the sum of each course's authored
   maximum threshold (currently 18).
9. **Audio feedback is absent from the acceptance gate.** Great racing front
   ends derive substantial energy from selection/confirm stingers. This is a
   worthwhile polish item only if existing synthesis can be reused; it should
   not create a new asset dependency or block the one-day build.
10. **“Best SNES title screen” needs an operational visual bar.** The final
    reviewer should reject if, in the 800x600 screenshot, the eye lands on menu
    chrome before the logo/car silhouette; if four cards read as text in boxes;
    if locked and earned states require reading tiny copy; or if any title/card
    uses thin default-web styling rather than deliberate pixel massing.

## Original name candidates

Ranked for this game's underdog rematch and road-to-space trajectory, not as a
legal clearance. Searches were preliminary exact-name web checks on 2026-08-11;
a final choice still needs storefront, domain/social, and trademark review in
the intended release territories.

### Top three

1. **Grid to Galaxy** — strongest option from the initial naming pass, now
   superseded by **Rhythmic Ride**. “Grid” means the starting grid now;
   “Galaxy” cleanly promises the future scale without borrowing Star Fox
   language. It is short, easy to say, and naturally breaks into two logo lines.
   Preliminary exact-name searches found no obvious game-title collision.
2. **Overtake Orbit** — strongest fable subtext: the presumed slower rival
   overtakes, then the series grows into space. Energetic alliteration and no
   obvious exact game-title collision in the preliminary search. “Orbit” is
   widely used, so distinct logo/search art would still matter.
3. **Last One First** — most original tortoise-and-hare inversion. It makes the
   underdog premise legible without naming animals and can survive a move from
   cars to ships. It is less immediately identifiable as a racer, so a strong
   vehicle logo/tableau is mandatory.

### Nine more viable directions

4. **Roads to Orbit** — exceptionally clear series trajectory; weaker rivalry.
5. **Rival Ascent** — compact rivalry plus upward progression; “Ascendant” and
   “Rivals” are crowded game words, so clearance deserves care.
6. **Starline Rivals** — strong two-line logo and sci-fi-racing read; `Starline`
   was also the name of an unreleased 1987 C64 project, so it is not pristine.
7. **Second Lap** — immediately communicates a rematch and racing; generic and
   harder to own in search.
8. **Quick & Steady** — a friendly inversion of the fable phrase; potentially
   reads more like a party racer than the game's aggressive near-future tone.
9. **Apex Rematch** — very clear and already convenient as the working title,
   but discoverability is weaker because `APEX Racer` is an active pixel-car
   game and **REMATCH** is a current Sloclap sports title. [APEX Racer on Google
   Play](https://play.google.com/store/apps/details?id=com.pixeldev.APEXRacers)
   and [REMATCH on Steam](https://store.steampowered.com/app/2138720/REMATCH/)
10. **Chasing Zenith** — chase narrative plus upward destination, but
    `CHASING ZENITHS` has a current US trademark filing in recorded music and
    “Zenith” is generally crowded. This is not necessarily disqualifying, but it
    is a reason not to pick it casually.
11. **Shell to Sky** — charming, readable animal-to-space arc; more storybook
    than high-impact arcade racer and an exact phrase is already used by an
    online story.
12. **Neon Rematch** — visually on-brief and easy to logo; generic `Neon` plus
    the existing **REMATCH** title makes it a weak search/clearance choice.

Avoid **Redline Rivals** and **Beyond Redline**: exact or near-exact racing-game
collisions are active now. [Redline Rivals](https://redlinerivals.com/) and
[Ferrano: Beyond Redline](https://store.steampowered.com/app/4202850/Ferrano_Beyond_Redline/)

## Research validation checklist for the implemented screen

In addition to the acceptance gate in `TITLE_SCREEN_REQUIREMENTS.md`, the review
pass should answer these in order:

1. At 800x600 and at thumbnail size, do logo, car/road silhouette, and selected
   destination read in that order?
2. If all text inside the main cards were blurred, would the four destinations
   still feel like four spatial objects rather than one list?
3. Can a first-time player discover every course and Trophy Room without a
   hidden left/right convention?
4. Do keyboard, gamepad, and pointer all mutate the same focus state, change the
   same description, and activate the same data payload?
5. Does each school course show exactly one truthful state, including completed
   with no trophy, and do current-version saved results produce the same state
   in Race School and Trophy Room?
6. Does Story preserve the agreed campaign/economy semantics rather than merely
   sending the right numeric `trackIndex`?
7. Are Gold/Silver/Bronze named as text, locks explained, and focus visible with
   color removed from the screenshot?
8. Are transitions short enough that repeated Back/open navigation still feels
   immediate, and are old hit areas/listeners destroyed when views change?
9. Does the screen feel authored from the game's road, palette, car, and trophy
   systems rather than like generic neon cards laid over a gradient?
10. Are every proper noun, character silhouette, and copy line free of Star Fox,
    Peppy Hare, Arwing, Nintendo, EA, Sega, or other franchise-specific content?
