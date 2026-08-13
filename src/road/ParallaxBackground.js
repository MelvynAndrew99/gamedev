// ParallaxBackground.js — deterministic, code-native horizon scenery.
//
// The road renderer supplies offsets from the projected vanishing point.
// Each scenery layer follows them by a different fraction, creating depth
// without disconnecting the background from the course direction. The
// celestial layer moves least, but deliberately more than strict realism
// would demand: the readable, slightly elastic response is part of the game's
// arcade-cartoon presentation.
// A very small travel drift keeps long straights alive without making the
// landscape look like a sideways conveyor belt.

export class ParallaxBackground {
  constructor(scene, width, height, environment, segmentLength) {
    this.scene = scene;
    this.w = width;
    this.h = height;
    this.environment = environment;
    this.segmentLength = segmentLength;
    this.sky = scene.add.graphics().setDepth(-7);
    this.plate = this.createPlate(environment);
    this.atmosphere = scene.add.graphics().setDepth(-5);
    this.stars = makeStars(environment, width, height);
    this.layers = environment.layers.map((config, index) => ({
      config,
      graphics: scene.add.graphics().setDepth(-4 + index),
      shapes: makeShapes(config, environment.seed + index * 997),
    }));

    this.drawSky();
    this.drawAtmosphere(0, 0);
  }

  displayObjects() {
    return [
      this.sky,
      this.plate,
      this.atmosphere,
      ...this.layers.map((layer) => layer.graphics),
    ].filter(Boolean);
  }

  setAlpha(alpha) {
    this.displayObjects().forEach((object) => object.setAlpha(alpha));
    return this;
  }

  destroy() {
    this.displayObjects().forEach((object) => object.destroy());
  }

  drawSky() {
    this.sky.clear();
    if (this.plate) return;
    const bands = this.environment.colors.skyBands;
    const horizon = this.h / 2;
    const bandH = horizon / bands.length;
    bands.forEach((color, index) => {
      this.sky.fillStyle(color, 1);
      const height = index === bands.length - 1 ? bandH + 5 : bandH + 1;
      this.sky.fillRect(0, index * bandH, this.w, height);
    });

  }

  setEnvironment(environment) {
    this.environment = environment;
    this.plate?.destroy();
    this.plate = this.createPlate(environment);
    this.stars = makeStars(environment, this.w, this.h);
    environment.layers.forEach((config, index) => {
      if (!this.layers[index]) return;
      this.layers[index].config = config;
      this.layers[index].shapes = makeShapes(config, environment.seed + index * 997);
    });
    this.drawSky();
    this.drawAtmosphere(0, 0);
  }

  createPlate(environment) {
    const key = environment.backgroundAsset;
    if (!key || !this.scene.textures?.exists(key)) return null;
    return this.scene.add.image(this.w / 2, this.h / 2, key)
      .setDisplaySize(this.w * 1.03, this.h * 1.03)
      .setDepth(-6);
  }

  drawAtmosphere(curveOffset, horizonOffset) {
    this.atmosphere.clear();
    const orb = this.environment.celestial;
    const shift = perspectiveOffset(curveOffset, horizonOffset, {
      curveFactor: orb.curveFactor ?? 0.18,
      pitchFactor: orb.pitchFactor ?? 0.32,
    });

    // Stars share the far-sky motion and wrap at the edges. This prevents the
    // sun from feeling like a HUD sticker while the rest of the sky stays put.
    const starColor = 0xd9e8e5;
    for (const star of this.stars) {
      const x = wrap(star.x + shift.x, -2, this.w + 2);
      const y = star.y + shift.y;
      this.atmosphere.fillStyle(starColor, star.alpha);
      this.atmosphere.fillRect(x, y, star.size, star.size);
    }

    const x = Math.round(this.w * orb.x + shift.x);
    const y = Math.round(this.h * orb.y + shift.y);
    this.atmosphere.fillStyle(orb.glow, 0.1);
    this.atmosphere.fillCircle(x, y, orb.radius * 1.7);
    this.atmosphere.fillStyle(orb.glow, 0.18);
    this.atmosphere.fillCircle(x, y, orb.radius * 1.28);
    this.atmosphere.fillStyle(orb.color, 0.9);
    this.atmosphere.fillCircle(x, y, orb.radius);
  }

