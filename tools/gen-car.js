// tools/gen-car.js — F-Zero-style hover racer, v7: a proper glass canopy
// integrated into the sloping hull, rendered through the same 3D-yaw pipeline.
//
// The brief for this pass was a reference sheet of F-Zero SNES Mode-7 ship
// sprites (Blue Falcon etc.) — but that sheet is drawn TOP-DOWN (bird's-eye,
// as Mode-7 racers render their vehicles), while this game's camera sits
// BEHIND the car at eye level (Outrun-style chase cam, see CAM_PITCH below).
// Pasting a top-down sprite into an eye-level view would look like a toy
// glued flat to the screen — the perspective doesn't transfer. So instead of
// tracing the sheet's pixels, this ports its *aesthetic* (blue hull, warm
// racing stripe, glass canopy, glowing twin engines) onto the existing v5
// technique: build a real low-poly 3D mesh and rasterize actual camera yaws
// and jump pitches,
// so turning frames genuinely reveal the nose/fenders instead of faking it
// with a 2D shear. See the v5 header (removed) and tools/CarRenderer.py
// (also removed) for why that shear approach was abandoned.
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

// Every color lives here so a future palette swap (AI racers, unlockable
// liveries) only means editing this table, not the mesh below.
const MATERIALS = {
  hull:      { color: [0x1f, 0x4f, 0xc7], bands: 3 },        // Blue Falcon-ish body blue
  hullDark:  { color: [0x12, 0x2a, 0x66], bands: 2 },         // lower skirt/undercarriage
  wing:      { color: [0x27, 0x3d, 0x7a], bands: 2 },         // side wing pods
  fin:       { color: [0x4a, 0x50, 0x66], bands: 2 },         // rear spoiler
  cab:       { color: [0x19, 0x79, 0xa3], bands: 3 },         // deep cyan canopy glass
  cabLight:  { color: [0x74, 0xdc, 0xf4], bands: 2 },         // glass reflection facet
  pillar:    { color: [0x68, 0x72, 0x86], bands: 2 },         // thin canopy sill/frame
  stripe:    { color: [0xff, 0xa8, 0x1a], emissive: true },   // racing stripe decal
  noseLight: { color: [0xff, 0xef, 0xb0], emissive: true },   // nose tip lamp — hidden at rest, revealed on turn
  engineHousing: { color: [0x55, 0x58, 0x66], bands: 2 },     // rear thruster housing
  engineGlow:    { color: [0x5a, 0xd8, 0xff], emissive: true }, // rear thruster core
  underglow:     { color: [0x7a, 0xc8, 0xff], emissive: true }, // belly hover light
};

// A tapered box: rear face at z0 (half-width w0), front face at z1
// (half-width w1), each face independently sized top/bottom — enough to
// build every hull panel, fin, and pod below without a real mesh tool.
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

// Flat disc facing -z (toward the camera at rest) — engine nacelle rings.
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

// A faceted teardrop dome lofted through cross-section rings. Each ring follows
// the hull with its own base height instead of sitting on one flat plane. That
// distinction matters most at yaw: a flat-bottomed canopy projected beyond the
// sloping nose as a cyan "beak", while this one stays planted in the body.
//
// Ring format: { z, w, base, top }. `slices` walks a half-ellipse from the
// left sill, over the crown, to the right sill.
function canopyDome(rings, slices = 8) {
  const ringPoints = rings.map(({ z, w, base, top }) => {
    const points = [];
    for (let i = 0; i <= slices; i++) {
      const a = Math.PI - (Math.PI * i) / slices;
      points.push([
        Math.cos(a) * w,
        base + Math.sin(a) * (top - base),
        z,
      ]);
    }
    return points;
  });

  const tris = [];
  for (let r = 0; r < ringPoints.length - 1; r++) {
    for (let i = 0; i < slices; i++) {
      const a = ringPoints[r][i];
      const b = ringPoints[r][i + 1];
      const c = ringPoints[r + 1][i + 1];
      const d = ringPoints[r + 1][i];
      tris.push([a, b, c], [a, c, d]);
    }
  }

  // Close the rear and nose so hard-turn views never reveal a hollow shell.
  for (const ring of [ringPoints[0], ringPoints[ringPoints.length - 1]]) {
    const center = [
      0,
      (ring[0][1] + ring[Math.floor(slices / 2)][1]) / 2,
      ring[0][2],
    ];
    for (let i = 0; i < slices; i++) tris.push([center, ring[i], ring[i + 1]]);
  }
  return tris;
}

