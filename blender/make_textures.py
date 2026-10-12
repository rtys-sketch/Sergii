"""Generate the texture set used by build_store.py.

Run once with a normal Python that has Pillow installed:

    python3 blender/make_textures.py

Every texture is procedural (no photos, no third-party brand logos), so the
output is deterministic and safe to ship with a game.  The PNGs are written to
blender/textures/ and are committed, so Blender itself never needs Pillow.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
BOLD = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")
REG = os.path.join(FONT_DIR, "DejaVuSans.ttf")


def font(size, bold=True):
    try:
        return ImageFont.truetype(BOLD if bold else REG, size)
    except OSError:
        return ImageFont.load_default()


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, img.size)


def noise_overlay(img, amount=10, seed=0):
    rnd = random.Random(seed)
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            n = rnd.randint(-amount, amount)
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img


# --------------------------------------------------------------------------- floors / walls
def tile(name, size_px, base, grout, grout_px, variation=6, seed=1, rect=(1, 1)):
    """One tile (or rect[0] x rect[1] tiles) per texture, grout on the edges."""
    w, h = size_px * rect[0], size_px * rect[1]
    img = Image.new("RGB", (w, h), grout)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    tw, th = w // rect[0], h // rect[1]
    for j in range(rect[1]):
        for i in range(rect[0]):
            v = rnd.randint(-variation, variation)
            c = tuple(max(0, min(255, k + v)) for k in base)
            d.rectangle([i * tw + grout_px, j * th + grout_px, (i + 1) * tw - grout_px - 1, (j + 1) * th - grout_px - 1], fill=c)
    noise_overlay(img, 5, seed)
    save(img, name)


def wood(name, w=512, h=1024, base=(196, 150, 98), seed=3, planks=4, vertical=True):
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    pw = w // planks
    for p in range(planks):
        shade = rnd.randint(-14, 14)
        x0 = p * pw
        # grain lines
        for _ in range(60):
            gx = x0 + rnd.randint(0, pw - 1)
            amp = rnd.uniform(1.5, 6)
            freq = rnd.uniform(0.004, 0.012)
            ph = rnd.uniform(0, 6.28)
            col = tuple(max(0, min(255, c + shade - rnd.randint(10, 35))) for c in base)
            pts = [(gx + amp * math.sin(y * freq + ph), y) for y in range(0, h, 8)]
            d.line(pts, fill=col, width=1)
        d.rectangle([x0, 0, x0 + pw - 1, h - 1], outline=tuple(int(c * 0.7) for c in base))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    if not vertical:
        img = img.rotate(90, expand=True)
    noise_overlay(img, 4, seed)
    save(img, name)


def granite(name, size=512, seed=5):
    rnd = random.Random(seed)
    img = Image.new("RGB", (size, size), (150, 146, 140))
    d = ImageDraw.Draw(img)
    for _ in range(9000):
        x, y = rnd.randint(0, size), rnd.randint(0, size)
        r = rnd.choice([1, 1, 2, 2, 3])
        c = rnd.choice([(40, 38, 36), (90, 86, 80), (200, 196, 190), (120, 100, 90), (230, 228, 222), (60, 58, 56)])
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    save(img, name)


def paver(name, seed=9):
    """Dark street pavers in a running bond (outside the front door)."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (512, 512), (24, 24, 26))
    d = ImageDraw.Draw(img)
    bh, bw = 64, 128
    for row in range(512 // bh):
        off = (row % 2) * bw // 2
        for col in range(-1, 512 // bw + 1):
            x = col * bw + off
            v = rnd.randint(-8, 8)
            d.rectangle([x + 3, row * bh + 3, x + bw - 3, row * bh + bh - 3], fill=(58 + v, 58 + v, 62 + v))
    noise_overlay(img, 6, seed)
    save(img, name)


def carpet(name, seed=11):
    rnd = random.Random(seed)
    img = Image.new("RGB", (256, 256), (88, 90, 94))
    px = img.load()
    for y in range(256):
        for x in range(256):
            n = rnd.randint(-14, 14)
            px[x, y] = (88 + n, 90 + n, 94 + n)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 255, 255], outline=(70, 72, 76), width=2)
    save(img, name)


