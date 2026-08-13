import assert from 'node:assert/strict';
import test from 'node:test';

import { TUNING } from '../config/tuning.js';
import { Boost } from './Boost.js';
import { Player } from './Player.js';

const DT = 1 / 60;

function run(boost, seconds, pressed) {
  for (let elapsed = 0; elapsed < seconds; elapsed += DT) {
    boost.update(DT, typeof pressed === 'function' ? pressed(elapsed) : pressed);
  }
}

// Presses for one frame then releases for one frame, like a quick controller
// tap. Returns the `justActivated` pulse from the PRESS frame — the flag is a
// one-frame signal that the following release frame would otherwise clear.
function tap(boost) {
  boost.update(DT, true);
  const activated = boost.justActivated;
  boost.update(DT, false);
  return activated;
}

function simulateBoost(pressedAtFrame, seconds = 5) {
  const boost = new Boost(TUNING);
  for (let i = 0; i < TUNING.nitroMax; i++) boost.collect();
  const player = new Player(TUNING);
  player.speed = TUNING.maxSpeed;
  const model = {
    trackLength: 1e9,
    findSegment: () => ({
      curve: 0,
      surface: 'road',
      p1: { world: { y: 0 } },
      p2: { world: { y: 0 } },
    }),
  };
  let peak = 0;
  let activeFrames = 0;

  for (let frame = 0; frame < seconds * 60; frame++) {
    boost.update(DT, pressedAtFrame(frame));
    if (boost.justActivated > 0) {
      player.boost(TUNING.boostTierCeilings[boost.justActivated - 1]);
    } else if (boost.justExtended) {
      player.boost(TUNING.boostTierCeilings[boost.tier - 1]);
    }
    player.update(DT, {
      steer: 0,
      throttle: 1,
      brake: 0,
      airbrakeL: false,
      airbrakeR: false,
      boostActive: boost.tier > 0,
      boostCeiling: boost.ceilingMultiplier,
    }, model);
    peak = Math.max(peak, player.speed / TUNING.maxSpeed);
    if (boost.tier > 0) activeFrames++;
  }
  return { peak, activeFrames };
}

test('a single tap reaches tier 1 and spends one slot', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  const activated = tap(boost);
  assert.equal(activated, 1);
  assert.equal(boost.tier, 1);
  assert.equal(boost.slots, 0);
  assert.equal(boost.ceilingMultiplier, TUNING.boostTierCeilings[0]);
});

test('three taps inside the chain window stack to tier 3', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  boost.collect();
  boost.collect();
  assert.equal(tap(boost), 1);
  assert.equal(boost.tier, 1);
  run(boost, TUNING.boostChainWindow * 0.5, false);
  assert.equal(tap(boost), 2);
  assert.equal(boost.tier, 2);
  run(boost, TUNING.boostChainWindow * 0.5, false);
  assert.equal(tap(boost), 3);
  assert.equal(boost.tier, 3);
  assert.equal(boost.slots, 0);
  assert.equal(boost.ceilingMultiplier, TUNING.boostTierCeilings[2]);
});

test('a fourth stack attempt with an empty bank does nothing', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  assert.equal(tap(boost), 1);
  assert.equal(tap(boost), 0, 'no slots left — a press should not activate anything');
  assert.equal(boost.tier, 1);
  assert.equal(boost.slots, 0);
});

test('a tap outside the chain window restarts at tier 1, not a stack', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  boost.collect();
  assert.equal(tap(boost), 1);
  assert.equal(boost.tier, 1);
  // Let the whole burn window (and therefore the chain) lapse.
  run(boost, TUNING.boostBurnDuration + 0.05, false);
  assert.equal(boost.tier, 0, 'boost should have worn off by itself');
  assert.equal(tap(boost), 1, 'a late tap starts a fresh tier 1, not tier 2');
  assert.equal(boost.tier, 1);
});

test('holding drains slots over time and extends duration without raising tier', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  boost.collect();
  boost.collect();
  let extensions = 0;
  run(boost, TUNING.boostHoldDrainInterval * 2 + 0.2, () => {
    if (boost.justExtended) extensions++;
    return true;
  });
  assert.equal(boost.tier, 1, 'holding never escalates tier by itself');
  assert.ok(extensions >= 1, 'holding should have drained at least one extra slot');
  assert.ok(boost.slots < 2, 'holding should have spent banked slots over time');
  assert.equal(boost.holding, true);
});

test('hold threshold classifies the press without spending the next slot early', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  boost.collect();
  boost.collect();

  run(boost, TUNING.boostHoldThreshold + DT, true);
  assert.equal(boost.holding, true);
  assert.equal(boost.slots, 2, 'the initial press should be the only spent slot');

  run(
    boost,
    TUNING.boostHoldDrainInterval - TUNING.boostHoldThreshold - DT * 3,
    true,
  );
  assert.equal(boost.slots, 2, 'slot two buys its own full burn interval');

  run(boost, DT * 4, true);
  assert.equal(boost.slots, 1, 'slot two drains at the configured interval');
  assert.equal(boost.tier, 1, 'holding extends duration without stacking speed');
});

test('the bank never exceeds nitroMax or drops below zero', () => {
  const boost = new Boost(TUNING);
  for (let i = 0; i < TUNING.nitroMax + 5; i++) boost.collect();
  assert.equal(boost.slots, TUNING.nitroMax);
  assert.equal(boost.full, true);
  for (let i = 0; i < TUNING.nitroMax + 5; i++) tap(boost);
  assert.equal(boost.slots, 0);
});

test('a one-race fourth slot increases capacity without changing the tuning singleton', () => {
  const boost = new Boost(TUNING, 4);
  for (let index = 0; index < 8; index++) boost.collect();
  assert.equal(boost.capacity, 4);
  assert.equal(boost.slots, 4);
  assert.equal(TUNING.nitroMax, 3);
});

test('ceilingMultiplier eases back down to exactly overspeedCap after the decay tail', () => {
  const boost = new Boost(TUNING);
  boost.collect();
  tap(boost);
  run(boost, TUNING.boostBurnDuration + 0.05, false); // let the tier end
  assert.equal(boost.tier, 0);
  const justAfter = boost.ceilingMultiplier;
  assert.ok(
    justAfter < TUNING.boostTierCeilings[0] && justAfter > TUNING.overspeedCap,
    'ceiling should be mid-ease immediately after the boost ends',
  );
  run(boost, TUNING.boostDecayTail + 0.05, false);
  assert.equal(boost.ceilingMultiplier, TUNING.overspeedCap);
});

test('with no boost ever taken, the ceiling is simply overspeedCap', () => {
  const boost = new Boost(TUNING);
  assert.equal(boost.ceilingMultiplier, TUNING.overspeedCap);
});

test('tap stack buys redline height while hold buys a longer tier-one burn', () => {
  const tapFrames = new Set([0, 6, 12]);
  const tapped = simulateBoost((frame) => tapFrames.has(frame));
  const held = simulateBoost(() => true);

  assert.equal(tapped.peak, TUNING.boostTierCeilings[2]);
  assert.equal(held.peak, TUNING.boostTierCeilings[0]);
  assert.ok(
    held.activeFrames > tapped.activeFrames * 2.5,
    'holding should trade the same three slots for substantially more burn time',
  );
});
