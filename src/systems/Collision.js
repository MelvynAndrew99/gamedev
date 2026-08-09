// Collision.js — obstacle hit detection. Pure logic, no Phaser.
//
// The whole collision system is one interval-overlap test, because the
// pseudo-3D world is 1.5-dimensional: an obstacle occupies a segment (z)
// and a lateral interval (x). The player is on a segment at a lateral
// position. Same segment + overlapping intervals = contact. No physics
// engine, no broadphase, no quadtrees — the road IS the broadphase.

// Return every road segment crossed by the car this frame, including both
// endpoints and a campaign lap wrap. Overspeed can advance several segments
// in one long frame, so checking only the destination tunnels through pickups,
// rocks, ramps, and zipper paint.
export function crossedRoadSegments(player, model, tuning, previous = null) {
  if (!previous) {
    return [{ segment: model.findSegment(player.position + tuning.playerZ), x: player.x }];
  }

  let distance = player.position - previous.position;
  if (distance < 0) distance += model.trackLength;
  const fromZ = previous.position + tuning.playerZ;
  const start = Math.floor(fromZ / tuning.segmentLength);
  const end = Math.floor((fromZ + distance) / tuning.segmentLength);
  const crossed = [];

  for (let index = start; index <= end; index++) {
    const boundaryZ = index === start ? fromZ : index * tuning.segmentLength;
    const fraction = distance > 0
      ? Math.max(0, Math.min(
        1,
        (Math.min((index + 1) * tuning.segmentLength, fromZ + distance) - fromZ) /
          distance,
      ))
      : 1;
    crossed.push({
      segment: model.findSegment(boundaryZ),
      x: previous.x + (player.x - previous.x) * fraction,
    });
  }
  return crossed;
}

export function checkObstacleHit(player, model, tuning, previous = null) {
  for (const { segment, x } of crossedRoadSegments(
    player,
    model,
    tuning,
    previous,
  )) {
    for (const s of segment.sprites) {
      if (!s.def || s.hit) continue; // decoration, or already smashed
      if (Math.abs(x - s.offset) < tuning.playerW + s.def.w) {
        s.hit = true; // consumed — renderer stops drawing it
        return s;
      }
    }
  }
  return null;
}
