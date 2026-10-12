"""Procedural Blender scene: the "MA PIZZA / МАРКЕТ МА ПІЦА" shop from the walkthrough video.

Run either way (Blender 4.2+ / 5.x):

    blender -b -P blender/build_store.py -- --out blender/ma_pizza_store.blend
    python  blender/build_store.py --out blender/ma_pizza_store.blend      # with the `bpy` wheel

Options:  --glb <path>  also export glTF binary for a game engine
          --fbx <path>  also export FBX
          --render <dir> render the video-matched preview cameras + top plan

Coordinate system (metres, real scale, Z up):
    +X = east, +Y = north, origin = inside face of the east wall at the street facade.
    The street entrance (MA PIZZA) is on the south facade at y = 0, the walk in the
    video goes north along the main aisle (x ~ -2), so the player spawn sits outside
    at (-2.0, -2.5) looking north.

People from the video are intentionally not modelled.  Every dimension that was
estimated from the video is a named constant in the LAYOUT section below, so a
measurement on site can be dropped in and the scene rebuilt.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures")

# =========================================================================== LAYOUT
H_HALL = 3.40      # ceiling height: sales hall, counter zone, kitchen
H_BACK = 2.80      # ceiling height: staff corridor, WC, office
T_EXT = 0.30       # exterior wall thickness
T_INT = 0.12       # interior partition thickness

# Sales hall (main aisle from the street door to the north door)
HALL_X0, HALL_X1 = -3.75, 0.0
HALL_Y0, HALL_Y1 = 0.0, 13.0
DOOR1_X = (-2.50, -1.50)          # street door "MA PIZZA" (south facade)
DOOR2_X = (-2.50, -1.50)          # north door "МАРКЕТ МА ПІЦА"
PASSAGE_Y = (8.20, 9.40)          # opening in the hall's west side -> cash desk / pizza counter
WOOD_COLUMN_Y = (7.60, 8.20)

# Counter zone (cash desk + MAMA pizza counter), west of the hall
COUNTER_X = (-7.90, -7.00)        # MAMA counter footprint (front faces east, x = -7.0)
COUNTER_Y = (5.90, 8.70)
OVEN_WALL_Y = (8.70, 9.60)        # wall block right of the counter: dark to customers, tiled to the kitchen
ZONE_Y0 = 5.00                    # south wall of counter zone + kitchen
STAFF_GAP_Y = (9.60, 10.40)       # staff pass between counter end and the corridor

# Kitchen (behind the MAMA counter), windows on the west facade
KIT_X0 = -13.60
KIT_Y1 = 11.80

# Staff corridor -> WC (right) -> office/storage (straight ahead)
COR_X = (-7.00, -6.00)
COR_Y = (10.40, 13.00)
WC_X = (-6.00, -4.30)
WC_Y = (11.60, 13.00)
OFF_X = (-7.45, -4.40)
OFF_Y = (13.00, 17.00)

# =========================================================================== helpers
MATS = {}
MAT_SCALE = {}       # material name -> (metres per texture repeat in u, in v)


def tex_path(name):
    return os.path.join(TEX, name)


def make_mat(name, color=(0.5, 0.5, 0.5), rough=0.6, metal=0.0, tex=None, scale=(1.0, 1.0),
             emit=None, emit_strength=0.0, alpha=1.0, alpha_tex=False, emit_tex=False, spec=0.5):
    """Principled material.  Only glTF-friendly nodes are used so the export keeps textures."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = spec
    img_node = None
    if tex:
        img = bpy.data.images.load(tex_path(tex), check_existing=True)
        img_node = nt.nodes.new("ShaderNodeTexImage")
        img_node.image = img
        img_node.location = (-400, 200)
        nt.links.new(img_node.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_tex:
            nt.links.new(img_node.outputs["Alpha"], bsdf.inputs["Alpha"])
    if emit is not None or emit_tex:
        bsdf.inputs["Emission Color"].default_value = (*(emit or (1, 1, 1)), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
        if emit_tex and img_node is not None:
            nt.links.new(img_node.outputs["Color"], bsdf.inputs["Emission Color"])
    if alpha < 1.0 or alpha_tex:
        if not alpha_tex:
            bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED" if not alpha_tex else "DITHERED"
        if hasattr(m, "blend_method"):
            try:
                m.blend_method = "BLEND" if not alpha_tex else "CLIP"
            except TypeError:
                pass
        if hasattr(m, "use_backface_culling"):
            m.use_backface_culling = False
    m.diffuse_color = (*color, alpha)
    MATS[name] = m
    MAT_SCALE[name] = scale
    return m


def build_materials():
    C = make_mat
    # --- architecture
    C("floor_hall", tex="floor_hall_60.png", scale=(0.6, 0.6), rough=0.35)
    C("floor_hall_dk", color=(0.1, 0.1, 0.105), rough=0.5)
    C("floor_kitchen", tex="floor_kitchen_30.png", scale=(0.3, 0.3), rough=0.4)
    C("floor_dark", tex="floor_dark_30.png", scale=(0.3, 0.3), rough=0.4)
    C("floor_carpet", tex="floor_carpet_50.png", scale=(0.5, 0.5), rough=0.9)
    C("paver", tex="paver.png", scale=(1.0, 1.0), rough=0.8)
    C("asphalt", color=(0.03, 0.03, 0.035), rough=0.9)
    C("wall_dark", color=(0.035, 0.038, 0.045), rough=0.8)          # charcoal paint (hall)
    C("chalk", tex="chalk_doodles.png", scale=(4.0, 1.0), rough=0.8)
    C("wall_grey", color=(0.075, 0.078, 0.085), rough=0.8)          # corridor
    C("wall_light", color=(0.36, 0.37, 0.38), rough=0.85)          # office / WC upper
    C("wall_tile", tex="wall_tile_white.png", scale=(0.3, 0.6), rough=0.15)
    C("ceiling", color=(0.018, 0.019, 0.022), rough=0.9)
    C("ceiling_light", color=(0.6, 0.6, 0.6), rough=0.9)
    C("exterior", color=(0.06, 0.062, 0.068), rough=0.85)
    C("fascia", color=(0.03, 0.03, 0.033), rough=0.6)
    # --- glazing & frames
    C("glass", color=(0.35, 0.42, 0.45), rough=0.03, alpha=0.18, spec=1.0)
    C("glass_clear", color=(0.8, 0.9, 0.95), rough=0.02, alpha=0.12, spec=1.0)
    C("frame_black", color=(0.02, 0.02, 0.022), rough=0.4, metal=0.3)
    C("frame_white", color=(0.85, 0.86, 0.86), rough=0.35)
    C("window_print", tex="window_print.png", scale=(1, 1), rough=0.6)
    # --- materials of fixtures
    C("shelf_dark", color=(0.035, 0.035, 0.04), rough=0.45, metal=0.4)
    C("shelf_grey", color=(0.32, 0.33, 0.35), rough=0.45, metal=0.5)
    C("price_strip", tex="price_strip.png", scale=(1.0, 1.0), rough=0.5)
    C("wood_oak", tex="wood_oak.png", scale=(1.0, 2.0), rough=0.55)
    C("wood_beech", tex="wood_beech.png", scale=(1.0, 2.0), rough=0.5)
    C("granite", tex="granite.png", scale=(0.6, 0.6), rough=0.25)
    C("mama_panel", tex="mama_panel.png", scale=(1.6, 1.0), rough=0.5)
    C("steel", color=(0.62, 0.63, 0.64), rough=0.28, metal=1.0)
    C("steel_dark", color=(0.25, 0.26, 0.27), rough=0.35, metal=1.0)
    C("black_plastic", color=(0.015, 0.015, 0.017), rough=0.45)
    C("anthracite", color=(0.08, 0.085, 0.09), rough=0.5)
    C("white_plastic", color=(0.85, 0.85, 0.84), rough=0.35)
    C("ceramic", color=(0.92, 0.92, 0.9), rough=0.12)
    C("red_paint", color=(0.6, 0.03, 0.03), rough=0.35, metal=0.2)
    C("green_rack", color=(0.25, 0.6, 0.12), rough=0.45)
    C("teal", color=(0.15, 0.42, 0.45), rough=0.4)
    C("yellow", color=(0.9, 0.75, 0.05), rough=0.5)
    C("blue_board", color=(0.05, 0.25, 0.75), rough=0.5)
    C("cardboard", tex="cardboard.png", scale=(0.5, 0.5), rough=0.9)
    C("pizza_boxes", tex="pizza_boxes.png", scale=(1.0, 2.2), rough=0.9)
    C("kraft", color=(0.55, 0.42, 0.26), rough=0.9)
    C("fridge_inner", color=(0.85, 0.87, 0.9), rough=0.4, emit=(0.85, 0.9, 1.0), emit_strength=0.6)
    C("prod_side", color=(0.12, 0.1, 0.1), rough=0.6)
    C("water", color=(0.55, 0.75, 0.95), rough=0.1, alpha=0.55)
    C("door_grey", tex="door_grey.png", scale=(1, 1), rough=0.45)
    C("door_white", color=(0.8, 0.8, 0.79), rough=0.4)
    C("chrome", color=(0.85, 0.85, 0.86), rough=0.1, metal=1.0)
    C("rubber", color=(0.02, 0.02, 0.02), rough=0.8)
    C("bag_black", color=(0.01, 0.01, 0.012), rough=0.3)
    C("bin_grey", color=(0.55, 0.56, 0.57), rough=0.5, metal=0.4)
    C("cloth_blue", color=(0.35, 0.65, 0.9), rough=0.9)
    C("helmet", color=(0.92, 0.92, 0.92), rough=0.15)
    C("visor", color=(0.05, 0.05, 0.06), rough=0.05, metal=0.2)
    C("whiteboard", tex="whiteboard.png", scale=(1, 1), rough=0.2)
    C("menu_board", tex="menu_board.png", scale=(1, 1), rough=0.5)
    C("kitchen_papers", tex="kitchen_papers.png", scale=(1, 1), rough=0.6)
    C("wc_shelf", tex="wc_shelf.png", scale=(1, 1), rough=0.7)
    C("coats", tex="coats.png", scale=(1, 1), rough=0.9, alpha_tex=True)
    C("sticker_yellow", tex="sticker_yellow.png", scale=(1, 1))
    C("chips_header", tex="chips_header.png", scale=(1, 1))
    C("header_red", tex="header_red.png", scale=(1, 1), emit_tex=True, emit_strength=0.4)
    C("header_mama", tex="header_mama.png", scale=(1, 1))
    C("header_green", tex="header_green.png", scale=(1, 1), emit_tex=True, emit_strength=0.3)
    for k in ("snacks", "grocery", "dairy", "drinks", "choco", "bakery", "candy", "kitchen", "storage"):
        C(f"prod_{k}", tex=f"prod_{k}.png", scale=(1.0, 1.0), rough=0.5)
    # --- emissive
    C("led", color=(1, 1, 1), emit=(1.0, 0.98, 0.95), emit_strength=25.0)
    C("led_cool", color=(1, 1, 1), emit=(0.85, 0.92, 1.0), emit_strength=12.0)
    C("led_green", color=(0.1, 1, 0.3), emit=(0.15, 1.0, 0.35), emit_strength=8.0)
    C("neon_market", tex="neon_market.png", scale=(1, 1), alpha_tex=True, emit_tex=True, emit_strength=20.0)
    C("sign_ma_pizza", tex="sign_ma_pizza.png", scale=(1, 1), alpha_tex=True, emit_tex=True, emit_strength=30.0)
    C("screen_cctv", tex="screen_cctv.png", scale=(1, 1), emit_tex=True, emit_strength=1.5)
    C("screen_laptop", tex="screen_laptop.png", scale=(1, 1), emit_tex=True, emit_strength=1.5)
    C("screen_pos", tex="screen_pos.png", scale=(1, 1), emit_tex=True, emit_strength=1.2)
    C("exit_sign", color=(0.1, 0.9, 0.3), emit=(0.1, 1.0, 0.3), emit_strength=4.0)


class MB:
    """Tiny mesh builder: boxes / cylinders with real-world UVs, many materials per object."""

    FACES = ("yn", "yp", "xp", "xn", "zp", "zn")

    def __init__(self):
        self.verts, self.faces, self.uvs, self.fmat, self.mats = [], [], [], [], []

    def _mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def quad(self, pts, mat, uv):
        base = len(self.verts)
        self.verts.extend(pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        self.uvs.append(uv)
        self.fmat.append(self._mi(mat))

    def box(self, x0, y0, z0, x1, y1, z1, mat, faces=None, fmat=None, fit=None):
        """Axis aligned box.  fmat: per-face material override {face: mat}.
        fit: {face: (u_repeat, v_repeat)} -> UVs 0..u, 0..v stretched over that face."""
        if x0 > x1: x0, x1 = x1, x0
        if y0 > y1: y0, y1 = y1, y0
        if z0 > z1: z0, z1 = z1, z0
        faces = faces or self.FACES
        fmat = fmat or {}
        fit = fit or {}
        P = {
            "yn": [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
            "yp": [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
            "xp": [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
            "xn": [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
            "zp": [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
            "zn": [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
        }
        for f in faces:
            m = fmat.get(f, mat)
            pts = P[f]
            if f in fit:
                U, V = fit[f]
                uv = [(0, 0), (U, 0), (U, V), (0, V)]
            else:
                su, sv = MAT_SCALE.get(m, (1.0, 1.0))
                uv = []
                for (x, y, z) in pts:
                    if f == "yn": u, v = x, z
                    elif f == "yp": u, v = -x, z
                    elif f == "xp": u, v = y, z
                    elif f == "xn": u, v = -y, z
                    elif f == "zp": u, v = x, y
                    else: u, v = x, -y
                    uv.append((u / su, v / sv))
            self.quad(pts, m, uv)

    def cyl(self, cx, cy, z0, z1, r, mat, seg=20, caps=True, r_top=None, cap_mat=None):
        r_top = r if r_top is None else r_top
        su, sv = MAT_SCALE.get(mat, (1.0, 1.0))
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            p = [(cx + r * math.cos(a0), cy + r * math.sin(a0), z0), (cx + r * math.cos(a1), cy + r * math.sin(a1), z0),
                 (cx + r_top * math.cos(a1), cy + r_top * math.sin(a1), z1), (cx + r_top * math.cos(a0), cy + r_top * math.sin(a0), z1)]
            c = 2 * math.pi * r
            self.quad(p, mat, [(c * i / seg / su, z0 / sv), (c * (i + 1) / seg / su, z0 / sv), (c * (i + 1) / seg / su, z1 / sv), (c * i / seg / su, z1 / sv)])
        if caps:
            cm = cap_mat or mat
            top = [(cx + r_top * math.cos(2 * math.pi * i / seg), cy + r_top * math.sin(2 * math.pi * i / seg), z1) for i in range(seg)]
            self.quad(top, cm, [(0.5 + 0.5 * math.cos(2 * math.pi * i / seg), 0.5 + 0.5 * math.sin(2 * math.pi * i / seg)) for i in range(seg)])
            bot = [(cx + r * math.cos(-2 * math.pi * i / seg), cy + r * math.sin(-2 * math.pi * i / seg), z0) for i in range(seg)]
            self.quad(bot, cm, [(0.5, 0.5)] * seg)

    def cyl_x(self, x0, x1, cy, cz, r, mat, seg=12):
        """Horizontal cylinder along X (pipes, rails)."""
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            p = [(x0, cy + r * math.cos(a1), cz + r * math.sin(a1)), (x1, cy + r * math.cos(a1), cz + r * math.sin(a1)),
                 (x1, cy + r * math.cos(a0), cz + r * math.sin(a0)), (x0, cy + r * math.cos(a0), cz + r * math.sin(a0))]
            self.quad(p, mat, [(0, 0), (1, 0), (1, 1), (0, 1)])

    def cyl_y(self, y0, y1, cx, cz, r, mat, seg=12):
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            p = [(cx + r * math.cos(a0), y0, cz + r * math.sin(a0)), (cx + r * math.cos(a0), y1, cz + r * math.sin(a0)),
                 (cx + r * math.cos(a1), y1, cz + r * math.sin(a1)), (cx + r * math.cos(a1), y0, cz + r * math.sin(a1))]
            self.quad(p, mat, [(0, 0), (1, 0), (1, 1), (0, 1)])

    def plane_y(self, x0, x1, y, z0, z1, mat, facing=-1, fit=(1, 1)):
        """Vertical plane at y, visible from -Y (facing=-1) or +Y (facing=+1). Signs, screens, prints."""
        if facing < 0:
            pts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
        else:
            pts = [(x1, y, z0), (x0, y, z0), (x0, y, z1), (x1, y, z1)]
        U, V = fit
        self.quad(pts, mat, [(0, 0), (U, 0), (U, V), (0, V)])

    def plane_x(self, x, y0, y1, z0, z1, mat, facing=-1, fit=(1, 1)):
        """Vertical plane at x, visible from -X (facing=-1) or +X (facing=+1)."""
        if facing > 0:
            pts = [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)]
        else:
            pts = [(x, y1, z0), (x, y0, z0), (x, y0, z1), (x, y1, z1)]
        U, V = fit
        self.quad(pts, mat, [(0, 0), (U, 0), (U, V), (0, V)])

    def obj(self, name, coll, loc=(0, 0, 0), rot_z=0.0):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        uvl = me.uv_layers.new(name="UVMap")
        for poly, uv in zip(me.polygons, self.uvs):
            for k, li in enumerate(poly.loop_indices):
                uvl.data[li].uv = uv[k]
        for m in self.mats:
            me.materials.append(MATS[m])
        for poly, mi in zip(me.polygons, self.fmat):
            poly.material_index = mi
        me.validate(clean_customdata=False)
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.location = loc
        ob.rotation_euler = (0, 0, rot_z)
        coll.objects.link(ob)
        return ob


FACING = {"S": 0.0, "E": math.pi / 2, "N": math.pi, "W": -math.pi / 2}   # local front (-Y) turned to ...


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def simple_box(name, c, x0, y0, z0, x1, y1, z1, mat, **kw):
    mb = MB()
    mb.box(x0, y0, z0, x1, y1, z1, mat, **kw)
    return mb.obj(name, c)


# =========================================================================== architecture
def wall(mb, a, b, fixed, axis, z0, z1, t, mat_neg, mat_pos=None, openings=(), bands=None, ends=True):
    """Straight wall.  axis='x': runs along X from a to b at y=fixed (thickness centred on fixed).
    axis='y': runs along Y at x=fixed.  mat_neg/mat_pos = material of the face looking to -Y/+Y
    (axis x) or -X/+X (axis y).  bands=[(z0, z1, mat_neg, mat_pos), ...] overrides vertical bands.
    openings=[(s0, s1, zb, zt)] in wall coordinates."""
    mat_pos = mat_pos or mat_neg
    bands = bands or [(z0, z1, mat_neg, mat_pos)]
    cuts = sorted(openings)
    segs = []   # (s0, s1, zb, zt) solid pieces
    s = a
    for (o0, o1, zb, zt) in cuts:
        if o0 > s:
            segs.append((s, o0, z0, z1))
        if zb > z0:
            segs.append((o0, o1, z0, zb))
        if zt < z1:
            segs.append((o0, o1, zt, z1))
        s = o1
    if s < b:
        segs.append((s, b, z0, z1))
    h = t / 2
    for (s0, s1, zb, zt) in segs:
        for (bz0, bz1, mn, mp) in bands:
            lo, hi = max(zb, bz0), min(zt, bz1)
            if hi <= lo + 1e-6:
                continue
            cap = "wall_dark"
            if axis == "x":
                mb.box(s0, fixed - h, lo, s1, fixed + h, hi, mn, fmat={"yp": mp, "zp": cap, "zn": cap, "xp": cap, "xn": cap})
            else:
                mb.box(fixed - h, s0, lo, fixed + h, s1, hi, mn, fmat={"xp": mp, "zp": cap, "zn": cap, "yp": cap, "yn": cap})


def build_architecture(root):
    c = coll("01_Architecture", root)
    floors, walls, ceil = MB(), MB(), MB()

    # ---------------------------------------------------------------- floors
    floors.box(HALL_X0, HALL_Y0, -0.05, HALL_X1, HALL_Y1, 0, "floor_hall")                 # hall
    floors.box(COUNTER_X[1], ZONE_Y0, -0.05, HALL_X0, COR_Y[0], 0, "floor_hall")            # counter zone
    floors.box(COUNTER_X[0], ZONE_Y0, -0.05, COUNTER_X[1], STAFF_GAP_Y[1], 0, "floor_kitchen")
    floors.box(KIT_X0, ZONE_Y0, -0.05, COUNTER_X[0], KIT_Y1, 0, "floor_kitchen")            # kitchen
    floors.box(COUNTER_X[0], STAFF_GAP_Y[1], -0.05, COR_X[0], KIT_Y1, 0, "floor_kitchen")
    floors.box(COR_X[0], COR_Y[0], -0.05, COR_X[1], COR_Y[1], 0, "floor_dark")              # corridor
    floors.box(COR_X[1], COR_Y[0], -0.05, HALL_X0 - T_INT, WC_Y[0], 0, "floor_hall")        # behind cash desk
    floors.box(WC_X[0], WC_Y[0], -0.05, WC_X[1], WC_Y[1], 0, "floor_dark")                  # WC
    floors.box(OFF_X[0], OFF_Y[0], -0.05, OFF_X[1], OFF_Y[1], 0, "floor_dark")            # office
    floors.obj("Floor_Interior", c)

    # ---------------------------------------------------------------- exterior ground
    g = MB()
    g.box(-9.0, -6.0, -0.06, 4.5, 0.0, -0.01, "paver")                                       # street paving (front)
    g.box(-30, -30, -0.1, 30, 30, -0.06, "asphalt")
    g.obj("Ground_Street", c)

    EXT = "exterior"
    D, CH = "wall_dark", "chalk"
    hall_bands = [(0, 2.25, D, D), (2.25, H_HALL, CH, CH)]

    # ---------------------------------------------------------------- south facade (street) y = 0
    # storefront: glazing x -3.75..0 (built separately), solid wall only at the corners.
    walls.box(HALL_X0 - T_EXT, -T_EXT, 0, HALL_X0, 0, H_HALL + 0.6, EXT)
    walls.box(HALL_X1, -T_EXT, 0, HALL_X1 + T_EXT, 0, H_HALL + 0.6, EXT)
    walls.box(HALL_X0 - T_EXT, -T_EXT - 0.05, H_HALL, HALL_X1 + T_EXT, 0.0, H_HALL + 0.6, "fascia")
    # ---------------------------------------------------------------- east wall x = 0
    wall(walls, HALL_Y0 - T_EXT, HALL_Y1 + T_EXT, HALL_X1 + T_EXT / 2, "y", 0, H_HALL, T_EXT, D, EXT,
         bands=[(0, 2.25, D, EXT), (2.25, H_HALL, CH, EXT)])
    # ---------------------------------------------------------------- north facade (hall part) y = 13
    walls.box(-0.6, HALL_Y1, 0, HALL_X1, HALL_Y1 + T_EXT, H_HALL, D, fmat={"yp": EXT})
    walls.box(-3.75, HALL_Y1, 0, -3.0, HALL_Y1 + T_EXT, H_HALL, D, fmat={"yp": EXT})
    walls.box(-3.0, HALL_Y1 + T_EXT - 0.05, 3.25, -0.6, HALL_Y1 + T_EXT, H_HALL, "frame_white")       # transom head
    walls.box(-3.0, HALL_Y1 + T_EXT - 0.04, 2.35, -0.6, HALL_Y1 + T_EXT - 0.03, 3.25, "glass")       # transom glass
    # ---------------------------------------------------------------- hall west side x = -3.75
    wall(walls, HALL_Y0, WOOD_COLUMN_Y[0], HALL_X0 - T_INT / 2, "y", 0, H_HALL, T_INT, D, D, bands=hall_bands)
    walls.box(HALL_X0 - T_INT, WOOD_COLUMN_Y[0], 0, HALL_X0 + 0.6, WOOD_COLUMN_Y[1], H_HALL, "wood_oak")  # wood column
    walls.box(HALL_X0 - T_INT, PASSAGE_Y[0] - 0.02, 2.6, HALL_X0, PASSAGE_Y[1], H_HALL, "wall_dark")     # lintel
    wall(walls, PASSAGE_Y[1], WC_Y[0], HALL_X0 - T_INT / 2, "y", 0, H_HALL, T_INT, D, D, bands=hall_bands)
    wall(walls, WC_Y[0], HALL_Y1, HALL_X0 - T_INT / 2, "y", 0, H_HALL, T_INT, D, D,
         bands=[(0, 2.25, D, D), (2.25, H_HALL, D, CH)])
    # closed service shaft between the WC and the hall partition
    walls.box(WC_X[1], WC_Y[0] - T_INT / 2, 0, HALL_X0 - T_INT, WC_Y[1], H_HALL, "wall_light", fmat={"xp": D})
    # ---------------------------------------------------------------- counter zone + kitchen south wall y = 5
    wall(walls, KIT_X0 - T_EXT, HALL_X0 - T_INT, ZONE_Y0 - T_INT / 2, "x", 0, H_HALL, T_INT, EXT, D,
         bands=[(0, 1.6, EXT, D), (1.6, H_HALL, EXT, D)])
    # wooden cladding on the counter-zone side of the south wall (as in the video: warm wood behind the oils shelf)
    walls.box(-6.9, ZONE_Y0, 0, HALL_X0 - T_INT, ZONE_Y0 + 0.02, H_HALL, "wood_oak")
    # ---------------------------------------------------------------- kitchen west facade x = -13.6 (windows)
    wall(walls, ZONE_Y0 - T_INT, KIT_Y1 + T_INT, KIT_X0 - T_EXT / 2, "y", 0, H_HALL, T_EXT, EXT, "wall_grey",
         openings=[(5.6, 10.6, 0.9, 3.0)])
    # ---------------------------------------------------------------- kitchen north wall y = 11.8
    wall(walls, KIT_X0 - T_EXT, COR_X[0] - T_INT / 2, KIT_Y1 + T_INT / 2, "x", 0, H_HALL, T_INT, "wall_tile", EXT,
         bands=[(0, 1.6, "wall_tile", EXT), (1.6, H_HALL, "wall_grey", EXT)])
    # ---------------------------------------------------------------- corridor west wall x = -7.0 (kitchen | corridor)
    wall(walls, STAFF_GAP_Y[1], COR_Y[1], COR_X[0] - T_INT / 2, "y", 0, H_BACK, T_INT, "wall_tile", "wall_grey",
         bands=[(0, 1.6, "wall_tile", "wall_grey"), (1.6, H_BACK, "wall_grey", "wall_grey")])
    walls.box(COR_X[0] - T_INT, STAFF_GAP_Y[1], H_BACK, COR_X[0], KIT_Y1, H_HALL, "wall_grey")
    # MAMA wainscot + granite ledge along the corridor's west wall (seen at the corridor entrance)
    walls.box(COR_X[0], STAFF_GAP_Y[1], 0.08, COR_X[0] + 0.03, 11.7, 0.95, "mama_panel")
    walls.box(COR_X[0], STAFF_GAP_Y[1], 0.95, COR_X[0] + 0.12, 11.7, 1.0, "granite")
    # ---------------------------------------------------------------- corridor east side: WC west wall x = -6.0
    wall(walls, WC_Y[0], WC_Y[1], WC_X[0] + T_INT / 2, "y", 0, H_BACK, T_INT, "wall_grey", "wall_tile",
         openings=[(11.95, 12.75, 0, 2.05)],
         bands=[(0, 1.5, "wall_grey", "wall_tile"), (1.5, H_BACK, "wall_grey", "wall_light")])
    # WC south wall y = 11.6 (behind drinks rack / cash desk side)
    wall(walls, WC_X[0], WC_X[1], WC_Y[0] - T_INT / 2, "x", 0, H_BACK, T_INT, D, "wall_tile",
         bands=[(0, 1.5, D, "wall_tile"), (1.5, H_BACK, D, "wall_light")])
    # WC east wall (shaft face): tiles to 1.5 m
    walls.box(WC_X[1] - 0.02, WC_Y[0], 0, WC_X[1], WC_Y[1], 1.5, "wall_tile")
    # WC north wall / exterior y = 13.0
    wall(walls, WC_X[0], HALL_X0 + 0.75, WC_Y[1] + T_EXT / 2, "x", 0, H_BACK, T_EXT, "wall_tile", EXT,
         bands=[(0, 1.5, "wall_tile", EXT), (1.5, H_BACK, "wall_light", EXT)])
    # ---------------------------------------------------------------- office
    wall(walls, OFF_X[0], OFF_X[1], OFF_Y[0] - T_INT / 2, "x", 0, H_BACK, T_INT, "wall_grey", "wall_light",
         openings=[(-7.0, -6.2, 0, 2.05)])                                                     # south (door)
    wall(walls, OFF_Y[0] - T_INT, OFF_Y[1] + T_EXT, OFF_X[0] - T_EXT / 2, "y", 0, H_BACK, T_EXT, EXT, "wall_light")  # west
    wall(walls, OFF_Y[0] - T_INT, OFF_Y[1] + T_EXT, OFF_X[1] + T_EXT / 2, "y", 0, H_BACK, T_EXT, "wall_light", EXT)  # east
    wall(walls, OFF_X[0] - T_EXT, OFF_X[1] + T_EXT, OFF_Y[1] + T_EXT / 2, "x", 0, H_BACK, T_EXT, "wall_light", EXT,
         openings=[(-7.05, -6.1, 0.95, 2.55)])                                               # north (window)
    # space between corridor west wall and office west wall above the unknown area
    walls.box(OFF_X[0] - T_EXT, KIT_Y1, 0, COR_X[0] - T_INT, OFF_Y[0] - T_INT, H_HALL, EXT)
    walls.obj("Walls", c)

    # ---------------------------------------------------------------- ceilings
    ceil.box(HALL_X0, HALL_Y0, H_HALL, HALL_X1, HALL_Y1, H_HALL + 0.1, "ceiling")
    ceil.box(COUNTER_X[0], ZONE_Y0, H_HALL, HALL_X0, COR_Y[0], H_HALL + 0.1, "ceiling")
    ceil.box(KIT_X0, ZONE_Y0, H_HALL, COUNTER_X[0], KIT_Y1, H_HALL + 0.1, "ceiling")
    ceil.box(COUNTER_X[0], COR_Y[0], H_HALL, COR_X[0], KIT_Y1, H_HALL + 0.1, "ceiling")
    ceil.box(COR_X[0], COR_Y[0], H_BACK, HALL_X0 - T_INT, WC_Y[1], H_BACK + 0.1, "wall_grey")
    ceil.box(COR_X[1], COR_Y[0], H_BACK + 0.1, HALL_X0 - T_INT, COR_Y[0] + 0.05, H_HALL, "ceiling")  # soffit step
    ceil.box(OFF_X[0], OFF_Y[0], H_BACK, OFF_X[1], OFF_Y[1], H_BACK + 0.1, "ceiling_light")
    ceil.obj("Ceilings", c)
    return c


def storefront_south(c):
    """Two-tone PVC storefront: anthracite outside, white inside.  Door leaf is a separate object
    with its origin on the hinge so a game can swing it."""
    mb = MB()
    y = 0.0
    fx = [-3.75, -2.55, -2.50, -1.50, -1.45, 0.0]          # mullion positions (bay, door jambs, bay)

    def bar(x0, x1, z0, z1):
        mb.box(x0, y - 0.07, z0, x1, y, z1, "frame_black")
        mb.box(x0, y, z0, x1, y + 0.05, z1, "frame_white")

    for x in fx:
        bar(x - 0.04, x + 0.04, 0, H_HALL)
    bar(-3.75, 0.0, 2.28, 2.36)                            # transom
    bar(-3.75, 0.0, H_HALL - 0.06, H_HALL)
    bar(-3.75, -2.55, 0.0, 0.08)
    bar(-1.45, 0.0, 0.0, 0.08)
    for (x0, x1, z0, z1) in [(-3.71, -2.59, 0.08, 2.28), (-1.41, -0.04, 0.08, 2.28), (-3.71, -0.04, 2.36, H_HALL - 0.06)]:
        mb.box(x0, y - 0.01, z0, x1, y + 0.01, z1, "glass")
    mb.obj("Facade_South_Storefront", c)
    # door leaf (opens outwards, hinge on the east jamb as in the video)
    d = MB()
    w, h = 0.98, 2.24
    d.box(-w, -0.06, 0, 0, 0, 0.1, "frame_black")
    d.box(-w, -0.06, h - 0.1, 0, 0, h, "frame_black")
    d.box(-w, -0.06, 0, -w + 0.09, 0, h, "frame_black")
    d.box(-0.09, -0.06, 0, 0, 0, h, "frame_black")
    d.box(-w + 0.09, -0.035, 0.1, -0.09, -0.025, h - 0.1, "glass")
    d.box(-w + 0.12, -0.18, 0.75, -w + 0.15, -0.06, 1.35, "chrome")          # pull handle outside
    d.box(-w + 0.12, 0.0, 0.95, -w + 0.15, 0.08, 1.15, "chrome")
    door = d.obj("Door_Street_MA_PIZZA", c, loc=(DOOR1_X[1] - 0.01, 0.0, 0.0))
    door["hinge"] = "east jamb, swings outwards (towards -Y)"
    # MA PIZZA sign behind the transom glass, readable from the street
    s = MB()
    s.plane_y(-3.4, -0.6, 0.08, 2.45, 3.05, "sign_ma_pizza", facing=-1)
    s.obj("Sign_MA_PIZZA", c)
    # outdoor glow strip under the fascia (green/red reflection seen in the first frame)
    g = MB()
    g.box(-3.75, -0.40, H_HALL - 0.02, 0.0, -0.34, H_HALL, "led_green")
    g.obj("Facade_Glow_Strip", c)


def storefront_north(c):
    """North door 'МАРКЕТ МА ПІЦА': white PVC door + fixed panes, neon on the transom facing the street."""
    mb = MB()
    y = HALL_Y1
    xs = [-3.0, -2.55, -2.50, -1.50, -1.45, -0.6]
    for x in xs:
        mb.box(x - 0.04, y, 0, x + 0.04, y + 0.12, 2.35, "frame_white")
    mb.box(-3.0, y, 2.27, -0.6, y + 0.12, 2.35, "frame_white")
    mb.box(-3.0, y, 0, -2.55, y + 0.12, 0.08, "frame_white")
    mb.box(-1.45, y, 0, -0.6, y + 0.12, 0.08, "frame_white")
    mb.box(-2.96, y + 0.05, 0.08, -2.59, y + 0.07, 2.27, "glass")
    mb.box(-1.41, y + 0.05, 0.08, -0.64, y + 0.07, 2.27, "glass")
    mb.obj("Facade_North_Door_Frame", c)
    d = MB()
    w, h = 0.96, 2.22
    d.box(0, 0, 0, w, 0.07, 0.12, "frame_white")
    d.box(0, 0, h - 0.1, w, 0.07, h, "frame_white")
    d.box(0, 0, 0, 0.1, 0.07, h, "frame_white")
    d.box(w - 0.1, 0, 0, w, 0.07, h, "frame_white")
    d.box(0.1, 0.03, 0.12, w - 0.1, 0.04, h - 0.1, "glass")
    d.box(w - 0.2, -0.06, 1.0, w - 0.16, 0.0, 1.1, "chrome")
    d.box(w - 0.35, -0.02, 2.05, w - 0.05, 0.0, 2.12, "steel_dark")           # door closer
    door = d.obj("Door_North_Market", c, loc=(DOOR2_X[0] + 0.02, y + 0.03, 0.0))
    door["hinge"] = "west jamb"
    n = MB()
    n.plane_y(-3.0, -0.6, y + T_EXT - 0.1, 2.55, 2.55 + 2.4 * 320 / 2048, "neon_market", facing=+1)
    n.obj("Sign_Neon_MARKET_MA_PIZZA", c)
    e = MB()
    e.box(-2.15, y - 0.05, 2.42, -1.85, y, 2.55, "exit_sign")
    e.obj("Exit_Sign_North", c)


def kitchen_windows(c):
    mb = MB()
    x = KIT_X0 - T_EXT / 2
    ys = [5.6 + i * 1.25 for i in range(5)]
    for yy in ys:
        mb.box(x - 0.05, yy - 0.04, 0.9, x + 0.05, yy + 0.04, 3.0, "frame_black")
    for zz in (0.9, 2.35, 3.0):
        mb.box(x - 0.05, 5.6, zz - 0.04, x + 0.05, 10.6, zz + 0.04, "frame_black")
    mb.box(x - 0.01, 5.6, 0.9, x + 0.01, 10.6, 3.0, "glass")
    mb.obj("Kitchen_Windows_West", c)


def office_window(c):
    mb = MB()
    y = OFF_Y[1] + T_EXT / 2
    for xx in (-7.05, -6.1):
        mb.box(xx - 0.03, y - 0.06, 0.95, xx + 0.03, y + 0.06, 2.55, "frame_white")
    for zz in (0.95, 2.55):
        mb.box(-7.05, y - 0.06, zz - 0.03, -6.1, y + 0.06, zz + 0.03, "frame_white")
    mb.box(-7.02, y - 0.01, 0.98, -6.13, y + 0.01, 2.52, "glass")
    mb.plane_y(-7.02, -6.13, y - 0.02, 0.98, 2.52, "window_print", facing=-1)
    mb.obj("Office_Window_Print", c)


# =========================================================================== fixtures (local space: front = -Y)
def shelving(name, c, L, D, H, levels, prod, loc, facing, frame="shelf_dark", double=False,
             top_prod=None, header=None, back=True, wood_shelves=False, fill=0.78):
    """Supermarket shelving. levels = list of shelf heights (z of the shelf board)."""
    mb = MB()
    hx, hy = L / 2, D / 2
    mb.box(-hx, -hy + 0.02, 0, hx, hy - 0.02, 0.12, frame)                     # plinth
    if back and not double:
        mb.box(-hx, hy - 0.04, 0.12, hx, hy, H, frame)
    if double:
        mb.box(-hx, -0.02, 0.12, hx, 0.02, H, frame)
    for sx in (-hx, hx - 0.04):
        mb.box(sx, -hy, 0, sx + 0.04, hy, H, frame)                              # uprights / end panels
    shelf_mat = "wood_oak" if wood_shelves else frame
    zs = [0.12] + list(levels)
    sides = [(-1, -hy, 0.0 if double else hy - 0.04)] + ([(+1, 0.0, hy)] if double else [])
    for sgn, ya, yb in sides:
        ya, yb = min(ya, yb), max(ya, yb)
        for i, z in enumerate(zs):
            if i > 0:
                mb.box(-hx + 0.04, ya, z - 0.025, hx - 0.04, yb, z, shelf_mat)
                # price strip on the shelf edge
                if sgn < 0:
                    mb.box(-hx + 0.04, ya - 0.012, z - 0.045, hx - 0.04, ya, z, "price_strip",
                           fit={"yn": (L, 1.0)}, faces=("yn",))
                else:
                    mb.box(-hx + 0.04, yb, z - 0.045, hx - 0.04, yb + 0.012, z, "price_strip",
                           fit={"yp": (L, 1.0)}, faces=("yp",))
            z_top = zs[i + 1] - 0.03 if i + 1 < len(zs) else (H if top_prod else None)
            if z_top is None:
                continue
            gap = z_top - z
            pz1 = z + gap * fill
            p = top_prod if (i + 1 == len(zs) and top_prod) else prod
            if sgn < 0:
                mb.box(-hx + 0.05, ya + 0.03, z + 0.005, hx - 0.05, yb - 0.03, pz1, "prod_side",
                       fmat={"yn": p}, fit={"yn": (L, 1.0)})
            else:
                mb.box(-hx + 0.05, ya + 0.03, z + 0.005, hx - 0.05, yb - 0.03, pz1, "prod_side",
                       fmat={"yp": p}, fit={"yp": (L, 1.0)})
    if header:
        mb.box(-hx, -hy - 0.02, H, hx, -hy + 0.02, H + 0.25, header, fit={"yn": (1, 1)})
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def multideck(name, c, L, loc, facing, prod="prod_dairy", D=0.95, H=2.05):
    """Open front refrigerated multideck (dairy/sausage chillers on the hall's east wall)."""
    mb = MB()
    hx, hy = L / 2, D / 2
    mb.box(-hx, -hy + 0.12, 0, hx, hy, 0.45, "black_plastic")                    # base
    mb.box(-hx, -hy + 0.08, 0.05, hx, -hy + 0.12, 0.42, "shelf_dark")            # front grille
    mb.box(-hx, -hy + 0.02, 0.32, hx, -hy + 0.1, 0.36, "chrome")                 # bumper rail
    mb.box(-hx, -hy + 0.02, 0.38, hx, -hy + 0.1, 0.4, "chrome")
    for sx in (-hx, hx - 0.05):
        mb.box(sx, -hy + 0.1, 0, sx + 0.05, hy, H, "black_plastic")
    mb.box(-hx + 0.05, hy - 0.08, 0.45, hx - 0.05, hy - 0.05, H - 0.1, "fridge_inner")
    mb.box(-hx, -hy + 0.18, H - 0.12, hx, hy, H, "black_plastic")                # canopy
    mb.box(-hx + 0.05, -hy + 0.2, H - 0.135, hx - 0.05, -hy + 0.26, H - 0.12, "led_cool")
    # well (bottom deck) + products
    mb.box(-hx + 0.05, -hy + 0.12, 0.45, hx - 0.05, hy - 0.08, 0.48, "fridge_inner")
    mb.box(-hx + 0.06, -hy + 0.16, 0.48, hx - 0.06, hy - 0.12, 0.66, "prod_side",
           fmat={"yn": prod, "zp": prod}, fit={"yn": (L, 0.7), "zp": (L, 1.0)})
    levels = [0.82, 1.12, 1.42, 1.70]
    for k, z in enumerate(levels):
        front = -hy + 0.30 + k * 0.07
        mb.box(-hx + 0.05, front, z - 0.025, hx - 0.05, hy - 0.08, z, "shelf_dark")
        mb.box(-hx + 0.05, front - 0.012, z - 0.05, hx - 0.05, front, z, "price_strip",
               fit={"yn": (L, 1.0)}, faces=("yn",))
        mb.box(-hx + 0.06, front + 0.02, z, hx - 0.06, hy - 0.1, z + 0.2, "prod_side",
               fmat={"yn": prod}, fit={"yn": (L, 1.0)})
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def glass_fridge(name, c, W, loc, facing, frame="frame_black", header="black_plastic", led=None,
                 prod="prod_drinks", D=0.75, H=2.05, doors=1):
    """Upright glass-door cooler.  Doors are part of the mesh (closed)."""
    mb = MB()
    hx, hy = W / 2, D / 2
    mb.box(-hx, -hy + 0.05, 0, hx, hy, 0.12, "black_plastic")                    # plinth
    mb.box(-hx, -hy + 0.05, 0.12, -hx + 0.05, hy, H - 0.18, frame)              # sides
    mb.box(hx - 0.05, -hy + 0.05, 0.12, hx, hy, H - 0.18, frame)
    mb.box(-hx, hy - 0.05, 0.12, hx, hy, H - 0.18, "fridge_inner")              # back (lit)
    mb.box(-hx, -hy + 0.05, H - 0.18, hx, hy, H, header, fit={"yn": (1, 1)})    # header
    mb.box(-hx + 0.05, -hy + 0.05, 0.12, hx - 0.05, hy - 0.05, 0.15, "fridge_inner")
    for z in (0.55, 0.92, 1.29, 1.62):
        mb.box(-hx + 0.05, -hy + 0.1, z - 0.015, hx - 0.05, hy - 0.06, z, "glass_clear")
    for z0, z1 in ((0.15, 0.53), (0.55, 0.9), (0.92, 1.27), (1.29, 1.6), (1.62, 1.84)):
        mb.box(-hx + 0.06, -hy + 0.14, z0, hx - 0.06, hy - 0.08, z0 + (z1 - z0) * 0.85, "prod_side",
               fmat={"yn": prod}, fit={"yn": (W - 0.1, 1.0)})
    # inner light strips
    mb.box(-hx + 0.05, -hy + 0.1, 0.2, -hx + 0.07, -hy + 0.14, H - 0.25, "led_cool")
    mb.box(hx - 0.07, -hy + 0.1, 0.2, hx - 0.05, -hy + 0.14, H - 0.25, "led_cool")
    # door(s): frame + glass
    dw = W / doors
    for k in range(doors):
        x0 = -hx + k * dw
        x1 = x0 + dw
        for (a0, a1, b0, b1) in ((x0, x0 + 0.05, 0.12, H - 0.18), (x1 - 0.05, x1, 0.12, H - 0.18),
                                 (x0, x1, 0.12, 0.18), (x0, x1, H - 0.24, H - 0.18)):
            mb.box(a0, -hy, b0, a1, -hy + 0.05, b1, frame)
        if led:
            for (a0, a1, b0, b1) in ((x0 + 0.01, x0 + 0.025, 0.14, H - 0.2), (x1 - 0.025, x1 - 0.01, 0.14, H - 0.2),
                                     (x0 + 0.01, x1 - 0.01, 0.14, 0.155), (x0 + 0.01, x1 - 0.01, H - 0.215, H - 0.2)):
                mb.box(a0, -hy - 0.005, b0, a1, -hy, b1, led)
        mb.box(x0 + 0.05, -hy + 0.02, 0.18, x1 - 0.05, -hy + 0.03, H - 0.24, "glass")
        mb.box(x1 - 0.1 if k % 2 == 0 else x0 + 0.07, -hy - 0.04, 0.8, x1 - 0.07 if k % 2 == 0 else x0 + 0.1, -hy, 1.4, "chrome")
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def counter_mama(name, c, L, loc, facing):
    """Customer-facing pizza counter: MAMA panel, granite band, steel display, glass guard.
    Local: front = -Y (customers), kitchen side = +Y.  The refrigeration unit is at local -X end."""
    mb = MB()
    hx, D = L / 2, 0.9
    hy = D / 2
    mb.box(-hx, -hy, 0.0, hx, hy, 0.1, "steel_dark")                               # legs / plinth
    mb.box(-hx + 0.55, -hy, 0.1, hx, -hy + 0.03, 0.86, "mama_panel", fit={"yn": ((L - 0.55) / 1.6, 1.0)})
    mb.box(-hx, -hy + 0.03, 0.1, hx, hy - 0.05, 0.86, "anthracite")               # body
    # refrigeration unit at the -X end: louvered steel + yellow sticker
    mb.box(-hx, -hy, 0.1, -hx + 0.55, -hy + 0.03, 0.86, "steel_dark")
    for k in range(9):
        mb.box(-hx + 0.06, -hy - 0.01, 0.2 + k * 0.06, -hx + 0.49, -hy, 0.22 + k * 0.06, "black_plastic")
    mb.box(-hx - 0.01, -0.25, 0.2, -hx, 0.25, 0.86, "steel_dark")
    for k in range(9):
        mb.box(-hx - 0.02, -0.2, 0.25 + k * 0.06, -hx - 0.01, 0.2, 0.27 + k * 0.06, "black_plastic")
    mb.box(-hx - 0.025, 0.25, 0.3, -hx - 0.02, 0.33, 0.48, "sticker_yellow", fit={"xn": (1, 1)}, faces=("xn",))
    # granite band + top
    mb.box(-hx, -hy - 0.03, 0.86, hx, hy, 0.98, "granite")
    # steel display (topping / pizza display) and glass sneeze guard
    mb.box(-hx + 0.05, -hy + 0.05, 0.98, hx - 0.05, hy - 0.25, 1.32, "steel", fmat={"zp": "steel_dark"})
    mb.box(-hx + 0.05, -hy + 0.1, 1.32, hx - 0.05, -hy + 0.12, 1.62, "glass")
    mb.box(-hx + 0.05, -hy + 0.1, 1.6, hx - 0.05, hy - 0.1, 1.62, "glass")
    for sx in (-hx + 0.05, hx - 0.07):
        mb.box(sx, -hy + 0.1, 1.32, sx + 0.02, hy - 0.1, 1.62, "chrome")
    # kitchen side: steel make-line with granite edge + sauce bottles
    mb.box(-hx, hy - 0.05, 0.1, hx, hy, 0.86, "steel")
    for i in range(6):
        bx = -hx + 0.8 + i * 0.22
        mb.cyl(bx, hy - 0.18, 0.98, 1.18, 0.035, "white_plastic" if i % 2 else "yellow", seg=10)
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def steel_table(name, c, L, D, loc, facing, top="steel", h=0.9, undershelf=True, splash=False, items=None):
    mb = MB()
    hx, hy = L / 2, D / 2
    mb.box(-hx, -hy, h - 0.04, hx, hy, h, top, fmat={"zp": top})
    for sx in (-hx + 0.03, hx - 0.07):
        for sy in (-hy + 0.03, hy - 0.07):
            mb.box(sx, sy, 0, sx + 0.04, sy + 0.04, h - 0.04, "steel")
    if undershelf:
        mb.box(-hx + 0.03, -hy + 0.03, 0.2, hx - 0.03, hy - 0.03, 0.23, "steel")
        if items:
            mb.box(-hx + 0.08, -hy + 0.08, 0.23, hx - 0.08, hy - 0.08, 0.55, "prod_side",
                   fmat={"yn": items}, fit={"yn": (L - 0.16, 1.0)})
    if splash:
        mb.box(-hx, hy - 0.02, h, hx, hy, h + 0.12, "steel")
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def fridge_counter(name, c, L, loc, facing, board=False, h=0.9, doors=2):
    """Refrigerated steel prep counter with doors (kitchen)."""
    mb = MB()
    D = 0.7
    hx, hy = L / 2, D / 2
    mb.box(-hx, -hy, 0.12, hx, hy, h - 0.04, "steel")
    mb.box(-hx, -hy, h - 0.04, hx, hy, h, "steel")
    for k in range(doors):
        x0 = -hx + 0.35 + k * (L - 0.4) / doors
        x1 = x0 + (L - 0.4) / doors - 0.03
        mb.box(x0, -hy - 0.015, 0.18, x1, -hy, h - 0.1, "steel")
        mb.box(x0 + 0.05, -hy - 0.04, h - 0.18, x1 - 0.05, -hy - 0.015, h - 0.15, "steel_dark")
    mb.box(-hx + 0.03, -hy - 0.01, 0.18, -hx + 0.32, -hy, h - 0.1, "steel_dark")          # compressor grille
    for k in range(6):
        mb.box(-hx + 0.05, -hy - 0.02, 0.25 + k * 0.08, -hx + 0.3, -hy - 0.01, 0.27 + k * 0.08, "black_plastic")
    for sx in (-hx + 0.05, hx - 0.1):
        for sy in (-hy + 0.05, hy - 0.1):
            mb.cyl(sx + 0.025, sy + 0.025, 0.0, 0.12, 0.03, "rubber", seg=8)
    if board:
        mb.box(-hx + 0.1, -hy + 0.05, h, hx - 0.1, hy - 0.05, h + 0.02, "blue_board")
    return mb.obj(name, c, loc=loc, rot_z=FACING[facing])


def wall_shelf(mb, x0, x1, y_wall, depth, z, sign=1, items="prod_kitchen", item_h=0.25):
    """Steel wall shelf along X attached to a wall at y_wall; sign=+1 -> shelf goes towards +Y."""
    y0, y1 = sorted((y_wall, y_wall + sign * depth))
    mb.box(x0, y0, z - 0.03, x1, y1, z, "steel")
    if items:
        if sign > 0:
            mb.box(x0 + 0.05, y0 + 0.03, z, x1 - 0.05, y1 - 0.04, z + item_h, "prod_side", fmat={"yp": items}, fit={"yp": (x1 - x0, 1)})
        else:
            mb.box(x0 + 0.05, y0 + 0.04, z, x1 - 0.05, y1 - 0.03, z + item_h, "prod_side", fmat={"yn": items}, fit={"yn": (x1 - x0, 1)})


def bin_round(name, c, x, y, r=0.24, h=0.62, cloth=False):
    mb = MB()
    mb.cyl(x, y, 0, h, r, "bin_grey", seg=20, caps=False)
    mb.cyl(x, y, 0, 0.02, r, "bin_grey", seg=20)
    mb.cyl(x, y, h - 0.02, h + 0.1, r + 0.02, "bag_black", seg=20, r_top=r * 0.75, cap_mat="cloth_blue" if cloth else "bag_black")
    return mb.obj(name, c)


def pizza_stack(mb, x0, y0, x1, y1, z0, z1):
    mb.box(x0, y0, z0, x1, y1, z1, "pizza_boxes", fmat={"zp": "kraft", "zn": "kraft"})


def door_leaf(name, c, hinge, width, angle_deg, along="x", h=2.05, mat="door_grey", thick=0.04, handle_side=1):
    """Interior door leaf with its origin on the hinge.  along='x' -> closed leaf runs to +X."""
    mb = MB()
    mb.box(0, -thick / 2, 0, width, thick / 2, h, mat, fit={"yn": (1, 1), "yp": (1, 1)}, fmat={"xp": "door_white", "xn": "door_white", "zp": "door_white"})
    hx = width - 0.08
    for s in (-1, 1):
        mb.box(hx - 0.02, s * (thick / 2), 1.0, hx + 0.02, s * (thick / 2 + 0.05), 1.06, "black_plastic")
        mb.box(hx - 0.14, s * (thick / 2 + 0.04), 1.0, hx, s * (thick / 2 + 0.06), 1.06, "black_plastic")
    rot = math.radians(angle_deg) + (0 if along == "x" else math.pi / 2)
    ob = mb.obj(name, c, loc=hinge, rot_z=rot)
    ob["hinge"] = "origin = hinge axis, rotate around Z to open/close"
    return ob


def door_frame(mb, x0, x1, y, h=2.05, axis="x", t=0.14):
    """Simple white casing around an interior door opening."""
    if axis == "x":
        mb.box(x0 - 0.05, y - t / 2, 0, x0, y + t / 2, h + 0.05, "door_white")
        mb.box(x1, y - t / 2, 0, x1 + 0.05, y + t / 2, h + 0.05, "door_white")
        mb.box(x0 - 0.05, y - t / 2, h, x1 + 0.05, y + t / 2, h + 0.05, "door_white")
    else:
        mb.box(y - t / 2, x0 - 0.05, 0, y + t / 2, x0, h + 0.05, "door_white")
        mb.box(y - t / 2, x1, 0, y + t / 2, x1 + 0.05, h + 0.05, "door_white")
        mb.box(y - t / 2, x0 - 0.05, h, y + t / 2, x1 + 0.05, h + 0.05, "door_white")


# =========================================================================== zones
def build_hall(root):
    c = coll("02_Sales_Hall", root)
    # ---- east wall, from the street door northwards
    glass_fridge("Hall_E01_BeerCooler_Black_1", c, 0.7, (-0.38, 0.62, 0), "W", prod="prod_drinks")
    glass_fridge("Hall_E02_BeerCooler_Black_2", c, 0.7, (-0.38, 1.33, 0), "W", prod="prod_drinks")
    shelving("Hall_E03_GreenPromoRack", c, 0.9, 0.5, 1.8, [0.45, 0.8, 1.15, 1.5], "prod_snacks", (-0.25, 2.17, 0), "W", frame="green_rack")
    m = MB()   # MA PIZZA A-frame floor stand in front of the green rack
    m.box(-0.3, -0.02, 0.0, 0.3, 0.02, 1.0, "white_plastic", fmat={"yn": "sign_ma_pizza"}, fit={"yn": (1, 1)})
    m.obj("Hall_E03b_FloorStand_MA", c, loc=(-0.72, 2.55, 0), rot_z=math.radians(-70))
    for i in range(4):
        multideck(f"Hall_E{4 + i:02d}_Multideck_{i + 1}", c, 1.5, (-0.475, 3.4 + i * 1.5, 0), "W",
                  prod="prod_dairy" if i < 3 else "prod_grocery")
    for i in range(3):
        shelving(f"Hall_E{8 + i:02d}_SnackWall_{i + 1}", c, 1.2, 0.5, 2.2, [0.5, 0.85, 1.2, 1.55, 1.9], "prod_snacks",
                 (-0.25, 9.3 + i * 1.2, 0), "W", top_prod="prod_snacks")
    # chest freezer (ice cream) + water packs by the north door
    fz = MB()
    fz.box(-0.5, -0.32, 0.0, 0.5, 0.32, 0.82, "teal", fmat={"yn": "teal"})
    fz.box(-0.48, -0.3, 0.82, 0.48, 0.3, 0.86, "glass")
    fz.box(-0.5, -0.32, 0.86, 0.5, -0.28, 0.9, "steel_dark")
    fz.box(-0.5, 0.28, 0.86, 0.5, 0.32, 0.9, "steel_dark")
    fz.obj("Hall_E11_IceCreamFreezer", c, loc=(-1.05, 12.3, 0), rot_z=FACING["S"])
    w = MB()
    for (x, y, n) in [(-1.75, 12.45, 3), (-1.75, 12.15, 2), (-0.75, 11.75, 2)]:
        for k in range(n):
            w.box(x - 0.18, y - 0.13, k * 0.33, x + 0.18, y + 0.13, k * 0.33 + 0.32, "water")
    w.obj("Hall_E12_WaterPacks", c)
    # chip clip-strip rack (red wire base, yellow header) in front of the snack wall
    cr = MB()
    cr.box(-0.25, -0.2, 0.0, 0.25, 0.2, 0.03, "red_paint")
    for sx in (-0.24, 0.22):
        cr.box(sx, -0.02, 0.03, sx + 0.02, 0.02, 1.75, "red_paint")
    cr.box(-0.22, -0.03, 0.15, 0.22, 0.03, 1.55, "black_plastic", fmat={"yn": "prod_snacks", "yp": "prod_snacks"},
           fit={"yn": (0.6, 1.0), "yp": (0.6, 1.0)})
    cr.box(-0.22, -0.03, 1.55, 0.22, 0.03, 1.85, "chips_header", fit={"yn": (1, 1), "yp": (1, 1)})
    cr.obj("Hall_E13_ChipsRack", c, loc=(-1.25, 8.95, 0))

    # ---- west side, from the street door northwards
    # wooden coffee / pizza order counter with the helmet (left of the street door)
    hc = MB()
    hc.box(-0.6, -0.3, 0.0, 0.6, 0.3, 1.0, "wood_oak")
    for k in range(2):
        hc.box(-0.52 + k * 0.56, -0.31, 0.12, -0.04 + k * 0.56, -0.3, 0.88, "black_plastic")
    hc.box(-0.62, -0.32, 1.0, 0.62, 0.32, 1.04, "wood_oak")
    hc.box(-0.45, -0.1, 1.04, -0.1, 0.25, 1.45, "black_plastic")           # coffee machine
    hc.box(-0.42, -0.11, 1.25, -0.13, -0.1, 1.4, "steel")
    hc.cyl(0.1, 0.1, 1.04, 1.3, 0.04, "white_plastic", seg=12)              # cup stacks
    hc.cyl(0.2, 0.12, 1.04, 1.36, 0.045, "white_plastic", seg=12)
    hc.box(0.3, -0.05, 1.04, 0.48, 0.1, 1.12, "black_plastic")              # card terminal
    hc.box(-0.55, 0.2, 1.04, -0.5, 0.28, 2.1, "black_plastic")              # menu board pole
    hc.box(-0.6, 0.28, 1.2, 0.1, 0.3, 2.3, "menu_board", fit={"yn": (1, 1)}, fmat={"yp": "black_plastic"})
    hc.obj("Hall_W01_CoffeeCounter", c, loc=(-2.95, 0.85, 0), rot_z=FACING["E"])
    hel = bpy.data.meshes.new("Helmet")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.16)
    bm.to_mesh(hel)
    bm.free()
    hel.materials.append(MATS["helmet"])
    ho = bpy.data.objects.new("Hall_W01b_Helmet", hel)
    ho.location = (-2.85, 0.45, 1.2)
    ho.scale = (1.0, 1.15, 0.95)
    c.objects.link(ho)
    # wooden bakery display
    shelving("Hall_W02_BakeryWood", c, 1.8, 0.5, 1.9, [0.55, 0.95, 1.35], "prod_bakery", (-3.5, 2.5, 0), "E",
             frame="wood_oak", wood_shelves=True, top_prod="prod_bakery")
    # grocery wall shelving (oils, jars, pasta) up to the wood column
    for i in range(3):
        shelving(f"Hall_W{3 + i:02d}_Grocery_{i + 1}", c, 1.4, 0.5, 2.1, [0.45, 0.8, 1.15, 1.5, 1.85], "prod_grocery",
                 (-3.5, 4.1 + i * 1.4, 0), "E", top_prod="prod_grocery")
    # chocolate gondola (between the passage and the drinks coolers)
    shelving("Hall_W06_Chocolate", c, 1.1, 0.5, 1.75, [0.4, 0.7, 1.0, 1.3], "prod_choco", (-3.45, 9.95, 0), "E",
             top_prod="prod_choco")
    # glass-door drink coolers up to the north door: green LED, red frame, black, black
    specs = [("frame_black", "header_green", "led_green"), ("red_paint", "header_red", None),
             ("frame_black", "black_plastic", "led_green"), ("frame_black", "black_plastic", None)]
    for i, (fr, hd, led) in enumerate(specs):
        glass_fridge(f"Hall_W{7 + i:02d}_DrinkCooler_{i + 1}", c, 0.62, (-3.375, 10.81 + i * 0.62, 0), "E",
                     frame=fr, header=hd, led=led)
    # ---- ceiling LED lines
    led = MB()
    for (y0, y1) in [(0.5, 4.3), (4.6, 8.4), (8.7, 12.5)]:
        led.box(-2.03, y0, H_HALL - 0.04, -1.97, y1, H_HALL, "led")
    for y in (1.8, 6.0, 10.4):
        led.box(-3.4, y - 0.03, H_HALL - 0.04, -2.4, y + 0.03, H_HALL, "led")
    led.obj("Hall_Ceiling_LED_Lines", c)
    # CCTV dome above the north door
    cam = MB()
    cam.cyl(-1.95, 12.6, H_HALL - 0.12, H_HALL, 0.07, "white_plastic", seg=12)
    cam.obj("Hall_CCTV_Dome", c)
    return c


def build_counter_zone(root):
    c = coll("03_CashDesk_PizzaCounter", root)
    cx = (COUNTER_X[0] + COUNTER_X[1]) / 2
    cy = (COUNTER_Y[0] + COUNTER_Y[1]) / 2
    counter_mama("Counter_MAMA_Pizza", c, COUNTER_Y[1] - COUNTER_Y[0], (cx, cy, 0), "E")
    # cash desk (anthracite) with candy rack facing the passage
    cd = MB()
    cd.box(-0.32, -0.7, 0.0, 0.32, 0.7, 0.92, "black_plastic")
    cd.box(-0.36, -0.72, 0.92, 0.36, 0.72, 0.96, "black_plastic")
    for k in range(3):   # drawers on the cashier (west) side
        cd.box(-0.33, -0.6 + k * 0.42, 0.62, -0.32, -0.25 + k * 0.42, 0.86, "black_plastic")
    cd.box(-0.25, -0.3, 0.96, -0.05, 0.1, 1.0, "black_plastic")              # POS stand
    cd.box(-0.18, -0.25, 1.0, -0.16, 0.05, 1.3, "black_plastic")
    cd.box(-0.165, -0.28, 1.05, -0.155, 0.08, 1.3, "screen_pos", fit={"xn": (1, 1)}, faces=("xn",))
    cd.box(-0.05, 0.25, 0.96, 0.25, 0.55, 1.02, "steel")                       # scale
    cd.box(0.15, -0.45, 0.96, 0.27, -0.33, 1.06, "black_plastic")             # card terminal
    # candy rack at the south end
    cd.box(-0.3, -1.05, 0.0, 0.3, -0.72, 0.95, "shelf_dark")
    for k, z in enumerate((0.12, 0.42, 0.72)):
        cd.box(-0.28, -1.06, z, 0.28, -0.75, z + 0.24, "prod_side", fmat={"yn": "prod_candy"}, fit={"yn": (0.6, 1.0)})
    cd.obj("CashDesk", c, loc=(-5.2, 10.1, 0))
    # snack shelving on the partition behind the cash desk + CCTV monitors above
    shelving("Cash_SnackShelf_Partition", c, 2.0, 0.35, 2.0, [0.5, 0.85, 1.2, 1.55], "prod_snacks",
             (HALL_X0 - T_INT - 0.175, 10.55, 0), "W", top_prod="prod_choco")
    tv = MB()
    for y in (9.95, 10.75):
        tv.box(HALL_X0 - T_INT - 0.06, y - 0.36, 2.25, HALL_X0 - T_INT, y + 0.36, 2.68, "black_plastic",
               fmat={"xn": "screen_cctv"}, fit={"xn": (1, 1)})
    tv.obj("Cash_CCTV_Monitors", c)
    # grey drinks rack (cola bottles) at the corridor entrance + paper menus on top
    shelving("Cash_DrinksRack", c, 0.85, 0.45, 1.35, [0.35, 0.7, 1.05], "prod_drinks", (-5.78, 11.12, 0), "W",
             frame="shelf_grey", top_prod=None)
    pm = MB()
    pm.box(-0.15, -0.2, 1.35, 0.15, 0.1, 1.75, "menu_board", fit={"xn": (1, 1)})
    pm.obj("Cash_PaperMenus", c, loc=(-5.75, 11.0, 0))
    # folding chair used by the staff
    ch = MB()
    ch.box(-0.22, -0.2, 0.44, 0.22, 0.2, 0.47, "steel_dark")
    ch.box(-0.22, 0.17, 0.47, 0.22, 0.2, 0.9, "steel_dark")
    for sx in (-0.21, 0.19):
        ch.box(sx, -0.2, 0.0, sx + 0.02, -0.18, 0.46, "chrome")
        ch.box(sx, 0.18, 0.0, sx + 0.02, 0.2, 0.9, "chrome")
    ch.obj("Cash_FoldingChair", c, loc=(-6.35, 9.9, 0), rot_z=math.radians(-60))
    # TV / menu screen hanging above the counter
    ms = MB()
    ms.box(-0.04, -0.3, 2.62, 0.0, 0.3, 2.97, "black_plastic", fmat={"xp": "screen_laptop"}, fit={"xp": (1, 1)})
    ms.box(-0.03, -0.01, 2.97, -0.01, 0.01, H_HALL, "black_plastic")
    ms.obj("Counter_MenuScreen", c, loc=(-6.95, 9.2, 0))
    # LED lines above the counter zone
    led = MB()
    led.box(-5.53, 5.4, H_HALL - 0.04, -5.47, 9.2, H_HALL, "led")
    led.box(-6.8, 7.3, H_HALL - 0.04, -4.0, 7.36, H_HALL, "led")
    led.box(-6.6, 9.9, H_HALL - 0.04, -4.2, 9.96, H_HALL, "led")
    led.obj("Counter_Ceiling_LED", c)
    # exposed ducts (seen above the counter / kitchen)
    du = MB()
    du.cyl_y(5.2, 11.6, -8.6, 3.1, 0.16, "steel_dark", seg=16)
    du.cyl_x(-13.4, -7.95, 9.9, 3.15, 0.12, "steel_dark", seg=16)
    du.obj("Kitchen_Ducts", c)
    return c


def build_kitchen(root):
    c = coll("04_Kitchen", root)
    # --- along the south wall (left when you walk in from the counter end)
    steel_table("Kit_S01_Table_Entry", c, 1.2, 0.65, (-9.05, 5.43, 0), "N", items="prod_kitchen")
    ps = MB()   # pizza box stacks in a wooden frame, up to the ceiling
    for px in (-10.95, -9.74):
        for py in (5.02, 5.58):
            ps.box(px, py, 0, px + 0.04, py + 0.04, H_HALL, "wood_oak")
    for pz in (0.0, 1.45, 2.95):
        ps.box(-10.95, 5.58, pz, -9.7, 5.62, pz + 0.05, "frame_white")
    for (x0, x1) in [(-10.88, -10.52), (-10.5, -10.12), (-10.1, -9.76)]:
        pizza_stack(ps, x0, 5.05, x1, 5.55, 0.0, 2.7 + 0.15 * ((x0 * 10) % 3))
    ps.obj("Kit_S02_PizzaBoxStacks", c)
    shelving("Kit_S03_MetalShelving", c, 1.2, 0.5, 2.0, [0.4, 0.8, 1.2, 1.6], "prod_kitchen", (-11.65, 5.3, 0), "N",
             frame="steel", back=False, top_prod="prod_kitchen")
    steel_table("Kit_S04_Table_Corner", c, 1.2, 0.65, (-12.85, 5.43, 0), "N", items="prod_kitchen")
    # --- refrigerated prep counters (blue boards) in the middle-south
    fridge_counter("Kit_C01_PrepCounter_1", c, 1.6, (-11.9, 6.95, 0), "N", board=True)
    fridge_counter("Kit_C02_PrepCounter_2", c, 1.6, (-10.25, 6.95, 0), "N", board=True)
    fridge_counter("Kit_C03_PrepCounter_Center", c, 1.4, (-9.9, 8.75, 0), "S", board=False)
    # --- pizza oven (double deck) behind the counter's north part, hood above
    ov = MB()
    ov.box(-0.5, -0.45, 0.0, 0.5, 0.45, 0.85, "steel", fmat={"zp": "steel"})         # stand
    ov.box(-0.48, -0.43, 0.25, 0.48, 0.43, 0.28, "steel")
    for k in range(2):
        z0 = 0.88 + k * 0.42
        ov.box(-0.5, -0.45, z0, 0.5, 0.45, z0 + 0.4, "steel")
        ov.box(-0.38, -0.46, z0 + 0.1, 0.38, -0.45, z0 + 0.3, "black_plastic")
        ov.box(-0.3, -0.5, z0 + 0.33, 0.3, -0.46, z0 + 0.36, "black_plastic")         # handle
        ov.box(0.35, -0.46, z0 + 0.12, 0.45, -0.45, z0 + 0.3, "steel_dark")            # controls
    ov.box(-0.65, -0.65, 2.25, 0.65, 0.55, 2.65, "steel")                             # hood
    ov.box(-0.15, -0.1, 2.65, 0.15, 0.2, H_HALL, "steel_dark")
    ov.obj("Kit_O01_PizzaOven_DoubleDeck", c, loc=(-8.47, 9.18, 0), rot_z=FACING["W"])
    tl = MB()   # wall block right of the MAMA counter: white tiles + recipe sheets on the kitchen side
    tl.box(-8.02, OVEN_WALL_Y[0], 0, -7.05, OVEN_WALL_Y[1], H_HALL, "wall_dark",
           fmat={"xn": "wall_tile", "yn": "wall_tile"})
    tl.plane_x(-8.03, OVEN_WALL_Y[0] + 0.05, OVEN_WALL_Y[1] - 0.05, 1.72, 2.2, "kitchen_papers", facing=-1)
    tl.plane_y(-7.98, -7.1, OVEN_WALL_Y[0] - 0.005, 1.2, 1.75, "kitchen_papers", facing=-1)
    tl.obj("Kit_O02_OvenWall_TiledPapers", c)
    # --- west window wall: steel tables with blue boards, rice cooker
    steel_table("Kit_W01_Table_Window_1", c, 1.3, 0.7, (-13.2, 7.85, 0), "E", items="prod_kitchen")
    steel_table("Kit_W02_Table_Window_2", c, 1.3, 0.7, (-13.2, 9.15, 0), "E", items="prod_kitchen")
    bb = MB()
    bb.box(-13.5, 7.3, 0.9, -12.95, 9.7, 0.92, "blue_board")
    bb.box(-13.45, 8.2, 0.92, -13.1, 8.5, 1.0, "steel")                              # scale
    bb.obj("Kit_W03_BlueBoards_Scale", c)
    rc = MB()
    rc.box(-13.5, 9.95, 0, -12.95, 10.5, 0.85, "steel")
    rc.cyl(-13.22, 10.22, 0.85, 1.2, 0.17, "steel", seg=20)
    rc.cyl(-13.22, 10.22, 1.2, 1.25, 0.12, "black_plastic", seg=16)
    rc.obj("Kit_W04_RiceCooker_Stand", c)
    # --- north wall: red MAMA coolers, steel tables, shelves, knife strips
    glass_fridge("Kit_N01_RedCooler_Double", c, 1.15, (-12.5, 11.4, 0), "S", frame="red_paint", header="header_mama",
                 prod="prod_kitchen", D=0.7, doors=2)
    glass_fridge("Kit_N02_RedCooler_Single", c, 0.7, (-11.55, 11.4, 0), "S", frame="red_paint", header="header_mama",
                 prod="prod_kitchen", D=0.7)
    wp = MB()
    wp.box(-13.25, 11.7, 0, -12.95, 11.72, 2.15, "white_plastic")                    # tall white panel (leaning board)
    wp.obj("Kit_N03_WhitePanel", c)
    steel_table("Kit_N04_Table_North_1", c, 1.25, 0.7, (-10.45, 11.43, 0), "S", items="prod_kitchen", splash=True)
    steel_table("Kit_N05_Table_North_2", c, 1.25, 0.7, (-9.15, 11.43, 0), "S", items="prod_kitchen", splash=True)
    sh = MB()
    wall_shelf(sh, -11.1, -8.5, KIT_Y1 - T_INT / 2, 0.35, 1.7, sign=-1)
    wall_shelf(sh, -11.1, -8.5, KIT_Y1 - T_INT / 2, 0.35, 2.1, sign=-1)
    for x in (-10.6, -9.4):
        sh.box(x, KIT_Y1 - 0.03, 1.25, x + 0.35, KIT_Y1, 1.3, "black_plastic")      # knife magnet strip
        for k in range(3):
            sh.box(x + 0.05 + k * 0.1, KIT_Y1 - 0.045, 1.0, x + 0.08 + k * 0.1, KIT_Y1 - 0.03, 1.3, "chrome")
    sh.box(-10.0, 11.3, 0.9, -9.6, 11.6, 1.05, "wood_oak")                            # wooden bowl (as a block)
    sh.cyl(-8.8, 11.45, 0.9, 1.15, 0.13, "steel", seg=16)                              # second rice cooker
    sh.obj("Kit_N06_WallShelves_Knives", c)
    # --- north-east corner: sinks, boiler, tall rack, dough mixer, dough trays
    sk = MB()
    sk.box(-8.45, 11.2, 0, -7.12, 11.75, 0.85, "steel")
    sk.box(-8.35, 11.25, 0.85, -7.82, 11.7, 0.9, "steel_dark")                        # bowls (top view)
    sk.box(-7.75, 11.25, 0.85, -7.22, 11.7, 0.9, "steel_dark")
    for x in (-8.08, -7.48):
        sk.box(x - 0.02, 11.65, 0.9, x + 0.02, 11.7, 1.25, "chrome")
        sk.box(x - 0.02, 11.45, 1.21, x + 0.02, 11.7, 1.25, "chrome")
    sk.box(-8.3, 11.75, 0.9, -7.1, 11.78, 1.6, "wall_tile")
    sk.cyl(-7.45, 11.55, 1.85, 2.6, 0.22, "white_plastic", seg=20)                     # electric water boiler
    sk.obj("Kit_NE01_Sinks_Boiler", c)
    shelving("Kit_NE02_TallSteelRack", c, 0.9, 0.5, 2.0, [0.4, 0.8, 1.2, 1.6], "prod_kitchen", (-7.32, 10.75, 0), "W",
             frame="steel", back=False, top_prod="prod_kitchen")
    mx = MB()   # spiral dough mixer on a white stand
    mx.box(-0.3, -0.3, 0.0, 0.3, 0.3, 0.55, "white_plastic")
    mx.cyl(0.0, -0.05, 0.55, 0.9, 0.3, "steel", seg=24, caps=False)
    mx.cyl(0.0, -0.05, 0.55, 0.57, 0.3, "steel", seg=24)
    mx.box(-0.15, 0.2, 0.55, 0.15, 0.4, 1.25, "white_plastic")
    mx.box(-0.15, -0.1, 1.05, 0.15, 0.4, 1.25, "white_plastic")
    mx.obj("Kit_NE03_DoughMixer", c, loc=(-8.0, 10.65, 0))
    tr = MB()
    for k in range(9):
        tr.box(-8.75, 10.3, 0.05 + k * 0.17, -8.15, 10.7, 0.2 + k * 0.17, "white_plastic")
    tr.obj("Kit_NE04_DoughTrayStack", c)
    # --- bins
    bin_round("Kit_Bin_1", c, -8.75, 6.25)
    bin_round("Kit_Bin_2", c, -11.0, 10.55, cloth=True)
    bin_round("Kit_Bin_3", c, -9.15, 10.0)
    fe = MB()
    fe.cyl(-11.05, 11.55, 0.0, 0.5, 0.08, "red_paint", seg=12)
    fe.obj("Kit_FireExtinguisher", c)
    # --- kitchen LED lines (run towards the windows)
    led = MB()
    for y in (6.3, 8.1, 10.2):
        led.box(-13.2, y - 0.03, H_HALL - 0.04, -8.2, y + 0.03, H_HALL, "led")
    led.obj("Kitchen_Ceiling_LED", c)
    return c


def build_back_of_house(root):
    c = coll("05_Corridor_WC", root)
    df = MB()
    door_frame(df, COR_X[0], -6.2, COR_Y[1], axis="x")                                # office door casing
    door_frame(df, 11.95, 12.75, WC_X[0], axis="y")                                    # WC door casing
    df.obj("Door_Casings", c)
    # office door: open, leaf lying against the corridor's west wall (as in the video)
    door_leaf("Door_Office", c, (COR_X[0] + 0.03, COR_Y[1] - 0.02, 0), 0.78, -90, along="x")
    # WC door: closed (light grey with black grooves, black lever handle)
    door_leaf("Door_WC", c, (WC_X[0] + 0.03, 11.97, 0), 0.76, -95, along="y")
    # corridor light
    lt = MB()
    lt.box(-6.65, 11.2, H_BACK - 0.03, -6.35, 12.4, H_BACK, "led")
    lt.obj("Corridor_Light", c)

    # --- WC
    w = MB()
    xe = WC_X[1] - 0.02                       # inner face of the east wall
    # tiled installation box behind the wall-hung toilet, with ledge + shelf of paper rolls
    w.box(xe - 0.22, 11.95, 0, xe, 12.75, 1.15, "wall_tile", fmat={"zp": "ceramic"})
    w.box(xe - 0.225, 12.22, 0.95, xe - 0.22, 12.48, 1.1, "white_plastic")            # flush plate
    w.box(xe - 0.3, 11.75, 1.72, xe, 12.95, 1.75, "black_plastic")                    # shelf
    w.box(xe - 0.28, 11.8, 1.75, xe - 0.02, 12.9, 2.05, "prod_side", fmat={"xn": "wc_shelf"}, fit={"xn": (1, 1)})
    w.box(xe - 0.3, 11.75, 2.2, xe, 12.95, 2.23, "black_plastic")                     # upper shelf
    # toilet (bowl as a tapered cylinder) + seat
    w.cyl(xe - 0.48, 12.35, 0.28, 0.42, 0.19, "ceramic", seg=20, r_top=0.21)
    w.box(xe - 0.48, 12.17, 0.25, xe - 0.22, 12.53, 0.42, "ceramic")
    w.cyl(xe - 0.48, 12.35, 0.42, 0.44, 0.2, "white_plastic", seg=20)
    w.box(xe - 0.26, 12.15, 0.44, xe - 0.22, 12.55, 0.85, "white_plastic")            # raised lid
    # black jumbo paper dispenser on the north wall, round
    w.cyl_y(WC_Y[1] - 0.17, WC_Y[1] - 0.06, xe - 0.75, 1.15, 0.16, "black_plastic", seg=20)
    # sink with cabinet + mirror on the north wall near the door
    w.box(-5.55, WC_Y[1] - 0.36, 0, -5.12, WC_Y[1] - 0.06, 0.72, "white_plastic")
    w.box(-5.6, WC_Y[1] - 0.42, 0.72, -5.07, WC_Y[1] - 0.06, 0.82, "ceramic")
    w.box(-5.37, WC_Y[1] - 0.18, 0.82, -5.3, WC_Y[1] - 0.1, 0.98, "chrome")
    w.box(-5.58, WC_Y[1] - 0.075, 1.15, -5.09, WC_Y[1] - 0.06, 1.75, "chrome")          # mirror
    # mop bucket (red/green) and mop in the corner
    w.cyl(xe - 0.18, 11.82, 0, 0.3, 0.14, "green_rack", seg=14)
    w.cyl(xe - 0.18, 11.82, 0.3, 0.36, 0.15, "red_paint", seg=14)
    w.box(xe - 0.06, 12.85, 0, xe - 0.04, 12.88, 1.4, "blue_board")
    w.box(-5.3, 12.05, H_BACK - 0.03, -4.9, 12.55, H_BACK, "led")                      # ceiling light
    w.obj("WC_Fixtures", c)
    return c


def build_office(root):
    c = coll("06_Office_Storage", root)
    x0, x1 = OFF_X[0] + T_EXT / 2, OFF_X[1] - T_EXT / 2       # inner faces
    y0, y1 = OFF_Y[0] + T_INT / 2, OFF_Y[1] - T_EXT / 2
    o = MB()
    # west wall: whiteboard + high wooden shelves with boxes
    o.box(x0, 13.6, 1.0, x0 + 0.02, 14.8, 1.9, "whiteboard", fit={"xp": (1, 1)}, fmat={"xn": "whiteboard"})
    for z in (2.1, 2.45):
        o.box(x0, y0 + 0.2, z - 0.025, x0 + 0.35, 15.6, z, "wood_beech")
        o.box(x0 + 0.02, y0 + 0.3, z, x0 + 0.33, 14.6, z + 0.22, "cardboard")
    # desk under the window (north-west) with laptop + monitor
    o.box(x0, y1 - 0.62, 0.72, x0 + 1.1, y1, 0.75, "white_plastic")
    for (ax, ay) in [(x0 + 0.03, y1 - 0.6), (x0 + 1.04, y1 - 0.6)]:
        o.box(ax, ay, 0, ax + 0.03, ay + 0.55, 0.72, "steel_dark")
    o.box(x0 + 0.35, y1 - 0.45, 0.75, x0 + 0.7, y1 - 0.2, 0.77, "black_plastic")       # laptop base
    o.box(x0 + 0.35, y1 - 0.21, 0.77, x0 + 0.7, y1 - 0.19, 1.0, "black_plastic", fmat={"yn": "screen_laptop"}, fit={"yn": (1, 1)})
    o.box(x0 + 0.72, y1 - 0.15, 0.75, x0 + 1.02, y1 - 0.12, 1.02, "black_plastic")
    o.cyl(x0 + 0.2, y1 - 0.9, 0.0, 0.35, 0.14, "bag_black", seg=14)                    # waste bin
    # beech wardrobe (north-east) with pizza boxes stacked on top up to the ceiling
    wx0, wx1 = -6.0, -5.08
    o.box(wx0, y1 - 0.55, 0, wx1, y1, 2.0, "wood_beech")
    o.box((wx0 + wx1) / 2 - 0.004, y1 - 0.556, 0.05, (wx0 + wx1) / 2 + 0.004, y1 - 0.55, 1.95, "black_plastic")
    for hx in ((wx0 + wx1) / 2 - 0.05, (wx0 + wx1) / 2 + 0.03):
        o.box(hx, y1 - 0.58, 0.95, hx + 0.02, y1 - 0.55, 1.15, "black_plastic")
    pizza_stack(o, wx0 + 0.02, y1 - 0.5, wx1 - 0.02, y1 - 0.05, 2.0, H_BACK)
    # pizza box stacks along the east wall (to the ceiling)
    pizza_stack(o, x1 - 0.48, 15.2, x1, 15.75, 0, H_BACK)
    pizza_stack(o, x1 - 0.48, 15.75, x1, 16.3, 0, H_BACK - 0.08)
    pizza_stack(o, x1 - 0.48, 16.3, x1, y1, 0, H_BACK)
    # cardboard boxes + pizza box with a paper on top, in front of the stacks
    o.box(x1 - 1.05, 15.25, 0, x1 - 0.5, 15.72, 1.0, "cardboard")
    pizza_stack(o, x1 - 1.0, 15.28, x1 - 0.55, 15.7, 1.0, 1.06)
    o.box(x1 - 0.95, 15.3, 1.06, x1 - 0.65, 15.62, 1.065, "white_plastic")
    # coats on hooks (east wall)
    o.box(x1 - 0.04, 14.4, 1.85, x1, 15.2, 1.88, "steel_dark")
    o.plane_x(x1 - 0.12, 14.35, 15.25, 0.55, 1.9, "coats", facing=-1)
    o.plane_x(x1 - 0.18, 14.45, 15.2, 0.6, 1.88, "coats", facing=-1)
    # ceiling panel light
    o.box(-6.2, 14.6, H_BACK - 0.03, -5.6, 15.2, H_BACK, "led")
    o.obj("Office_Furniture", c)
    # black metal rack with wooden boards (east wall, by the door): bags, boxes, drinks on top
    shelving("Office_MetalRack", c, 1.3, 0.5, 2.0, [0.45, 0.85, 1.25, 1.65], "prod_storage", (x1 - 0.25, 13.8, 0), "W",
             frame="shelf_dark", back=False, wood_shelves=True, top_prod="prod_drinks")
    # office chair
    ch = MB()
    ch.box(-0.24, -0.24, 0.45, 0.24, 0.24, 0.53, "black_plastic")
    ch.box(-0.22, 0.2, 0.55, 0.22, 0.26, 1.15, "black_plastic")
    ch.cyl(0, 0, 0.1, 0.45, 0.025, "chrome", seg=8)
    for k in range(5):
        a = k * 2 * math.pi / 5
        ch.box(min(0, 0.3 * math.cos(a)) - 0.02, min(0, 0.3 * math.sin(a)) - 0.02, 0.05,
               max(0, 0.3 * math.cos(a)) + 0.02, max(0, 0.3 * math.sin(a)) + 0.02, 0.1, "black_plastic")
    ch.obj("Office_Chair", c, loc=(x0 + 0.75, y1 - 1.05, 0), rot_z=math.radians(160))
    # grey folding chair
    fc = MB()
    fc.box(-0.2, -0.2, 0.44, 0.2, 0.2, 0.47, "shelf_grey")
    fc.box(-0.2, 0.17, 0.47, 0.2, 0.2, 0.9, "shelf_grey")
    fc.obj("Office_FoldingChair", c, loc=(-5.95, 15.1, 0), rot_z=math.radians(80))
    return c


def build_signage_and_lights(root):
    c = coll("07_Lights_Render", root)
    lights = []

    def area(name, loc, size, energy, rot=(0, 0, 0), color=(1.0, 0.97, 0.92)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size
        ld.energy = energy
        ld.color = color
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        ob.rotation_euler = rot
        c.objects.link(ob)
        lights.append(ob)

    z = H_HALL - 0.06
    for (y0, y1) in [(0.5, 4.3), (4.6, 8.4), (8.7, 12.5)]:
        area(f"L_Hall_{y0}", (-2.0, (y0 + y1) / 2, z), (0.12, y1 - y0), 380)
    area("L_Counter_1", (-5.5, 7.3, z), (0.12, 3.8), 240)
    area("L_Counter_2", (-5.4, 9.93, z), (2.4, 0.12), 140)
    for y in (6.3, 8.1, 10.2):
        area(f"L_Kitchen_{y}", (-10.7, y, z), (5.0, 0.12), 300)
    area("L_Corridor", (-6.5, 11.8, H_BACK - 0.05), (0.3, 1.2), 48)
    area("L_WC", (-5.1, 12.3, H_BACK - 0.05), (0.4, 0.4), 30)
    area("L_Office", (-5.9, 14.9, H_BACK - 0.05), (0.6, 0.6), 64)
    area("L_Office_2", (-5.9, 16.2, H_BACK - 0.05), (0.6, 0.6), 32)
    area("L_Street", (-2.0, -2.5, 4.5), (6.0, 3.0), 48, color=(0.7, 0.75, 0.9))
    return c


def build_markers(root):
    c = coll("08_Game_Markers", root)
    sp = bpy.data.objects.new("PlayerStart_Street", None)
    sp.empty_display_type = "ARROWS"
    sp.location = (-2.0, -2.5, 0.0)
    sp.rotation_euler = (0, 0, 0)        # +Y (north) is forward: walk in through the MA PIZZA door
    c.objects.link(sp)
    names = {
        "Zone_SalesHall": (-1.9, 6.5), "Zone_CashDesk": (-5.9, 9.0), "Zone_PizzaCounter": (-6.3, 7.5),
        "Zone_Kitchen": (-10.5, 8.5), "Zone_Corridor": (-6.5, 11.7), "Zone_WC": (-5.15, 12.3),
        "Zone_Office": (-5.9, 15.0), "Door_North_Exit": (-2.0, 13.4),
    }
    for n, (x, y) in names.items():
        e = bpy.data.objects.new(n, None)
        e.empty_display_type = "PLAIN_AXES"
        e.empty_display_size = 0.4
        e.location = (x, y, 0.05)
        c.objects.link(e)
    return c


# =========================================================================== cameras / render
VIEWS = [
    # name, location, look-at, lens(mm, 36mm sensor), video time it reproduces
    ("CAM_01_Street", (-2.05, -2.6, 1.4), (-2.05, 6.0, 1.75), 14, "0.0 s  outside the MA PIZZA door"),
    ("CAM_02_Entry", (-2.0, -0.4, 1.45), (-1.4, 6.0, 1.3), 14, "2.2 s  stepping in, coffee counter left"),
    ("CAM_03_AisleNorth", (-1.95, 8.6, 1.5), (-1.95, 14.0, 1.4), 14, "11 s  coolers left, north door ahead"),
    ("CAM_04_AisleSouth", (-1.9, 11.8, 1.5), (-2.2, 2.0, 1.2), 14, "16.5 s looking back to the street door"),
    ("CAM_05_Counter", (-3.5, 8.6, 1.5), (-7.5, 10.4, 1.2), 14, "19 s  cash desk right, MAMA counter ahead"),
    ("CAM_06_Kitchen", (-7.6, 5.55, 1.5), (-13.6, 6.5, 1.5), 14, "23.5 s walking into the kitchen"),
    ("CAM_07_KitchenNorth", (-10.2, 8.0, 1.5), (-10.2, 13.0, 1.2), 14, "30.5 s north wall shelves"),
    ("CAM_08_Corridor", (-6.5, 9.9, 1.5), (-6.6, 16.0, 1.2), 14, "38 s  corridor: office ahead-left, WC right"),
    ("CAM_09_WC", (-6.25, 12.4, 1.5), (-4.0, 12.3, 0.85), 14, "41 s  WC"),
    ("CAM_10_Office", (-6.6, 13.1, 1.5), (-6.0, 17.5, 1.1), 14, "50.5 s office / storage"),
    ("CAM_11_KitchenToCounter", (-10.6, 8.2, 1.5), (-6.0, 9.6, 1.1), 14, "34 s  kitchen looking at the counter back"),
    ("CAM_12_CashFromStaffGap", (-7.6, 9.95, 1.5), (-3.8, 10.6, 1.2), 14, "36.5 s cash desk seen from the staff pass"),
]


def add_cameras(root):
    c = coll("09_Cameras_VideoMatch", root)
    cams = []
    for name, loc, tgt, lens, note in VIEWS:
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.sensor_width = 36
        cd.sensor_height = 36
        cd.sensor_fit = "VERTICAL"
        cd.clip_start = 0.05
        ob = bpy.data.objects.new(name, cd)
        ob.location = loc
        d = Vector(tgt) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        ob["video_time"] = note
        c.objects.link(ob)
        cams.append(ob)
    # orthographic top-down plan camera
    cd = bpy.data.cameras.new("CAM_Plan_Top")
    cd.type = "ORTHO"
    cd.ortho_scale = 19.5
    ob = bpy.data.objects.new("CAM_Plan_Top", cd)
    ob.location = (-6.8, 8.2, 30)
    c.objects.link(ob)
    cams.append(ob)
    bpy.context.scene.camera = cams[0]
    return cams


def setup_world():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("Night")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.004, 0.005, 0.008, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    try:
        sc.view_settings.view_transform = "AgX"
    except TypeError:
        sc.view_settings.view_transform = "Filmic"
    sc.view_settings.exposure = -0.4


def render_previews(out_dir, cams, samples=48, size=(540, 960)):
    import addon_utils
    try:
        addon_utils.enable("cycles", default_set=True)
    except Exception:
        pass
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.render.image_settings.file_format = "PNG"
    for cam in cams:
        sc.camera = cam
        if cam.data.type == "ORTHO":
            sc.render.resolution_x, sc.render.resolution_y = 1100, 1250
            hide = [o for o in bpy.data.objects if o.name.startswith(("Ceilings", "Hall_Ceiling", "Counter_Ceiling",
                                                                      "Kitchen_Ceiling", "Kitchen_Ducts", "Corridor_Light",
                                                                      "Kit_O01", "Hall_CCTV"))]
            for o in hide:
                o.hide_render = True
            sun = bpy.data.lights.new("PlanSun", "SUN")
            sun.energy = 3.0
            so = bpy.data.objects.new("PlanSun", sun)
            so.rotation_euler = (math.radians(20), math.radians(10), 0)
            sc.collection.objects.link(so)
        else:
            sc.render.resolution_x, sc.render.resolution_y = size
        sc.render.filepath = os.path.join(out_dir, cam.name + ".png")
        bpy.ops.render.render(write_still=True)
        if cam.data.type == "ORTHO":
            for o in hide:
                o.hide_render = False
            bpy.data.objects.remove(so)
        print("rendered", cam.name)


# =========================================================================== main
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_materials()
    setup_world()
    root = coll("MA_PIZZA_Store")
    a = build_architecture(root)
    storefront_south(a)
    storefront_north(a)
    kitchen_windows(a)
    office_window(a)
    build_hall(root)
    build_counter_zone(root)
    build_kitchen(root)
    build_back_of_house(root)
    build_office(root)
    build_signage_and_lights(root)
    build_markers(root)
    cams = add_cameras(root)
    return cams


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = argv[1:]
    opts = {"out": os.path.join(HERE, "ma_pizza_store.blend"), "glb": None, "fbx": None, "render": None, "samples": 48}
    i = 0
    while i < len(argv):
        k = argv[i].lstrip("-")
        if k in opts and i + 1 < len(argv):
            opts[k] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def main():
    opts = parse_args(sys.argv)
    cams = build()
    if opts["render"]:
        render_previews(opts["render"], cams, samples=int(opts["samples"]))
    bpy.context.scene.camera = cams[0]
    if opts["out"]:
        bpy.ops.file.pack_all()          # textures inside the .blend -> opens anywhere
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opts["out"]), compress=True)
        print("saved", opts["out"])
    if opts["glb"]:
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(opts["glb"]), export_format="GLB",
                                  export_apply=True, export_lights=False, export_cameras=False,
                                  export_extras=True, export_yup=True)
        print("exported", opts["glb"])
    if opts["fbx"]:
        bpy.ops.export_scene.fbx(filepath=os.path.abspath(opts["fbx"]), apply_unit_scale=True,
                                 object_types={"MESH", "EMPTY"}, path_mode="COPY", embed_textures=True)
        print("exported", opts["fbx"])


if __name__ == "__main__":
    main()
