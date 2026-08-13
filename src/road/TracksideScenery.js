// TracksideScenery.js — large non-collidable landmarks that the car passes.
//
// Unlike the tiled horizon, these objects are anchored to absolute road
// segments and use the road's own perspective projection. Campaign landmarks
// therefore repeat in the same places each lap, while Endless Mode keeps a
// stable cadence through trimming because its segment indices are absolute.

export class TracksideScenery {
  constructor(scene, tuning, environment) {
    this.t = tuning;
    this.environment = environment;
    this.width = scene.scale.width;
    // Above the road (-1), below gameplay props (5), gates (6), and the car
    // (10). Close scenery can sweep past the shoulders without obscuring a
    // cone, rock, ramp, pickup, or timing landmark.
    this.graphics = scene.add.graphics().setDepth(4);
  }

  setEnvironment(environment) {
    this.environment = environment;
  }

  render(model, base) {
    const g = this.graphics;
    const t = this.t;
    g.clear();

    // Far -> near: close silhouettes naturally paint over distant ones.
    for (let n = t.drawDistance - 1; n >= 0; n--) {
      const seg = model.segmentAt(base, n);
      if (seg.clipped) continue;
      const object = tracksideObjectForSegment(this.environment, seg.index);
      if (!object) continue;

      const { x: roadX, y, w: unit } = seg.p1.screen;
      if (unit < 1.5) continue;
      const x = roadX + object.offset * unit;
      const reach = unit * 1.25;
      if (x < -reach || x > this.width + reach) continue;

      const distanceAlpha = 0.32 + 0.68 * (1 - n / t.drawDistance);
      drawObject(
        g,
        object.kind,
        x,
        y,
        unit * object.size,
        this.environment.trackside,
        distanceAlpha,
        object.variant,
      );
    }
  }
}

export function tracksideObjectForSegment(environment, segmentIndex) {
  const config = environment.trackside;
  if (!config) return null;
  const signature = config.signature;
  if (signature) {
    const signaturePhase = (environment.seed * 3) % signature.cadence;
    if ((segmentIndex + signaturePhase) % signature.cadence === 0) {
      const hash = hashInt(segmentIndex, environment.seed ^ 0x51f15e);
      const side = (hash & 1) === 0 ? -1 : 1;
      const offsetT = ((hash >>> 8) & 0xff) / 255;
      const sizeT = ((hash >>> 16) & 0xff) / 255;
      return {
        kind: signature.kinds[(hash >>> 1) % signature.kinds.length],
        offset: side * (
          signature.offset[0] +
          (signature.offset[1] - signature.offset[0]) * offsetT
        ),
        size: signature.size[0] + (signature.size[1] - signature.size[0]) * sizeT,
        variant: (hash >>> 24) & 0xff,
        signature: true,
      };
    }
  }
  const phase = environment.seed % config.cadence;
  if ((segmentIndex + phase) % config.cadence !== 0) return null;

  const hash = hashInt(segmentIndex, environment.seed);
  const side = (hash & 1) === 0 ? -1 : 1;
  const offsetRange = config.offset[1] - config.offset[0];
  const offsetT = ((hash >>> 8) & 0xff) / 255;
  const kind = config.kinds[(hash >>> 1) % config.kinds.length];
  return {
    kind,
    offset: side * (config.offset[0] + offsetRange * offsetT),
    size: 0.84 + (((hash >>> 16) & 0xff) / 255) * 0.34,
    variant: (hash >>> 24) & 0xff,
    signature: false,
  };
}

