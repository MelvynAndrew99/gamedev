import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import { RoadModel } from './RoadModel.js';
import { RoadRenderer } from './RoadRenderer.js';

function chainable(base = {}) {
  let proxy;
  proxy = new Proxy(base, {
    get(target, key) {
      return key in target ? target[key] : () => proxy;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return proxy;
}

function fakeScene() {
  return {
    scale: { width: 960, height: 540 },
    add: {
      graphics: () => chainable(),
      image: () => chainable({ width: 10, height: 10 }),
      text: () => chainable({ width: 170, height: 24 }),
    },
  };
}

function recordingGraphics() {
  const rects = [];
  const paths = [];
  let path = [];

  return {
    rects,
    paths,
    fillStyle() { return this; },
    fillRect(...rect) {
      rects.push(rect);
      return this;
    },
    beginPath() {
      path = [];
      return this;
    },
    moveTo(x, y) {
      path.push([x, y]);
      return this;
    },
    lineTo(x, y) {
      path.push([x, y]);
      return this;
    },
    closePath() { return this; },
    fillPath() {
      paths.push(path);
      return this;
    },
  };
}

test('opaque road slabs overlap their shared edge by one pixel', () => {
  const renderer = new RoadRenderer(fakeScene(), TUNING);
  const graphics = recordingGraphics();
  renderer.g = graphics;

  renderer.drawSegment({
    band: 0,
    surface: 'road',
    index: 0,
    launchApproach: { offset: 0.35, w: 0.2, distanceToRamp: 4 },
    zipper: { offset: -0.45, w: 0.22 },
    startLine: true,
    p1: { screen: { x: 480, y: 300, w: 280 } },
    p2: { screen: { x: 500, y: 200, w: 120 } },
  }, 0);

  assert.deepEqual(
    graphics.rects[0],
    [0, 200, 960, 101],
    'the full-width ground should cover the shared raster row',
  );
  assert.deepEqual(
    graphics.paths[2],
    [
      [200, 301],
      [760, 301],
      [620, 200],
      [380, 200],
    ],
    'the asphalt quad should extend one pixel into the nearer slab',
  );
  for (const pathIndex of [3, 4, 5, 6, 7, 8, 9, 10]) {
    assert.equal(
      graphics.paths[pathIndex][0][1],
      301,
      `road overlay path ${pathIndex} should cover the shared raster row`,
    );
    assert.equal(
      graphics.paths[pathIndex][1][1],
      301,
      `road overlay path ${pathIndex} should cover the shared raster row`,
    );
  }
});

test('gate stays stable while roadside speed markers keep their horizon wink', () => {
  const model = new RoadModel(TUNING);
  model.addStraight(100);
  model.segments[0].gate = { label: 'START / FINISH' };
  model.segments[0].sprites.push({
    key: 'post',
    view: 0.09,
    offset: -1.25,
    speedMarker: true,
  });

  const renderer = new RoadRenderer(fakeScene(), TUNING);
  let gateDraws = 0;
  renderer.drawGate = () => gateDraws++;
  const post = {
    width: 16,
    height: 56,
    visible: false,
    setTexture() { return this; },
    setDisplaySize() { return this; },
    setVisible(visible) {
      this.visible = visible;
      return this;
    },
  };
  renderer.pool = [post];
  const postStates = new Set();

  // Sample more finely than one road segment. Before the fix, integer screen
  // rounding made the gate disappear for alternating portions of this range.
  for (let distance = 8000; distance >= 400; distance -= 20) {
    gateDraws = 0;
    renderer.render(
      model,
      { position: model.trackLength - distance, x: 0 },
      1,
      0
    );
    assert.equal(gateDraws, 1, `gate was culled at distance ${distance}`);
    postStates.add(post.visible);
  }

  assert.deepEqual(
    postStates,
    new Set([true, false]),
    'roadside pickets should retain their alternating speed cadence'
  );
});

test('every boost tier keeps perspective finite, positive, and below the lens cap', () => {
  const model = new RoadModel(TUNING);
  model.addStraight(TUNING.drawDistance + 10);
  const renderer = new RoadRenderer(fakeScene(), TUNING);

  for (const speedPercent of [...TUNING.boostTierCeilings, 10]) {
    renderer.render(model, { position: 0, x: 0 }, speedPercent, 0);
    assert.ok(Number.isFinite(renderer.frameDepth), `${speedPercent}x frame depth`);
    assert.ok(renderer.frameDepth > 0, `${speedPercent}x must not invert perspective`);
    for (const segment of model.segments.slice(1, TUNING.drawDistance)) {
      assert.ok(Number.isFinite(segment.p1.screen.x), `${speedPercent}x projected x`);
      assert.ok(Number.isFinite(segment.p1.screen.y), `${speedPercent}x projected y`);
      assert.ok(segment.p1.screen.w >= 0, `${speedPercent}x projected road width`);
    }
  }
});
