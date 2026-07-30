// tools/gen-car.js — apocalypse Jeep, v5: real 3D yaw, not 2D shear.
//
// v3/v4 drew ONE rear-view pixel map and faked steering by horizontally
// shearing rows of that same raster. That can only ever bank the existing
// pixels — it can't reveal geometry that was never drawn, so turn frames
// never showed any hint of the front of the car (playtest feedback).
//
// v5 replaces that with an actual low-poly 3D jeep (boxes + discs), lit
// and rasterized with a z-buffer, palette-quantized into flat shading
// bands so it still reads as pixel art. The five steering frames are real
// camera yaws (with a light bank into the turn): as the car rotates, the
// front corner — fender, headlamp, front wheel — genuinely swings into
// view past the edge of the (nearer, at-rest-visible) tailgate. This is
// the same technique tools/CarRenderer.py used for the sci-fi ship that
// briefly replaced this jeep; it's ported to JS here so the whole asset
// pipeline stays on `node tools/gen-car.js` + pngjs, no Python/Pillow step.
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const MATERIALS = {
  body:     { color: [0xa8, 0x50, 0x1f], bands: 3 },        // rust orange
  skirt:    { color: [0x4a, 0x4f, 0x42], bands: 2 },         // lower olive skirt/bumper
  rust:     { color: [0x7a, 0x38, 0x14], bands: 2 },         // battle-damage patch, driver's side only
  cab:      { color: [0x14, 0x16, 0x22], bands: 2 },         // window glass
  pillar:   { color: [0x5c, 0x5c, 0x6c], bands: 3 },         // roof rail + A/C pillars
  hazard:   { color: [0xff, 0xcf, 0x3f], emissive: true },   // hazard stripe paint
  tire:     { color: [0x16, 0x16, 0x1a], bands: 2 },         // rubber
  hub:      { color: [0xc9, 0xc9, 0xd4], emissive: true },   // hubcap
  tail:     { color: [0xff, 0x2d, 0x55], emissive: true },   // taillight
  amber:    { color: [0xff, 0x8a, 0x1a], emissive: true },   // amber taillight lens
  headlamp: { color: [0xff, 0xf2, 0xc8], emissive: true },   // nose corner lamp — hidden at rest, revealed on turn
  grille:   { color: [0x1a, 0x18, 0x18], bands: 2 },         // front cap
  jerry:    { color: [0x4a, 0x4f, 0x42], bands: 2 },         // roof-lashed fuel can
  jerryHi:  { color: [0xd0, 0xc9, 0x3f], emissive: true },   // fuel-can handle glint
  pole:     { color: [0x0a, 0x0a, 0x14], bands: 1 },         // whip antenna
  flag:     { color: [0xff, 0x2d, 0x55], emissive: true },   // rag flag
};

// A tapered box: rear face at z0 (half-width w0), front face at z1
// (half-width w1), each face independently sized top/bottom — enough to
// build every panel, skirt, and cab wall below without a real mesh tool.
function box(z0, z1, w0, w1, yBot0, yTop0, yBot1, yTop1, xOff = 0) {
  const r = [[-w0 + xOff, yBot0, z0], [w0 + xOff, yBot0, z0], [w0 + xOff, yTop0, z0], [-w0 + xOff, yTop0, z0]];
  const f = [[-w1 + xOff, yBot1, z1], [w1 + xOff, yBot1, z1], [w1 + xOff, yTop1, z1], [-w1 + xOff, yTop1, z1]];
  const quads = [
    [r[0], r[1], r[2], r[3]], // rear
    [f[1], f[0], f[3], f[2]], // front
    [r[3], r[2], f[2], f[3]], // top
    [r[0], f[0], f[1], r[1]], // bottom
    [r[0], r[3], f[3], f[0]], // left
    [r[1], f[1], f[2], r[2]], // right
  ];
  const tris = [];
  for (const [a, b, c, d] of quads) { tris.push([a, b, c]); tris.push([a, c, d]); }
  return tris;
}

// Flat disc facing -z (toward the camera at rest) — wheels, spare tire,
// hubcaps, taillight lenses.
function disc(cx, cy, cz, radius, segments = 10) {
  const tris = [];
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a), cz]);
  }
  const center = [cx, cy, cz];
  for (let i = 0; i < segments; i++) tris.push([center, pts[i], pts[(i + 1) % segments]]);
  return tris;
}

