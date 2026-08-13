import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GARAGE_ITEMS,
  PIT_CREW_REPAIR_FRACTIONS,
  applyEmergencyTow,
  applyPitCrewService,
  awardStoryPayout,
  buyGarageItem,
  buyRepair,
  consumeRaceLoadout,
  garageCatalog,
  raceLoadout,
  repairQuote,
  storyStyleBank,
} from './Economy.js';

const tuning = {
  repairPackHealth: 10,
  repairPackCost: 50,
  emergencyHealth: 25,
};

function racer(health = 50, money = 300) {
  return {
    health,
    money,
    maxHealth: 100,
    repair(amount) {
      this.health = Math.min(this.maxHealth, this.health + amount);
    },
  };
}

test('repair quote prorates the final partial pack', () => {
  assert.deepEqual(repairQuote(racer(96), tuning, 10), { health: 4, cost: 20 });
});

test('repair purchase atomically spends money and restores hull', () => {
  const state = racer(50, 60);
  assert.deepEqual(buyRepair(state, tuning, 10),
    { ok: true, reason: null, health: 10, cost: 50 });
  assert.equal(state.health, 60);
  assert.equal(state.money, 10);
});

test('failed purchases do not mutate racer state', () => {
  const state = racer(50, 40);
  assert.equal(buyRepair(state, tuning, 10).reason, 'FUNDS');
  assert.deepEqual({ health: state.health, money: state.money }, { health: 50, money: 40 });
});

test('emergency tow restores only the minimum retry health', () => {
  const wreck = racer(0, 0);
  assert.equal(applyEmergencyTow(wreck, tuning), 25);
  assert.equal(wreck.health, 25);

  const healthy = racer(40, 0);
  assert.equal(applyEmergencyTow(healthy, tuning), 0);
  assert.equal(healthy.health, 40);
});

function career(money = 0) {
  const histories = {};
  return {
    ...racer(55, money),
    pitCrewLevel: 0,
    rivalWinCount: 0,
    musicPlayerUnlocked: false,
    paintBoothUnlocked: false,
    afterburnerFxUnlocked: false,
    afterburnerEligible: false,
    pendingBoostCharges: 0,
    pendingExtraBoostSlot: false,
    getPayoutHistory(key) {
      return structuredClone(histories[key] ?? {
        qualifierWinsPaid: 0, rivalWinsPaid: 0, platinumPaid: false,
        lastQualifierAttempt: 0, lastRivalAttempt: 0,
        qualifierStyleCash: 0, rivalStyleCash: 0, rivalBountyIds: [],
      });
    },
    setPayoutHistory(key, value) { histories[key] = structuredClone(value); },
  };
}

test('garage catalog exposes stable purchase states and enforces upgrade gates', () => {
  const state = career(4000);
  assert.deepEqual(garageCatalog(state).map(({ id }) => id), GARAGE_ITEMS.map(({ id }) => id));
  assert.equal(buyGarageItem(state, 'pit_crew_2').reason, 'REQUIRES_PIT_CREW_1');
  assert.equal(buyGarageItem(state, 'pit_crew_1').ok, true);
  assert.equal(buyGarageItem(state, 'pit_crew_2').reason, 'REQUIRES_RIVAL_WIN');
  state.rivalWinCount = 1;
  assert.equal(buyGarageItem(state, 'pit_crew_2').ok, true);
  assert.equal(buyGarageItem(state, 'pit_crew_2').reason, 'OWNED');
  assert.equal(state.pitCrewLevel, 2);
});

test('starter canisters stack to three while the purchased fourth slot starts empty', () => {
  const state = career(500);
  assert.equal(buyGarageItem(state, 'boost_pack').ok, true);
  assert.equal(buyGarageItem(state, 'boost_pack').loaded, 2);
  assert.equal(buyGarageItem(state, 'boost_pack').loaded, 3);
  assert.equal(buyGarageItem(state, 'boost_pack').reason, 'ARMED');
  assert.equal(buyGarageItem(state, 'extra_boost_slot').ok, true);
  assert.deepEqual(raceLoadout(state, 3), {
    capacity: 4,
    startingSlots: 3,
    consumed: { boostCharges: 3, extraSlot: true },
  });
  assert.equal(state.pendingBoostCharges, 3, 'briefing preview does not consume prep');
  assert.deepEqual(consumeRaceLoadout(state, 3), {
    capacity: 4,
    startingSlots: 3,
    consumed: { boostCharges: 3, extraSlot: true },
  });
  assert.deepEqual(consumeRaceLoadout(state, 3), {
    capacity: 3,
    startingSlots: 0,
    consumed: { boostCharges: 0, extraSlot: false },
  });
});

