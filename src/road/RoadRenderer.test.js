import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import {
  VEHICLE_FRAME_WIDTH,
  VEHICLE_NEUTRAL_HULL_WIDTH,
} from '../config/vehicleSprite.js';
import { RoadModel } from './RoadModel.js';
import {
  backgroundPitchOffset,
  blendEnvironmentColors,
  flightArchitectureFrame,
  rivalRenderAlpha,
  rivalSpriteFrameSize,
  rivalSpriteMode,
  RoadRenderer,
  storyGantrySpec,
} from './RoadRenderer.js';

test('only authored Story tracks opt into themed gantries', () => {
  assert.deepEqual(storyGantrySpec('training-validation', 'Proving Ground'), {
    key: 'story-gantry-proving-ground',
    label: 'PROVING GROUND',
  });
  assert.equal(storyGantrySpec('syndicate-run').horizontalScale, 1.1);
  assert.equal(storyGantrySpec('training-air', 'Air School'), null);
  assert.equal(storyGantrySpec(undefined, 'Race School'), null);
});

test('Flight School concourse opens around the viewport instead of framing the city', () => {
  const section = { from: 1180, to: 1660 };
  const approach = flightArchitectureFrame(1030, section);
  const entrance = flightArchitectureFrame(1180, section);
  const middle = flightArchitectureFrame(1420, section);
  const nearExit = flightArchitectureFrame(1650, section);

  assert.equal(approach.phase, 'approach');
  assert.ok(approach.opacity < entrance.opacity);
  assert.equal(entrance.phase, 'inside');
  assert.ok(entrance.apertureWidth >= 800 * 0.84);
  assert.ok(middle.apertureWidth >= 800 * 0.95);
  assert.ok(middle.apertureHeight >= 600 * 0.89);
  assert.ok(nearExit.apertureWidth >= 800 * 0.84);
  assert.equal(flightArchitectureFrame(900, section), null);
  assert.equal(flightArchitectureFrame(1800, section), null);
});

test('environment palette blend reaches each endpoint without abrupt channel jumps', () => {
  const from = { road: 0x000000, grass: 0x204060, skyBands: [0x000000] };
  const to = { road: 0xffffff, grass: 0x80a0c0, skyBands: [0xffffff] };
  assert.deepEqual(blendEnvironmentColors(from, to, 0), from);
  assert.equal(blendEnvironmentColors(from, to, 0.5).road, 0x808080);
  assert.equal(blendEnvironmentColors(from, to, 0.5).grass, 0x507090);
  assert.deepEqual(blendEnvironmentColors(from, to, 1), to);
});

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
      sprite: () => chainable({ width: 128, height: 112 }),
      container: () => chainable({ scaleX: 1, scaleY: 1 }),
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
    setTint() { return this; },
    clearTint() { return this; },
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

test('clock cones add a pooled clock silhouette while ordinary cones do not', () => {
  const renderer = new RoadRenderer(fakeScene(), { ...TUNING, drawDistance: 1 });
  const model = new RoadModel({ ...TUNING, drawDistance: 1 });
  model.addStraight(1);
  const segment = model.segments[0];
  segment.clipped = false;
  segment.speedMarkerClipped = false;
  segment.p1.screen = { x: 480, y: 300, scale: 0.02, w: 220 };
  const prop = {
    key: 'cone', view: 0.09, offset: 0, hit: false, timeBonusSeconds: 0,
  };
  segment.sprites = [prop];

  const clockDraws = { circles: 0, hands: 0 };
  renderer.timeBonusMarkers = {
    clear() { clockDraws.circles = 0; clockDraws.hands = 0; return this; },
    lineStyle() { return this; },
    strokeCircle() { clockDraws.circles += 1; return this; },
    lineBetween() { clockDraws.hands += 1; return this; },
  };
  let appliedTint = null;
  const pooledProp = {
    width: 10,
    height: 10,
    setTexture() { return this; },
    setTint(tint) { appliedTint = tint; return this; },
    clearTint() { appliedTint = null; return this; },
    setDisplaySize() { return this; },
    setVisible() { return this; },
  };
  renderer.pool = [pooledProp];
  const stablePool = renderer.pool;

  renderer.renderSprites(model, segment);
  assert.deepEqual(clockDraws, { circles: 0, hands: 0 });

  prop.timeBonusSeconds = 2;
  renderer.renderSprites(model, segment);
  assert.equal(appliedTint, 0x2ee56b, 'clock cones use the authored success green');
  assert.equal(clockDraws.circles, 2, 'dark keyline and white clock face are drawn');
  assert.equal(clockDraws.hands, 4, 'two clock hands are drawn with both outline layers');
  assert.equal(renderer.pool, stablePool, 'rendering reuses the existing prop pool');
});

test('far-only rival staging fades in during its collision grace instead of popping', () => {
  assert.equal(rivalRenderAlpha({ stagingGrace: 1, stagingGraceTotal: 1 }), 0);
  assert.equal(rivalRenderAlpha({ stagingGrace: 0.5, stagingGraceTotal: 1 }), 0.5);
  assert.equal(rivalRenderAlpha({ stagingGrace: 0, stagingGraceTotal: 1 }), 1);
  assert.equal(rivalRenderAlpha({ stagingGrace: 0 }), 1);
});

