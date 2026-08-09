import assert from 'node:assert/strict';
import test from 'node:test';

import {
  airtimeGapOutcome,
  shouldAnnounceGapMiss,
} from './AirtimeOutcome.js';

test('gap mastery requires both latched readiness and physical clearance', () => {
  assert.equal(airtimeGapOutcome({
    ready: false, landingSegment: 1259, rockEndSegment: 1258,
  }), 'short');
  assert.equal(airtimeGapOutcome({
    ready: true, landingSegment: 1258, rockEndSegment: 1258,
  }), 'short');
  assert.equal(airtimeGapOutcome({
    ready: true, landingSegment: 1259, rockEndSegment: 1258,
  }), 'cleared');
});

test('collision does not announce a gap miss already resolved on landing', () => {
  assert.equal(shouldAnnounceGapMiss(null, { landingNow: true }), true);
  assert.equal(shouldAnnounceGapMiss(
    { result: 'cleared' }, { landingNow: true },
  ), true);
  assert.equal(shouldAnnounceGapMiss(
    { result: 'short' }, { landingNow: true },
  ), false);
  assert.equal(shouldAnnounceGapMiss(
    { result: 'short' }, { landingNow: false },
  ), true, 'a later/lap-reset contact must not inherit suppression');
});
