import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEmergencyTow, buyRepair, repairQuote } from './Economy.js';

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