// Narrow metal rails following both canopy sills. They visually lock the
// glass into the hull without adding a long roof bar that can swing out into
// another beak at hard yaw.
function canopyRails(rings, thickness = 0.22) {
  const tris = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      const outerA = [side * a.w, a.base + 0.08, a.z];
      const innerA = [side * Math.max(0, a.w - thickness), a.base + 0.24, a.z];
      const outerB = [side * b.w, b.base + 0.08, b.z];
      const innerB = [side * Math.max(0, b.w - thickness), b.base + 0.24, b.z];
      tris.push([outerA, innerA, innerB], [outerA, innerB, outerB]);
    }
  }
  return tris;
}

// ---------------- the racer ----------------
// Coordinates: x right, y up, z forward (nose at +z, tail/engines at -z).
// Camera sits behind the car looking toward +z, so the twin engine nacelles
// (-z, nearest) are what's visible at rest; the pointed nose (+z) is hidden
// behind the hull until the car yaws and swings it out to a different x.
function buildRacer() {
  const T = [];
  const add = (tris, mat) => { for (const t of tris) T.push([t, mat]); };

  // Main hull: wide flared tail tapering to a low, pointed nose.
  add(box(-14, 12, 8, 2.5, 0, 5.2, 0, 2.8), 'hull');
  add(box(-14.1, 11, 7.6, 2.2, -0.6, 0.2, -0.5, 0.1), 'hullDark');

  // Side fins tucked into the tail silhouette, then tapering toward the nose.
  // Keeping their centerlines parallel avoids non-planar swept faces fighting
  // the tiny orthographic z-buffer.
  for (const s of [-1, 1]) {
    add(box(
      -12, 2, 1.6, 0.75,
      0.8, 3.1, 0.8, 2.5,
      s * 7.0
    ), 'wing');
  }

  // Small tail fins, kept well inside the hull's own rear half-width (8)
  // so they stay within the hull's silhouette at yaw instead of swinging
  // out past it — a wider bar here rotated into a disconnected floating
  // rod on turn frames (read as a gun barrel, not a spoiler).
  for (const s of [-1, 1]) add(box(-14.1, -11.5, 0.3, 0.3, 5.2, 6.0, 5.1, 5.7, s * 5.5), 'fin');

  // Teardrop glass cockpit. Its sill heights follow the main hull's slope
  // toward the nose, and its crown rises into a bubble instead of a flat roof.
  // The widest/highest ring sits just behind center, producing the rounded
  // F-Zero cockpit read in both slight and hard steering frames.
  const canopyRings = [
    { z: -5.0, w: 1.35, base: 4.37, top: 5.25 },
    { z: -2.6, w: 2.55, base: 4.15, top: 7.15 },
    { z:  0.3, w: 2.95, base: 3.88, top: 7.85 },
    { z:  3.4, w: 2.30, base: 3.59, top: 7.05 },
    { z:  5.9, w: 0.85, base: 3.36, top: 4.95 },
  ];
  add(canopyDome(canopyRings), 'cab');
  add(canopyRails(canopyRings), 'pillar');

  // One small rear-quarter reflection catches the eye as unmistakable glass.
  // It is deliberately compact and lives inside the dome silhouette.
  add(box(-4.85, -3.15, 0.62, 1.18, 4.85, 5.10, 5.72, 6.05), 'cabLight');

  // Racing stripe: a raised ridge sitting flush on the hull's spine so it
  // reads as a stripe along the whole visible length, not a rear decal.
  add(box(-13.6, 10, 2.0, 0.8, 5.2, 5.8, 2.8, 3.4), 'stripe');

  // Nose tip lamp — edge-on and invisible at yaw 0; swings into view on turns.
  add(box(11.5, 12.3, 0.9, 0.7, 2.4, 3.1, 2.4, 3.1), 'noseLight');

  // Twin rear thrusters, flanking the tail, set above ground height so
  // they read as engines rather than wheels.
  for (const s of [-1, 1]) {
    add(disc(s * 6.5, 2.6, -14.05, 2.1, 12), 'engineHousing');
    add(disc(s * 6.5, 2.6, -14.1, 1.2, 10), 'engineGlow');
  }

  // Belly hover glow, a thin line just under the skirt.
  add(box(-13.9, 9, 7.5, 2.0, -0.68, -0.6, -0.55, -0.48), 'underglow');

  return T;
}

