// Pure presentation state for windshield damage. Training simulates four
// 25-hull rock hits without touching the persistent racer; normal modes derive
// the same four visual stages from actual hull. Keeping this logic outside the
// Phaser scene makes the critical boundary explicit and testable.

export function damageFeedbackState({
  training = false,
  trainingHits = 0,
  trainingMax = 0,
  health = 100,
  maxHealth = 100,
  fatalDamage = 25,
} = {}) {
  if (training) {
    if (trainingMax <= 0) return { stage: 0, critical: false, destroyed: false };
    const stage = clamp(Math.floor(trainingHits), 0, trainingMax);
    return {
      stage,
      critical: stage >= Math.max(1, trainingMax - 1),
      destroyed: stage >= trainingMax,
    };
  }

  const safeMax = Math.max(1, maxHealth);
  const healthFrac = clamp(health / safeMax, 0, 1);
  const stage = healthFrac >= 1
    ? 0
    : clamp(Math.ceil((1 - healthFrac) * 4), 0, 4);
  return {
    stage,
    critical: health > 0 && fatalDamage > 0 && health <= fatalDamage,
    destroyed: health <= 0,
  };
}

export function trainingDamageTrophyMessage(thresholds = [], hits = 0) {
  const possible = [...thresholds]
    .filter((threshold) =>
      threshold.maximumDamageHits == null || hits <= threshold.maximumDamageHits
    )
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))[0];
  return possible
    ? `TRAINING CONTINUES  •  ${String(possible.rank ?? 'TROPHY').toUpperCase()} STILL LIVE`
    : 'TRAINING CONTINUES  •  NO TROPHY';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
