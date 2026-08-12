# Rhythmic Ride — Story Course Research and Validation Contract

## Design conclusion

Story mode should reuse each course as a two-step challenge:

1. **Qualifier:** a solo, one-lap time attack teaches the stable route and unlocks that course's Rival event only when the target time is beaten.
2. **Rival race:** the same road becomes a moving line-choice problem. Rivals can be passed or wrecked, but the win condition must be explicit and consistent: finish ahead of the field, with takedowns as an optional advantage/objective rather than a substitute for finishing unless the event is deliberately labeled a takedown event.

The initial research recommendation preferred one substantial lap over three
copies of a short lap. Post-implementation playtest feedback supersedes that
recommendation for Rival Races: these long routes now run three laps so the
first pass teaches the line, the second rewards optimization, and the third
gives overtakes and takedowns time to settle the result. Qualifiers remain one
lap.

The common course identity is a repeated downhill-style flow:

> **read → earn/commit boost → launch → choose in the air → land into a reward → precision/obstacle beat → breathe**

This is not a request to copy an SSX course. It adapts the principles of readable spectacle, linked high points, discoverable lines, and action-fed speed to Rhythmic Ride's single-ribbon pseudo-3D road.

## Evidence translated into our game

- SSX producer Steven Rechtschaffner described race play as finding the fastest line, and SSX 3 as finding the best route while linking actions into continuing combinations. He also described wide courses with many paths and short big-air events built from several jumps. For this game, that means several visible **lane-level choices** per run and jumps that pay into the next decision, not isolated ramps. ([GameSpot SSX 3 Q&A](https://www.gamespot.com/articles/ssx-3-qanda/1100-6030553/))
- EA's own level-design retrospective identifies options, newly discovered lines, memorable moments that flow into one another, and reveal/vista beats as core track qualities; it lists exaggerated kickers, switchbacks, tunnels, and crevasses as authored ingredients rather than raw terrain. For Rhythmic Ride, every authored piece needs a gameplay job, and a difficult sequence needs a visible reveal before commitment. ([EA, “Owning the Planet”](https://www.ea.com/news/ssx-developer-blog-owning-the-planet))
- SSX 3 supported championship races, head-to-head events, time trials, and quick challenges on shared spaces. Its action economy connected successful play to speed boost, while its review also notes that apparent alternate routes which forcibly reset the player were frustrating. Therefore the qualifier/Rival split is sound, objectives should reinforce normal fast driving, and every visually offered line must actually work. ([Nintendo World Report review](https://www.nintendoworldreport.com/review/4206/ssx-3-gamecube))
- EA later made music react to player action and performance. Rhythmic Ride need not build a remix engine during the jam, but boost, launch, air, landing, collision, and section changes should preserve and accent the musical pulse already specified in `MUSIC_DESIGN.md`. ([EA soundtrack announcement](https://www.ea.com/news/ssx-unveils-its-full-soundtrack))

## Reusable course loop

Author each course as **five to eight macro cycles**, escalating the required precision while changing scenery, geometry, surface, or lane solution.

1. **Read (about 1–2 seconds at target speed).** Reveal the bend, climb, ramp runway, objective cones, rivals, and at least one viable lane. Do not conceal the required exit behind the crest.
2. **Earn or commit boost.** Offer a green zipper line or a bankable nitro pickup. A safe lane may skip the resource; the committed lane earns the strongest launch. Never require boost that the course has not reliably supplied.
3. **Launch.** Place the ramp on a readable yellow/cyan approach. Live boost should improve the arc or access, but an ordinary jump must still resolve honestly unless the road clearly frames it as an expert gap.
4. **Air choice.** Ask for one decision: short/long glide, left/right airbrake transfer, or straight safe landing. Do not demand two hidden corrections in one flight.
5. **Land into payoff.** A skilled landing feeds a zipper, nitro pickup, cone chain, shortcut feeling, or clean racing line. Never land the car directly into an unread rock or unavoidable rival.
6. **Precision/obstacle beat.** Spend the earned speed on a chicane, curve, dirt strip, objective-cone sweep, open-lane rock formation, or rival encounter. An expert line may chain two actions; routine sequences should not stack more.
7. **Breathe.** Give clean road long enough to recover lateral position, read the HUD, and acquire the next runway. Use this space for scenery, a music transition, rival passing, or a nitro decision rather than another forced dodge.

At least one cycle per course should present a clear safe/committed pair. The committed line may be faster or complete an objective; the safe line must remain honestly traversable. Because the current renderer has one road ribbon rather than a branching graph, “route choice” currently means lanes, jump arcs, and surface tradeoffs—not tunnels or paths with different topology.

## Length, laps, and difficulty

The current geometry is repetitive rather than long. At the configured `12,000` world-units/second maximum, its theoretical no-acceleration, no-corner lap floors are approximately:

| Story course | Segments | Floor per lap | Current laps | Floor for race |
| --- | ---: | ---: | ---: | ---: |
| Proving Ground | 1,398 | 23.3 s | 3 | 69.9 s |
| Neon Gulch | 916 | 15.3 s | 3 | 45.8 s |
| Syndicate Run | 991 | 16.5 s | 3 | 49.6 s |

These are comparison floors, not player targets; acceleration, dirt, corners, collisions, and imperfect lines make real times longer. Neon Gulch and Syndicate Run currently repeat only six or seven authored patterns across very short laps.

Recommended target:

- Build a skilled clean lap around **60–90 seconds**, comprising five to eight complete macro cycles.
- Run the Qualifier for **one lap**. Set its target from playtest telemetry: the median of at least five clean, non-developer-exploit runs plus a 10–15% completion allowance. Do not derive it from the theoretical speed floor or the old `par` value.
- Run the Rival event for **three laps** per the subsequent player feedback.
  Preserve the substantial 60–90 second lap: duration is now deliberate so
  route learning, optimization, and combat each have room to emerge.
- Use difficulty escalation within the course: readable/open first cycle, combined boost/air choice in the middle, and the strongest precision chain near the end, followed by a clean finish approach.
- A crash should cost one beat and a line, not invalidate a minute-long run. Maintain a recoverable lane and honor the existing two-second recovery behavior.

## Cones become Story objectives

The user's new direction supersedes the current `GAME_DESIGN.md` Story rule that ordinary cones warn of rocks.

For Story courses:

- Every collidable cone must be an authored objective target with a stable ID and visible HUD purpose. Validate this mechanically: **there must be zero Story cone sprites without an `objectiveId`.**
- Use cones as short, joyful actions: a three-to-seven cone sweep after landing, a lane-transfer slalom, a boost-through smash line, or an optional committed-line chain. Preserve enough spacing for individual impact feedback to read.
- Cone completion should reward objective progress and score. It must not be required for basic course completion unless the event is explicitly presented as an objective challenge.
- Do not place objective cones where an airborne car cannot collide with them, in the same lane as a rock payload, or where a rival body can make the target effectively random.
- Rocks must communicate themselves through direct silhouette, road paint/barriers, open-lane composition, or long sightline. Do not silently keep using cones as their warning language.

Implementation consequence: current `rocks`, `gate`, `edge`, and `combo` patterns create ordinary warning cones. They cannot be used unchanged in Story after this rule. `ramp` and `rampRocks` are compatible; the other patterns need Story-specific no-cone variants or replacement with authored object layouts. `hit_all` objectives and authored cone objects already support persistent, one-shot objective targets.

## Rivals and takedowns

- Use **three rivals** as the production target. This is already the tested Rival School density and preserves a driving lane.
- Treat rivals as mobile route pressure. Put aggressive `attackZones` on broad straights, recovery beats, and the approach to optional lines—not on ramp faces, landings, narrow dirt, blind crests, or the apex of a required airbrake turn.
- A boosted ram may wreck instantly and a committed two-hit side shunt may provide the lower-resource path, matching the learned Rival School language. Takedowns may award bounded nitro, score, or an optional Story objective.
- Never require a takedown at the same moment the course requires an objective cone or precision landing. The player should know which verb is being judged.
- Disable collision during staging/re-entry and keep airborne contact disabled. Do not respawn wrecks in an ordinary finite race; defeated rivals should stay defeated for that event.
- Catch-up may maintain contact only outside immediate collision range. Near-contact speed must remain physically legible, and a passed rival must not teleport ahead.
- A Rival victory needs actual race-order evaluation at the finish. If that system is not implemented, label the event as a timed takedown challenge rather than pretending the player “beat” opponents by completing their own lap counter.

## What is feasible now

**Authorable in track JSON and existing mechanics:** longer fixed geometry; straight, curve, hill, dirt, and chicane pieces; one or more laps; stable pattern placement; bankable nitro; automatically placed deterministic zippers; physical ramps; boosted launch; forward/back glide; ground and airborne airbrakes; rocks and recovery; authored objective cones with `hit_all`; ramp/zip/takedown event counters; three collision-capable rivals; boost and two-hit takedowns; rival attack zones; campaign hull damage; return to the Story submenu after results.

**Requires systems/progression work:** a stored per-course Qualifier/Rival phase; locking Rival mode until its timer is beaten; a visible countdown/target-time failure state for an ordinary race; separate records for qualifier time and Rival result; selecting the phase from the Story submenu; true finishing order and “beat the field” resolution; Story-specific cone semantics or cone-free hazard pattern variants; objective-cone rewards if more than current progress/points/feedback is desired; genuinely branching roads; beat-quantized object placement or dynamically remixed music.

The existing `par` only contributes campaign payout; it is not a qualification gate. `TimedScoreAttack` and `TimedElimination` implement specialized Rival School clocks, but neither is the requested solo “reach the finish before time expires” qualifier.

## Hard validation rubric

A track is rejected if any required item fails. “Feels fun” is then evaluated only after these are true.

### Structure and progression

- [ ] Solo Qualifier contains no rivals, displays target and remaining/delta time, unlocks Rival mode only on success, and returns to the Story submenu on success or failure.
- [ ] Rival event is visibly marked unlocked/locked in the submenu and returns there after results.
- [ ] Rival victory is based on implemented finishing order, or the event is honestly labeled and scored as a takedown challenge.
- [ ] Best qualifier time and Rival completion persist independently per course.

### Flow and geometry

- [ ] Course contains five to eight identifiable read→boost→launch→air-choice→land→precision→breathe macro cycles.
- [ ] Every ramp is preceded by a readable runway and a reliably available speed source or honest safe-speed outcome.
- [ ] Every ramp leads to a benefit, choice, or hazard clear; there are no decorative dead-end launches.
- [ ] Every landing has a visible legal zone and enough recovery before the next forced lateral decision.
- [ ] At least one cycle offers both a safe lane and a higher-reward committed lane; every offered lane works without reset or invisible rejection.
- [ ] At least three geometry/surface families are used meaningfully, including elevation and at least one of dirt, chicane, or sharp curve.
- [ ] No more than two technical geometry pieces occur back-to-back without clean recovery.
- [ ] Skilled clean lap is roughly 60–90 seconds; the three-lap Rival event is
  intentionally longer and must be checked for repetition fatigue in playtest.

### Objects and objectives

- [ ] Every Story cone has a stable ID, an `objectiveId`, HUD purpose, and persistent one-shot state; there are zero warning cones.
- [ ] Every rock is readable without cone language and leaves a traversable ground lane unless a clearly optional ramp clears it.
- [ ] Cone chains do not overlap rocks, rival attack zones, ramp collision, or unreachable airborne space.
- [ ] Boost supply is deterministic and sufficient to attempt every required boosted launch after one ordinary mistake.
- [ ] Object placement is stable across retries and laps.

### Rivals, fairness, and recovery

- [ ] Production field is three rivals and still leaves a usable response through every formation.
- [ ] Rival attack zones exclude blind crests, ramp faces, landing windows, narrow technical sections, and required objective-cone chains.
- [ ] Boosted takedown and two-hit side-shunt routes work; passive rubbing/rear contact cannot accidentally award a wreck.
- [ ] Wrecked finite-race rivals do not recycle; re-entry/staging cannot collide or visibly teleport.
- [ ] One mistake loses a line or a few seconds but returns steering authority before the next required decision.

### Music, readability, and playtest acceptance

- [ ] Course escalation follows the theme's intensity waveform: opening read, build, high-speed payoff, subtractive/breathing passage, final rebuild.
- [ ] Boost, launch, flight, landing, cone, rock, and takedown feedback remain audible without masking the hook or pulse.
- [ ] At least five clean telemetry runs establish the qualifier target; at least three first-time-player runs verify the opening read and objective language.
- [ ] A tester can identify the safe line, committed line, cone objective, and next ramp without explanation after one run.
- [ ] No tester reports an unavoidable rock/rival hit, false route, blind landing, unexplained cone role, or more than one low-information repetition. Any such report is a rejection until corrected and replayed.
