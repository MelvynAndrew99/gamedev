// Collision.js — obstacle hit detection. Pure logic, no Phaser.
//
// The whole collision system is one interval-overlap test, because the
// pseudo-3D world is 1.5-dimensional: an obstacle occupies a segment (z)
// and a lateral interval (x). The player is on a segment at a lateral
// position. Same segment + overlapping intervals = contact. No physics
// engine, no broadphase, no quadtrees — the road IS the broadphase.

export function checkObstacleHit(player, model, tuning) {
  const seg = model.findSegment(player.position + tuning.playerZ);
  for (const s of seg.sprites) {
    if (!s.def || s.hit) continue; // decoration, or already smashed
    if (Math.abs(player.x - s.offset) < tuning.playerW + s.def.w) {
      s.hit = true; // consumed — renderer stops drawing it
      return s;
    }
  }
  return null;
}