// ---------------- the jeep ----------------
// Coordinates: x right, y up, z forward (nose/hood at +z, tailgate at
// -z). Camera sits behind the car looking toward +z, so the tailgate
// (-z, nearest) is what's visible at rest; the nose (+z) is hidden behind
// it until the car yaws and the nose swings out to a different x.
function buildJeep() {
  const T = [];
  const add = (tris, mat) => { for (const t of tris) T.push([t, mat]); };

  // Main body: tailgate wide/square, hood slightly narrower and lower —
  // a real front, not a mirrored rear.
  add(box(-13, 9, 12.5, 11.5, 0, 7.2, 0, 5.6), 'body');
  add(box(-13.2, 9, 11.8, 11.0, -1.4, 0.3, -1.2, 0.4), 'skirt');
  // Battle-damage patch, driver's side (x<0) only — asymmetric weathering.
  // Small decal on the flank, well inside the body's own half-width so it
  // stays hidden behind the (nearer) tailgate face at rest and only shows
  // on the turn frames, same as the headlamps.
  add(box(-8, -1, 1.6, 1.6, 1.0, 4.2, 1.0, 4.2, -9.5), 'rust');

  // Cab: full-width dark window box, thin pillars + roof rail drawn
  // fractionally nearer (larger local |z|) so they read as a frame
  // around the glass instead of the glass itself.
  add(box(-13, -3, 10.2, 10.2, 7.2, 12.6, 7.2, 11.4), 'cab');
  add(box(-13.05, -3, 1.6, 1.6, 7.2, 12.7, 7.2, 11.5, -8.7), 'pillar');
  add(box(-13.05, -3, 1.6, 1.6, 7.2, 12.7, 7.2, 11.5, 8.7), 'pillar');
  add(box(-13.1, -3.2, 10.6, 10.6, 12.4, 13.4, 11.2, 12.0), 'pillar');

  // Hazard stripe wraps the body above the skirt.
  add(box(-12.9, 8.9, 12.1, 11.1, 3.4, 4.2, 3.2, 4.0), 'hazard');

  // Rear wheels, flanking the spare — visible at rest.
  for (const s of [-1, 1]) add(disc(s * 9.5, -0.6, -13.05, 3.1, 12), 'tire');
  for (const s of [-1, 1]) add(disc(s * 9.5, -0.6, -13.1, 1.3, 8), 'hub');

  // Front wheels, tucked at the nose corners — self-occluded at yaw 0,
  // revealed by the turn frames.
  for (const s of [-1, 1]) add(disc(s * 9.2, -0.6, 8.4, 3.0, 12), 'tire');
  for (const s of [-1, 1]) add(disc(s * 9.2, -0.6, 8.5, 1.2, 8), 'hub');

  // Grille cap + headlamp pods at the very nose. Edge-on and invisible at
  // yaw 0; this is what actually swings into view on the turn frames.
  add(box(8.9, 9.15, 6.0, 5.8, 3.0, 5.6, 3.0, 5.6), 'grille');
  for (const s of [-1, 1]) add(box(9.0, 10.3, 1.1, 1.0, 3.4, 5.8, 3.4, 5.8, s * 10.6), 'headlamp');

  // Spare tire on the tailgate.
  add(disc(0, 2.4, -13.1, 4.2, 14), 'tire');
  add(disc(0, 2.4, -13.15, 3.2, 14), 'hub');
  add(disc(0, 2.4, -13.2, 2.5, 14), 'tire');

  // Taillights flanking the spare.
  for (const s of [-1, 1]) {
    add(box(-13.1, -13.1, 1.4, 1.4, 1.2, 3.6, 1.2, 3.6, s * 6.4), 'tail');
    add(box(-13.15, -13.15, 0.7, 0.7, 1.2, 3.6, 1.2, 3.6, s * 5.3), 'amber');
  }

  // Roof cargo: lashed jerry can, off-centre (raider improvisation, not a
  // symmetric factory rack).
  add(box(-4, -1, 1.6, 1.6, 12.7, 15.1, 12.7, 15.1, 3.2), 'jerry');
  add(disc(3.2, 14.6, -2.5, 0.35, 6), 'jerryHi');

  // Whip antenna + rag flag, off-centre by the pillar.
  add(box(-8.7, -8.7, 0.22, 0.22, 12.7, 18.5, 12.7, 18.5), 'pole');
  add(box(-8.5, -6.6, 0.1, 0.1, 17.2, 18.3, 17.2, 18.3, 1.6), 'flag');

  return T;
}

// ---------------- rasterizer ----------------
const FRAME_W = 64, FRAME_H = 56;
const FRAMES = 5; // hard-left, left, straight, right, hard-right
const ORTHO_SCALE = 1.75;
const CAM_PITCH = 0; // eye-level — any downward tilt reads as "driving downhill"
let LIGHT = [-0.45, 0.8, -0.35];       // from upper-left, slightly behind camera
const AMBIENT = 0.5, DIFFUSE = 0.6;

