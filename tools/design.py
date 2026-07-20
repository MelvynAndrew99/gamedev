# v3: Jeep-inspired silhouette. The core fix from v2's feedback: a real
# full-width greenhouse (cab) integrated into the body instead of two
# skinny disconnected posts, PLUS a mounted spare tire — the single most
# recognizable "this is a Jeep" signal, doing more identity work than any
# amount of panel shading could.
W, H = 32, 24
grid = [['.' for _ in range(W)] for _ in range(H)]

def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                grid[y][x] = ch

def mirror_x(x0, x1):
    return W - 1 - x1, W - 1 - x0

def mrect(x0, y0, x1, y1, ch):
    rect(x0, y0, x1, y1, ch)
    mx0, mx1 = mirror_x(x0, x1)
    rect(mx0, y0, mx1, y1, ch)

def outlined_rect(x0, y0, x1, y1, ch):
    rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 'K')
    rect(x0, y0, x1, y1, ch)

def outlined_mrect(x0, y0, x1, y1, ch):
    outlined_rect(x0, y0, x1, y1, ch)
    mx0, mx1 = mirror_x(x0, x1)
    outlined_rect(mx0, y0, mx1, y1, ch)

def dither(x0, y0, x1, y1, chA, chB):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                grid[y][x] = chA if (x + y) % 2 == 0 else chB

def circle(cx, cy, r, ch):
    # octagon approximation of a circle at pixel scale — reads clean at 2x
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy <= r*r + r*0.6:
                if 0 <= x < W and 0 <= y < H:
                    grid[y][x] = ch

# ===== SILHOUETTE: full-width cab, integrated roof rail =====
outlined_rect(6, 0, 25, 2, 'G')          # roof rail — spans nearly the full body now
outlined_rect(4, 9, 27, 21, 'R')         # main body (wide, low, jeep-proportioned)
outlined_mrect(0, 16, 1, 20, 'C')        # exhaust
outlined_mrect(0, 20, 7, 23, 'W')        # tires — bigger, chunkier (jeep stance)
outlined_mrect(1, 21, 5, 21, 'w')        # hubcaps

# ===== CAB: full window band, not two skinny posts =====
rect(8, 3, 23, 8, 'D')                   # continuous rear window — THE fix
rect(8, 3, 23, 3, 'g')                   # roofline highlight along the top edge
rect(8, 3, 9, 8, 'G'); rect(22, 3, 23, 8, 'G')  # A-pillars, thin, at the edges only
rect(15, 4, 16, 7, 'g')                  # center window highlight/reflection streak

# ===== DETAIL PASS =====
rect(5, 9, 26, 10, 'A')                  # roof-to-body transition panel
rect(5, 9, 26, 9, 'a')

rect(7, 11, 24, 11, 'Y')                 # hazard stripe

# highlight spines, both quarter panels
rect(6, 12, 7, 19, 'r'); rect(24, 12, 25, 19, 'r')
rect(9, 12, 10, 18, 'H'); rect(21, 12, 22, 18, 'H')

# center bolted plate (smaller now — the spare tire is the real centerpiece)
rect(13, 13, 18, 15, 'A')
rect(13, 13, 13, 15, 'a'); rect(18, 13, 18, 15, 'a')

# --- SPARE TIRE: mounted on the tailgate, classic Jeep signature -----------
circle(16, 16, 4, 'K')
circle(16, 16, 3, 'W')
circle(16, 16, 1, 'w')

# taillights, dual-tone + glint, flanking the tire
rect(5, 14, 8, 17, 't')
rect(5, 14, 6, 17, 'T'); rect(7, 14, 8, 17, 'O')
grid[15][6] = 'w'
mx0, mx1 = mirror_x(5, 8); rect(mx0, 14, mx1, 17, 't')
rect(mx0, 14, mx0 + 1, 17, 'O'); rect(mx0 + 2, 14, mx1, 17, 'T')
grid[15][mx1 - 1] = 'w'

rect(21, 19, 23, 20, 'r')                # rust patch

dither(9, 20, 22, 21, 'A', 'a')          # mesh vent under the bumper

mrect(0, 20, 1, 20, 'c')                 # exhaust tip glow

rect(5, 22, 26, 22, 'A')                 # bumper
for xc in (7, 11, 15, 16, 20, 24):
    if 23 < H:
        grid[23][xc] = 'S'

rows = [''.join(row) for row in grid]
for r in rows:
    assert len(r) == W, (len(r), r)
print('\n'.join(rows))
open('map.txt', 'w').write('\n'.join(rows))