test('Story purses pay 100/50/25 percent, then stop without consuming losses', () => {
  const state = career();
  const result = (attemptNumber, won = true) => awardStoryPayout(state, {
    trackId: 'neon-gulch', phase: 'qualifier', attemptNumber, won,
  });
  assert.equal(result(1, false).total, 0);
  assert.equal(result(2).purse, 450);
  assert.equal(result(3).purse, 225);
  assert.equal(result(4).purse, 113);
  assert.equal(result(5).purse, 0);
  assert.equal(result(5).duplicate, true, 'same submitted result cannot mint twice');
  assert.equal(state.money, 788);
});

test('six first-clear event purses total 3600 without requiring style or replays', () => {
  const state = career();
  const tracks = ['training-validation', 'neon-gulch', 'syndicate-run'];
  tracks.forEach((trackId) => {
    awardStoryPayout(state, {
      trackId, phase: 'qualifier', attemptNumber: 1, won: true,
    });
    awardStoryPayout(state, {
      trackId, phase: 'rivals', attemptNumber: 1, won: true,
    });
  });
  assert.equal(state.money, 3600);
});

test('style banks and stable rival-ID bounties bank only on wins and remain finite', () => {
  const state = career();
  const payout = (attemptNumber, won, rivalIds, styleCash = 999) =>
    awardStoryPayout(state, {
      trackId: 'training-validation', phase: 'rivals', attemptNumber,
      won, rivalIds, styleCash,
    });
  assert.equal(payout(1, false, ['proving-cyan', 'proving-magenta']).total, 0);
  const first = payout(2, true, ['proving-cyan', 'proving-magenta']);
  assert.equal(first.purse, 600);
  assert.equal(first.style, 300);
  assert.equal(first.bounties, 100);
  const second = payout(3, true, ['proving-cyan', 'proving-gold']);
  assert.equal(second.style, 0);
  assert.equal(second.bounties, 50);
  assert.deepEqual(storyStyleBank(state, 'training-validation', 1, 'rivals'), {
    earned: 300, cap: 300, remaining: 0,
  });
});

test('unknown courses and forged rival IDs cannot expand the authored money supply', () => {
  const state = career();
  const forged = awardStoryPayout(state, {
    trackId: 'forged-course', phase: 'rivals', attemptNumber: 1,
    won: true, styleCash: 999, rivalIds: ['a', 'b', 'c', 'd'],
  });
  assert.equal(forged.total, 0);
  assert.equal(state.money, 0);

  const bounded = awardStoryPayout(state, {
    trackId: 'neon-gulch', phase: 'rivals', attemptNumber: 1,
    won: true,
    rivalIds: ['gulch-rival-cyan', 'gulch-rival-magenta', 'gulch-rival-gold', 'forged'],
  });
  assert.equal(bounded.bounties, 150);
});

test('pit crews repair at most 25% or 50% of max hull without granting a full reset', () => {
  assert.deepEqual(PIT_CREW_REPAIR_FRACTIONS, { 1: 0.25, 2: 0.5 });
  const state = career();
  state.health = 20;
  state.pitCrewLevel = 1;
  assert.deepEqual(applyPitCrewService(state), { level: 1, health: 25 });
  assert.equal(state.health, 45);

  state.health = 20;
  state.pitCrewLevel = 2;
  assert.deepEqual(applyPitCrewService(state), { level: 2, health: 50 });
  assert.equal(state.health, 70, 'heavy damage still leaves a paid repair decision');

  state.health = 80;
  assert.deepEqual(applyPitCrewService(state), { level: 2, health: 20 });
  assert.equal(state.health, 100);
});