  render(distance, curveOffset, horizonOffset = 0) {
    if (this.plate) {
      this.plate.setPosition(
        this.w / 2 - curveOffset * 0.08,
        this.h / 2 + horizonOffset * 0.12,
      );
    }
    this.drawAtmosphere(curveOffset, horizonOffset);
    for (const layer of this.layers) {
      const { graphics, config, shapes } = layer;
      graphics.clear();
      const offset = parallaxOffset(
        distance,
        curveOffset,
        config,
        this.segmentLength,
      );
      const pitch = perspectiveOffset(curveOffset, horizonOffset, config).y;
      const firstTile = Math.floor((-config.tileWidth - offset) / config.tileWidth);
      const lastTile = Math.ceil((this.w + config.tileWidth - offset) / config.tileWidth);
      for (let tile = firstTile; tile <= lastTile; tile++) {
        const tileX = tile * config.tileWidth + offset;
        this.drawLayer(graphics, config, shapes, tileX, pitch);
      }
    }
  }

  drawLayer(g, config, shapes, tileX, pitch = 0) {
    const baseY = Math.round(this.h * config.baseY + pitch);
    if (config.kind === 'city' || config.kind === 'industrial') {
      drawCity(g, config, shapes, tileX, baseY, this.h);
    } else {
      drawTerrain(g, config, shapes, tileX, baseY, this.h);
    }
    drawDetail(g, config, tileX, baseY);
  }
}

export function parallaxOffset(distance, curveOffset, layer, segmentLength) {
  const traveledSegments = distance / segmentLength;
  // The road's vanishing point moves toward the turn; a fixed landscape
  // sweeps the other way as the player's view yaws into it.
  return -curveOffset * layer.curveFactor - traveledSegments * layer.travelFactor;
}

// Horizontal bend response is authored per environment. Vertical response is
// inferred from that same depth: near silhouettes pitch more than distant
// ones, with a bounded extra push so hill crests read immediately at speed.
export function perspectiveOffset(curveOffset, horizonOffset, layer) {
  const curveFactor = layer.curveFactor ?? 0;
  const pitchFactor = layer.pitchFactor
    ?? Math.min(0.92, Math.max(0.42, 0.36 + curveFactor * 0.84));
  return {
    x: -curveOffset * curveFactor,
    y: horizonOffset * pitchFactor,
  };
}

function makeStars(environment, width, height) {
  const rng = seededRandom(environment.seed ^ 0x9e3779b9);
  const stars = [];
  for (let i = 0; i < environment.stars; i++) {
    stars.push({
      x: Math.floor(rng() * width),
      y: Math.floor(18 + rng() * height * 0.3),
      size: rng() > 0.82 ? 2 : 1,
      alpha: 0.35 + rng() * 0.45,
    });
  }
  return stars;
}

function wrap(value, min, max) {
  const range = max - min;
  return ((value - min) % range + range) % range + min;
}

function drawTerrain(g, config, shapes, tileX, baseY, screenHeight) {
  g.fillStyle(config.color, config.alpha ?? 1);
  g.beginPath();
  g.moveTo(tileX, screenHeight);
  // First and last samples share a height, so adjacent tiles meet as one
  // continuous horizon instead of revealing a repeated vertical seam.
  g.lineTo(tileX, baseY - (shapes[0]?.height ?? 0));
  for (const point of shapes) {
    g.lineTo(tileX + point.x, baseY - point.height);
  }
  g.lineTo(tileX + config.tileWidth, screenHeight);
  g.closePath();
  g.fillPath();
}

function drawCity(g, config, shapes, tileX, baseY, screenHeight) {
  const alpha = config.alpha ?? 1;
  g.fillStyle(config.color, alpha);
  g.fillRect(tileX, baseY, config.tileWidth + 1, screenHeight - baseY);
  for (const building of shapes) {
    const x = Math.round(tileX + building.x);
    const y = Math.round(baseY - building.height);
    g.fillStyle(config.color, alpha);
    g.fillRect(x, y, building.width + 1, building.height + 1);

    if (building.antenna) {
      g.lineStyle(1, config.color, 1);
      g.lineBetween(
        x + Math.floor(building.width / 2),
        y,
        x + Math.floor(building.width / 2),
        y - building.antenna,
      );
    }

    // Sparse warm windows make the city inhabited while keeping gameplay
    // neon the brightest information on screen.
    if (config.windowColor && building.height > 24) {
      g.fillStyle(config.windowColor, 0.42);
      const rows = Math.min(3, Math.floor(building.height / 14));
      for (let row = 0; row < rows; row++) {
        const wy = y + 8 + row * 10;
        if ((building.windowMask + row) % 3 === 0) {
          g.fillRect(x + 5, wy, 2, 2);
        }
        if ((building.windowMask + row) % 4 === 1 && building.width > 16) {
          g.fillRect(x + building.width - 7, wy, 2, 2);
        }
      }
    }
  }
}

