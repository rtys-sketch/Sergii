"""Draw zone labels and the walkthrough route from the video on top of the plan render.

    python3 blender/annotate_plan.py            # needs Pillow; reads renders/CAM_Plan_Top.png

World -> pixel mapping matches CAM_Plan_Top in build_store.py (orthographic, centre
(-6.8, 8.2), ortho_scale 19.5 on the 1250 px image height).
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = next(p for p in (os.path.join(HERE, "renders", "CAM_Plan_Top." + e) for e in ("png", "jpg")) if os.path.exists(p))
DST = os.path.join(HERE, "renders", "PLAN_annotated.jpg")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

CX, CY, SCALE, W, H = -6.8, 8.2, 19.5, 1100, 1250
PPM = H / SCALE


def px(x, y):
    return (W / 2 + (x - CX) * PPM, H / 2 - (y - CY) * PPM)


ZONES = [
    ("ВХІД  MA PIZZA", -1.9, -1.0),
    ("ТОРГОВИЙ ЗАЛ", -1.95, 5.2),
    ("ВИХІД «МАРКЕТ МА ПІЦА»", -1.9, 13.9),
    ("КАСА", -4.9, 11.3),
    ("СТІЙКА MAMA", -6.2, 6.4),
    ("КУХНЯ", -11.0, 9.6),
    ("ПІЧ", -9.3, 9.2),
    ("КОРИДОР", -6.5, 12.3),
    ("WC", -5.15, 12.75),
    ("КАБІНЕТ / СКЛАД", -5.9, 14.6),
]

# camera route of the video (seconds, x, y)
ROUTE = [
    (0.0, -2.0, -2.5), (4, -2.0, 0.0), (11, -2.0, 9.0), (14, -2.0, 12.3), (16.5, -2.1, 10.6),
    (18, -3.4, 8.8), (19.5, -5.0, 8.8), (21, -6.4, 7.4), (22.5, -6.6, 5.45), (23.5, -8.4, 5.55),
    (25.5, -9.3, 7.3), (28, -11.6, 8.2), (30.5, -10.2, 10.3), (31.5, -8.9, 10.0), (34, -9.3, 9.9),
    (35.5, -7.6, 10.0), (36.5, -6.6, 10.1), (38, -6.5, 11.4), (40, -6.2, 12.35), (44, -5.2, 12.3),
    (48, -6.5, 12.5), (49.5, -6.6, 13.3), (52, -6.0, 14.8),
]
LABEL_AT = {0.0, 4, 11, 14, 18, 22.5, 23.5, 30.5, 36.5, 40, 49.5}


def main():
    img = Image.open(SRC).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    f_big = ImageFont.truetype(FONT, 22)
    f_small = ImageFont.truetype(FONT, 15)
    pts = [px(x, y) for _, x, y in ROUTE]
    d.line(pts, fill=(255, 200, 0, 230), width=5, joint="curve")
    for (t, x, y), p in zip(ROUTE, pts):
        d.ellipse([p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6], fill=(255, 200, 0, 255))
        if t in LABEL_AT:
            d.text((p[0] + 8, p[1] - 9), f"{t:g}s", font=f_small, fill=(255, 230, 120, 255),
                   stroke_width=3, stroke_fill=(0, 0, 0, 255))
    for text, x, y in ZONES:
        p = px(x, y)
        tw = d.textlength(text, font=f_big)
        d.text((p[0] - tw / 2, p[1] - 12), text, font=f_big, fill=(255, 255, 255, 255),
               stroke_width=4, stroke_fill=(0, 0, 0, 255))
    # 1 m scale bar + north arrow
    x0, y0 = 40, H - 50
    for i in range(5):
        d.rectangle([x0 + i * PPM, y0, x0 + (i + 1) * PPM, y0 + 10], fill=(255, 255, 255) if i % 2 == 0 else (60, 60, 60))
    d.text((x0, y0 - 26), "0      1      2      3      4      5 м", font=f_small, fill=(255, 255, 255),
           stroke_width=2, stroke_fill=(0, 0, 0))
    d.polygon([(W - 60, 40), (W - 75, 80), (W - 45, 80)], fill=(255, 255, 255))
    d.text((W - 68, 84), "N", font=f_big, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    d.text((20, 18), "MA PIZZA / МАРКЕТ МА ПІЦА — план з маршрутом камери з відео (жовтим, секунди)",
           font=f_small, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    img.save(DST, quality=88, optimize=True)
    print("wrote", DST)


if __name__ == "__main__":
    main()