# --------------------------------------------------------------------------- brand / decor
def mama_pattern(name, seed=13):
    """Counter front panel: white 'M'/'A' letters + red and green strokes on charcoal."""
    rnd = random.Random(seed)
    w, h = 1024, 640
    img = Image.new("RGB", (w, h), (38, 38, 42))
    d = ImageDraw.Draw(img)
    f = font(78)
    letters = "MAMA"
    row_h = 92
    for r in range(h // row_h + 1):
        x = -40 + (r % 2) * 60
        i = r
        while x < w:
            ch = letters[i % 4]
            ang = rnd.uniform(-25, 25)
            tile_img = Image.new("RGBA", (110, 110), (0, 0, 0, 0))
            ImageDraw.Draw(tile_img).text((14, 6), ch, font=f, fill=(240, 240, 240, 255))
            tile_img = tile_img.rotate(ang, resample=Image.BICUBIC)
            img.paste(tile_img, (int(x), int(r * row_h - 10)), tile_img)
            # little red / green "pepper" strokes
            for col in ((210, 40, 40), (60, 170, 70)):
                sx, sy = x + rnd.randint(70, 120), r * row_h + rnd.randint(10, 70)
                a = rnd.uniform(0, math.pi)
                d.line([(sx, sy), (sx + 22 * math.cos(a), sy + 22 * math.sin(a))], fill=col, width=7)
            x += rnd.randint(120, 160)
            i += 1
    save(img, name)


def chalk_wall(name, seed=17):
    """Charcoal wall with white chalk-line doodles (pizza, cups, croissant, bottles...)."""
    rnd = random.Random(seed)
    w, h = 2048, 512
    img = Image.new("RGB", (w, h), (40, 42, 46))
    d = ImageDraw.Draw(img)
    white = (215, 215, 215)

    def pizza(cx, cy, r):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=white, width=6)
        for k in range(6):
            a = k * math.pi / 3
            d.line([(cx, cy), (cx + r * math.cos(a), cy + r * math.sin(a))], fill=white, width=3)
        for _ in range(5):
            a, rr = rnd.uniform(0, 6.28), rnd.uniform(0.2, 0.75) * r
            d.ellipse([cx + rr * math.cos(a) - 6, cy + rr * math.sin(a) - 6, cx + rr * math.cos(a) + 6, cy + rr * math.sin(a) + 6], outline=white, width=3)

    def cup(cx, cy, s):
        d.polygon([(cx - s, cy - s), (cx + s, cy - s), (cx + 0.7 * s, cy + s), (cx - 0.7 * s, cy + s)], outline=white)
        d.arc([cx + 0.6 * s, cy - 0.5 * s, cx + 1.5 * s, cy + 0.4 * s], -90, 90, fill=white, width=3)
        for k in range(3):
            d.arc([cx - 0.6 * s + k * 0.5 * s, cy - 2.2 * s, cx - 0.2 * s + k * 0.5 * s, cy - 1.2 * s], 90, 270, fill=white, width=3)

    def bottle(cx, cy, s):
        d.rectangle([cx - 0.4 * s, cy - 0.6 * s, cx + 0.4 * s, cy + 1.4 * s], outline=white, width=3)
        d.rectangle([cx - 0.15 * s, cy - 1.4 * s, cx + 0.15 * s, cy - 0.6 * s], outline=white, width=3)
        d.line([(cx - 0.4 * s, cy + 0.2 * s), (cx + 0.4 * s, cy + 0.2 * s)], fill=white, width=3)

    def croissant(cx, cy, s):
        for k in range(5):
            x0 = cx - s + k * 0.4 * s
            d.arc([x0, cy - 0.6 * s, x0 + 0.6 * s, cy + 0.6 * s], 200, 340, fill=white, width=3)
        d.arc([cx - 1.2 * s, cy - 0.9 * s, cx + 1.4 * s, cy + 0.7 * s], 20, 160, fill=white, width=3)

    def burger(cx, cy, s):
        d.chord([cx - s, cy - s, cx + s, cy + 0.3 * s], 180, 360, outline=white, width=3)
        d.line([(cx - s, cy), (cx + s, cy)], fill=white, width=3)
        d.rectangle([cx - s, cy + 0.15 * s, cx + s, cy + 0.45 * s], outline=white, width=3)

    x = 60
    funcs = [pizza, cup, bottle, croissant, burger, cup, pizza, bottle]
    i = 0
    while x < w - 80:
        fn = funcs[i % len(funcs)]
        s = rnd.randint(70, 110)
        fn(x, rnd.randint(200, 320), s if fn is not pizza else s + 30)
        # stars / sparkles in between
        sx, sy = x + rnd.randint(60, 120), rnd.randint(60, 460)
        d.line([(sx - 8, sy), (sx + 8, sy)], fill=white, width=2)
        d.line([(sx, sy - 8), (sx, sy + 8)], fill=white, width=2)
        x += rnd.randint(300, 420)
        i += 1
    save(img, name)


