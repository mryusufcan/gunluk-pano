import os

from PIL import Image, ImageDraw

TEAL_TOP = (18, 128, 108, 255)
TEAL_BOT = (11, 90, 83, 255)
WHITE = (255, 255, 255, 255)
LINE = (15, 111, 102, 255)
AMBER = (240, 173, 78, 255)
SS = 4  # supersampling


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make(size, detailed=True):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    # dikey degrade
    for y in range(s):
        t = y / (s - 1)
        color = tuple(round(TEAL_TOP[i] * (1 - t) + TEAL_BOT[i] * t) for i in range(3)) + (255,)
        d.line([(0, y), (s, y)], fill=color)
    # beyaz pano
    left, right = 0.275 * s, 0.725 * s
    top, bottom = 0.25 * s, 0.765 * s
    rounded(d, (left, top, right, bottom), 0.062 * s, WHITE)
    # üstteki klips
    rounded(d, (0.425 * s, 0.205 * s, 0.575 * s, 0.305 * s), 0.022 * s, WHITE)
    rounded(d, (0.455 * s, 0.228 * s, 0.545 * s, 0.282 * s), 0.012 * s, TEAL_TOP)
    if detailed:
        # satırlar
        for index, width in enumerate((0.30, 0.30, 0.19)):
            y = 0.41 * s + index * 0.095 * s
            d.rounded_rectangle(
                (0.355 * s, y, (0.355 + width) * s, y + 0.034 * s),
                radius=0.017 * s,
                fill=LINE,
            )
        # gün işareti
        d.ellipse((0.60 * s, 0.615 * s, 0.655 * s, 0.670 * s), fill=AMBER)
    else:
        for index, width in enumerate((0.30, 0.22)):
            y = 0.44 * s + index * 0.13 * s
            d.rounded_rectangle(
                (0.355 * s, y, (0.355 + width) * s, y + 0.055 * s),
                radius=0.026 * s,
                fill=LINE,
            )
    return img.resize((size, size), Image.LANCZOS)


ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
os.makedirs(ASSETS, exist_ok=True)

for size, detailed in ((512, True), (192, True), (180, True), (32, False)):
    make(size, detailed).save(os.path.join(ASSETS, f"ikon-{size}.png"))

print("ok")
