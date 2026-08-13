# Rhythmic Ride — Style Rewards and Lifetime Records

## Purpose

Story mode treats skilled sequences as named style rewards. They celebrate the
player now and produce typed local event envelopes that a future asynchronous
multiplayer mode can translate into opponent-track pressure. This pass does not
implement networking, remote obstacles, matchmaking, or competitive balance.

## Story reward rules

| Reward | Authoritative trigger | Reset | Future attack class |
| --- | --- | --- | --- |
| **Killer Driving!** | Clear one authored cone line: five cones in Proving Ground, four in Neon Gulch and Syndicate Run | Four-second timeout, collision, or after each complete authored line | `cone_scatter` |
| **Speed Demon!** | Enter three distinct road Speed Lines within six seconds between entries | Six-second timeout, collision, or after each group of three | `road_pressure` |
| **Sky High!** | Land after at least 0.85 seconds of measured airtime from a takeoff that had live boost | Evaluated once at each landing | `air_drop` |
| **Triple Threat!** | Activate boost tier three through the tap-chain state machine | Each new tier-three activation | `speed_surge` |
| **Long Burn!** | Sustain a classified held boost for at least 1.05 seconds | Button release, boost end, or collision | `burn_line` |

Owning boost, overlapping one object for several frames, duplicated event IDs,
briefings, and paused/result states cannot award a reward. Cone and Speed Line
sets use distinct authored/live object identities. A crash breaks partial style
lines but never retracts a reward already banked.

## Presentation contract

- Ordinary progress has no persistent panel. Threshold rewards alone use an
  original three-beat action-sports cadence: geometric accent, large named
  title with the exact achievement, then a short readable exit.
- The borderless 230×58 celebration sits in the left peripheral column at
  800×600, outside the road corridor and below the top timing/race ribbon.
  Critical damage has a higher layer and prevents a new celebration from starting.
- Labels, geometric icons, borders, and motion encode identity without relying
  on color or audio. `prefers-reduced-motion` removes the scale pulse and keeps
  a stable readable hold.
- A bounded presentation FIFO plus an ordered overflow backlog keeps local
  rewards lossless. Only adjacent equivalent rewards are compressed into an
  explicit `×N` (capped at 64 per envelope), so a later event can never overtake an earlier one. A separate
  remote lane reserves future opponent notices. Stable event IDs make duplicate
  delivery idempotent. No multiplayer feature is promised by the current UI.

## Lifetime records and achievements

One versioned persistence authority records nonnegative totals for cones,
Speed Lines, measured airtime, qualifying boosted hangtimes, tier-three boosts,
held-boost time, Long Burns, rival takedowns, qualifier clears, and Rival wins.
Each increment uses a stable run/event ID and is accepted once.

The Trophy Room keeps all six school trophies, stars, and the all-Gold teaser,
then adds compact `LIFETIME` and `STYLE` strips—including explicit zeroes—and
four achievement badges:

| Achievement | Requirement |
| --- | --- |
| Cone Killer | 50 lifetime cones |
| Speed Demon | 30 lifetime Speed Lines |
| Sky Rider | 30 seconds lifetime airtime |
| Rival Breaker | 10 lifetime rival takedowns |

Locked badges display exact progress. Earned badges persist their original
timestamp and display an earned state/date. These milestones are data-driven
and can grow without changing the stat ingestion path.

## Future event boundary

Every stat/reward/remote-attack envelope has schema version, stable event ID,
typed event name, source, optional target, timestamp, and a strict per-type
payload allowlist. Lifetime-stat increments accept only the local source.
Local style rewards include a semantic `attackClass`; a later multiplayer
director may map that class to deterministic obstacles on another independent
Endless instance. Remote data must remain untrusted, idempotent, and separate
from lifetime-stat submission.