def pizza_box_side(name, seed=19):
    """Side view of stacked kraft pizza boxes (thin horizontal layers)."""
    rnd = random.Random(seed)
    w, h = 512, 512
    img = Image.new("RGB", (w, h), (190, 160, 118))
    d = ImageDraw.Draw(img)
    y = 0
    while y < h:
        th = rnd.randint(9, 12)
        v = rnd.randint(-10, 10)
        d.rectangle([0, y, w, y + th - 2], fill=(196 + v, 164 + v, 120 + v))
        d.line([(0, y + th - 1), (w, y + th - 1)], fill=(130, 104, 70), width=2)
        # small offsets (stacks are never perfect)
        if rnd.random() < 0.3:
            d.line([(rnd.randint(0, w), y), (rnd.randint(0, w), y)], fill=(150, 120, 84), width=1)
        y += th
    save(img, name)


def cardboard(name, seed=23):
    img = Image.new("RGB", (256, 256), (178, 142, 98))
    noise_overlay(img, 8, seed)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 120, 255, 136], fill=(160, 126, 84))  # tape
    save(img, name)


# --------------------------------------------------------------------------- products on shelves
PALETTE_SNACK = [(230, 40, 40), (250, 200, 30), (40, 90, 200), (240, 120, 20), (30, 150, 70),
                 (150, 40, 160), (250, 230, 80), (200, 30, 90), (20, 160, 200), (255, 255, 255)]


