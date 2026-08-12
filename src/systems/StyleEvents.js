import { createGameplayEvent, validGameplayEvent } from './GameplayEvents.js';

const MAX_COALESCED_REWARDS = 64;

export const STORY_STYLE_RULES = Object.freeze({
  coneChain: Object.freeze({ count: 5, windowSeconds: 4 }),
  speedLineChain: Object.freeze({ count: 3, windowSeconds: 6 }),
  boostedHangtime: Object.freeze({ minimumSeconds: 0.85 }),
  longBurn: Object.freeze({ minimumHeldSeconds: 1.05 }),
});

export function storyStyleRulesForTrack(track = {}) {
  const authoredConeLineSize = Math.floor(
    Number(track.styleRewards?.coneLineSize),
  );
  const coneLineSize = Number.isFinite(authoredConeLineSize) &&
    authoredConeLineSize >= 2 && authoredConeLineSize <= 12
    ? authoredConeLineSize
    : STORY_STYLE_RULES.coneChain.count;
  return Object.freeze({
    ...STORY_STYLE_RULES,
    coneChain: Object.freeze({
      ...STORY_STYLE_RULES.coneChain,
      count: coneLineSize,
    }),
  });
}

export const STYLE_REWARDS = Object.freeze({
  cone_chain: Object.freeze({
    title: 'KILLER DRIVING!', detail: 'CONE LINE', icon: 'cones',
    attackClass: 'cone_scatter', color: 0xffcf3f,
  }),
  speed_line_chain: Object.freeze({
    title: 'SPEED DEMON!', detail: '3 SPEED LINES', icon: 'chevrons',
    attackClass: 'road_pressure', color: 0x2ee56b,
  }),
  boosted_hangtime: Object.freeze({
    title: 'SKY HIGH!', detail: 'BOOSTED HANGTIME', icon: 'wings',
    attackClass: 'air_drop', color: 0x00e5ff,
  }),
  triple_boost: Object.freeze({
    title: 'TRIPLE THREAT!', detail: 'TIER 3 BOOST', icon: 'triple',
    attackClass: 'speed_surge', color: 0xff2d95,
  }),
  long_burn: Object.freeze({
    title: 'LONG BURN!', detail: 'HELD BOOST', icon: 'flame',
    attackClass: 'burn_line', color: 0xff7a3d,
  }),
});

// Two independent lanes keep future remote attacks from corrupting or
// displacing local rewards. No network behavior is implemented here.
export class RewardInbox {
  constructor({ localLimit = 16, remoteLimit = 8 } = {}) {
    this.localLimit = localLimit;
    this.remoteLimit = remoteLimit;
    this.local = [];
    this.remote = [];
    this.localOverflow = [];
    this.remoteOverflow = [];
    this.seen = new Set();
  }

  push(event) {
    if (!validGameplayEvent(event) || this.seen.has(event.eventId)) return false;
    const lane = event.type === 'remote_attack' ? this.remote : this.local;
    const limit = event.type === 'remote_attack' ? this.remoteLimit : this.localLimit;
    this.seen.add(event.eventId);
    const overflow = event.type === 'remote_attack'
      ? this.remoteOverflow
      : this.localOverflow;
    if (lane.length < limit && overflow.length === 0) {
      lane.push(event);
      return true;
    }
    // The visible FIFO stays bounded. Overflow is losslessly compressed by
    // semantic reward/attack class: the UI presents ×N and a future attack
    // director can expand repeatCount without losing earned actions.
    const semanticId = event.payload.styleId ?? event.payload.attackClass;
    const tail = overflow.at(-1);
    const tailCount = tail?.payload.repeatCount ?? 1;
    const incomingCount = event.payload.repeatCount ?? 1;
    // Only adjacent equivalent events may be coalesced. Merging across another
    // reward would change the order in which the player earned them.
    if (tail &&
        tailCount + incomingCount <= MAX_COALESCED_REWARDS &&
        (tail.payload.styleId ?? tail.payload.attackClass) === semanticId) {
      overflow[overflow.length - 1] = createGameplayEvent({
        ...tail,
        payload: {
          ...tail.payload,
          repeatCount: tailCount + incomingCount,
          latestEventId: event.payload.latestEventId ?? event.eventId,
        },
      });
    } else {
      overflow.push(event);
    }
    return true;
  }

  takeLocal() {
    return this.local.shift() ?? this.localOverflow.shift() ?? null;
  }

  takeRemote() {
    return this.remote.shift() ?? this.remoteOverflow.shift() ?? null;
  }
}