function drawDetail(g, config, tileX, baseY) {
  const color = config.kind === 'mesa' ? 0x25212c : config.color;
  const positions = [0.18, 0.58, 0.84];

  if (config.detail === 'turbines') {
    g.lineStyle(2, color, 0.95);
    for (const p of positions.slice(0, 2)) {
      const x = tileX + config.tileWidth * p;
      const y = baseY - 24;
      g.lineBetween(x, y, x, baseY);
      g.lineBetween(x, y, x - 11, y - 3);
      g.lineBetween(x, y, x + 6, y - 10);
      g.lineBetween(x, y, x + 5, y + 9);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 2);
    }
  } else if (config.detail === 'solar') {
    g.fillStyle(0x18252c, 0.95);
    for (const p of positions) {
      const x = tileX + config.tileWidth * p;
      g.fillRect(x, baseY - 9, 38, 6);
      g.lineStyle(1, 0x6b8790, 0.55);
      g.lineBetween(x + 19, baseY - 3, x + 19, baseY);
    }
  } else if (config.detail === 'transmission') {
    g.lineStyle(1, color, 0.9);
    for (const p of positions.slice(0, 2)) {
      const x = tileX + config.tileWidth * p;
      const top = baseY - 31;
      g.lineBetween(x, baseY, x, top);
      g.lineBetween(x, top, x - 10, baseY);
      g.lineBetween(x, top, x + 10, baseY);
      g.lineBetween(x - 10, top + 10, x + 10, top + 10);
      g.lineBetween(x - 7, top + 18, x + 7, top + 18);
    }
  } else if (config.detail === 'cranes') {
    g.lineStyle(2, color, 0.95);
    const x = tileX + config.tileWidth * 0.72;
    const top = baseY - 62;
    g.lineBetween(x, baseY, x, top);
    g.lineBetween(x, top, x + 72, top);
    g.lineBetween(x + 18, top, x, top + 14);
    g.lineStyle(1, color, 0.9);
    g.lineBetween(x + 58, top, x + 58, top + 32);
  } else if (config.detail === 'freight' || config.detail === 'commuter') {
    const y = baseY - (config.detail === 'commuter' ? 18 : 13);
    g.lineStyle(2, color, 1);
    g.lineBetween(tileX, y, tileX + config.tileWidth, y);
    g.fillStyle(config.windowColor ?? 0xa9c4c7, 0.6);
    for (let x = 30; x < config.tileWidth; x += config.detail === 'commuter' ? 86 : 68) {
      g.fillRect(tileX + x, y - 5, config.detail === 'commuter' ? 44 : 36, 4);
    }
  }
}

function makeShapes(config, seed) {
  const rng = seededRandom(seed);
  if (config.kind === 'city' || config.kind === 'industrial') {
    const buildings = [];
    let x = 0;
    while (x < config.tileWidth) {
      const width = Math.round(14 + rng() * (config.kind === 'industrial' ? 42 : 24));
      const height = Math.round(12 + rng() * config.amplitude);
      buildings.push({
        x,
        width,
        height,
        antenna: rng() > 0.82 ? Math.round(8 + rng() * 16) : 0,
        windowMask: Math.floor(rng() * 12),
      });
      x += width + Math.round(4 + rng() * 10);
    }
    return buildings;
  }

  const points = [];
  let x = 0;
  while (x < config.tileWidth) {
    const step = config.kind === 'mesa'
      ? Math.round(36 + rng() * 54)
      : Math.round(24 + rng() * 48);
    const height = Math.round(config.amplitude * (0.3 + rng() * 0.7));
    points.push({ x, height });
    if (config.kind === 'mesa') {
      points.push({ x: Math.min(config.tileWidth, x + step * 0.58), height });
    }
    x += step;
  }
  points.push({ x: config.tileWidth, height: points[0]?.height ?? 0 });
  return points;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
