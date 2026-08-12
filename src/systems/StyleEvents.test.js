import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameplayEvent } from './GameplayEvents.js';
import { TRACKS } from '../tracks/index.js';
import {
  RewardInbox,
  StoryStyleTracker,
  storyStyleRulesForTrack,
  styleRewardView,
} from './StyleEvents.js';

function takeIds(tracker) {
  const ids = [];
  let event;
  while ((event = tracker.takeReward())) ids.push(event.payload.styleId);
  return ids;
}

test('five distinct cones earn one Killer Driving reward and repeat as a new set', () => {
  const tracker = new StoryStyleTracker({ runId: 'test' });
  for (let index = 0; index < 4; index++) {
    assert.equal(tracker.recordCone(`cone-${index}`), false);
  }
  assert.equal(tracker.recordCone('cone-3'), false, 'same object cannot inflate the line');
  assert.equal(tracker.recordCone('cone-4'), true);
  assert.deepEqual(takeIds(tracker), ['cone_chain']);
  for (let index = 5; index < 10; index++) tracker.recordCone(`cone-${index}`);
  assert.deepEqual(takeIds(tracker), ['cone_chain']);
});

test('cone reward follows the authored course line size and names its real count', () => {
  const tracker = new StoryStyleTracker({
    runId: 'four-cone-course',
    rules: storyStyleRulesForTrack({ styleRewards: { coneLineSize: 4 } }),
  });
  for (let index = 0; index < 3; index++) {
    assert.equal(tracker.recordCone(`line-cone-${index}`), false);
  }
  assert.equal(tracker.recordCone('line-cone-3'), true);
  assert.equal(styleRewardView(tracker.takeReward()).detail, '4 CONES');
  assert.equal(storyStyleRulesForTrack({ styleRewards: { coneLineSize: 1 } })
    .coneChain.count, 5, 'invalid authored sizes fall back safely');
});

test('every Story course authors at least one achievable cone reward per line', () => {
  assert.deepEqual(
    TRACKS.map((track) => storyStyleRulesForTrack(track).coneChain.count),
    [5, 4, 4],
  );
  TRACKS.forEach((track) => {
    const threshold = storyStyleRulesForTrack(track).coneChain.count;
    const cones = track.objects
      .filter((object) => object.kind === 'cone' && object.objective)
      .sort((a, b) => a.at - b.at);
    const lines = [];
    cones.forEach((cone) => {
      const line = lines.at(-1);
      if (!line || cone.at - line.at(-1).at > 40) lines.push([cone]);
      else line.push(cone);
    });
    assert.ok(lines.length > 0, `${track.name} must author a cone line`);
    lines.forEach((line) => assert.ok(
      line.length >= threshold,
      `${track.name} line at ${line[0].at} has ${line.length}/${threshold} cones`,
    ));
  });
});

test('three distinct speed-line entries earn Speed Demon and timeout resets progress', () => {
  const tracker = new StoryStyleTracker({ runId: 'test' });
  tracker.recordSpeedLine('line-a');
  tracker.recordSpeedLine('line-b');
  tracker.update(6.01);
  assert.equal(tracker.progress.speedLines, 0);
  tracker.recordSpeedLine('line-a');
  tracker.recordSpeedLine('line-b');
  tracker.recordSpeedLine('line-c');
  assert.deepEqual(takeIds(tracker), ['speed_line_chain']);
});

test('boost rewards use exact tier, hold, and landing boundaries', () => {
  const tracker = new StoryStyleTracker({ runId: 'test' });
  assert.equal(tracker.recordBoostTier(2), false);
  assert.equal(tracker.recordBoostTier(3), true);
  assert.equal(tracker.recordLanding({ boosted: false, seconds: 1.2 }), false);
  assert.equal(tracker.recordLanding({ boosted: true, seconds: 0.849 }), false);
  assert.equal(tracker.recordLanding({ boosted: true, seconds: 0.85 }), true);
  tracker.update(1.04, { boostHeld: true });
  tracker.update(0.01, { boostHeld: true });
  tracker.update(1, { boostHeld: true });
  assert.deepEqual(takeIds(tracker), [
    'triple_boost', 'boosted_hangtime', 'long_burn',
  ]);
});

test('long-burn timing is equivalent at 30, 60, and 120Hz', () => {
  for (const hz of [30, 60, 120]) {
    const tracker = new StoryStyleTracker({ runId: `hz-${hz}` });
    for (let frame = 0; frame < Math.ceil(1.05 * hz); frame++) {
      tracker.update(1 / hz, { boostHeld: true });
    }
    assert.deepEqual(takeIds(tracker), ['long_burn']);
  }
});

test('damage breaks partial lines without retracting queued rewards', () => {
  const tracker = new StoryStyleTracker({ runId: 'test' });
  tracker.recordBoostTier(3);
  tracker.recordCone('one');
  tracker.recordSpeedLine('one');
  tracker.breakStreaks();
  assert.equal(tracker.progress.cones, 0);
  assert.equal(tracker.progress.speedLines, 0);
  assert.deepEqual(takeIds(tracker), ['triple_boost']);
});

