// Shared executable contract for the player/title/rival vehicle atlas.
// The generator, Phaser loaders, frame policy, projection, and tests all read
// these values so an art-resolution change cannot silently desynchronize one
// presentation from the others.

export const VEHICLE_FRAME_WIDTH = 128;
export const VEHICLE_FRAME_HEIGHT = 112;
export const VEHICLE_STEER_FRAMES = 5;
export const VEHICLE_PITCH_ROWS = 3;
export const VEHICLE_SHEET_WIDTH = VEHICLE_FRAME_WIDTH * VEHICLE_STEER_FRAMES;
export const VEHICLE_SHEET_HEIGHT = VEHICLE_FRAME_HEIGHT * VEHICLE_PITCH_ROWS;

// The deterministic concept extraction is calibrated to a 109-pixel opaque
// neutral hull. Display scales preserve the gameplay and title footprints
// previously tuned around collision and UI.
export const VEHICLE_NEUTRAL_HULL_WIDTH = 108;
export const VEHICLE_HULL_FRAME_RATIO =
  VEHICLE_NEUTRAL_HULL_WIDTH / VEHICLE_FRAME_WIDTH;
export const VEHICLE_FRAME_ASPECT = VEHICLE_FRAME_HEIGHT / VEHICLE_FRAME_WIDTH;
export const VEHICLE_GAMEPLAY_SCALE = 1.4;
export const VEHICLE_TITLE_SCALE = 0.98;

export const VEHICLE_TEXTURES = Object.freeze({
  composite: 'car',
  paint: 'car-paint',
  detail: 'car-detail',
});

export const VEHICLE_LIVERIES = Object.freeze([
  0x48a8ff,
  0xff4f8f,
  0xffb229,
  0x5ee878,
  0xb978ff,
  0xff6b5c,
]);

export const VEHICLE_LIVERY_NAMES = Object.freeze([
  'PULSE BLUE',
  'NEON PINK',
  'GOLD RUSH',
  'LASER GREEN',
  'VIOLET DRIVE',
  'HEAT CORAL',
]);

export function vehicleLiveryIndex(color) {
  const index = VEHICLE_LIVERIES.indexOf(Number(color));
  return index >= 0 ? index : 0;
}

export function nextVehicleLivery(color, direction = 1) {
  const index = vehicleLiveryIndex(color);
  const step = direction < 0 ? -1 : 1;
  return VEHICLE_LIVERIES[(index + step + VEHICLE_LIVERIES.length) % VEHICLE_LIVERIES.length];
}

export function loadVehicleSheets(scene) {
  const frameConfig = {
    frameWidth: VEHICLE_FRAME_WIDTH,
    frameHeight: VEHICLE_FRAME_HEIGHT,
  };
  scene.load.spritesheet(VEHICLE_TEXTURES.composite, 'assets/car-v2.png', frameConfig);
  scene.load.spritesheet(VEHICLE_TEXTURES.paint, 'assets/car-v2-paint.png', frameConfig);
  scene.load.spritesheet(VEHICLE_TEXTURES.detail, 'assets/car-v2-detail.png', frameConfig);
}
