import assert from 'node:assert/strict';
import test from 'node:test';

import {
  airtimeCoachView,
  airtimeControlHint,
  formatAirtime,
} from './AirtimeCoach.js';

test('airtime controls use the same actions with device-specific labels', () => {
  assert.equal(
    airtimeControlHint('gamepad'),
    '↑ SHORT  •  ↓ LONG',
  );
  assert.equal(
    airtimeControlHint('keyboard'),
    'W SHORT  •  S LONG',
  );
});

test('airtime formatting is stable before telemetry exists', () => {
  assert.equal(formatAirtime(undefined), '0.00s');
  assert.equal(formatAirtime(-1), '0.00s');
  assert.equal(formatAirtime(0.746), '0.75s');
  assert.equal(
    airtimeCoachView().detail,
    'CENTER CAR  •  HIT GOLD',
  );
  assert.equal(airtimeCoachView().value, '');
});

test('airborne coach explains the effect of the current glide input', () => {
  assert.deepEqual(
    airtimeCoachView({
      phase: 'airborne',
      currentAirSeconds: 0.437,
      glide: 0.8,
    }, 'keyboard'),
    {
      phase: 'airborne',
      title: 'AIRTIME',
      value: '0.44s',
      detail: 'GLIDING LONG  •  PULL ↓',
      controls: '',
      color: '#ffcf3f',
      meter: null,
      pulse: false,
    },
  );
});

test('airborne coach matches the short magenta and long gold world language', () => {
  const short = airtimeCoachView({
    phase: 'airborne', currentAirSeconds: 0.2, glideMode: 'short', glide: 0,
    message: 'SPEED READY  •  PULL ↓', messageTone: 'success',
  });
  const long = airtimeCoachView({
    phase: 'airborne', currentAirSeconds: 0.2, glideMode: 'long', glide: 0,
  });
  assert.equal(short.color, '#ff2d95');
  assert.match(short.detail, /SHORT ARC/);
  assert.doesNotMatch(short.detail, /SPEED READY/);
  assert.equal(long.color, '#ffcf3f');
  assert.match(long.detail, /GLIDING LONG/);
});

test('rock-gap coach makes the speed requirement and readiness explicit', () => {
  const building = airtimeCoachView({
    phase: 'gap', speed: 12000, requiredSpeed: 14400, gapReady: false,
  }, 'gamepad');
  assert.equal(building.title, 'ROCK GAP');
  assert.equal(building.value, '120 / 144');
  assert.equal(building.meter, 12000 / 14400);
  assert.equal(building.color, '#ffcf3f');

  const ready = airtimeCoachView({
    phase: 'gap', speed: 14600, requiredSpeed: 14400, gapReady: true,
  }, 'gamepad');
  assert.equal(ready.title, 'ROCK GAP READY');
  assert.equal(ready.meter, 1);
  assert.equal(ready.color, '#2ee56b');
  assert.equal(ready.pulse, true);

  const needsLiveBoost = airtimeCoachView({
    phase: 'gap', speed: 14600, requiredSpeed: 14400, gapReady: false,
  }, 'gamepad');
  assert.equal(needsLiveBoost.title, 'ROCK GAP');
  assert.equal(needsLiveBoost.color, '#ffcf3f');

  const boundary = airtimeCoachView({
    phase: 'gap', speed: 13788, requiredSpeed: 13800, gapReady: false,
  });
  assert.equal(boundary.value, '137 / 138',
    'a below-threshold speed must never display as equal to the requirement');
});

test('authored success and failure feedback takes priority without changing controls', () => {
  const view = airtimeCoachView({
    phase: 'landed',
    bestAirSeconds: 1.12,
    message: 'SOFT LANDING  +1.12s',
    messageTone: 'success',
  }, 'gamepad');
  assert.equal(view.value, 'BEST 1.12s');
  assert.equal(view.detail, 'SOFT LANDING  +1.12s');
  assert.equal(view.color, '#2ee56b');
  assert.equal(view.controls, '');

  const retry = airtimeCoachView({
    phase: 'gap',
    speed: 10000,
    requiredSpeed: 14000,
    message: 'NEED MORE SPEED  •  NEXT LAP',
    messageTone: 'failure',
  });
  assert.equal(retry.detail, 'NEED MORE SPEED  •  NEXT LAP');
  assert.equal(retry.color, '#ff6b6b');

  const afterGap = airtimeCoachView({
    phase: 'landed',
    message: 'NEED MORE SPEED  •  NEXT LAP',
    messageTone: 'failure',
  });
  assert.equal(afterGap.title, 'TRY AGAIN');
});

test('Flight School introduces dedicated persistent-flight instruments', () => {
  const ready = airtimeCoachView({ flightAssist: true }, 'gamepad');
  assert.equal(ready.title, 'FLIGHT SYSTEMS READY');
  assert.equal(ready.detail, 'ENTER THE FIRST RING');
  assert.match(ready.controls, /STICK FLY/);
  const flying = airtimeCoachView({
    flightAssist: true, flightPhase: 'flight', altitude: 0.62,
    ringsHit: 4, ringsTotal: 10,
  }, 'gamepad');
  assert.equal(flying.title, 'FLIGHT MODE');
  assert.equal(flying.value, 'RINGS 4/10');
  assert.match(flying.controls, /BRAKE/);
});

test('every live detail fits the compact one-line coach budget', () => {
  const views = [
    airtimeCoachView(),
    airtimeCoachView({ phase: 'airborne', glide: -1 }),
    airtimeCoachView({ phase: 'airborne', glide: 1 }),
    airtimeCoachView({ phase: 'gap', speed: 12000, requiredSpeed: 13800 }),
    airtimeCoachView({ phase: 'gap', speed: 13800, requiredSpeed: 13800, gapReady: true }),
    airtimeCoachView({ phase: 'landed', message: 'NEED MORE SPEED  •  NEXT LAP' }),
  ];
  for (const view of views) {
    assert.ok(view.detail.length <= 30, `${view.detail} exceeds the one-line budget`);
  }
});