test('reward inbox preserves burst order, rejects duplicate IDs, and separates remote attacks', () => {
  const inbox = new RewardInbox({ localLimit: 8, remoteLimit: 2 });
  const local = [1, 2, 3, 4, 5].map((sequence) => createGameplayEvent({
    eventId: `burst:${sequence}`,
    type: 'style_reward',
    timestamp: sequence,
    payload: {
      sequence,
      styleId: 'triple_boost',
      attackClass: 'speed_surge',
    },
  }));
  local.forEach((event) => assert.equal(inbox.push(event), true));
  assert.equal(inbox.push(local[0]), false);
  const remote = createGameplayEvent({
    eventId: 'remote:1', type: 'remote_attack', source: 'opponent',
    target: 'local', payload: { attackClass: 'cone_scatter', sequence: 1 },
  });
  assert.equal(inbox.push(remote), true);
  assert.deepEqual(local.map(() => inbox.takeLocal().eventId), local.map((event) => event.eventId));
  assert.equal(inbox.takeRemote().eventId, 'remote:1');
});

test('overflow coalesces repeat counts without losing earned rewards', () => {
  const tracker = new StoryStyleTracker({ runId: 'overflow' });
  for (let index = 0; index < 40; index++) tracker.recordBoostTier(3);
  let delivered = 0;
  let event;
  let compressedView = null;
  while ((event = tracker.takeReward())) {
    delivered += event.payload.repeatCount ?? 1;
    if ((event.payload.repeatCount ?? 1) > 1) compressedView = styleRewardView(event);
  }
  assert.equal(delivered, 40);
  assert.equal(compressedView.repeats, 24);
  assert.match(compressedView.detail, /×24$/);
});

test('overflowed rewards cannot be overtaken after an interleaved dequeue', () => {
  const inbox = new RewardInbox({ localLimit: 2 });
  const reward = (sequence, styleId = 'triple_boost') => createGameplayEvent({
    eventId: `ordered:${sequence}`,
    type: 'style_reward',
    timestamp: sequence,
    payload: {
      sequence,
      styleId,
      attackClass: styleId === 'triple_boost' ? 'speed_surge' : 'air_drop',
    },
  });
  [reward(1), reward(2), reward(3, 'boosted_hangtime')].forEach((event) => {
    assert.equal(inbox.push(event), true);
  });
  assert.equal(inbox.takeLocal().eventId, 'ordered:1');
  assert.equal(inbox.push(reward(4)), true);
  assert.deepEqual(
    [inbox.takeLocal(), inbox.takeLocal(), inbox.takeLocal()].map((event) => event.eventId),
    ['ordered:2', 'ordered:3', 'ordered:4'],
  );
});

test('remote payload validation rejects missing, unknown, and nonfinite attack data', () => {
  const inbox = new RewardInbox();
  const badPayloads = [
    {},
    { attackClass: 'unknown', sequence: 1 },
    { attackClass: 'cone_scatter', sequence: Number.NaN },
    { attackClass: 'cone_scatter', sequence: 1, unexpected: { deep: true } },
  ];
  badPayloads.forEach((payload, index) => {
    const event = createGameplayEvent({
      eventId: `bad:${index}`,
      type: 'remote_attack',
      source: 'opponent',
      target: 'local',
      payload,
    });
    assert.equal(inbox.push(event), false);
  });
});

test('remote overflow compression remains a valid bounded event envelope', () => {
  const inbox = new RewardInbox({ remoteLimit: 1 });
  const remote = (sequence) => createGameplayEvent({
    eventId: `remote:${sequence}`,
    type: 'remote_attack',
    source: 'opponent',
    target: 'local',
    payload: { attackClass: 'cone_scatter', sequence },
  });
  [1, 2, 3].forEach((sequence) => assert.equal(inbox.push(remote(sequence)), true));
  assert.equal(inbox.takeRemote().eventId, 'remote:1');
  const compressed = inbox.takeRemote();
  assert.equal(compressed.payload.repeatCount, 2);
  assert.equal(compressed.payload.latestEventId, 'remote:3');
  const consumer = new RewardInbox();
  assert.equal(consumer.push(compressed), true, 'queue-produced envelope is consumable');
});

test('recompressing a valid batch never exceeds the 64-event envelope cap', () => {
  const inbox = new RewardInbox({ remoteLimit: 1 });
  const remote = (sequence, repeatCount = null) => createGameplayEvent({
    eventId: `batch:${sequence}`,
    type: 'remote_attack',
    source: 'opponent',
    target: 'local',
    payload: {
      attackClass: 'cone_scatter',
      sequence,
      ...(repeatCount == null ? {} : {
        repeatCount,
        latestEventId: `batch:${sequence + repeatCount - 1}`,
      }),
    },
  });
  assert.equal(inbox.push(remote(1)), true);
  assert.equal(inbox.push(remote(2)), true);
  assert.equal(inbox.push(remote(3, 64)), true);
  assert.equal(inbox.takeRemote().eventId, 'batch:1');
  const firstOverflow = inbox.takeRemote();
  const secondOverflow = inbox.takeRemote();
  assert.equal(firstOverflow.payload.repeatCount ?? 1, 1);
  assert.equal(secondOverflow.payload.repeatCount, 64);
  assert.equal(secondOverflow.payload.latestEventId, 'batch:66');
  const consumer = new RewardInbox();
  assert.equal(consumer.push(firstOverflow), true);
  assert.equal(consumer.push(secondOverflow), true);
});

test('style presentation is label-based and formats authoritative airtime', () => {
  const tracker = new StoryStyleTracker({ runId: 'view' });
  tracker.recordLanding({ boosted: true, seconds: 1.234 });
  const view = styleRewardView(tracker.takeReward());
  assert.equal(view.title, 'SKY HIGH!');
  assert.equal(view.detail, '1.2s BOOSTED AIR');
  assert.equal(view.icon, 'wings');
});
