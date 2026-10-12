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

CX, CY, SCALE, W, H = -4.85, 5.2, 13.2, 1100, 1250   # = PLAN_CENTER / PLAN_SCALE in build_store.py
PPM = H / SCALE


def px(x, y):
    return (W / 2 + (x - CX) * PPM, H / 2 - (y - CY) * PPM)


ZONES = [   # (text, x, y) - room numbers and areas from the BTI plan
    ("1106-1  ЗАЛ 55,1 м²", -1.7, 4.4),
    ("1106-2  КУХНЯ 17,7 м²", -8.1, 4.95),
    ("1106-3  КАБІНЕТ 5,3 м²", -4.2, 10.25),
    ("1106-4  WC 1,8", -3.45, 7.45),
    ("КОРИДОР", -4.73, 5.75),
    ("КАСА", -3.7, 5.3),
    ("СТІЙКА MAMA", -4.9, 2.0),
    ("ВХІД  MA PIZZA", -1.5, -0.75),
    ("ВІКНО (було двері 3,04)", -4.8, -0.75),
    ("ВИХІД «МАРКЕТ МА ПІЦА»", -1.45, 11.3),
]

# camera route of the video (seconds, x, y)
ROUTE = [
    (0.0, -1.5, -2.5), (4, -1.5, 0.0), (11, -1.55, 7.0), (14, -1.45, 10.1), (16.5, -1.5, 9.0),
    (18, -2.5, 3.5), (19.5, -3.6, 3.9), (21, -4.0, 3.2), (22.5, -4.0, 2.05), (23.5, -4.1, 1.3),
    (25.5, -5.4, 1.3), (27, -7.3, 1.35), (28, -8.65, 1.45), (30.5, -8.65, 3.9), (31.5, -7.6, 3.75),
    (33, -7.3, 2.4), (34, -6.9, 1.4), (35, -5.85, 2.4), (35.8, -5.85, 4.2), (36.5, -5.6, 5.15),
    (38, -4.73, 5.9), (40, -4.73, 6.7), (44, -3.6, 6.8), (48, -4.7, 7.0), (49.5, -4.7, 7.85), (52, -4.4, 9.0),
]
LABEL_AT = {0.0, 4, 11, 14, 18, 23.5, 30.5, 36.5, 40, 49.5}


def main():
    img = Image.open(SRC).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    f_big = ImageFont.truetype(FONT, 19)
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
    x0, y0 = 40, 90
    for i in range(5):
        d.rectangle([x0 + i * PPM, y0, x0 + (i + 1) * PPM, y0 + 10], fill=(255, 255, 255) if i % 2 == 0 else (60, 60, 60))
    for i in range(6):
        d.text((x0 + i * PPM - 4, y0 - 22), str(i) + (" м" if i == 5 else ""), font=f_small, fill=(255, 255, 255),
               stroke_width=2, stroke_fill=(0, 0, 0))
    d.polygon([(W - 60, 40), (W - 75, 80), (W - 45, 80)], fill=(255, 255, 255))
    d.text((W - 68, 84), "N", font=f_big, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    d.text((20, 18), "MA PIZZA — макет за планом БТІ (H = 3,46 м) з маршрутом камери з відео (жовтим, секунди)",
           font=f_small, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    img.save(DST, quality=88, optimize=True)
    print("wrote", DST)


if __name__ == "__main__":
    main()
