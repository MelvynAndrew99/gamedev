# Rhythmic Ride — Game Jam Readiness Plan

**Audit date:** 2026-08-13  
**Target:** a clean School / Story / Endless showcase build for today's presentation  
**Current gate:** core handling and balance remain frozen; 414 automated tests and the production build pass.

This plan combines three independent reviews: gameplay/readiness, presentation/readiness, and a high-effort Claude Code repository audit. The reviewers converged on the same conclusion: freeze the core race mechanics and spend the remaining jam time on the public shell, result integrity, Endless records, first-load feedback, and a short fresh-save smoke test.

## Scope lock

Ship and polish:

- Race School
- Story qualifier and Rival Race
- Endless distance run
- Title carousel, Trophy Room, Garage, Music Player, and completed custom-track tools
- Existing progression, economy, persistence, audio, and pause behavior

Do not add or rebalance today unless a presentation smoke test finds a reproducible blocker:

- Flight School
- multiplayer or async attacks
- new race mechanics
- Story timers, rival pace, course length, economy payouts, or Pit Crew values
- major handling or camera changes

Flight School code and assets remain preserved for post-jam work; the locked course is not part of this release gate.

## Priority order

### P0 — clean public browser shell

**Status:** Completed and validated  
**Why now:** At an actual 800×600 browser viewport, the always-visible Projection Lab and external controls crop and shift the game canvas. The same footer currently teaches the opposite rule (`Cones warn. Rocks collect.`), omits keyboard `C` boost, and renders some controller glyphs as missing characters.

Work:

- Make the default URL a centered, uncropped game-only view.
- Put Projection Lab behind an explicit `?lab=1` flag or a development-only condition.
- Remove the external controls footer from the public build. If retained in Lab, use accurate plain text: hit objective cones, avoid rocks, `C` boosts, shoulders/`Z`+`X` airbrake, and pause.
- Add `base: './'` to Vite and verify a zipped `dist` works from a nested path, as itch.io-style hosting will not reliably serve absolute `/assets/...` URLs.

Acceptance:

- 800×600 and 1100×800 both show the whole canvas with no scroll, clipping, squeezed Lab, or external footer.
- `?lab=1` still exposes the tuning and Projection Lab tools.
- A nested-path production preview loads every JS, image, and audio asset without a 404.

**Validation result:** PASS. The default page is an exact centered 800×600 game-only canvas. Press **F2** (or **Ctrl+Shift+L**) to toggle Projection Lab without changing progression; `?lab=1` opens it on boot. Editable Lab controls ignore the shortcut. The built entry uses relative `./assets/...` paths, and the inaccurate external footer has been removed.

### P0 — make terminal race results atomic

**Status:** Completed and validated  
**Why now:** Damage is resolved before finish-line crossing, but there is no authoritative barrier preventing a same-frame finish from overwriting a wreck. Repeated terminal callbacks can also repeat presentation side effects.

Work:

- Introduce one idempotent terminal-outcome commit for finish, failure, and wreck.
- Preserve the current deterministic ordering: a fatal collision on the finish-crossing frame resolves as a wreck because damage is processed first.
- Stop later same-frame systems from awarding progression or replacing the result.

Acceptance:

- A fatal finish-line contact produces one wreck result and no finish payout/progression.
- Repeating a terminal callback has no additional persistence, audio, payout, or UI effect.
- Add regression tests for same-frame fatal contact plus finish crossing and terminal idempotency.

**Validation result:** PASS. One terminal-outcome gate now owns every finish, wreck, qualifier timeout, and training timeout. Damage retains first authority on a crossing frame, and duplicate/competing callbacks cannot repeat progression, payouts, or result presentation.

### P0 — guarantee Story emergency-tow recovery

**Status:** Completed and validated  
**Why now:** A Story wreck saves zero hull, but the emergency tow currently applies only when TitleScene receives the wreck payload. Back/Escape or a refresh at the result can bypass that path and leave a player with no money and no retry-capable car.

Work:

- Commit the one-time emergency tow as part of the wreck/result transaction, before any result exit can bypass it.
- Keep ordinary persistent Story damage and paid repair behavior unchanged.

Acceptance:

- A wreck followed by A, B, Escape, or refresh always reloads at or above `TUNING.emergencyHealth`.
- The tow applies once, cannot be farmed, and does not grant a full repair.
- Add alternate-exit and reload regression tests.

**Validation result:** PASS. Story commits the emergency tow synchronously with the wreck. A/B/Escape, scene changes, and reloads can no longer preserve a zero-hull deadlock; repeated Garage entry applies no additional repair.

### P0 — Story start/finish art quick win

**Effort:** Completed and visually validated  
**Why now:** The generic generated-vector gate was visually below the quality of the vehicle, title, and environment art.

Implemented:

- Proving Ground uses a precision telemetry/test-facility gantry.
- Neon Gulch uses a copper, sandstone, solar-energy desert gantry.
- Syndicate Run uses a blue-gray freight-terminal gantry.
- Only Story opts into these location assets. Race School retains its existing vector timing gate.
- Course names are rendered at runtime on intentionally blank nameplates rather than baked into the art.

Acceptance:

- At 800×600, each gate is grounded, clears the HUD, stays legible at approach speed, and does not shimmer or float on bends/hills.
- Cross in both outer lanes; non-collidable supports must not look like the car passes through a physical pillar.
- School remains visually and mechanically unchanged.

**Validation result:** PASS at 800×600. All three gantries pass both outer-lane approaches/crossings. Near Story supports briefly occlude the vehicle as world geometry, then clear immediately; HUD readability, clean alpha, grounding, and course labels all pass.

## P1 — high-value showcase polish

### Endless records dashboard

