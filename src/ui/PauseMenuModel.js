export const PAUSE_ACTIONS = Object.freeze([
  Object.freeze({ id: 'resume', label: 'RESUME' }),
  Object.freeze({ id: 'restart', label: 'RESTART EVENT' }),
  Object.freeze({ id: 'exit', label: 'EXIT TO COURSE SELECT' }),
]);

export function canPauseRace({
  mode,
  done = false,
  awaitingBriefing = false,
  trainingTutorial = false,
} = {}) {
  return mode !== 'endless' && !done && !awaitingBriefing && !trainingTutorial;
}

export function movePauseSelection(index, direction, count = PAUSE_ACTIONS.length) {
  if (!Number.isInteger(count) || count <= 0) return 0;
  const current = Number.isInteger(index) ? index : 0;
  const step = direction < 0 ? -1 : 1;
  return (current + step + count) % count;
}
