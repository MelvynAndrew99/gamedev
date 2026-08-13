import test from 'node:test';
import assert from 'node:assert/strict';

import { ENVIRONMENT_IDS, getEnvironment } from '../config/environments.js';
import { parallaxOffset, perspectiveOffset } from './ParallaxBackground.js';

test('every game mode has a complete two-layer environment', () => {
  const semanticColors = [
    'rumbleA',
    'rumbleB',
    'zipperA',
    'zipperB',
    'zipperGlow',
    'launchA',
    'launchB',
    'launchEdge',
  ];

  assert.deepEqual(
    ENVIRONMENT_IDS,
    [
      'proving-ground', 'training-loop', 'flight-school',
      'neon-gulch', 'syndicate-run', 'endless',
    ],
  );

  for (const id of ENVIRONMENT_IDS) {
    const environment = getEnvironment(id);
    assert.equal(environment.colors.skyBands.length, 6, `${id} sky band count`);
    assert.equal(environment.layers.length, 2, `${id} parallax layer count`);
    assert.ok(
      environment.layers[0].curveFactor < environment.layers[1].curveFactor,
      `${id} near layer should react more strongly to curves`,
    );
    assert.ok(
      environment.layers[0].travelFactor < environment.layers[1].travelFactor,
      `${id} near layer should travel faster than the far layer`,
    );
    for (const color of semanticColors) {
      assert.equal(
        environment.colors[color],
        undefined,
        `${id} must not redefine gameplay color ${color}`,
      );
    }
  }
});

test('Story Proving Ground has a distinct night-test environment from Race School', () => {
  const story = getEnvironment('proving-ground');
  const school = getEnvironment('training-loop');
  assert.notEqual(story, school);
  assert.notDeepEqual(story.colors.skyBands, school.colors.skyBands);
  assert.notDeepEqual(story.trackside.kinds, school.trackside.kinds);
});

test('Flight School owns a distinct generated skyport plate and synth-pop palette', () => {
  const flight = getEnvironment('flight-school');
  const school = getEnvironment('training-loop');
  assert.equal(flight.backgroundAsset, 'flight-school-city');
  assert.notDeepEqual(flight.colors.skyBands, school.colors.skyBands);
  assert.notDeepEqual(flight.trackside.kinds, school.trackside.kinds);
});

test('near scenery produces stronger parallax than far scenery', () => {
  const environment = getEnvironment('neon-gulch');
  const [far, near] = environment.layers;
  const distance = 12000;
  const curveOffset = 180;
  const segmentLength = 200;

  const farOffset = parallaxOffset(distance, curveOffset, far, segmentLength);
  const nearOffset = parallaxOffset(distance, curveOffset, near, segmentLength);

  assert.ok(Math.abs(nearOffset) > Math.abs(farOffset));
});

test('bends and hills move every depth layer with exaggerated perspective', () => {
  const environment = getEnvironment('neon-gulch');
  const [far, near] = environment.layers;
  const farShift = perspectiveOffset(180, -70, far);
  const nearShift = perspectiveOffset(180, -70, near);
  const sunShift = perspectiveOffset(180, -70, {
    curveFactor: environment.celestial.curveFactor ?? 0.18,
    pitchFactor: environment.celestial.pitchFactor ?? 0.32,
  });

  assert.ok(sunShift.x < 0, 'a right bend should sweep the fixed sun left');
  assert.ok(sunShift.y < 0, 'a negative pitch signal should lift the sun');
  assert.ok(Math.abs(farShift.x) > Math.abs(sunShift.x));
  assert.ok(Math.abs(nearShift.x) > Math.abs(farShift.x));
  assert.ok(Math.abs(farShift.y) > Math.abs(sunShift.y));
  assert.ok(Math.abs(nearShift.y) > Math.abs(farShift.y));
});

test('explicit perspective factors support environment art direction', () => {
  assert.deepEqual(
    perspectiveOffset(-120, 50, { curveFactor: 0.25, pitchFactor: 0.5 }),
    { x: 30, y: 25 },
  );
});

test('left and right bends mirror every fixed-world layer', () => {
  const environment = getEnvironment('training-loop');
  for (const layer of [
    { curveFactor: environment.celestial.curveFactor ?? 0.18 },
    ...environment.layers,
  ]) {
    const right = perspectiveOffset(180, 0, layer).x;
    const left = perspectiveOffset(-180, 0, layer).x;
    assert.ok(right < 0);
    assert.ok(left > 0);
    assert.equal(left, -right);
  }
  for (const layer of environment.layers) {
    assert.ok(parallaxOffset(0, 180, layer, 200) < 0);
    assert.ok(parallaxOffset(0, -180, layer, 200) > 0);
  }
});

test('unknown environment IDs use the Endless Mode world', () => {
  assert.equal(getEnvironment('missing'), getEnvironment('endless'));
});
