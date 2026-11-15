#!/usr/bin/env python3
"""Sosyal medya bağlantı önizlemesi (1200x630) üretir."""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "onizleme.png")

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
bold = lambda size: ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), size)
regular = lambda size: ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans.ttf"), size)

BG_TOP = (18, 128, 108)
BG_BOTTOM = (9, 61, 56)
CARD = (255, 255, 255)
INK = (16, 24, 40)
MUTED = (90, 102, 117)
TEAL = (15, 111, 102)
SOFT = (207, 233, 228)

image = Image.new("RGB", (W, H), BG_BOTTOM)
draw = ImageDraw.Draw(image)

# Arka plan degradesi
for y in range(H):
    t = y / (H - 1)
    color = tuple(round(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3))
    draw.line([(0, y), (W, y)], fill=color)

# Dekoratif halkalar
for radius, alpha in ((420, 26), (300, 22), (200, 18)):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    ldraw.ellipse((W - 220 - radius, -160 - radius + 120, W - 220 + radius, -160 + radius + 120), outline=(255, 255, 255, alpha), width=2)
    image = Image.alpha_composite(image.convert("RGBA"), layer).convert("RGB")
draw = ImageDraw.Draw(image)

# Sol taraf
x = 84
draw.text((x, 92), "RADYOLOJİ DEPARTMANI", font=bold(24), fill=SOFT)
title_font = bold(72)
title = "Günün Panosu"
draw.text((x, 140), title, font=title_font, fill=(255, 255, 255))

sub_font = regular(30)
draw.text((x, 268), "Günün ekibi · Yemek menüsü · Notlar", font=sub_font, fill=SOFT)
draw.text((x, 320), "Tek ekranda, kurulum gerektirmeden.", font=regular(28), fill=(178, 215, 208))

draw.line([(x, 404), (x + 520, 404)], fill=(255, 255, 255, 60), width=2)

# Alt bilgi: URL + küçük rozet
draw.rounded_rectangle((x, 444, x + 300, 500), radius=28, outline=(255, 255, 255, 90), width=2)
draw.text((x + 26, 459), "mryusufcan.github.io", font=regular(24), fill=(255, 255, 255))
draw.text((x, 530), "Ekip görüntüler · Yönetici yayınlar", font=regular(26), fill=(178, 215, 208))

# Sağ taraf: kart
card_x0, card_y0, card_x1, card_y1 = 704, 96, 1116, 534
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sdraw = ImageDraw.Draw(shadow)
sdraw.rounded_rectangle((card_x0 + 6, card_y0 + 14, card_x1 + 6, card_y1 + 14), radius=28, fill=(0, 0, 0, 70))
image = Image.alpha_composite(image.convert("RGBA"), shadow).convert("RGB")
draw = ImageDraw.Draw(image)

draw.rounded_rectangle((card_x0, card_y0, card_x1, card_y1), radius=28, fill=CARD)

pad = 34
draw.text((card_x0 + pad, card_y0 + 32), "GÜNÜN EKİBİ", font=bold(20), fill=TEAL)
rows = [
    ("08–16", "Hazal Kaşıkcı", "MR"),
    ("16–24", "Yusuf Can Özdemir", ""),
    ("24–08", "Abdullah Tecen", ""),
]
row_font = bold(24)
meta_font = regular(20)
y = card_y0 + 74
for shift, name, note in rows:
    draw.rounded_rectangle((card_x0 + pad, y, card_x0 + pad + 66, y + 30), radius=8, fill=(232, 244, 242))
    draw.text((card_x0 + pad + 10, y + 4), shift, font=bold(17), fill=TEAL)
    draw.text((card_x0 + pad + 82, y + 2), name, font=row_font, fill=INK)
    if note:
        draw.text((card_x0 + pad + 82 + draw.textlength(name, font=row_font) + 10, y + 6), f"· {note}", font=meta_font, fill=MUTED)
    y += 46

draw.line([(card_x0 + pad, y + 10), (card_x1 - pad, y + 10)], fill=(226, 231, 238), width=2)

y += 34
draw.text((card_x0 + pad, y), "GÜNÜN YEMEĞİ", font=bold(20), fill=TEAL)
y += 34
draw.text((card_x0 + pad, y), "Mercimek çorbası", font=regular(24), fill=INK)
draw.text((card_x0 + pad, y + 34), "Izgara tavuk · Pilav · Salata", font=regular(24), fill=MUTED)

y += 96
draw.text((card_x0 + pad, y), "NOT", font=bold(20), fill=TEAL)
draw.text((card_x0 + pad, y + 32), "BT 14:00–16:00 bakımda", font=regular(22), fill=MUTED)

image.save(OUT, "PNG", optimize=True)
print("yazıldı:", os.path.abspath(OUT), image.size)