function drawObject(g, kind, x, y, unit, colors, alpha, variant) {
  if (kind === 'turbine') drawTurbine(g, x, y, unit, colors, alpha, variant);
  else if (kind === 'sensor') drawSensor(g, x, y, unit, colors, alpha);
  else if (kind === 'tree') drawTree(g, x, y, unit, colors, alpha);
  else if (kind === 'rock') drawRock(g, x, y, unit, colors, alpha, variant);
  else if (kind === 'solar') drawSolar(g, x, y, unit, colors, alpha);
  else if (kind === 'power') drawPower(g, x, y, unit, colors, alpha);
  else if (kind === 'cargo') drawCargo(g, x, y, unit, colors, alpha, variant);
  else if (kind === 'light') drawLight(g, x, y, unit, colors, alpha);
  else if (kind === 'signal') drawSignal(g, x, y, unit, colors, alpha);
  else if (kind === 'service') drawService(g, x, y, unit, colors, alpha);
}

function drawTurbine(g, x, y, u, c, a, variant) {
  const hubY = y - u * 0.82;
  polygon(g, c.structure, a, [
    [x - u * 0.025, y],
    [x + u * 0.025, y],
    [x + u * 0.012, hubY],
    [x - u * 0.012, hubY],
  ]);
  const angle = ((variant % 12) / 12) * Math.PI;
  g.lineStyle(Math.max(1, u * 0.025), c.highlight, a);
  for (let blade = 0; blade < 3; blade++) {
    const theta = angle + blade * (Math.PI * 2 / 3);
    g.lineBetween(
      x,
      hubY,
      x + Math.cos(theta) * u * 0.29,
      hubY + Math.sin(theta) * u * 0.29,
    );
  }
  g.fillStyle(c.light, a);
  g.fillCircle(x, hubY, Math.max(1, u * 0.035));
}

function drawSensor(g, x, y, u, c, a) {
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.025, y - u * 0.52, u * 0.05, u * 0.52);
  g.fillRect(x - u * 0.12, y - u * 0.54, u * 0.24, u * 0.08);
  g.fillStyle(c.highlight, a);
  g.fillRect(x - u * 0.085, y - u * 0.515, u * 0.09, u * 0.025);
  g.fillStyle(c.light, a);
  g.fillRect(x + u * 0.04, y - u * 0.515, Math.max(1, u * 0.025), Math.max(1, u * 0.025));
}

function drawTree(g, x, y, u, c, a) {
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.035, y - u * 0.34, u * 0.07, u * 0.34);
  g.fillStyle(c.highlight, a);
  g.fillTriangle(x, y - u * 0.74, x - u * 0.25, y - u * 0.28, x + u * 0.25, y - u * 0.28);
  g.fillTriangle(x - u * 0.08, y - u * 0.6, x - u * 0.29, y - u * 0.17, x + u * 0.18, y - u * 0.17);
}

function drawRock(g, x, y, u, c, a, variant) {
  const lean = ((variant % 9) - 4) * u * 0.012;
  polygon(g, c.structure, a, [
    [x - u * 0.34, y],
    [x - u * 0.24, y - u * 0.46],
    [x + lean, y - u * 0.88],
    [x + u * 0.2, y - u * 0.35],
    [x + u * 0.34, y],
  ]);
  polygon(g, c.highlight, a * 0.72, [
    [x - u * 0.2, y - u * 0.42],
    [x + lean, y - u * 0.82],
    [x + u * 0.06, y - u * 0.34],
    [x - u * 0.02, y - u * 0.12],
  ]);
}

function drawSolar(g, x, y, u, c, a) {
  g.lineStyle(Math.max(1, u * 0.018), c.structure, a);
  g.lineBetween(x - u * 0.2, y, x - u * 0.14, y - u * 0.14);
  g.lineBetween(x + u * 0.2, y, x + u * 0.14, y - u * 0.14);
  polygon(g, c.structure, a, [
    [x - u * 0.38, y - u * 0.18],
    [x + u * 0.34, y - u * 0.18],
    [x + u * 0.26, y - u * 0.38],
    [x - u * 0.3, y - u * 0.38],
  ]);
  g.lineStyle(Math.max(1, u * 0.012), c.highlight, a);
  g.lineBetween(x - u * 0.04, y - u * 0.18, x - u * 0.02, y - u * 0.38);
  g.lineBetween(x - u * 0.35, y - u * 0.28, x + u * 0.3, y - u * 0.28);
}