def products(name, kind, seed):
    """A 1 m wide strip of shelf facings.  Texture V = full product height."""
    rnd = random.Random(seed)
    w, h = 1024, 256
    bg = (24, 24, 28)
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    x = 2
    while x < w - 4:
        if kind == "snacks":  # chip bags: tall, pillow-shaped, bright
            pw = rnd.randint(70, 110)
            ph = rnd.randint(170, 240)
            c = rnd.choice(PALETTE_SNACK)
            d.rounded_rectangle([x, h - ph, x + pw, h - 2], radius=14, fill=c)
            d.ellipse([x + pw * 0.2, h - ph * 0.7, x + pw * 0.8, h - ph * 0.35], fill=rnd.choice(PALETTE_SNACK))
            d.rectangle([x + 6, h - ph + 8, x + pw - 6, h - ph + 26], fill=(255, 255, 255))
        elif kind == "grocery":  # jars, oil bottles, pasta boxes
            t = rnd.random()
            if t < 0.35:  # oil bottle
                pw, ph = rnd.randint(46, 60), rnd.randint(200, 246)
                d.rectangle([x, h - ph * 0.8, x + pw, h - 2], fill=(220, 180, 40))
                d.rectangle([x + pw * 0.35, h - ph, x + pw * 0.65, h - ph * 0.8], fill=(200, 160, 30))
                d.rectangle([x + 4, h - ph * 0.55, x + pw - 4, h - ph * 0.3], fill=rnd.choice([(30, 120, 50), (200, 30, 30), (250, 250, 250)]))
            elif t < 0.7:  # jar
                pw, ph = rnd.randint(54, 70), rnd.randint(110, 150)
                d.rectangle([x, h - ph, x + pw, h - 2], fill=rnd.choice([(150, 60, 40), (90, 120, 40), (190, 120, 40), (120, 30, 30)]))
                d.rectangle([x, h - ph, x + pw, h - ph + 16], fill=(200, 200, 205))
                d.rectangle([x + 4, h - ph * 0.65, x + pw - 4, h - ph * 0.3], fill=(240, 236, 220))
            else:  # box
                pw, ph = rnd.randint(70, 110), rnd.randint(150, 230)
                c = rnd.choice(PALETTE_SNACK)
                d.rectangle([x, h - ph, x + pw, h - 2], fill=c)
                d.rectangle([x + 6, h - ph * 0.6, x + pw - 6, h - ph * 0.35], fill=(255, 255, 255))
        elif kind == "dairy":  # yogurts, milk, cheese packs
            t = rnd.random()
            if t < 0.5:
                pw, ph = rnd.randint(50, 64), rnd.randint(80, 120)
                c = rnd.choice([(250, 250, 250), (240, 240, 230), (60, 110, 200), (250, 220, 60), (240, 140, 40)])
                for k in range(2):
                    d.rectangle([x, h - ph * (k + 1), x + pw, h - ph * k - 4], fill=c)
                    d.rectangle([x, h - ph * (k + 1), x + pw, h - ph * (k + 1) + 12], fill=(200, 200, 210))
            else:
                pw, ph = rnd.randint(60, 80), rnd.randint(170, 230)
                d.rectangle([x, h - ph, x + pw, h - 2], fill=(248, 248, 248))
                d.rectangle([x, h - ph * 0.5, x + pw, h - ph * 0.3], fill=rnd.choice([(40, 90, 200), (220, 40, 40), (40, 160, 70)]))
        elif kind == "drinks":  # PET bottles and cans
            t = rnd.random()
            pw = rnd.randint(42, 58)
            ph = rnd.randint(200, 248) if t < 0.75 else rnd.randint(110, 130)
            body = rnd.choice([(40, 20, 20), (230, 120, 20), (60, 170, 60), (200, 230, 250), (200, 230, 250), (250, 200, 30), (180, 30, 30)])
            d.rounded_rectangle([x, h - ph * 0.85, x + pw, h - 2], radius=10, fill=body)
            d.rectangle([x + pw * 0.3, h - ph, x + pw * 0.7, h - ph * 0.85], fill=(220, 220, 225))
            d.rectangle([x, h - ph * 0.55, x + pw, h - ph * 0.38], fill=rnd.choice([(200, 20, 30), (250, 250, 250), (20, 120, 50), (20, 60, 160)]))
        elif kind == "choco":  # purple bars, boxes, candy
            pw, ph = rnd.randint(60, 120), rnd.randint(70, 200)
            c = rnd.choice([(120, 80, 170), (120, 80, 170), (90, 50, 30), (200, 30, 40), (240, 240, 240), (30, 60, 140), (220, 170, 40)])
            d.rectangle([x, h - ph, x + pw, h - 2], fill=c)
            d.rectangle([x + 4, h - ph * 0.7, x + pw - 4, h - ph * 0.5], fill=(255, 255, 255))
        elif kind == "bakery":  # bread loaves / buns in bags
            pw, ph = rnd.randint(90, 150), rnd.randint(80, 130)
            c = rnd.choice([(180, 120, 60), (150, 95, 45), (210, 160, 90), (120, 75, 40)])
            d.ellipse([x, h - ph, x + pw, h - 2], fill=c)
            d.rectangle([x, h - ph * 0.5, x + pw, h - 2], fill=c)
        elif kind == "candy":  # cash-desk candy rack
            pw, ph = rnd.randint(40, 60), rnd.randint(160, 240)
            c = rnd.choice([(250, 250, 250), (90, 50, 30), (30, 30, 30), (40, 90, 200), (200, 30, 30)])
            d.rectangle([x, h - ph, x + pw, h - 2], fill=c)
            d.rectangle([x + 4, h - ph * 0.6, x + pw - 4, h - ph * 0.4], fill=rnd.choice([(200, 30, 30), (40, 90, 200), (250, 200, 30)]))
        elif kind == "kitchen":  # containers, sauce bottles, packs
            pw, ph = rnd.randint(60, 140), rnd.randint(80, 220)
            c = rnd.choice([(240, 240, 240), (230, 230, 220), (200, 200, 205), (180, 40, 40), (60, 140, 60), (230, 180, 40), (120, 90, 60)])
            d.rectangle([x, h - ph, x + pw, h - 2], fill=c)
        elif kind == "storage":  # office rack: bags, boxes, water packs
            pw, ph = rnd.randint(90, 180), rnd.randint(90, 220)
            c = rnd.choice([(140, 100, 70), (200, 200, 200), (60, 60, 64), (178, 142, 98), (40, 90, 160), (160, 200, 230)])
            d.rectangle([x, h - ph, x + pw, h - 2], fill=c)
        else:
            raise ValueError(kind)
        x += pw + rnd.randint(2, 6)
    save(img, name)


