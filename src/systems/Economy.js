// Economy.js — pure/bounded transaction rules shared by gameplay and garage.

export const STORY_PAYOUTS = Object.freeze({
  courses: Object.freeze({
    'training-validation': Object.freeze({
      qualifier: 350, rivals: 600,
      rivalIds: Object.freeze(['proving-cyan', 'proving-magenta', 'proving-gold']),
    }),
    'neon-gulch': Object.freeze({
      qualifier: 450, rivals: 750,
      rivalIds: Object.freeze([
        'gulch-rival-cyan', 'gulch-rival-magenta', 'gulch-rival-gold',
      ]),
    }),
    'syndicate-run': Object.freeze({
      qualifier: 550, rivals: 900,
      rivalIds: Object.freeze(['rival-cyan', 'rival-magenta', 'rival-gold']),
    }),
  }),
  replayMultipliers: Object.freeze([1, 0.5, 0.25]),
  paidWinsPerPhase: 3, // first win plus two smaller replay purses
  styleCaps: Object.freeze({ qualifier: 150, rivals: 300 }),
  rivalBounty: 50,
});

export const PIT_CREW_REPAIR_FRACTIONS = Object.freeze({
  1: 0.25,
  2: 0.5,
});

export const GARAGE_ITEMS = Object.freeze([
  Object.freeze({
    id: 'boost_pack', category: 'race', label: 'STARTER CANISTER', cost: 75,
    description: 'Load 1 boost for your next Story race. Buy up to 3.',
  }),
  Object.freeze({
    id: 'extra_boost_slot', category: 'race', label: 'OVERCHARGE RACK', cost: 150,
    description: 'Add an empty fourth slot for your next Story race. Fill it on the track.',
  }),
  Object.freeze({
    id: 'pit_crew_1', category: 'upgrade', label: 'PIT CREW', cost: 800,
    description: 'Your crew restores up to 25% of max hull after every completed Story event.',
  }),
  Object.freeze({
    id: 'pit_crew_2', category: 'upgrade', label: 'UPGRADE PIT CREW', cost: 1400,
    requires: 'pit_crew_1',
    description: 'Your upgraded crew restores up to 50% of max hull after completed Story events.',
  }),
  Object.freeze({
    id: 'music_player', category: 'unlock', label: 'MUSIC PLAYER', cost: 500,
    description: 'Unlock the garage jukebox and listen to the game soundtrack.',
  }),
]);

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
  racer.recordSpending?.('repairs', quote.cost);
  return { ok: true, reason: null, ...quote };
}

// A wreck at $0 must never deadlock the campaign. The tow is deliberately
// only a quarter-car: enough to retry, too little to erase the consequence.
export function applyEmergencyTow(racer, tuning) {
  const restored = Math.max(0, tuning.emergencyHealth - racer.health);
  racer.repair(restored);
  return restored;
}

function itemFlags(racer, id) {
  if (id === 'boost_pack') {
    const loaded = Math.min(3, Math.max(0, Math.floor(
      Number(racer.pendingBoostCharges ?? (racer.pendingBoostPack ? 1 : 0)) || 0,
    )));
    return { owned: false, armed: loaded >= 3, loaded, limit: 3 };
  }
  if (id === 'extra_boost_slot') {
    return { owned: false, armed: racer.pendingExtraBoostSlot === true };
  }
  if (id === 'pit_crew_1') return { owned: racer.pitCrewLevel >= 1, armed: false };
  if (id === 'pit_crew_2') return { owned: racer.pitCrewLevel >= 2, armed: false };
  if (id === 'music_player') return { owned: racer.musicPlayerUnlocked === true, armed: false };
  return { owned: false, armed: false };
}

export function garageItemState(racer, id) {
  const item = GARAGE_ITEMS.find((candidate) => candidate.id === id);
  if (!item) return null;
  const flags = itemFlags(racer, id);
  const locked = !flags.owned && ((item.requires === 'pit_crew_1' && racer.pitCrewLevel < 1) ||
    (id === 'pit_crew_2' && racer.rivalWinCount < 1));
  return Object.freeze({
    ...item,
    ...flags,
    locked,
    affordable: racer.money >= item.cost,
  });
}

