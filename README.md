# Rhythmic Ride

Rhythmic Ride is a fast, music-driven 16-bit arcade racer made for a game jam. Learn its boost, airbrake, and airtime rhythm in Race School; qualify for each Rematch Cup event; then race and wreck a finite field of rivals. Endless Mode turns the same handling into a distance-record challenge.

## Play

The game targets an 800×600 desktop browser canvas. Click or press a game button once if the browser requires interaction before enabling audio. Press `M` anywhere to mute or restore all audio. Finite events also expose separate Music and Sound FX toggles in the pause menu.

### Keyboard

| Action | Input |
| --- | --- |
| Accelerate / brake | Up / Down |
| Steer | Left / Right |
| Boost | C |
| Left / right airbrake | Z / X |
| Shorter / longer airtime arc | W / S |
| Confirm / back | Enter / Escape |
| Pause finite events | Escape |

### Controller

| Action | Input |
| --- | --- |
| Accelerate / brake | R2 / L2 |
| Steer and control airtime | Left stick |
| Boost | West face button — X on Xbox, Square on PlayStation |
| Left / right airbrake | L1 / R1 |
| Confirm / back | South / East face button |
| Pause finite events | Start |

Hit objective cones and speed lines. Avoid rocks unless taking damage is a deliberate risk.

## Modes

- **Race School:** five playable lessons teach racing fundamentals. Flight School remains a clearly marked post-jam `SOON` preview and cannot launch in the jam build.
- **Story:** beat each qualifier clock to unlock its Rival Race. Winning earns Gold; winning after eliminating all three rivals earns Platinum.
- **Endless:** start each attempt with a fresh hull and chase a persistent best-distance record through three environments.
- **Trophy Room:** review School trophies, lifetime style statistics, achievements, and the best Endless distance/stage.
- **Garage and Music Player:** spend Story winnings on repairs, race supplies, Pit Crew upgrades, and the unlockable soundtrack player.
- **Custom Tracks:** the Track Editor is revealed as a campaign-completion reward.

Story damage persists between events. Endless hull damage is isolated to the current distance attempt.

## Development

Requires Node.js 22 or a compatible current Node release.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

The production upload is the contents of `dist/`. Vite uses relative asset paths so the build works from itch.io-style nested locations.

### Projection Lab

Projection Lab is hidden from the normal player presentation. Press **F2** or **Ctrl+Shift+L** to toggle it, or open the game with `?lab=1`.

The Lab intentionally bypasses player progression for testing: it can launch any course or open the Track Editor without changing the saved unlock state. Its music and sound sliders remain developer mix controls; player-facing Music and Sound FX toggles live in the pause menu.

## Jam scope

- Flight School code and art are preserved for post-jam development but the course is locked as `SOON`.
- Multiplayer and asynchronous track attacks are design hooks only; the jam build does not claim network play.
- Core School/Story balance is frozen for presentation unless a repeatable blocker is found.

See [JAM_READINESS_PLAN.md](./JAM_READINESS_PLAN.md) for the release gate and remaining polish work.
