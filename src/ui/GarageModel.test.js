import test from 'node:test';
import assert from 'node:assert/strict';
import { garageActionBlocked, garageItemBadge } from './GarageModel.js';

test('garage product badges distinguish affordability, ownership, and one-race loadouts', () => {
  assert.equal(garageItemBadge({ cost: 120, perRace: true }, 60), 'FUNDS LOW');
  assert.equal(garageItemBadge({ cost: 120, perRace: true }, 120), 'PER RACE');
  assert.equal(garageItemBadge({ cost: 500 }, 60), 'FUNDS LOW');
  assert.equal(garageItemBadge({ cost: 90, armed: true, perRace: true }, 500), 'NEXT RACE');
  assert.equal(garageItemBadge({ cost: 750, owned: true }, 0), 'OWNED');
  assert.equal(garageItemBadge({ cost: 1400, locked: true }, 5000), 'LOCKED');
});

test('owned music player stays interactive while ordinary owned products do not', () => {
  const music = { owned: true, jukebox: true };
  assert.equal(garageItemBadge(music, 0), 'NOW PLAYING');
  assert.equal(garageActionBlocked(music), false);
  assert.equal(garageActionBlocked({ owned: true }), true);
  assert.equal(garageActionBlocked({ armed: true, perRace: true }), true);
});
