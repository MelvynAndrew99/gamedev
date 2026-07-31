import test from 'node:test';
import assert from 'node:assert/strict';

import { ENVIRONMENT_IDS, getEnvironment } from '../config/environments.js';
import { parallaxOffset } from './ParallaxBackground.js';

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
    ['training-loop', 'neon-gulch', 'syndicate-run', 'endless'],
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

test('unknown environment IDs use the Endless Mode world', () => {
  assert.equal(getEnvironment('missing'), getEnvironment('endless'));
});