export function garageCatalog(racer) {
  return GARAGE_ITEMS.map((item) => garageItemState(racer, item.id));
}

export function buyGarageItem(racer, id) {
  const item = garageItemState(racer, id);
  if (!item) return { ok: false, reason: 'UNKNOWN_ITEM', itemId: id, cost: 0 };
  if (item.locked) {
    const reason = racer.pitCrewLevel < 1
      ? 'REQUIRES_PIT_CREW_1'
      : 'REQUIRES_RIVAL_WIN';
    return { ok: false, reason, itemId: id, cost: item.cost };
  }
  if (item.owned) return { ok: false, reason: 'OWNED', itemId: id, cost: item.cost };
  if (item.armed) return { ok: false, reason: 'ARMED', itemId: id, cost: item.cost };
  if (racer.money < item.cost) {
    return { ok: false, reason: 'FUNDS', itemId: id, cost: item.cost };
  }

  racer.money -= item.cost;
  if (id === 'boost_pack') {
    const loaded = Math.min(3, (item.loaded ?? 0) + 1);
    racer.pendingBoostCharges = loaded;
  }
  else if (id === 'extra_boost_slot') racer.pendingExtraBoostSlot = true;
  else if (id === 'pit_crew_1') racer.pitCrewLevel = 1;
  else if (id === 'pit_crew_2') racer.pitCrewLevel = 2;
  else if (id === 'music_player') racer.musicPlayerUnlocked = true;
  racer.recordSpending?.(item.category === 'race' ? 'supplies' : 'upgrades', item.cost);
  return {
    ok: true,
    reason: null,
    itemId: id,
    cost: item.cost,
    armed: id === 'boost_pack' ? (item.loaded ?? 0) + 1 >= 3 : id === 'extra_boost_slot',
    owned: id !== 'boost_pack' && id !== 'extra_boost_slot',
    ...(id === 'boost_pack'
      ? { loaded: Math.min(3, (item.loaded ?? 0) + 1), limit: 3 }
      : {}),
  };
}

export function raceLoadout(racer, baseCapacity = 3) {
  const boostCharges = Math.min(
    Math.max(1, Math.floor(Number(baseCapacity) || 3)),
    Math.max(0, Math.floor(
      Number(racer.pendingBoostCharges ?? (racer.pendingBoostPack ? 1 : 0)) || 0,
    )),
  );
  const extraSlot = racer.pendingExtraBoostSlot === true;
  return Object.freeze({
    capacity: Math.max(1, Math.floor(Number(baseCapacity) || 3)) + (extraSlot ? 1 : 0),
    // The purchased rack is capacity, not a free fourth charge. This keeps
    // its intended accessibility value while preserving the pickup loop.
    startingSlots: boostCharges,
    consumed: Object.freeze({ boostCharges, extraSlot }),
  });
}

// Story consumes armed help once, when the rolling start line is crossed.
// Merely opening a race scene or backing out of its briefing does not spend it.
export function consumeRaceLoadout(racer, baseCapacity = 3) {
  const loadout = raceLoadout(racer, baseCapacity);
  racer.pendingBoostCharges = 0;
  racer.pendingExtraBoostSlot = false;
  return loadout;
}

export function applyPitCrewService(racer) {
  if (racer.pitCrewLevel <= 0) return { level: 0, health: 0 };
  const level = racer.pitCrewLevel >= 2 ? 2 : 1;
  const fraction = PIT_CREW_REPAIR_FRACTIONS[level];
  const requested = Math.floor(Math.max(0, racer.maxHealth) * fraction);
  const health = Math.min(requested, Math.max(0, racer.maxHealth - racer.health));
  racer.repair(health);
  return { level, health };
}