# --------------------------------------------------------------------------- signs, screens, prints
def text_img(name, size, bg, lines, fill=(255, 255, 255), alpha_bg=False):
    """lines: [(text, font_px, (x, y), colour or None)]"""
    img = Image.new("RGBA" if alpha_bg else "RGB", size, bg)
    d = ImageDraw.Draw(img)
    for text, px, pos, col in lines:
        d.text(pos, text, font=font(px), fill=col or fill)
    save(img, name)
    return img


def neon_glow(img, color, blur=10):
    """Return an RGBA image with a soft glow around the glyphs (for neon signs)."""
    a = img.split()[-1]
    glow = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: min(255, int(v * 1.6)))
    out = Image.new("RGBA", img.size, color + (0,))
    out.putalpha(glow)
    out.alpha_composite(img)
    return out


def neon_market(name):
    """'МАРКЕТ [MA] ПІЦА' neon above the north (white) door.  Text faces the street."""
    w, h = 2048, 320
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(170)
    x = 40
    d.text((x, 70), "МАРКЕТ", font=f, fill=(60, 255, 90, 255))
    x = d.textbbox((x, 70), "МАРКЕТ", font=f)[2] + 40
    # MA logo box
    fm = font(140)
    mw = d.textbbox((0, 0), "M", font=fm)[2]
    aw = d.textbbox((0, 0), "A", font=fm)[2]
    d.rounded_rectangle([x, 50, x + mw + aw + 60, 270], radius=40, outline=(60, 255, 90, 255), width=22)
    d.text((x + 28, 80), "M", font=fm, fill=(60, 255, 90, 255))
    d.text((x + 28 + mw, 80), "A", font=fm, fill=(255, 50, 50, 255))
    x += mw + aw + 60 + 40
    d.text((x, 70), "ПІЦА", font=f, fill=(255, 50, 50, 255))
    g = neon_glow(img, (120, 255, 140), 14)
    save(g, name)


def sign_ma_pizza(name):
    """Front window sign: green 'MA' box (red A) + red 'PIZZA'."""
    w, h = 1536, 320
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([30, 40, 390, 280], radius=48, outline=(70, 255, 150, 255), width=26)
    d.text((70, 70), "M", font=font(170), fill=(70, 255, 150, 255))
    d.text((205, 70), "A", font=font(170), fill=(255, 40, 40, 255))
    d.text((560, 70), "PIZZA", font=font(180), fill=(255, 40, 40, 255))
    g = neon_glow(img, (255, 120, 120), 10)
    save(g, name)


def menu_board(name):
    w, h = 384, 1024
    img = Image.new("RGB", (w, h), (245, 245, 240))
    d = ImageDraw.Draw(img)
    prices = ["69,99", "98,99", "59,99", "39,99", "12,99", "45,99", "89,99", "24,99"]
    y = 30
    for p in prices:
        d.rectangle([20, y, 210, y + 70], fill=(200, 30, 40))
        d.text((32, y + 14), p, font=font(40), fill=(255, 255, 255))
        d.line([(230, y + 25), (360, y + 25)], fill=(120, 120, 120), width=6)
        d.line([(230, y + 50), (330, y + 50)], fill=(160, 160, 160), width=4)
        y += 120
    save(img, name)


def window_print(name):
    """Frosted office window film 'ДІЙСНО СМАЧНА ПІЦА!' (dark band + pizza icon)."""
    w, h = 512, 1024
    img = Image.new("RGB", (w, h), (205, 214, 214))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 120, w, 640], fill=(46, 54, 58))
    d.text((70, 170), "ДІЙСНО", font=font(76), fill=(235, 235, 235))
    d.text((40, 260), "СМАЧНА", font=font(76), fill=(235, 235, 235))
    d.text((70, 350), "ПІЦА!", font=font(76), fill=(235, 235, 235))
    d.rounded_rectangle([90, 470, 210, 590], radius=10, outline=(235, 235, 235), width=6)
    d.text((240, 480), "замовляй", font=font(30, False), fill=(235, 235, 235))
    d.text((240, 525), "у нас", font=font(30, False), fill=(235, 235, 235))
    # scalloped bottom edge
    for k in range(0, w, 64):
        d.ellipse([k - 10, 600, k + 74, 690], fill=(46, 54, 58))
    save(img, name)