function normalize(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
}
LIGHT = normalize(LIGHT);

function rotY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}
function rotX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

const EMISSIVE_KEYS = new Set(
  Object.values(MATERIALS).filter((m) => m.emissive).map((m) => m.color.join(','))
);

// Renders one steering frame: rotate (bank, then yaw) -> pitch the
// camera -> orthographic-project -> barycentric-rasterize with a
// z-buffer -> quantize shading into pixel-art bands -> outline.
function renderFrame(tris, yawDeg, rollDeg) {
  const yaw = (yawDeg * Math.PI) / 180, roll = (rollDeg * Math.PI) / 180;
  const w = FRAME_W, h = FRAME_H;
  const px = new Float64Array(w * h * 4);
  const alpha = new Uint8Array(w * h);
  const zbuf = new Float64Array(w * h).fill(-1e9);

  const prepared = tris.map(([tri, mat]) => {
    const pts = tri.map((p) => rotX(rotY(rotZ(p, roll), yaw), CAM_PITCH));
    const ax = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const bx = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const n = normalize([
      ax[1] * bx[2] - ax[2] * bx[1],
      ax[2] * bx[0] - ax[0] * bx[2],
      ax[0] * bx[1] - ax[1] * bx[0],
    ]);
    const scr = pts.map((p) => [p[0] * ORTHO_SCALE + w / 2, h * 0.82 - p[1] * ORTHO_SCALE, -p[2]]);
    return [scr, n, mat];
  });

  for (const [scr, n, matName] of prepared) {
    const m = MATERIALS[matName];
    let shade;
    if (m.emissive) shade = 1.0;
    else {
      const d = Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      shade = Math.round((AMBIENT + DIFFUSE * d) * m.bands) / m.bands;
    }
    const col = m.color.map((c) => Math.min(255, c * shade));

    const xs = scr.map((p) => p[0]), ys = scr.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    const [ax_, ay, az] = scr[0], [bx_, by, bz] = scr[1], [cx_, cy, cz] = scr[2];
    const den = (by - cy) * (ax_ - cx_) + (cx_ - bx_) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w0 = ((by - cy) * (x + 0.5 - cx_) + (cx_ - bx_) * (y + 0.5 - cy)) / den;
        const w1_ = ((cy - ay) * (x + 0.5 - cx_) + (ax_ - cx_) * (y + 0.5 - cy)) / den;
        const w2 = 1 - w0 - w1_;
        if (w0 < 0 || w1_ < 0 || w2 < 0) continue;
        const depth = w0 * az + w1_ * bz + w2 * cz;
        const idx = y * w + x;
        if (depth > zbuf[idx]) {
          zbuf[idx] = depth;
          const di = idx * 4;
          px[di] = col[0]; px[di + 1] = col[1]; px[di + 2] = col[2]; px[di + 3] = 255;
          alpha[idx] = 1;
        }
      }
    }
  }

  // Outline: opaque pixel touching transparency -> near-black, except
  // emissive colors (lamps/lights keep their glow instead of going dark).
  const out = new Uint8ClampedArray(px.length);
  out.set(px);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!alpha[idx]) continue;
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !alpha[ny * w + nx]) { edge = true; break; }
      }
      const di = idx * 4;
      const key = `${Math.round(px[di])},${Math.round(px[di + 1])},${Math.round(px[di + 2])}`;
      if (edge && !EMISSIVE_KEYS.has(key)) { out[di] = 10; out[di + 1] = 10; out[di + 2] = 20; }
    }
  }
  return { data: out, alpha };
}

const tris = buildJeep();
// Real camera yaws with a light bank into the turn (F-Zero-style lean,
// but subtle — this is a ground vehicle, not a hovercraft).
const STEER_FRAMES = [[-28, 5], [-14, 2.5], [0, 0], [14, -2.5], [28, -5]];
const sheet = new PNG({ width: FRAME_W * FRAMES, height: FRAME_H });
STEER_FRAMES.forEach(([yaw, roll], i) => {
  const { data, alpha } = renderFrame(tris, yaw, roll);
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (!alpha[y * FRAME_W + x]) continue;
      const si = (y * FRAME_W + x) * 4;
      const di = (y * sheet.width + i * FRAME_W + x) * 4;
      sheet.data[di] = data[si]; sheet.data[di + 1] = data[si + 1];
      sheet.data[di + 2] = data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
});

const out = path.join(process.cwd(), 'public', 'assets', 'car.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(`wrote ${out} (${sheet.width}x${sheet.height}, ${FRAMES} frames of ${FRAME_W}x${FRAME_H})`);
