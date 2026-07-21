#!/usr/bin/env python3
# tools/render-car.py — pre-rendered 3D sprite pipeline (the Donkey Kong
# Country / early Mario Kart technique). A simple triangle model of the
# craft is lit, rasterized at sprite resolution, palette-quantized into
# shading bands (so it reads as pixel art, not a bad screenshot), and
# outlined. The five steering frames are REAL camera yaws with the craft
# banking into the turn — actual rotation, which shear can never fake.
#
# Usage: python3 tools/render-car.py   (writes public/assets/car.png)
# Deps: Pillow only.

import math
from PIL import Image

# ---------------- geometry helpers ----------------

def frustum_box(z0, z1, w0, w1, y_bot0, y_top0, y_bot1, y_top1, x_off=0.0):
    """8 corners of a tapered box: rear face at z0 (width w0, y_bot0..y_top0),
    front face at z1 (width w1, y_bot1..y_top1). Returns list of tris
    as (v0, v1, v2) with outward-ish winding (we light double-sided)."""
    r = [(-w0 + x_off, y_bot0, z0), (w0 + x_off, y_bot0, z0),
         (w0 + x_off, y_top0, z0), (-w0 + x_off, y_top0, z0)]
    f = [(-w1 + x_off, y_bot1, z1), (w1 + x_off, y_bot1, z1),
         (w1 + x_off, y_top1, z1), (-w1 + x_off, y_top1, z1)]
    quads = [
        (r[0], r[1], r[2], r[3]),  # rear
        (f[1], f[0], f[3], f[2]),  # front
        (r[3], r[2], f[2], f[3]),  # top
        (r[0], f[0], f[1], r[1]),  # bottom (wound down)
        (r[0], r[3], f[3], f[0]),  # left
        (r[1], f[1], f[2], r[2]),  # right
    ]
    tris = []
    for a, b, c, d in quads:
        tris.append((a, b, c))
        tris.append((a, c, d))
    return tris

def disc(cx, cy, cz, radius, segments=10):
    """Flat octagon-ish disc facing -z (toward the camera at rear view)."""
    tris = []
    pts = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a), cz))
    center = (cx, cy, cz)
    for i in range(segments):
        tris.append((center, pts[i], pts[(i + 1) % segments]))
    return tris

# ---------------- the craft ----------------
# Coordinates: x right, y up, z forward (nose at +z, thrusters at -z).
# Units are arbitrary; the ortho scale below sets pixels.

MATERIALS = {
    'hull':    {'color': (218, 70, 40),  'bands': 4},
    'hull_lo': {'color': (146, 40, 26),  'bands': 3},
    'canopy':  {'color': (16, 26, 44),   'bands': 3},
    'visor':   {'color': (0, 229, 255),  'emissive': True},
    'stripe':  {'color': (0, 229, 255),  'emissive': True},
    'fin':     {'color': (236, 96, 56),  'bands': 4},
    'thr_ring':{'color': (10, 10, 16),   'bands': 2},
    'thr_glow':{'color': (0, 229, 255),  'emissive': True},
    'thr_core':{'color': (240, 255, 255),'emissive': True},
}

def build_craft():
    T = []  # (tri, material)
    def add(tris, mat):
        for t in tris:
            T.append((t, mat))

    # Fuselage: wide low wedge. Rear 15 wide / 6 tall, nose 6 wide / 2 tall.
    add(frustum_box(-16, 16, 15, 6, 0.0, 6.0, 1.2, 3.2), 'hull')
    # Belly plate, slightly darker and slimmer (reads as shadowed underside).
    add(frustum_box(-16, 14, 13, 5, -1.6, 0.2, 0.0, 1.2), 'hull_lo')

    # Canopy: small tapered pod on the rear-third of the hull top.
    add(frustum_box(-10, 4, 6.0, 3.0, 6.0, 10.8, 3.2, 5.8), 'canopy')
    # Visor: a thin bright band across the canopy rear face.
    add(frustum_box(-10.3, -9.6, 5.4, 5.3, 7.8, 9.6, 7.7, 9.5), 'visor')

    # Side pods: swept slabs flaring outward past the fuselage.
    for s in (-1, 1):
        add(frustum_box(-15, 6, 5.2, 2.4, 0.6, 4.2, 1.2, 2.6, x_off=s * 19.0), 'hull')
        # magenta stripe along each pod top
        add(frustum_box(-14, 4, 4.6, 2.0, 4.2, 5.0, 2.6, 3.2, x_off=s * 19.0), 'stripe')

    # Tail fin: thin vertical blade at the rear centerline.
    add(frustum_box(-16, -5, 1.6, 1.0, 6.0, 12.5, 3.2, 6.5), 'fin')

    # Thrusters: rings + glow + core on the rear face.
    for cx in (-8.5, 0.0, 8.5):
        add(disc(cx, 3.0, -16.4, 3.4), 'thr_ring')
        add(disc(cx, 3.0, -16.6, 2.5), 'thr_glow')
        add(disc(cx, 3.0, -16.8, 1.2), 'thr_core')
    return T

# ---------------- rasterizer ----------------