def cctv(name, seed=29):
    rnd = random.Random(seed)
    w, h = 512, 288
    img = Image.new("RGB", (w, h), (10, 10, 12))
    d = ImageDraw.Draw(img)
    for j in range(2):
        for i in range(2):
            x0, y0 = i * w // 2 + 3, j * h // 2 + 3
            g = rnd.randint(70, 120)
            d.rectangle([x0, y0, x0 + w // 2 - 6, y0 + h // 2 - 6], fill=(g, g, g + 5))
            for _ in range(6):
                rx, ry = x0 + rnd.randint(5, 220), y0 + rnd.randint(5, 120)
                c = rnd.randint(30, 200)
                d.rectangle([rx, ry, rx + rnd.randint(10, 60), ry + rnd.randint(10, 40)], fill=(c, c, c))
    save(img, name)


def screen(name, color=(30, 60, 140)):
    img = Image.new("RGB", (512, 320), color)
    d = ImageDraw.Draw(img)
    for k in range(10):
        d.line([(30, 30 + k * 26), (30 + random.Random(k).randint(150, 450), 30 + k * 26)], fill=(220, 230, 255), width=6)
    save(img, name)


def pos_screen(name):
    img = Image.new("RGB", (512, 384), (235, 238, 240))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 512, 50], fill=(40, 120, 70))
    for j in range(4):
        for i in range(4):
            d.rectangle([20 + i * 120, 70 + j * 75, 120 + i * 120, 130 + j * 75], fill=(80, 160, 90) if (i + j) % 2 else (230, 140, 40))
    save(img, name)


def whiteboard(name):
    img = Image.new("RGB", (512, 384), (246, 247, 248))
    d = ImageDraw.Draw(img)
    for k in range(5):
        d.line([(40, 60 + k * 50), (300 + k * 20, 60 + k * 50)], fill=(60, 80, 160), width=4)
    d.rectangle([0, 0, 511, 383], outline=(170, 170, 175), width=12)
    save(img, name)


