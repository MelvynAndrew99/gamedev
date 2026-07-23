// Economy.js — pure transaction rules shared by the garage UI and tests.
// Keeping purchases out of the scene makes future powerups ordinary catalog
// entries instead of one-off UI logic.

export function repairQuote(racer, tuning, requestedHealth) {
  const missing = Math.max(0, racer.maxHealth - racer.health);
  const health = Math.min(missing, Math.max(0, requestedHealth));
  if (health === 0) return { health: 0, cost: 0 };

  const costPerHealth = tuning.repairPackCost / tuning.repairPackHealth;
  return { health, cost: Math.ceil(health * costPerHealth) };
}

export function buyRepair(racer, tuning, requestedHealth) {
  const quote = repairQuote(racer, tuning, requestedHealth);
  if (quote.health === 0) return { ok: false, reason: 'FULL', ...quote };
  if (racer.money < quote.cost) {
    return { ok: false, reason: 'FUNDS', ...quote };
  }

  racer.money -= quote.cost;
  racer.repair(quote.health);
  return { ok: true, reason: null, ...quote };
}

// A wreck at $0 must never deadlock the campaign. The tow is deliberately
// only a quarter-car: enough to retry, too little to erase the consequence.
export function applyEmergencyTow(racer, tuning) {
  const restored = Math.max(0, tuning.emergencyHealth - racer.health);
  racer.repair(restored);
  return restored;
}