// ---------------- rasterizer ----------------
const FRAME_W = 64, FRAME_H = 56;
const STEER_FRAME_COUNT = 5; // hard-left, left, straight, right, hard-right
const ORTHO_SCALE = 1.75;
// Match the game's Outrun-style chase camera: directly behind the car rather
// than above it. The teardrop canopy geometry supplies the glass read without
// borrowing a top-down Mode-7 viewing angle.
const CAM_PITCH = 0;
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

// Renders one car frame: pitch the chassis around its local left/right axis,
// then rotate (bank, then yaw) -> pitch the camera -> orthographic-project ->
// barycentric-rasterize with a
// z-buffer -> quantize shading into pixel-art bands -> outline.
function renderFrame(tris, yawDeg, rollDeg, pitchDeg = 0) {
  const yaw = (yawDeg * Math.PI) / 180;
  const roll = (rollDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const w = FRAME_W, h = FRAME_H;
  const px = new Float64Array(w * h * 4);
  const alpha = new Uint8Array(w * h);
  const zbuf = new Float64Array(w * h).fill(-1e9);

  const prepared = tris.map(([tri, mat]) => {
    const pts = tri.map((p) =>
      rotX(rotY(rotZ(rotX(p, pitch), roll), yaw), CAM_PITCH)
    );
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

const tris = buildRacer();
// Real camera yaws with a bank into the turn — a bit more roll than the old
// jeep since a hover racer leans harder than a ground vehicle.
const STEER_FRAMES = [[-28, 7], [-14, 3.5], [0, 0], [14, -3.5], [28, -7]];
// Rows are deliberately ordered nose-down, neutral, nose-up. Phaser numbers
// spritesheet frames left-to-right, top-to-bottom, so gameplay can combine a
// pitch row with the existing five steering buckets using one integer.
const PITCH_ROWS = [
  { id: 'down', degrees: 12 },
  { id: 'neutral', degrees: 0 },
  { id: 'up', degrees: -12 },
];
const sheet = new PNG({
  width: FRAME_W * STEER_FRAME_COUNT,
  height: FRAME_H * PITCH_ROWS.length,
});
PITCH_ROWS.forEach(({ degrees: pitch }, pitchRow) => {
  STEER_FRAMES.forEach(([yaw, roll], steerFrame) => {
    const { data, alpha } = renderFrame(tris, yaw, roll, pitch);
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        if (!alpha[y * FRAME_W + x]) continue;
        const si = (y * FRAME_W + x) * 4;
        const sheetX = steerFrame * FRAME_W + x;
        const sheetY = pitchRow * FRAME_H + y;
        const di = (sheetY * sheet.width + sheetX) * 4;
        sheet.data[di] = data[si]; sheet.data[di + 1] = data[si + 1];
        sheet.data[di + 2] = data[si + 2]; sheet.data[di + 3] = 255;
      }
    }
  });
});

const out = path.join(process.cwd(), 'public', 'assets', 'car.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(
  `wrote ${out} (${sheet.width}x${sheet.height}, ` +
  `${STEER_FRAME_COUNT * PITCH_ROWS.length} frames of ${FRAME_W}x${FRAME_H})`
);
