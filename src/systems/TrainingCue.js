// TrainingCue.js — pure outcome gate for adaptive instruction. Level data
// defines a clean diagnostic window and a later assist point; gameplay feeds
// one sample at a time and receives silence, pass, or remediation.

export function trainingCueDecision(cue, sample) {
  const failedBefore = sample.failed ?? false;
  if (!cue || sample.lap !== cue.lap) {
    return { failed: failedBefore, action: 'none' };
  }
  const insideDiagnostic =
    sample.segmentIndex >= cue.diagnostic.from &&
    sample.segmentIndex <= cue.diagnostic.to;
  const failed = failedBefore || (insideDiagnostic && sample.offRoad);
  if (sample.segmentIndex < cue.at) return { failed, action: 'none' };
  return { failed, action: failed ? 'assist' : 'pass' };
}
