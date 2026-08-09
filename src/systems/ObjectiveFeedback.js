// ObjectiveFeedback.js — lossless, ordered delivery from authoritative
// ObjectiveState updates to the non-blocking HUD confirmation channel.

export function objectiveFeedbackEvent(sequence, objective = {}) {
  return Object.freeze({
    sequence,
    id: objective.id,
    label: objective.label,
    hudLabel: objective.hudLabel,
  });
}

export function nextObjectiveFeedback(events = [], afterSequence = 0) {
  return events.find((event) => event.sequence > afterSequence) ?? null;
}
