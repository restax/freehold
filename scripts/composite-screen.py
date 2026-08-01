"""Warp a real Freehold screenshot onto the laptop screen in the generated photo.

Compositing rather than prompting, because an image model asked to render a
specific UI invents one: plausible-looking chrome, garbled text, nothing that
is actually the product. The whole point of the shot is to show real software.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

PHOTO = "/tmp/presenter-blank.png"
SHOT = "/Users/paul/Documents/Coding/TC Website/apps/web/public/marketing/shots/shot-transactions.png"
OUT = "/tmp/presenter-composited.png"

photo = Image.open(PHOTO).convert("RGB")
a = np.asarray(photo).astype(int)

# The placeholder screen is *perfectly* neutral grey (196,196,195); the wall
# behind her is warm (217,212,208), R above B by roughly nine. Chroma, not
# brightness, is what separates them — a brightness threshold picks the wall,
# which is the larger region.
mx, mn = a.max(axis=2), a.min(axis=2)
mask = (mx - mn <= 5) & (mn > 180) & (mx < 215)

lab, n = ndimage.label(mask)
sizes = ndimage.sum(mask, lab, range(1, n + 1))
screen = lab == (int(np.argmax(sizes)) + 1)
ys, xs = np.nonzero(screen)
print(f"screen blob: {screen.sum():,} px, bbox x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}")

# Corners of a convex quad: extremes of x+y and x-y.
s, d = xs + ys, xs - ys
tl = (xs[np.argmin(s)], ys[np.argmin(s)])
br = (xs[np.argmax(s)], ys[np.argmax(s)])
tr = (xs[np.argmax(d)], ys[np.argmax(d)])
bl = (xs[np.argmin(d)], ys[np.argmin(d)])
print("corners  TL", tl, " TR", tr, " BR", br, " BL", bl)

# Crop the screenshot to the screen's aspect so nothing is stretched.
scr = Image.open(SHOT).convert("RGB")
quad_w = (np.hypot(*(np.subtract(tr, tl))) + np.hypot(*(np.subtract(br, bl)))) / 2
quad_h = (np.hypot(*(np.subtract(bl, tl))) + np.hypot(*(np.subtract(br, tr)))) / 2
target_ar = quad_w / quad_h
sw, sh = scr.size
if sw / sh > target_ar:                       # too wide -> trim the right only
    # Anchored left, not centred. A centred crop eats the page title and the
    # filter labels down the left edge, which is where a viewer's eye lands
    # and the only part that says what they are looking at.
    new_w = int(sh * target_ar)
    scr = scr.crop((0, 0, new_w, sh))
else:                                          # too tall -> trim from the bottom
    new_h = int(sw / target_ar)
    scr = scr.crop((0, 0, sw, new_h))
print(f"screenshot cropped to {scr.size}, screen aspect {target_ar:.3f}")


def coeffs(dst, src):
    """PIL PERSPECTIVE maps destination -> source, so solve in that direction."""
    m = []
    for (dx, dy), (sx, sy) in zip(dst, src):
        m.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        m.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    A = np.array(m, dtype=float)
    B = np.array(src, dtype=float).reshape(8)
    return np.linalg.solve(A, B)


c = coeffs([tl, tr, br, bl], [(0, 0), (scr.width, 0), scr.size, (0, scr.height)])
warped = scr.transform(photo.size, Image.PERSPECTIVE, c, Image.BICUBIC)

# Pull the mask in by a pixel so no placeholder grey survives at the edges.
m = ndimage.binary_erosion(screen, iterations=2)
alpha = Image.fromarray((ndimage.gaussian_filter(m.astype(float), 0.8) * 255).astype("uint8"))

out = Image.composite(warped, photo, alpha)
out.save(OUT)
print("wrote", OUT, out.size)