**Status:** Completed and visually validated  
**Evidence:** Endless already persists best distance and shows it in the live HUD; the missing piece is presentation, not a new scoring system.

Work:

- Add `BEST ENDLESS DISTANCE` and furthest named stage to Trophy Room → Player Records.
- Expand the Endless result card to clearly separate run distance, prior best/best, stage, tips, and `NEW RECORD` state.
- Optionally show the saved best when Endless is centered in the title carousel if it fits without reintroducing clutter.
- Harden `HighScores` while touching it: finite nonnegative values only, storage exceptions safe, corrupt payload recoverable, legacy key documented.

Acceptance:

- Fresh save renders `0m` / `NO RUN` cleanly.
- A record survives reload and only increases.
- Corrupt or unavailable storage never interrupts a run.
- Unit tests cover max semantics, sanitization, reload, and storage failures.

**Implementation result:** Endless now shows a concise saved best on its selected carousel item and a dedicated Player Records hero row with best distance and furthest named stage. The legacy score key remains intentionally compatible, while invalid IDs, modes, negative/nonfinite values, corrupt JSON, and unavailable storage are handled safely. Fresh saves render `0m` / `NO RUN`.

**Validation result:** PASS at 800×600 for fresh and saved states. `BEST — NO RUN` / `BEST 8,123m` remain clear on the selected carousel item; Player Records shows `0m / NO RUN` or the saved distance and correct furthest stage without displacing lifetime totals, style rewards, achievements, or bottom help.

### Branded first-load feedback and deferred locked art

**Effort:** Small–Medium  
**Evidence:** The title currently queues roughly 10 MB before showing useful feedback, including a ~2.5 MB Flight School background that jam players cannot launch.

Work:

- Show a primitive Rhythmic Ride loading mark, progress rail, and percentage from the first load event.
- Do not require generated art to draw the loader.
- Defer the Flight School city plate until a Lab/Flight path explicitly requests it.
- Keep all Flight School source assets in the repository.

Acceptance:

- A throttled-network cold boot never appears as an unexplained black or frozen page.
- The ordinary title becomes interactive without downloading locked Flight School art.
- Projection Lab can still load Flight School deliberately without missing-texture errors.

### Projection-safe text and one player-facing audio affordance

**Effort:** Small  

Work:

- Move the main title help above the documented 24px safe margin; combine redundant attract/help copy.
- Raise actionable lock reasons, prices, result actions, and controls to at least 11–12px. Small decorative metadata may remain smaller.
- Once Lab is hidden, provide a simple `M` mute shortcut or minimal pause-menu mute action. Do not build a full settings system today.

Acceptance:

- A projector/TV overscan check retains all essential prompts.
- Every action and lock reason is legible at 800×600 from presentation distance.
- Muting does not require developer controls.

### Result destination copy

**Effort:** Small  

Work:

- Make every result prompt name its actual destination.
- School should say Race School, Story should say Story/Garage as appropriate, and custom races should say Custom Tracks.
- Either label the alternate B/Escape destination or make result inputs honor the primary return contract consistently.

Acceptance:

- The displayed A/Enter action always matches the scene actually opened.
- B/Escape behavior is consistent and no result copy says `TITLE` when it returns to a submenu.

## P2 — only after the release gate is green

- Add favicon, page description, and an original social/itch preview image.
- Add a short player README if the jam upload page cannot carry controls and known limitations.
- Consider fuller volume/settings UI after presentation feedback.
- Confirm every new generated asset is included in the release commit; do not rely on local untracked files.

## Required fresh-save smoke gate

Run this after P0/P1 changes, with browser storage cleared:

1. **Boot:** game-only shell at 800×600; title loads visibly; keyboard and controller both enter the carousel.
2. **School:** start, finish, and return to the same School submenu/focus. Verify training gantry remains unchanged.
3. **Story qualifier:** fail, retry, pass, unlock Rival Race, and verify the themed gantry at far approach and outer-lane crossing.
4. **Rival Race:** win, wreck, visit Garage, repair, and retry. Verify persistent hull, emergency tow, payout, and atomic result behavior.
5. **Endless:** always start at full Endless hull, wreck, save a distance record, reload, and verify Story hull is unchanged.
6. **Pause:** resume, restart, and exit in a finite mode; verify Endless stays unpaused by design.
7. **Audio/input:** unlock browser audio, test mute, controller reconnect, keyboard `C` boost, and both airbrakes.
8. **Hosting:** run the production build from a nested path and inspect the browser console/network log for 404s or missing textures.

Capture at least one 800×600 screenshot for title, School result, each Story gantry, Story wreck/tow, Endless result/record, and the clean public shell.

## Ship decision

Ship the jam build when:

- all P0 acceptance criteria pass;
- the full automated suite and production build pass;
- the fresh-save smoke matrix has no progression, persistence, input, audio-unlock, or asset-load blocker;
- no essential UI is clipped at 800×600;
- generated art required by the build is tracked and packaged.

Use presentation feedback to decide whether to pursue Steam/itch development. Do not use the remaining jam hours to preemptively build Flight School, multiplayer, or other speculative mechanics.

## Audit provenance

- **Gameplay/readiness reviewer:** result-state integrity, persistence, flow, mechanics-freeze recommendation, and smoke matrix.
- **Presentation reviewer:** live 800×600/1100×800 shell inspection, typography/safe-area review, Story gantry review, and itch path risk.
- **Claude Code:** independent high-effort, read-only audit using `Read`, `Grep`, `Glob`, and `Bash`; confirmed the public-shell, loader, Endless-dashboard, Flight-asset, and release-asset findings. Full external report: `/home/phil/.claude/plans/act-as-an-independent-cozy-pillow.md`.
