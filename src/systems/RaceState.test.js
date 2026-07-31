import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceState } from './RaceState.js';

// A tiny fake model — RaceState only needs trackLength.
const model = { trackLength: 10000 };

// Drive to just before the line, then across it (position wraps to a small
// value): that pair of samples is one line crossing.
function crossLine(race) {
  race.update(0.1, { position: 9500 });
  return race.update(0.1, { position: 500 });
}

test('the grid start crossing begins the race without counting a lap', () => {
  const race = new RaceState(model, 2);
  race.prevPos = 8000; // spawned behind the start/finish line (grid setback)

  assert.equal(crossLine(race), 'start'); // first crossing = the start
  assert.equal(race.lap, 1);

  assert.equal(crossLine(race), 'lap'); // lap 1 complete
  assert.equal(race.lap, 2);

  assert.equal(crossLine(race), 'finished'); // lap 2 complete -> finish
  assert.equal(race.finished, true);
});

test('spawning behind the line is not misread as a wrap', () => {
  const race = new RaceState(model, 3);
  race.prevPos = 8000;
  // Rolling toward the line (position increasing) never triggers an event.
  assert.equal(race.update(0.1, { position: 8500 }), null);
  assert.equal(race.update(0.1, { position: 9200 }), null);
  assert.equal(race.crossedStart, false);
});

test('a finished race stops reporting events', () => {
  const race = new RaceState(model, 1);
  assert.equal(crossLine(race), 'start');
  assert.equal(crossLine(race), 'finished');
  assert.equal(crossLine(race), null);
});
