// AirtimeOutcome.js — pure ordering policy for the final training gap.
// Distance alone is not mastery: the HUD's latched boost/speed readiness and
// the physical landing must agree. Keeping this decision outside GameScene
// makes boundary and duplicate-presentation behavior directly testable.

export function airtimeGapOutcome({
  ready = false,
  landingSegment = 0,
  rockEndSegment = 0,
} = {}) {
  return ready === true && landingSegment > rockEndSegment
    ? 'cleared'
    : 'short';
}

export function shouldAnnounceGapMiss(attempt, { landingNow = false } = {}) {
  // Only suppress the collision duplicate produced by the same landing frame.
  // A stale lap-one result must not silence a later grounded rock contact.
  return !(landingNow && attempt?.result === 'short');
}