export function storyStyleBank(racer, trackId, version, phase) {
  const key = `${trackId}:${Math.max(1, Math.floor(Number(version) || 1))}`;
  const history = racer.getPayoutHistory(key);
  const cap = STORY_PAYOUTS.styleCaps[phase] ?? 0;
  const earned = phase === 'qualifier'
    ? history.qualifierStyleCash
    : history.rivalStyleCash;
  return Object.freeze({ earned, cap, remaining: Math.max(0, cap - earned) });
}

// Call for every submitted Story result, including losses, so its monotonically
// increasing attempt number makes repeat calls idempotent without an unbounded
// event-ID list in the save file.
export function awardStoryPayout(racer, {
  trackId,
  version = 1,
  phase,
  attemptNumber,
  won = false,
  fullClear = false,
  styleCash = 0,
  rivalIds = [],
} = {}) {
  const course = STORY_PAYOUTS.courses[trackId];
  const key = `${trackId}:${Math.max(1, Math.floor(Number(version) || 1))}`;
  const history = racer.getPayoutHistory(key);
  const cleanAttempt = Math.max(0, Math.floor(Number(attemptNumber) || 0));
  const attemptField = phase === 'qualifier' ? 'lastQualifierAttempt' : 'lastRivalAttempt';
  if (!course || !['qualifier', 'rivals'].includes(phase) || cleanAttempt <= history[attemptField]) {
    return Object.freeze({
      total: 0, purse: 0, style: 0, bounties: 0,
      capped: false, duplicate: true, claim: null,
      spending: Object.freeze({ repairs: 0, supplies: 0, upgrades: 0, total: 0 }),
    });
  }
  history[attemptField] = cleanAttempt;
  let purse = 0;
  let style = 0;
  let bounties = 0;
  let capped = false;
  let claim = null;
  if (won) {
    const paidField = phase === 'qualifier' ? 'qualifierWinsPaid' : 'rivalWinsPaid';
    const claimIndex = history[paidField];
    const base = course[phase];
    if (claimIndex < STORY_PAYOUTS.paidWinsPerPhase) {
      purse = Math.round(base * STORY_PAYOUTS.replayMultipliers[claimIndex]);
      history[paidField] += 1;
      claim = claimIndex === 0
        ? 'FIRST PURSE'
        : claimIndex === 1
          ? 'REPLAY 2/3'
          : 'FINAL REPLAY PURSE';
    } else {
      capped = true;
      claim = 'PURSE COMPLETE';
    }

    const styleField = phase === 'qualifier' ? 'qualifierStyleCash' : 'rivalStyleCash';
    const styleCap = STORY_PAYOUTS.styleCaps[phase];
    style = Math.min(
      Math.max(0, styleCap - history[styleField]),
      Math.max(0, Math.floor(Number(styleCash) || 0)),
    );
    history[styleField] += style;

    if (phase === 'rivals') {
      const alreadyPaid = new Set(history.rivalBountyIds);
      const eligibleIds = new Set(course.rivalIds);
      const cleanIds = [...new Set(rivalIds
        .map(String)
        .filter((id) => eligibleIds.has(id)))];
      const newIds = cleanIds.filter((id) => !alreadyPaid.has(id));
      bounties = newIds.length * STORY_PAYOUTS.rivalBounty;
      history.rivalBountyIds.push(...newIds);
      racer.rivalWinCount += 1;
      if (fullClear) history.platinumPaid = true;
    }
  }
  const spending = racer.takeSpendingLedger?.() ?? {
    repairs: 0, supplies: 0, upgrades: 0, total: 0,
  };
  racer.setPayoutHistory(key, history);
  racer.money += purse + style + bounties;
  return Object.freeze({
    total: purse + style + bounties,
    purse,
    style,
    bounties,
    capped,
    duplicate: false,
    claim,
    spending: Object.freeze({ ...spending }),
    styleBank: storyStyleBank(racer, trackId, version, phase),
  });
}
