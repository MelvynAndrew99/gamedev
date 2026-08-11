import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatEventTime,
  rivalCourseMarkers,
  rivalEventHudView,
  rivalMarkerIdentity,
} from './RivalHud.js';

test('timed event read rounds up and counts cars from five to zero', () => {
  assert.equal(formatEventTime(65.01), '1:06');
  assert.equal(formatEventTime(0), '0:00');
  assert.equal(formatEventTime(undefined), '--:--');

  const opening = rivalEventHudView({
    timeRemainingSeconds: 40, carsRemaining: 5, startingCars: 5,
  });
  const finish = rivalEventHudView({
    timeRemainingSeconds: 4.2, carsRemaining: 0, startingCars: 5, lap: 4,
  });
  assert.equal(opening.carsText, '5');
  assert.equal(opening.urgent, false);
  assert.equal(finish.carsText, '0');
  assert.equal(finish.urgent, true);
  assert.equal(finish.critical, true);
  assert.equal(finish.cleared, true);
  assert.equal(finish.lapText, 'LAP 4');
});

test('score attack HUD shows an unbounded takedown count without lap semantics', () => {
  const opening = rivalEventHudView({
    timeRemainingSeconds: 35,
    takedowns: 0,
    scoreAttack: true,
    lap: 7,
  });
  const veteran = rivalEventHudView({
    timeRemainingSeconds: 4.2,
    takedowns: 12,
    scoreAttack: true,
  });
  assert.equal(opening.timeText, '0:35');
  assert.equal(opening.counterLabel, 'TAKEDOWNS');
  assert.equal(opening.carsText, '0');
  assert.equal(opening.lapText, '');
  assert.equal(opening.cleared, false);
  assert.equal(veteran.carsText, '12');
  assert.equal(veteran.critical, true);
});

test('rival identity is stable by authored id and distinct by shape and color', () => {
  assert.deepEqual(rivalMarkerIdentity('rival-cyan', 2), {
    key: 'cyan', color: 0x00e5ff, shape: 'circle',
  });
  assert.deepEqual(rivalMarkerIdentity('rival-magenta', 0), {
    key: 'magenta', color: 0xff2d95, shape: 'diamond',
  });
  assert.deepEqual(rivalMarkerIdentity('rival-gold', 0), {
    key: 'gold', color: 0xffcf3f, shape: 'square',
  });
  assert.deepEqual(rivalMarkerIdentity('rival-green', 0), {
    key: 'green', color: 0x2ee56b, shape: 'triangle',
  });
  assert.deepEqual(rivalMarkerIdentity('rival-violet', 0), {
    key: 'violet', color: 0xb58cff, shape: 'cross',
  });
});

test('course markers use nearest wrapped location on the existing ribbon', () => {
  const markers = rivalCourseMarkers({
    playerPosition: 990,
    playerRaceProgress: 0.495,
    trackLength: 1000,
    laps: 2,
    rivals: [
      { id: 'rival-cyan', position: 10 },
      { id: 'rival-magenta', position: 950 },
      { id: 'gone', position: 995, state: 'wrecked' },
    ],
  });

  assert.equal(markers.length, 2);
  assert.equal(markers[0].fraction, 0.505, 'wrapped rival is just ahead');
  assert.equal(markers[0].side, 1);
  assert.equal(markers[1].fraction, 0.475, 'nearby rival stays nearby');
  assert.equal(markers[1].side, -1);
});

test('marker fractions clamp at event ribbon bookends', () => {
  const [before] = rivalCourseMarkers({
    playerPosition: 10, playerRaceProgress: 0, trackLength: 1000, laps: 1,
    rivals: [{ id: 'rival-gold', position: 990 }],
  });
  const [after] = rivalCourseMarkers({
    playerPosition: 990, playerRaceProgress: 1, trackLength: 1000, laps: 1,
    rivals: [{ id: 'rival-gold', position: 10 }],
  });
  assert.equal(before.fraction, 0);
  assert.equal(after.fraction, 1);
});

test('single-loop markers remain beside the player across both seam directions', () => {
  const markers = rivalCourseMarkers({
    playerPosition: 990,
    playerRaceProgress: 0.99,
    trackLength: 1000,
    laps: 1,
    loop: true,
    rivals: [
      { id: 'rival-cyan', position: 10 },
      { id: 'rival-magenta', position: 970 },
    ],
  });
  assert.equal(markers[0].fraction, 1, 'just-ahead rival stays at the nearby right bookend');
  assert.equal(markers[0].side, 1);
  assert.equal(markers[1].fraction, 0.97, 'just-behind rival remains behind the player');
  assert.equal(markers[1].side, -1);

  const [behindAcrossStart] = rivalCourseMarkers({
    playerPosition: 10,
    playerRaceProgress: 0.01,
    trackLength: 1000,
    laps: 1,
    loop: true,
    rivals: [{ id: 'rival-gold', position: 990 }],
  });
  assert.equal(behindAcrossStart.fraction, 0);
  assert.equal(behindAcrossStart.side, -1);
});

test('five nearby rivals fan into non-occluding ribbon lanes', () => {
  const ribbonWidth = 336;
  const markers = rivalCourseMarkers({
    playerPosition: 0,
    playerRaceProgress: 0,
    trackLength: 466,
    laps: 1,
    loop: true,
    ribbonWidth,
    rivals: [
      { id: 'rival-cyan', position: 10 },
      { id: 'rival-magenta', position: 16 },
      { id: 'rival-gold', position: 22 },
      { id: 'rival-green', position: 28 },
      { id: 'rival-violet', position: 34 },
    ],
  });

  assert.equal(markers.length, 5);
  assert.equal(new Set(markers.map((marker) => marker.shape)).size, 5);
  for (const marker of markers) {
    const centerY = 30 + marker.yOffset;
    assert.ok(centerY - 5 >= 25, 'markers stay below the LAP/player-chevron band');
    assert.ok(centerY + 5 <= 52, 'markers stay inside the ribbon chip');
  }
  for (let i = 0; i < markers.length; i += 1) {
    for (let j = i + 1; j < markers.length; j += 1) {
      const dx = (markers[i].fraction - markers[j].fraction) * ribbonWidth +
        markers[i].xOffset - markers[j].xOffset;
      const dy = markers[i].yOffset - markers[j].yOffset;
      assert.ok(
        Math.hypot(dx, dy) >= 9.5,
        `${markers[i].id}/${markers[j].id} markers overlap`,
      );
    }
  }
});

test('packed seam markers remain inside the ribbon bookends', () => {
  const ribbonWidth = 336;
  const markers = rivalCourseMarkers({
    playerPosition: 0,
    playerRaceProgress: 0,
    trackLength: 1000,
    loop: true,
    ribbonWidth,
    rivals: [
      { id: 'rival-cyan', position: 0 },
      { id: 'rival-magenta', position: 0 },
      { id: 'rival-gold', position: 0 },
      { id: 'rival-green', position: 0 },
      { id: 'rival-violet', position: 0 },
    ],
  });
  for (const marker of markers) {
    const x = marker.fraction * ribbonWidth + marker.xOffset;
    assert.ok(x >= 0 && x <= ribbonWidth);
  }
});
