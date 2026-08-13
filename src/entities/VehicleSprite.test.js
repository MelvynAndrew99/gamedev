import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLE_TEXTURES } from '../config/vehicleSprite.js';
import { createVehicleSprite } from './VehicleSprite.js';

function fakeSprite(texture, frame) {
  return {
    texture,
    frame,
    width: 128,
    height: 112,
    tint: null,
    tintMode: 0,
    setOrigin() { return this; },
    setFrame(nextFrame) { this.frame = nextFrame; return this; },
    setTint(nextTint) { this.tint = nextTint; return this; },
    clearTint() { this.tint = null; return this; },
    setTintMode(nextMode) { this.tintMode = nextMode; return this; },
  };
}

function fakeScene() {
  return {
    add: {
      sprite: (_x, _y, texture, frame) => fakeSprite(texture, frame),
      container: (x, y, children) => ({
        x,
        y,
        children,
        scaleX: 1,
        scaleY: 1,
        setScale(nextX, nextY = nextX) {
          this.scaleX = nextX;
          this.scaleY = nextY;
          return this;
        },
      }),
    },
  };
}

test('layered vehicle sprite keeps paint and fixed detail synchronized', () => {
    const vehicle = createVehicleSprite(fakeScene(), 12, 34, 7, 0xff4f8f);

    assert.equal(vehicle.paint.texture, VEHICLE_TEXTURES.paint);
    assert.equal(vehicle.detail.texture, VEHICLE_TEXTURES.detail);
    assert.equal(vehicle.paint.tint, 0xff4f8f);
    assert.equal(vehicle.detail.tint, null);
    assert.equal(vehicle.paint.tintMode, 0);
    assert.equal(vehicle.detail.tintMode, 0);

    vehicle.setFrame(14);
    assert.equal(vehicle.paint.frame, 14);
    assert.equal(vehicle.detail.frame, 14);
});

test('damage flash restores only the authored vehicle paint livery', () => {
    const vehicle = createVehicleSprite(fakeScene(), 0, 0, 2, 0x5ee878);

    vehicle.impactFlash(0xff5555);
    assert.equal(vehicle.paint.tint, 0xff5555);
    assert.equal(vehicle.detail.tint, 0xff5555);
    assert.equal(vehicle.paint.tintMode, 1);
    assert.equal(vehicle.detail.tintMode, 1);

    vehicle.clearImpactFlash();
    assert.equal(vehicle.paint.tint, 0x5ee878);
    assert.equal(vehicle.detail.tint, null);
    assert.equal(vehicle.paint.tintMode, 0);
    assert.equal(vehicle.detail.tintMode, 0);
});
