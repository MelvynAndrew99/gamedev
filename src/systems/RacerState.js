// RacerState.js — versioned garage/economy persistence plus live car condition.
//
// Wallet, owned upgrades, armed one-race purchases, and claimed race purses
// survive a refresh. `resetRun()` is intentionally navigation-safe and does
// not erase career purchases or repair the hull. This keeps TitleScene from
// quietly deleting progression or granting free service.

import { VEHICLE_LIVERIES } from '../config/vehicleSprite.js';

const KEY = 'rhythmic-ride.garage.v1';
export const RACER_PROFILE_VERSION = 1;

function nonnegativeInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function emptyProfile() {
  return {
    version: RACER_PROFILE_VERSION,
    money: 0,
    health: 100,
    pitCrewLevel: 0,
    musicPlayerUnlocked: false,
    paintBoothUnlocked: false,
    carColor: VEHICLE_LIVERIES[0],
    afterburnerFxUnlocked: false,
    afterburnerEligible: false,
    rivalWinCount: 0,
    pendingBoostCharges: 0,
    pendingExtraBoostSlot: false,
    spendingLedger: { repairs: 0, supplies: 0, upgrades: 0 },
    payoutHistory: {},
  };
}

export function sanitizeRacerProfile(value) {
  const clean = emptyProfile();
  if (!value || value.version !== RACER_PROFILE_VERSION) return clean;
  clean.money = nonnegativeInt(value.money);
  clean.health = Math.min(100, nonnegativeInt(value.health, 100));
  clean.pitCrewLevel = Math.min(2, nonnegativeInt(value.pitCrewLevel));
  clean.musicPlayerUnlocked = value.musicPlayerUnlocked === true;
  clean.paintBoothUnlocked = value.paintBoothUnlocked === true;
  clean.carColor = VEHICLE_LIVERIES.includes(Number(value.carColor))
    ? Number(value.carColor)
    : VEHICLE_LIVERIES[0];
  clean.afterburnerFxUnlocked = value.afterburnerFxUnlocked === true;
  clean.afterburnerEligible = value.afterburnerEligible === true;
  clean.rivalWinCount = nonnegativeInt(value.rivalWinCount);
  // v1 originally stored a single boolean starter canister. Preserve it as
  // one charge while allowing new saves to queue any count from zero to the
  // normal three-slot capacity.
  clean.pendingBoostCharges = Math.min(3, nonnegativeInt(
    value.pendingBoostCharges,
    value.pendingBoostPack === true ? 1 : 0,
  ));
  clean.pendingExtraBoostSlot = value.pendingExtraBoostSlot === true;
  clean.spendingLedger = {
    repairs: nonnegativeInt(value.spendingLedger?.repairs),
    supplies: nonnegativeInt(value.spendingLedger?.supplies),
    upgrades: nonnegativeInt(value.spendingLedger?.upgrades),
  };
  Object.entries(value.payoutHistory ?? {}).forEach(([key, history]) => {
    if (!/^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(key) || !history ||
        typeof history !== 'object') return;
    clean.payoutHistory[key] = {
      qualifierWinsPaid: Math.min(3, nonnegativeInt(history.qualifierWinsPaid)),
      rivalWinsPaid: Math.min(3, nonnegativeInt(history.rivalWinsPaid)),
      platinumPaid: history.platinumPaid === true,
      lastQualifierAttempt: nonnegativeInt(history.lastQualifierAttempt),
      lastRivalAttempt: nonnegativeInt(history.lastRivalAttempt),
      qualifierStyleCash: Math.min(150, nonnegativeInt(history.qualifierStyleCash)),
      rivalStyleCash: Math.min(300, nonnegativeInt(history.rivalStyleCash)),
      rivalBountyIds: [...new Set(
        (Array.isArray(history.rivalBountyIds) ? history.rivalBountyIds : [])
          .filter((id) => /^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(id)),
      )].slice(0, 12),
    };
  });
  return clean;
}

function loadProfile() {
  try {
    return sanitizeRacerProfile(JSON.parse(globalThis.localStorage?.getItem(KEY)));
  } catch {
    return emptyProfile();
  }
}

let profile = loadProfile();
// Endless owns a disposable hull for one distance attempt. Keeping it outside
// the saved profile prevents both directions of leakage: Story damage cannot
// shorten an Endless run, and an Endless wreck cannot damage the Story car.
let endlessHealth = null;

function saveProfile() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Career saving is best-effort; storage failure must never stop a race.
  }
}