export class StoryStyleTracker {
  constructor({ runId = 'run', rules = STORY_STYLE_RULES } = {}) {
    this.runId = runId;
    this.rules = rules;
    this.elapsed = 0;
    this.sequence = 0;
    this.inbox = new RewardInbox();
    this.cones = { count: 0, lastAt: -Infinity, seen: new Set() };
    this.speedLines = { count: 0, lastAt: -Infinity, seen: new Set() };
    this.holdSeconds = 0;
    this.longBurnAwarded = false;
  }

  update(dt, { boostHeld = false } = {}) {
    const step = Math.max(0, Number(dt) || 0);
    this.elapsed += step;
    this.expireStreak(this.cones, this.rules.coneChain.windowSeconds);
    this.expireStreak(this.speedLines, this.rules.speedLineChain.windowSeconds);
    if (boostHeld) {
      this.holdSeconds += step;
      if (!this.longBurnAwarded &&
          this.holdSeconds + 1e-9 >= this.rules.longBurn.minimumHeldSeconds) {
        this.longBurnAwarded = true;
        this.emit('long_burn', { heldSeconds: this.holdSeconds });
      }
    } else {
      this.holdSeconds = 0;
      this.longBurnAwarded = false;
    }
  }

  expireStreak(streak, windowSeconds) {
    if (this.elapsed - streak.lastAt <= windowSeconds) return;
    streak.count = 0;
    streak.seen.clear();
  }

  recordCone(objectId) {
    return this.recordStreak(
      this.cones,
      String(objectId),
      this.rules.coneChain.count,
      'cone_chain',
    );
  }

  recordSpeedLine(objectId) {
    return this.recordStreak(
      this.speedLines,
      String(objectId),
      this.rules.speedLineChain.count,
      'speed_line_chain',
    );
  }

  recordStreak(streak, objectId, threshold, styleId) {
    if (!objectId || streak.seen.has(objectId)) return false;
    streak.seen.add(objectId);
    streak.count += 1;
    streak.lastAt = this.elapsed;
    if (streak.count < threshold) return false;
    this.emit(styleId, { count: threshold });
    streak.count = 0;
    streak.seen.clear();
    return true;
  }

  recordBoostTier(tier) {
    if (tier !== 3) return false;
    this.emit('triple_boost', { tier: 3 });
    return true;
  }

  recordLanding({ boosted = false, seconds = 0 } = {}) {
    const airtime = Math.max(0, Number(seconds) || 0);
    if (!boosted || airtime + 1e-9 < this.rules.boostedHangtime.minimumSeconds) {
      return false;
    }
    this.emit('boosted_hangtime', { seconds: airtime });
    return true;
  }

  breakStreaks() {
    [this.cones, this.speedLines].forEach((streak) => {
      streak.count = 0;
      streak.seen.clear();
      streak.lastAt = -Infinity;
    });
    this.holdSeconds = 0;
    this.longBurnAwarded = false;
  }

  emit(styleId, detail = {}) {
    const reward = STYLE_REWARDS[styleId];
    if (!reward) return null;
    this.sequence += 1;
    const event = createGameplayEvent({
      eventId: `${this.runId}:style:${this.sequence}`,
      type: 'style_reward',
      source: 'local',
      timestamp: Math.round(this.elapsed * 1000),
      payload: {
        styleId,
        attackClass: reward.attackClass,
        sequence: this.sequence,
        ...detail,
      },
    });
    this.inbox.push(event);
    return event;
  }

  takeReward() {
    return this.inbox.takeLocal();
  }

  get progress() {
    return Object.freeze({
      cones: this.cones.count,
      coneTarget: this.rules.coneChain.count,
      speedLines: this.speedLines.count,
      speedLineTarget: this.rules.speedLineChain.count,
      holdSeconds: this.holdSeconds,
      holdTarget: this.rules.longBurn.minimumHeldSeconds,
    });
  }
}

export function styleRewardView(event) {
  if (!validGameplayEvent(event, 'style_reward')) return null;
  const reward = STYLE_REWARDS[event.payload.styleId];
  if (!reward) return null;
  const detail = event.payload.styleId === 'boosted_hangtime'
    ? `${Math.max(0, Number(event.payload.seconds) || 0).toFixed(1)}s BOOSTED AIR`
    : event.payload.styleId === 'cone_chain'
      ? `${Math.max(1, Math.floor(Number(event.payload.count) || 1))} CONES`
      : reward.detail;
  const repeats = Math.max(1, Math.floor(Number(event.payload.repeatCount) || 1));
  return Object.freeze({
    ...reward,
    detail: repeats > 1 ? `${detail}  ×${repeats}` : detail,
    repeats,
    styleId: event.payload.styleId,
  });
}