test('rivals use opaque hull width and a cohesive far LOD instead of engine fragments', () => {
  assert.equal(rivalSpriteMode(7.99), 'beacon');
  assert.equal(rivalSpriteMode(8), 'sprite');
  assert.equal(
    rivalSpriteFrameSize(VEHICLE_NEUTRAL_HULL_WIDTH),
    VEHICLE_FRAME_WIDTH,
    'the measured projected hull requires the full transparent steering frame',
  );
  assert.ok(
    rivalSpriteFrameSize(12) > 12,
    'transparent padding must not silently shrink the visible opponent',
  );
});

test('one rival ID occupies exactly one pooled sprite', () => {
  const renderer = new RoadRenderer(fakeScene(), { ...TUNING, drawDistance: 1 });
  const model = new RoadModel({ ...TUNING, drawDistance: 1 });
  model.addStraight(1);
  const segment = model.segments[0];
  segment.clipped = false;
  segment.p1.screen = { x: 480, y: 300, scale: 0.05, w: 220 };
  segment.p2.screen = { x: 480, y: 290, scale: 0.05, w: 210 };

  renderer.rivalPool = Array.from({ length: 6 }, () => ({
    visible: false,
    setFrame() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setDisplaySize() { return this; },
    setLivery() { return this; },
    setAlpha() { return this; },
    setVisible(value) { this.visible = value; return this; },
  }));
  renderer.rivalMarkers = chainable();
  renderer.rivalShadows = chainable();
  const rival = {
    id: 'rival-cyan', active: true, state: 'cruise', position: 0,
    renderPosition: 0, x: -0.8, renderX: 0.25,
    steer: 0, color: 0x00e5ff,
    screen: { x: 0, y: 0, width: 0, visible: false },
  };

  renderer.renderRivals(model, segment, { x: 0 }, [rival]);
  assert.deepEqual(
    renderer.rivalPool.map((sprite, index) => sprite.visible ? index : null)
      .filter((index) => index !== null),
    [0],
  );
  assert.equal(
    renderer.rivalPool[0].x,
    535,
    'world projection consumes the smooth render lane, not the fixed physics lane',
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

test('projected bends and hills drive the background view offsets', () => {
  const model = new RoadModel(TUNING);
  model.addStraight(30);
  model.addCurve(100, 4, 10);

  const renderer = new RoadRenderer(fakeScene(), TUNING);
  let view;
  renderer.background.render = (...args) => { view = args; };
  renderer.render(model, {
    position: 80 * TUNING.segmentLength,
    x: 0,
  }, 0.8, 0);

  assert.equal(view.length, 3);
  assert.equal(view[0], 80 * TUNING.segmentLength);
  assert.ok(Number.isFinite(view[1]));
  assert.ok(Number.isFinite(view[2]));
  assert.notEqual(view[1], 0, 'the bend should move the background heading');
  assert.notEqual(view[2], 0, 'the hill should move the background horizon');
  assert.ok(Math.abs(view[1]) <= renderer.w * 0.65);
  assert.ok(Math.abs(view[2]) <= renderer.h * 0.14);
});

test('authored bend direction sweeps the fixed panorama opposite the turn', () => {
  const panoramaShift = (curve) => {
    const model = new RoadModel(TUNING);
    model.addStraight(30);
    model.addCurve(100, curve);
    const renderer = new RoadRenderer(fakeScene(), TUNING);
    let view;
    renderer.background.render = (...args) => { view = args; };
    renderer.render(model, { position: 80 * TUNING.segmentLength, x: 0 }, 1, 0);
    return view[1];
  };

  const rightHeading = panoramaShift(8);
  const leftHeading = panoramaShift(-8);
  assert.ok(rightHeading > 0, 'the +8 road should point right on screen');
  assert.ok(leftHeading < 0, 'the -8 road should point left on screen');
  assert.ok(Math.abs(rightHeading + leftHeading) <= 1, 'turn response should mirror');
});

test('weighted road grade gives hills a visible and bounded panorama pitch', () => {
  const model = new RoadModel(TUNING);
  model.addStraight(30);
  model.addHill(18, 6);
  model.addStraight(40);

  const uphill = backgroundPitchOffset(
    model,
    model.segments[86],
    TUNING.segmentLength,
    600,
  );
  assert.ok(uphill >= 20, `uphill pitch should be visible, got ${uphill}`);
  assert.ok(uphill <= 600 * 0.14);

  const downhillModel = new RoadModel(TUNING);
  downhillModel.addStraight(30);
  downhillModel.addHill(18, -6);
  downhillModel.addStraight(40);
  const downhill = backgroundPitchOffset(
    downhillModel,
    downhillModel.segments[86],
    TUNING.segmentLength,
    600,
  );
  assert.equal(downhill, -uphill);
});