function drawPower(g, x, y, u, c, a) {
  const top = y - u * 0.76;
  g.lineStyle(Math.max(1, u * 0.024), c.structure, a);
  g.lineBetween(x - u * 0.19, y, x, top);
  g.lineBetween(x + u * 0.19, y, x, top);
  g.lineBetween(x - u * 0.14, y - u * 0.18, x + u * 0.14, y - u * 0.18);
  g.lineBetween(x - u * 0.1, y - u * 0.39, x + u * 0.1, y - u * 0.39);
  g.lineBetween(x - u * 0.24, top + u * 0.13, x + u * 0.24, top + u * 0.13);
  g.lineBetween(x - u * 0.16, top + u * 0.26, x + u * 0.16, top + u * 0.26);
  g.fillStyle(c.light, a);
  g.fillRect(x - u * 0.255, top + u * 0.11, Math.max(1, u * 0.025), Math.max(1, u * 0.035));
  g.fillRect(x + u * 0.23, top + u * 0.11, Math.max(1, u * 0.025), Math.max(1, u * 0.035));
}

function drawCargo(g, x, y, u, c, a, variant) {
  const swap = variant % 2;
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.35, y - u * 0.25, u * 0.7, u * 0.25);
  g.fillRect(x - u * (swap ? 0.28 : 0.34), y - u * 0.49, u * 0.56, u * 0.22);
  g.lineStyle(Math.max(1, u * 0.012), c.highlight, a);
  for (let col = -2; col <= 2; col++) {
    g.lineBetween(x + col * u * 0.105, y - u * 0.47, x + col * u * 0.105, y - u * 0.29);
  }
  g.fillStyle(c.light, a * 0.75);
  g.fillRect(x - u * 0.29, y - u * 0.2, Math.max(1, u * 0.025), Math.max(1, u * 0.025));
}

function drawLight(g, x, y, u, c, a) {
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.025, y - u * 0.82, u * 0.05, u * 0.82);
  g.fillRect(x - u * 0.22, y - u * 0.84, u * 0.44, u * 0.07);
  g.fillStyle(c.light, a * 0.16);
  g.fillCircle(x - u * 0.14, y - u * 0.78, u * 0.11);
  g.fillCircle(x + u * 0.14, y - u * 0.78, u * 0.11);
  g.fillStyle(c.light, a);
  g.fillRect(x - u * 0.17, y - u * 0.81, u * 0.06, u * 0.025);
  g.fillRect(x + u * 0.11, y - u * 0.81, u * 0.06, u * 0.025);
}

function drawSignal(g, x, y, u, c, a) {
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.025, y - u * 0.68, u * 0.05, u * 0.68);
  polygon(g, c.highlight, a, [
    [x - u * 0.21, y - u * 0.66],
    [x + u * 0.17, y - u * 0.66],
    [x + u * 0.21, y - u * 0.51],
    [x - u * 0.17, y - u * 0.51],
  ]);
  g.fillStyle(c.light, a);
  g.fillRect(x - u * 0.1, y - u * 0.605, u * 0.2, Math.max(1, u * 0.025));
}

function drawService(g, x, y, u, c, a) {
  g.fillStyle(c.structure, a);
  g.fillRect(x - u * 0.32, y - u * 0.38, u * 0.64, u * 0.38);
  polygon(g, c.highlight, a, [
    [x - u * 0.37, y - u * 0.38],
    [x, y - u * 0.57],
    [x + u * 0.37, y - u * 0.38],
  ]);
  g.fillStyle(c.light, a * 0.8);
  g.fillRect(x - u * 0.2, y - u * 0.27, u * 0.13, u * 0.08);
  g.fillRect(x + u * 0.07, y - u * 0.27, u * 0.13, u * 0.08);
}

function polygon(g, color, alpha, points) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.closePath();
  g.fillPath();
}

function hashInt(value, seed) {
  let hash = (value ^ seed) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}
