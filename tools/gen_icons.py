"""Generates the app icon set as real PNG files with no external dependencies.

Draws a simple flat house mark (roof + body + door) on a rounded-square dark
background. Run with: py tools/gen_icons.py
"""
import os
import struct
import zlib

BG = (15, 23, 42)        # slate-900, matches --brand
MARK = (255, 255, 255)   # white
ACCENT = (37, 99, 235)   # blue-600, used for the door

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'icons')


def rounded_square_mask(size, radius):
    r = radius
    mask = [[True] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            in_corner = (x < r and y < r) or (x >= size - r and y < r) or \
                        (x < r and y >= size - r) or (x >= size - r and y >= size - r)
            if not in_corner:
                continue
            cx = r if x < r else size - r
            cy = r if y < r else size - r
            dx, dy = x - cx + 0.5, y - cy + 0.5
            if dx * dx + dy * dy > r * r:
                mask[y][x] = False
    return mask


def point_in_triangle(px, py, ax, ay, bx, by, cx, cy):
    def sign(x1, y1, x2, y2, x3, y3):
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
    d1 = sign(px, py, ax, ay, bx, by)
    d2 = sign(px, py, bx, by, cx, cy)
    d3 = sign(px, py, cx, cy, ax, ay)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


def draw_icon(size):
    px = [[BG for _ in range(size)] for _ in range(size)]
    mask = rounded_square_mask(size, int(size * 0.22))

    u = size / 100.0

    # Roof: a triangle
    apex = (50 * u, 20 * u)
    left = (18 * u, 52 * u)
    right = (82 * u, 52 * u)

    # House body: rectangle
    body_x0, body_x1 = 26 * u, 74 * u
    body_y0, body_y1 = 52 * u, 82 * u

    # Door: small rectangle, accent color
    door_x0, door_x1 = 44 * u, 56 * u
    door_y0, door_y1 = 64 * u, 82 * u

    roof_thick = 7 * u  # roof drawn as an outline band, not filled, for a lighter mark

    for y in range(size):
        for x in range(size):
            if not mask[y][x]:
                continue
            fx, fy = x + 0.5, y + 0.5
            color = BG

            in_roof_outer = point_in_triangle(fx, fy, *apex, *left, *right)
            in_roof_inner = point_in_triangle(
                fx, fy,
                apex[0], apex[1] + roof_thick * 1.4,
                left[0] + roof_thick, left[1] - roof_thick * 0.4,
                right[0] - roof_thick, right[1] - roof_thick * 0.4,
            )
            if in_roof_outer and not in_roof_inner:
                color = MARK
            elif body_x0 <= fx <= body_x1 and body_y0 <= fy <= body_y1:
                if door_x0 <= fx <= door_x1 and door_y0 <= fy <= door_y1:
                    color = ACCENT
                else:
                    color = MARK

            px[y][x] = color
    return px


def write_png(path, pixels):
    size = len(pixels)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type 0
        for (r, g, b) in row:
            raw += bytes((r, g, b))

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sizes = [32, 152, 167, 180, 192, 512]
    for s in sizes:
        write_png(os.path.join(OUT_DIR, f'icon-{s}.png'), draw_icon(s))
        print(f'wrote icon-{s}.png')


if __name__ == '__main__':
    main()