def papers(name, seed=31):
    """Kitchen wall: sheets with photo grids / check lists (recipe cards)."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (1024, 512), (238, 238, 236))
    d = ImageDraw.Draw(img)
    for i in range(6):
        x0 = 20 + i * 165
        d.rectangle([x0, 30, x0 + 150, 230], fill=(250, 250, 250), outline=(200, 200, 200))
        for j in range(3):
            for k in range(2):
                g = rnd.randint(40, 120)
                d.rectangle([x0 + 10 + k * 70, 45 + j * 60, x0 + 70 + k * 70, 95 + j * 60], fill=(g, g - 10, g - 20))
    for i in range(4):
        x0 = 60 + i * 240
        d.rectangle([x0, 270, x0 + 200, 490], fill=(252, 252, 252), outline=(200, 200, 200))
        for k in range(8):
            d.line([(x0 + 15, 290 + k * 24), (x0 + 185, 290 + k * 24)], fill=(120, 120, 120), width=3)
    save(img, name)


def price_tags(name):
    """Shelf-edge strip: white with black/yellow price labels."""
    img = Image.new("RGB", (1024, 32), (235, 235, 235))
    d = ImageDraw.Draw(img)
    x = 10
    rnd = random.Random(37)
    while x < 1000:
        yel = rnd.random() < 0.25
        d.rectangle([x, 3, x + 70, 29], fill=(250, 220, 30) if yel else (255, 255, 255), outline=(60, 60, 60))
        d.text((x + 6, 6), f"{rnd.randint(10, 99)},99", font=font(18), fill=(20, 20, 20))
        x += rnd.randint(110, 170)
    save(img, name)


def chips_header(name):
    img = Image.new("RGB", (256, 192), (250, 210, 30))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, 246, 182], radius=20, outline=(200, 30, 30), width=8)
    d.text((40, 60), "ЧІПСИ", font=font(46), fill=(200, 30, 30))
    save(img, name)


def fridge_header(name, color, text):
    img = Image.new("RGB", (512, 96), color)
    d = ImageDraw.Draw(img)
    d.text((24, 18), text, font=font(54), fill=(255, 255, 255))
    save(img, name)


def mama_header(name):
    """Red fridge header in the kitchen: black band with MAMA letters + peppers."""
    img = Image.new("RGB", (768, 128), (30, 30, 32))
    d = ImageDraw.Draw(img)
    rnd = random.Random(41)
    x = 10
    for k in range(14):
        ch = "MA"[k % 2]
        d.text((x, rnd.randint(8, 40)), ch, font=font(56), fill=(240, 240, 240))
        d.line([(x + 40, 90), (x + 62, 70)], fill=(210, 40, 40) if k % 2 else (60, 170, 70), width=7)
        x += 55
    save(img, name)


def cola_header(name):
    """Generic red cooler header (no third-party logo)."""
    img = Image.new("RGB", (512, 128), (200, 16, 30))
    d = ImageDraw.Draw(img)
    d.arc([-100, 40, 612, 260], 200, 340, fill=(255, 255, 255), width=10)
    d.text((150, 22), "COLD DRINKS", font=font(40), fill=(255, 255, 255))
    save(img, name)


def warning_sticker(name):
    img = Image.new("RGB", (64, 128), (250, 225, 30))
    d = ImageDraw.Draw(img)
    for k in range(6):
        d.line([(8, 14 + k * 18), (56, 14 + k * 18)], fill=(40, 40, 40), width=3)
    save(img, name)


def door_grooves(name):
    """Light grey interior door with the black horizontal grooves seen in the corridor."""
    w, h = 256, 1024
    img = Image.new("RGB", (w, h), (196, 198, 200))
    d = ImageDraw.Draw(img)
    for y in (300, 330, 700, 730):
        d.line([(0, y), (w, y - 26)], fill=(30, 30, 32), width=6)
    noise_overlay(img, 3, 43)
    save(img, name)


def toilet_rolls(name):
    """Shelf above the toilet: blue + green paper towel rolls and cleaning bottles."""
    rnd = random.Random(47)
    img = Image.new("RGB", (512, 256), (60, 60, 62))
    d = ImageDraw.Draw(img)
    for row in range(2):
        for k in range(5):
            cx, cy = 50 + k * 95 + row * 40, 190 - row * 90
            col = rnd.choice([(80, 130, 190), (90, 160, 120)])
            d.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=col)
            d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(40, 40, 40))
    save(img, name)


def clothes(name, seed=53):
    """Coats hanging on the office wall (dark puffer + beige)."""
    rnd = random.Random(seed)
    img = Image.new("RGBA", (512, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 10
    for k, col in enumerate([(26, 26, 30), (210, 200, 188), (40, 40, 44), (30, 30, 34)]):
        wdt = rnd.randint(110, 150)
        d.rounded_rectangle([x, 40, x + wdt, rnd.randint(780, 980)], radius=40, fill=col + (255,))
        for y in range(120, 900, 70):
            d.line([(x + 8, y), (x + wdt - 8, y)], fill=tuple(max(0, c - 15) for c in col) + (255,), width=3)
        x += wdt - 20
    save(img, name)


def main():
    tile("floor_hall_60.png", 256, (112, 112, 114), (78, 78, 80), 2, seed=1)
    tile("floor_kitchen_30.png", 256, (120, 120, 120), (80, 80, 82), 3, seed=2)
    tile("floor_dark_30.png", 256, (78, 78, 80), (58, 58, 60), 3, seed=4)
    tile("wall_tile_white.png", 256, (236, 236, 234), (205, 205, 205), 2, seed=6, rect=(1, 2))
    carpet("floor_carpet_50.png")
    paver("paver.png")
    wood("wood_oak.png")
    wood("wood_beech.png", base=(214, 172, 112), seed=7, planks=2)
    granite("granite.png")
    mama_pattern("mama_panel.png")
    chalk_wall("chalk_doodles.png")
    pizza_box_side("pizza_boxes.png")
    cardboard("cardboard.png")
    for i, k in enumerate(["snacks", "grocery", "dairy", "drinks", "choco", "bakery", "candy", "kitchen", "storage"]):
        products(f"prod_{k}.png", k, 100 + i)
    neon_market("neon_market.png")
    sign_ma_pizza("sign_ma_pizza.png")
    menu_board("menu_board.png")
    window_print("window_print.png")
    cctv("screen_cctv.png")
    screen("screen_laptop.png")
    pos_screen("screen_pos.png")
    whiteboard("whiteboard.png")
    papers("kitchen_papers.png")
    price_tags("price_strip.png")
    chips_header("chips_header.png")
    cola_header("header_red.png")
    mama_header("header_mama.png")
    fridge_header("header_green.png", (20, 140, 60), "ХОЛОДНІ НАПОЇ")
    warning_sticker("sticker_yellow.png")
    door_grooves("door_grey.png")
    toilet_rolls("wc_shelf.png")
    clothes("coats.png")


if __name__ == "__main__":
    main()
