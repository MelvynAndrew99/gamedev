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
