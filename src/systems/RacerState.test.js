import assert from 'node:assert/strict';
import test from 'node:test';

import { RACER, sanitizeRacerProfile } from './RacerState.js';
import { VEHICLE_LIVERIES } from '../config/vehicleSprite.js';
import { applyEmergencyTow } from './Economy.js';

function storage(initial = null) {
  const data = new Map(initial ? [['rhythmic-ride.garage.v1', JSON.stringify(initial)]] : []);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('malformed profile data sanitizes to bounded migration-safe defaults', () => {
  assert.deepEqual(sanitizeRacerProfile({ version: 1, money: -50, health: 900, pitCrewLevel: 99 }), {
    version: 1,
    money: 0,
    health: 100,
    pitCrewLevel: 2,
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
  });
});

test('car color is persisted and restricted to authored readable liveries', () => {
  globalThis.localStorage = storage({
    version: 1,
    paintBoothUnlocked: true,
    carColor: VEHICLE_LIVERIES[3],
  });
  RACER.reloadProfile();
  assert.equal(RACER.carColor, VEHICLE_LIVERIES[3]);
  RACER.carColor = 0x123456;
  assert.equal(RACER.carColor, VEHICLE_LIVERIES[0]);
  RACER.carColor = VEHICLE_LIVERIES[5];
  RACER.reloadProfile();
  assert.equal(RACER.carColor, VEHICLE_LIVERIES[5]);
});

test('spending ledger is persisted, itemized, and atomically cleared for a receipt', () => {
  globalThis.localStorage = storage({ version: 1, spendingLedger: { repairs: 50 } });
  RACER.reloadProfile();
  RACER.recordSpending('supplies', 75);
  assert.deepEqual(RACER.takeSpendingLedger(), {
    repairs: 50, supplies: 75, upgrades: 0, total: 125,
  });
  assert.deepEqual(RACER.takeSpendingLedger(), {
    repairs: 0, supplies: 0, upgrades: 0, total: 0,
  });
});

test('wallet, hull, ownership, and queued prep survive reload while resetRun grants no repair', () => {
  globalThis.localStorage = storage({
    version: 1, money: 725, health: 42, pitCrewLevel: 1,
    musicPlayerUnlocked: true, pendingBoostPack: true,
  });
  RACER.reloadProfile();
  RACER.resetRun();
  assert.equal(RACER.money, 725);
  assert.equal(RACER.health, 42);
  assert.equal(RACER.pitCrewLevel, 1);
  assert.equal(RACER.musicPlayerUnlocked, true);
  assert.equal(RACER.pendingBoostPack, true);
  assert.equal(RACER.pendingBoostCharges, 1, 'legacy boolean migrates to one charge');
  RACER.repair(8);
  RACER.reloadProfile();
  assert.equal(RACER.health, 50);
});

test('up to three purchased starter charges persist and sanitize safely', () => {
  globalThis.localStorage = storage({ version: 1, pendingBoostCharges: 3 });
  RACER.reloadProfile();
  assert.equal(RACER.pendingBoostCharges, 3);
  RACER.pendingBoostCharges = 99;
  RACER.reloadProfile();
  assert.equal(RACER.pendingBoostCharges, 3);
});

test('payout history reads cannot mutate persisted rival bounty IDs', () => {
  globalThis.localStorage = storage({
    version: 1,
    payoutHistory: {
      'neon-gulch:1': { rivalBountyIds: ['gulch-rival-cyan'] },
    },
  });
  RACER.reloadProfile();
  const copy = RACER.getPayoutHistory('neon-gulch:1');
  copy.rivalBountyIds.push('forged-rival');
  assert.deepEqual(
    RACER.getPayoutHistory('neon-gulch:1').rivalBountyIds,
    ['gulch-rival-cyan'],
  );
});

test('Endless uses a fresh disposable hull without reading or mutating Story damage', () => {
  globalThis.localStorage = storage({ version: 1, health: 42, money: 300 });
  RACER.reloadProfile();

  RACER.beginEndlessRun();
  assert.equal(RACER.inEndlessRun, true);
  assert.equal(RACER.health, 100, 'Endless always starts at full hull');
  RACER.damage(75);
  assert.equal(RACER.health, 25, 'damage still matters during this Endless attempt');

  RACER.endEndlessRun();
  assert.equal(RACER.inEndlessRun, false);
  assert.equal(RACER.health, 42, 'the persistent Story hull is restored unchanged');

  RACER.beginEndlessRun();
  assert.equal(RACER.health, 100, 'the next Endless attempt is fresh again');
  RACER.endEndlessRun();
});

test('Story emergency tow is persisted immediately and remains a bounded floor after reload', () => {
  globalThis.localStorage = storage({ version: 1, health: 0, money: 0 });
  RACER.reloadProfile();

  const tuning = { emergencyHealth: 25 };
  assert.equal(applyEmergencyTow(RACER, tuning), 25);
  assert.equal(RACER.health, 25);

  // Models B/Escape, a scene exit, or a browser reload before Garage opens.
  RACER.reloadProfile();
  assert.equal(RACER.health, 25);
  assert.equal(applyEmergencyTow(RACER, tuning), 0);
  assert.equal(RACER.health, 25);
});
