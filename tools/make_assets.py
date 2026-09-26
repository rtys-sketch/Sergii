"""
Asset pipeline for «Сергій проти всіх».

Takes the original photo (tools/source/sergii.jpg — not committed) and a
BiRefNet-portrait matte (produced with `rembg`), cuts out Sergii's real head
1:1 (no generative redraw) and exports game textures + PWA icons.

    pip install pillow numpy opencv-python-headless "rembg[cpu]"
    python3 tools/make_assets.py
"""
import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'source', 'sergii.jpg')
MATTE = os.path.join(ROOT, 'tools', 'source', 'matte.png')
OUT = os.path.join(ROOT, 'public', 'assets')
ICONS = os.path.join(ROOT, 'public', 'icons')


def make_matte():
    if os.path.exists(MATTE):
        return
    from rembg import remove, new_session
    out = remove(Image.open(SRC), session=new_session('birefnet-portrait'))
    out.save(MATTE)


def cut_head():
    im = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
    a = np.array(Image.open(MATTE))[:, :, 3].astype(np.float32) / 255
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    mx = np.maximum(np.maximum(R, G), B)
    # dark navy T-shirt below the ears -> not part of the head
    shirt = ((B - R) > 8) & (mx < 125) & (yy > 880)
    shirt = cv2.morphologyEx(shirt.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    shirt = cv2.dilate(shirt, np.ones((3, 3), np.uint8))
    m = (a > 0.5).astype(np.uint8)
    m[shirt > 0] = 0
    m[(xx < 300) & (yy > 860)] = 0  # thumb holding the can
    m[xx > 860] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    m = (lab == big).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 1)
    m = m | (1 - ff)
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.6)
    alpha = np.minimum(soft, np.clip(a * 1.15, 0, 1))
    alpha *= np.clip((1262 - yy) / 40.0, 0, 1)  # neck fades under the collar
    ys, xs = np.where(alpha > 0.02)
    x0, x1, y0, y1 = xs.min() - 6, xs.max() + 7, ys.min() - 6, ys.max() + 7
    rgba = np.dstack([im.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    head = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1, y1))
    print('head crop origin', (x0, y0), 'size', head.size)
    return head, (x0, y0)


def save_head(head):
    head.save(os.path.join(OUT, 'sergii-head.webp'), 'WEBP', quality=88, method=6)
    head.save(os.path.join(OUT, 'sergii-head.png'), optimize=True)


def splat(draw, cx, cy, r, color, seed):
    rng = np.random.default_rng(seed)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    for i in range(11):
        ang = rng.uniform(0, 2 * np.pi)
        d = r * rng.uniform(0.7, 1.35)
        rr = r * rng.uniform(0.18, 0.42)
        x, y = cx + np.cos(ang) * d, cy + np.sin(ang) * d
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)
    for i in range(6):
        ang = rng.uniform(0, 2 * np.pi)
        d = r * rng.uniform(1.5, 2.1)
        rr = r * rng.uniform(0.07, 0.14)
        x, y = cx + np.cos(ang) * d, cy + np.sin(ang) * d
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)


def make_icon(head, size, maskable=False, bg=True):
    S = 1024
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if bg:
        yy, xx = np.mgrid[0:S, 0:S]
        d = np.sqrt((xx - S * 0.5) ** 2 + (yy - S * 0.38) ** 2) / (S * 0.75)
        c0 = np.array([255, 196, 61])
        c1 = np.array([236, 64, 52])
        c2 = np.array([120, 20, 40])
        t = np.clip(d, 0, 1)[..., None]
        col = np.where(t < 0.6, c0 + (c1 - c0) * (t / 0.6), c1 + (c2 - c1) * ((t - 0.6) / 0.4))
        img = Image.fromarray(np.dstack([col.astype(np.uint8), np.full((S, S), 255, np.uint8)]), 'RGBA')
    # sunburst rays
    rays = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for i in range(16):
        a0 = i * 2 * np.pi / 16
        pts = [(S / 2, S * 0.45)]
        for a in (a0, a0 + np.pi / 16):
            pts.append((S / 2 + np.cos(a) * S, S * 0.45 + np.sin(a) * S))
        rd.polygon(pts, fill=(255, 255, 255, 38))
    img.alpha_composite(rays)
    scale = (0.66 if maskable else 0.84) * S / head.size[1]
    h = head.resize((int(head.size[0] * scale), int(head.size[1] * scale)), Image.LANCZOS)
    # white sticker outline
    al = np.array(h)[:, :, 3]
    k = max(3, int(S * 0.012))
    dil = cv2.dilate((al > 60).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
    outline = Image.new('RGBA', h.size, (255, 255, 255, 0))
    outline.putalpha(Image.fromarray(cv2.GaussianBlur(dil, (0, 0), 1.2)))
    shadow = Image.new('RGBA', h.size, (60, 0, 10, 0))
    shadow.putalpha(Image.fromarray(cv2.GaussianBlur(dil, (0, 0), 14)).point(lambda v: v * 0.55))
    px = (S - h.size[0]) // 2
    py = int(S * (0.2 if maskable else 0.1))
    img.alpha_composite(shadow, (px + 8, py + 22))
    img.alpha_composite(outline, (px, py))
    img.alpha_composite(h, (px, py))
    # tomato splat on the forehead
    sp = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    splat(ImageDraw.Draw(sp), px + h.size[0] * 0.66, py + h.size[1] * 0.2, S * 0.055, (224, 36, 30, 235), 3)
    sp = sp.filter(ImageFilter.GaussianBlur(1.5))
    img.alpha_composite(sp)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    make_matte()
    head, origin = cut_head()
    save_head(head)
    make_icon(head, 512).convert('RGB').save(os.path.join(ICONS, 'icon-512.png'), optimize=True)
    make_icon(head, 192).convert('RGB').save(os.path.join(ICONS, 'icon-192.png'), optimize=True)
    make_icon(head, 512, maskable=True).convert('RGB').save(os.path.join(ICONS, 'icon-maskable-512.png'), optimize=True)
    make_icon(head, 180).convert('RGB').save(os.path.join(ICONS, 'apple-touch-icon.png'), optimize=True)
    make_icon(head, 64).save(os.path.join(ICONS, 'favicon-64.png'), optimize=True)
    # social preview
    og = Image.new('RGB', (1200, 630), (30, 20, 40))
    ic = make_icon(head, 630)
    og.paste(ic.convert('RGB'), (285, 0))
    og.save(os.path.join(ICONS, 'og.jpg'), quality=85)


if __name__ == '__main__':
    main()