FRAME_W, FRAME_H = 92, 48
ORTHO_SCALE = 1.45          # world units -> pixels
CAM_PITCH = math.radians(5)  # looking slightly down at the craft
LIGHT = (-0.45, 0.8, -0.4)   # from upper-left, slightly behind camera
AMBIENT, DIFFUSE = 0.5, 0.6

def normalize(v):
    l = math.sqrt(sum(c * c for c in v)) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)

LIGHT = normalize(LIGHT)

def rot_y(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)

def rot_z(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2])

def rot_x(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c)

def render_frame(tris, yaw_deg, roll_deg):
    yaw, roll = math.radians(yaw_deg), math.radians(roll_deg)
    img = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
    px = img.load()
    zbuf = [[-1e9] * FRAME_W for _ in range(FRAME_H)]

    prepared = []
    for tri, mat in tris:
        # model -> world (bank, then yaw) -> camera (pitch)
        pts = [rot_x(rot_y(rot_z(p, roll), yaw), CAM_PITCH) for p in tri]
        # face normal in camera space (for lighting)
        ax = tuple(pts[1][i] - pts[0][i] for i in range(3))
        bx = tuple(pts[2][i] - pts[0][i] for i in range(3))
        n = normalize((ax[1] * bx[2] - ax[2] * bx[1],
                       ax[2] * bx[0] - ax[0] * bx[2],
                       ax[0] * bx[1] - ax[1] * bx[0]))
        # ortho project: x -> screen x, y -> screen y (flip), z = depth
        # camera looks along +z, so NEARER to camera = smaller z; keep -z as depth
        scr = [((p[0] * ORTHO_SCALE) + FRAME_W / 2,
                FRAME_H * 0.80 - (p[1] * ORTHO_SCALE),
                -p[2]) for p in pts]
        prepared.append((scr, n, mat))

    for scr, n, mat in prepared:
        m = MATERIALS[mat]
        if m.get('emissive'):
            shade = 1.0
        else:
            d = abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])
            shade = AMBIENT + DIFFUSE * d
            bands = m['bands']
            shade = round(shade * bands) / bands  # quantize -> pixel-art bands
        r0, g0, b0 = m['color']
        col = (min(255, int(r0 * shade)), min(255, int(g0 * shade)),
               min(255, int(b0 * shade)), 255)

        xs = [p[0] for p in scr]; ys = [p[1] for p in scr]
        x0, x1 = max(0, int(min(xs))), min(FRAME_W - 1, int(max(xs)) + 1)
        y0, y1 = max(0, int(min(ys))), min(FRAME_H - 1, int(max(ys)) + 1)
        (ax_, ay, az), (bx_, by, bz), (cx_, cy, cz) = scr
        den = (by - cy) * (ax_ - cx_) + (cx_ - bx_) * (ay - cy)
        if abs(den) < 1e-9:
            continue
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                w0 = ((by - cy) * (x + 0.5 - cx_) + (cx_ - bx_) * (y + 0.5 - cy)) / den
                w1 = ((cy - ay) * (x + 0.5 - cx_) + (ax_ - cx_) * (y + 0.5 - cy)) / den
                w2 = 1 - w0 - w1
                if w0 < 0 or w1 < 0 or w2 < 0:
                    continue
                depth = w0 * az + w1 * bz + w2 * cz
                if depth > zbuf[y][x]:
                    zbuf[y][x] = depth
                    px[x, y] = col

    # underglow: a thin magenta->cyan line hugging the craft's bottom edge
    glow = [(255, 45, 149, 255), (0, 229, 255, 255)]
    for x in range(FRAME_W):
        bottom = None
        for y in range(FRAME_H - 1, -1, -1):
            if px[x, y][3] > 0:
                bottom = y
                break
        if bottom is not None and bottom + 2 < FRAME_H:
            px[x, bottom + 1] = glow[0]
            px[x, bottom + 2] = glow[1]

    # outline: opaque pixel touching transparency -> near-black
    out = img.copy()
    opx = out.load()
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            if px[x, y][3] == 0:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= FRAME_W or ny >= FRAME_H or px[nx, ny][3] == 0:
                    edge = True
                    break
            if edge and px[x, y][:3] not in ((255, 45, 149), (0, 229, 255)):
                opx[x, y] = (10, 10, 20, 255)
    return out

def main():
    tris = build_craft()
    # 5 frames: hard-left, left, straight, right, hard-right.
    # Yaw turns the craft; roll banks it INTO the turn (F-Zero style).
    frames = [(-26, 14), (-13, 7), (0, 0), (13, -7), (26, -14)]
    sheet = Image.new('RGBA', (FRAME_W * 5, FRAME_H), (0, 0, 0, 0))
    for i, (yaw, roll) in enumerate(frames):
        sheet.paste(render_frame(tris, yaw, roll), (FRAME_W * i, 0))
    import os
    out = os.path.join(os.getcwd(), 'public', 'assets', 'car.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print(f'wrote {out} ({sheet.width}x{sheet.height}, 5 frames of {FRAME_W}x{FRAME_H})')

if __name__ == '__main__':
    main()