export const RACER = {
  maxHealth: 100,

  get health() { return endlessHealth ?? profile.health; },
  set health(value) {
    const health = Math.min(this.maxHealth, nonnegativeInt(value));
    if (endlessHealth != null) {
      endlessHealth = health;
      return;
    }
    profile.health = health;
    saveProfile();
  },

  beginEndlessRun() {
    endlessHealth = this.maxHealth;
  },

  endEndlessRun() {
    endlessHealth = null;
  },

  get inEndlessRun() {
    return endlessHealth != null;
  },

  get money() { return profile.money; },
  set money(value) {
    profile.money = nonnegativeInt(value);
    saveProfile();
  },

  get pitCrewLevel() { return profile.pitCrewLevel; },
  set pitCrewLevel(value) {
    profile.pitCrewLevel = Math.min(2, nonnegativeInt(value));
    saveProfile();
  },

  get musicPlayerUnlocked() { return profile.musicPlayerUnlocked; },
  set musicPlayerUnlocked(value) {
    profile.musicPlayerUnlocked = value === true;
    saveProfile();
  },

  get paintBoothUnlocked() { return profile.paintBoothUnlocked; },
  set paintBoothUnlocked(value) {
    profile.paintBoothUnlocked = value === true;
    saveProfile();
  },

  get carColor() { return profile.carColor; },
  set carColor(value) {
    profile.carColor = VEHICLE_LIVERIES.includes(Number(value))
      ? Number(value)
      : VEHICLE_LIVERIES[0];
    saveProfile();
  },

  get afterburnerFxUnlocked() { return profile.afterburnerFxUnlocked; },
  set afterburnerFxUnlocked(value) {
    profile.afterburnerFxUnlocked = value === true;
    saveProfile();
  },

  get afterburnerEligible() { return profile.afterburnerEligible; },
  set afterburnerEligible(value) {
    profile.afterburnerEligible = value === true;
    saveProfile();
  },

  get rivalWinCount() { return profile.rivalWinCount; },
  set rivalWinCount(value) {
    profile.rivalWinCount = nonnegativeInt(value);
    saveProfile();
  },

  get pendingBoostCharges() { return profile.pendingBoostCharges; },
  set pendingBoostCharges(value) {
    profile.pendingBoostCharges = Math.min(3, nonnegativeInt(value));
    saveProfile();
  },

  // Compatibility seam for older callers and persisted tests. New economy
  // code uses the numeric charge count above.
  get pendingBoostPack() { return profile.pendingBoostCharges > 0; },
  set pendingBoostPack(value) {
    profile.pendingBoostCharges = value === true
      ? Math.max(1, profile.pendingBoostCharges)
      : 0;
    saveProfile();
  },

  get pendingExtraBoostSlot() { return profile.pendingExtraBoostSlot; },
  set pendingExtraBoostSlot(value) {
    profile.pendingExtraBoostSlot = value === true;
    saveProfile();
  },

  recordSpending(category, amount) {
    if (!['repairs', 'supplies', 'upgrades'].includes(category)) return false;
    const cost = nonnegativeInt(amount);
    if (cost <= 0) return false;
    profile.spendingLedger[category] += cost;
    saveProfile();
    return true;
  },

  takeSpendingLedger() {
    const ledger = { ...profile.spendingLedger };
    profile.spendingLedger = { repairs: 0, supplies: 0, upgrades: 0 };
    saveProfile();
    return {
      ...ledger,
      total: ledger.repairs + ledger.supplies + ledger.upgrades,
    };
  },

  // Scene launches are not a "new career" action. Preserve hull as well as
  // wallet so backing out and re-entering Story cannot become a free repair.
  resetRun() {
    // Intentionally empty. A future explicit new-career flow can clear the
    // persisted profile after confirmation; ordinary navigation cannot.
  },

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  },

  repair(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  },

  get healthFrac() {
    return this.health / this.maxHealth;
  },

  getPayoutHistory(key) {
    const stored = profile.payoutHistory[key];
    return stored ? { ...stored, rivalBountyIds: [...stored.rivalBountyIds] } : {
      qualifierWinsPaid: 0,
      rivalWinsPaid: 0,
      platinumPaid: false,
      lastQualifierAttempt: 0,
      lastRivalAttempt: 0,
      qualifierStyleCash: 0,
      rivalStyleCash: 0,
      rivalBountyIds: [],
    };
  },

  setPayoutHistory(key, history) {
    profile.payoutHistory[key] = sanitizeRacerProfile({
      ...emptyProfile(),
      payoutHistory: { [key]: history },
    }).payoutHistory[key] ?? this.getPayoutHistory(key);
    saveProfile();
  },

  // Test/dev seam and an explicit save migration entry point.
  reloadProfile() {
    profile = loadProfile();
    endlessHealth = null;
  },
};
