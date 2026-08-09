# Playtesting
Qualitative
Look for emotion
aim for 3-4 full playthroughs

# Analytics
Quantitative
look for patterns
figure out 2-3 important numbers


## TODO

### Parallax the Sun
The sun in the background of the tracks is static and it looks funny compared to the rest of the parallax graphics

## Remove Trophies from HUD

Make a dedicated player screen to show off trophies.  They should be like steam achievements, but we are going to give rewards based on the trophy cabinet.

## Story mode: author for the stacked/held boost mechanic

Redline (Training 3) taught tap-to-stack / hold-to-sustain boosting, and the
underlying physics (Player.js, Boost.js) is shared code, so Neon Gulch,
Syndicate Run, and Endless already play with the new depth. What's missing is
content that actually invites it there:

- Author deliberate pickup clusters (2-3 close together) into Neon Gulch and
  Syndicate Run instead of relying on today's sparse/random `placeBoostPads`
  placement, which rarely banks enough slots for a real tap-stack.
- Decide how Endless Mode's pickup frequency should scale with difficulty —
  right now it doesn't scale at all.
- Once authored, update GAME_DESIGN.md's Neon Gulch/Syndicate Run role
  sections to describe the boost placements the same way their nitro
  before-a-climb guidance already does.
