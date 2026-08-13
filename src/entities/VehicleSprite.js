import { VEHICLE_TEXTURES } from '../config/vehicleSprite.js';

// Creates one transformable Phaser Container with synchronized paint/detail
// children. Keeping this as a factory (rather than importing Phaser here)
// preserves the renderer's headless deterministic test boundary.
export function createVehicleSprite(scene, x, y, frame = 0, color = 0x48a8ff) {
  const paint = scene.add.sprite(0, 0, VEHICLE_TEXTURES.paint, frame).setOrigin(0.5, 1);
  const detail = scene.add.sprite(0, 0, VEHICLE_TEXTURES.detail, frame).setOrigin(0.5, 1);
  const vehicle = scene.add.container(x, y, [paint, detail]);
  vehicle.paint = paint;
  vehicle.detail = detail;
  vehicle.frameIndex = frame;
  vehicle.livery = color;
  vehicle.setFrame = (nextFrame) => {
    vehicle.frameIndex = nextFrame;
    paint.setFrame(nextFrame);
    detail.setFrame(nextFrame);
    return vehicle;
  };
  vehicle.setLivery = (nextColor) => {
    vehicle.livery = Number.isInteger(nextColor) ? nextColor : 0x48a8ff;
    paint.setTintMode(0).setTint(vehicle.livery);
    detail.setTintMode(0).clearTint();
    return vehicle;
  };
  vehicle.setDisplaySize = (width, height) => {
    vehicle.setScale(width / (paint.width || 1), height / (paint.height || 1));
    return vehicle;
  };
  vehicle.impactFlash = (flashColor = 0xff5555) => {
    paint.setTint(flashColor).setTintMode(1);
    detail.setTint(flashColor).setTintMode(1);
    return vehicle;
  };
  vehicle.clearImpactFlash = () => {
    paint.setTintMode(0).setTint(vehicle.livery);
    detail.setTintMode(0).clearTint();
    return vehicle;
  };
  Object.defineProperties(vehicle, {
    displayWidth: { get: () => paint.width * Math.abs(vehicle.scaleX) },
    displayHeight: { get: () => paint.height * Math.abs(vehicle.scaleY) },
  });
  vehicle.setLivery(color);
  return vehicle;
}
