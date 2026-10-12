"""Procedural Blender scene: the "MA PIZZA / МАРКЕТ МА ПІЦА" shop (non-residential premises No. 1106).

Run either way (Blender 4.2+ / 5.x):

    blender -b -P blender/build_store.py -- --out blender/ma_pizza_store.blend
    python  blender/build_store.py --out blender/ma_pizza_store.blend      # with the `bpy` wheel

Options:  --glb <path>  also export glTF binary for a game engine
          --fbx <path>  also export FBX
          --render <dir> render the video-matched preview cameras + top plan

Sources
    * Walls, openings, rooms and the ceiling height come from the BTI floor plan of
      premises No. 1106 (scale 1:100, 01.03.2024): 1106-1 hall 55.1 m2, 1106-2 hall
      (kitchen) 17.7 m2, 1106-3 room (office/storage) 5.3 m2, 1106-4 WC 1.8 m2, H = 3.46 m.
    * Owner's correction: the plan's door in the 3.04 m bay of the street facade is a
      window today.  The street entrance seen in the video is in the 3.02 m bay next to
      the east wall, in line with the main aisle and the north door.
    * Furniture and equipment are placed from the walkthrough video.  People are not modelled.

Coordinate system (metres, real scale, Z up):
    +X = east, +Y = north, origin = inside face of the east wall at the street facade.
    The street (MA PIZZA) facade is y = 0, the north door is at y = 10.66, the kitchen
    (1106-2) is the west part.  Player spawn: outside the street door, looking north.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures")

# =========================================================================== LAYOUT (BTI plan, metres)
H = 3.46                       # ceiling height (plan: H=3,46)
H_HALL = H_BACK = H
T_EXT = 0.32                   # east wall / facade piers
T_FAC = 0.30                   # facade wall depth
T_PART = 0.22                  # hall|kitchen partition, upper-left wall, office south wall

# 1106-1 sales hall
HALL_W = 6.32                  # 3.04 + 0.26 + 3.02 along the street facade
HALL_D = 10.66                 # along the east wall
X_PART = -HALL_W               # east face of the hall|kitchen partition
COL_X = (-3.32, -3.01)         # free-standing column on the centre-pier axis (wood-clad)
COL_Y = (2.03, 2.98)
# street facade (south), bays from east to west
BAY_B = (-2.96, -0.24)         # 2.72 opening: storefront with the MA PIZZA street door
BAY_A = (-6.16, -3.42)         # 2.74 opening: door in the plan, a window today
BAY_K = (-9.43, -6.82)         # kitchen window of 1106-2
PIER_C = (-3.42, -2.96)        # centre pier, stem (-3.32..-3.06) runs 0.56 m into the room
PIER_T = (-6.82, -6.16)        # T-pier at the partition
STEM_D = 0.56
STREET_DOOR = (-1.94, -1.04)   # door leaf inside BAY_B (left pane, door, right pane)
SILL = 0.85                    # window sill height (bay A, kitchen window)
# 1106-2 kitchen
KIT_X = (-9.68, -6.54)         # 3.14 inner
KIT_Y1 = 5.46
PART_X = (-6.54, -6.32)        # partition between hall and kitchen
PART_OPEN_Y = (STEM_D, 2.09)   # opening in the partition (dashed in the plan)
PART_PIER_Y = (2.65, 3.13)     # pier on the kitchen side of the partition
# upper part: corridor, WC 1106-4, office 1106-3
UPW_X = (-5.37, -5.15)         # upper-left wall, 1.17 east of the partition
COR_X = (-5.15, -4.31)
COR_Y = (KIT_Y1, 7.70)
WC_X = (-4.15, -2.77)          # 1.38 inner
WC_Y = (6.04, 7.70)            # 1.66 inner
WC_OUT = (-4.31, -2.60, 5.94)  # outer west face, outer east face, outer south face
SHAFT = (-3.30, -2.77, 7.19, 7.70)
OFF_X = (-5.15, -3.26)         # 1.89 inner
OFF_Y = (7.92, HALL_D)         # 2.74 inner
OFF_EAST_OUT = -2.93           # office east wall, 0.33 thick (plan: 0.33 / 3.00)
OFF_NICHE_Y = (9.12, 10.00)    # recess in the office east wall
OFF_DOOR_X = (-5.10, -4.30)    # 0.90 opening from the corridor
WC_DOOR_Y = (6.35, 7.05)
NORTH_OPEN = (-2.60, -0.24)    # north facade opening, door in the middle
NORTH_DOOR = (-1.90, -1.00)
NORTH_PIER = (-3.47, -2.60)    # thick pier between office window and north door
OFF_WIN_X = (-4.65, -3.89)

# Furniture zones derived from the video
COUNTER_X = (-5.35, -4.45)     # MAMA counter footprint, front faces east
COUNTER_Y = (2.25, 4.85)

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
    D, CH, EXT = "wall_dark", "chalk", "exterior"
    hall = [(0, 2.25, D, D), (2.25, H, CH, CH)]

    # ---------------------------------------------------------------- floors (no overlaps)
    FH, FK, FD = "floor_hall", "floor_kitchen", "floor_dark"
    floors.box(KIT_X[0], 0, -0.05, PART_X[1], KIT_Y1, 0, FK)                        # 1106-2 kitchen
    floors.box(X_PART, 0, -0.05, COL_X[0], COUNTER_Y[0], 0, FK)                     # kitchen part in front of bay A
    floors.box(X_PART, COUNTER_Y[0], -0.05, COUNTER_X[0], KIT_Y1, 0, FK)            # worker aisle behind the counter
    floors.box(COL_X[0], 0, -0.05, 0, COUNTER_Y[0], 0, FH)                          # hall, street end
    floors.box(COUNTER_X[0], COUNTER_Y[0], -0.05, 0, KIT_Y1, 0, FH)                 # hall + customers + cash desk
    floors.box(COR_X[1], KIT_Y1, -0.05, 0, WC_OUT[2], 0, FH)                        # cashier strip
    floors.box(WC_OUT[1], WC_OUT[2], -0.05, 0, COR_Y[1], 0, FH)                     # aisle beside the WC
    floors.box(OFF_EAST_OUT, COR_Y[1], -0.05, 0, HALL_D, 0, FH)                     # aisle beside the office
    floors.box(COR_X[0], KIT_Y1, -0.05, COR_X[1], COR_Y[1] + T_PART, 0, FD)         # corridor (+ door sill)
    floors.box(WC_X[0], WC_Y[0], -0.05, WC_X[1], WC_Y[1], 0, FD)                    # WC
    floors.box(OFF_X[0], OFF_Y[0], -0.05, OFF_X[1], OFF_Y[1], 0, FD)                # office
    floors.obj("Floor_Interior", c)

    g = MB()
    g.box(-11.0, -6.0, -0.06, 2.5, -T_FAC, -0.01, "paver")                          # street paving
    g.box(-6.0, HALL_D + 0.25, -0.06, 2.5, HALL_D + 4.0, -0.01, "paver")            # north side
    g.box(-30, -30, -0.1, 30, 30, -0.06, "asphalt")
    g.obj("Ground_Street", c)

    # ---------------------------------------------------------------- east wall (party wall), x = 0
    wall(walls, -T_FAC, HALL_D + 0.25, T_EXT / 2, "y", 0, H, T_EXT, D, EXT,
         bands=[(0, 2.25, D, EXT), (2.25, H, CH, EXT)])
    walls.box(0, HALL_D + 0.25, 0, T_EXT, HALL_D + 1.17, H, EXT)                    # fin past the north facade

    # ---------------------------------------------------------------- street facade, y = 0 (piers between the bays)
    for (x0, x1) in [(BAY_B[1], 0.0), PIER_C, PIER_T, (KIT_X[0] - 0.33, BAY_K[0])]:
        walls.box(x0, -T_FAC, 0, x1, 0, H, EXT, fmat={"yp": D})
    walls.box(-3.32, 0, 0, -3.06, STEM_D, H, D)                                       # centre pier stem
    walls.box(PART_X[0], 0, 0, PART_X[1], STEM_D, H, "wall_tile", fmat={"xp": D})     # T-pier stem
    for (x0, x1) in [BAY_A, BAY_K]:                                                   # masonry under the windows
        walls.box(x0, -T_FAC, 0, x1, -0.05, SILL - 0.05, EXT, fmat={"yp": "anthracite"})
    walls.box(BAY_B[0], -T_FAC, 3.2, BAY_B[1], 0, H, EXT, fmat={"yp": D})             # head over the storefront
    for (x0, x1) in [BAY_A, BAY_K]:
        walls.box(x0, -T_FAC, 3.2, x1, 0, H, EXT, fmat={"yp": D})

    # ---------------------------------------------------------------- 1106-2 kitchen shell
    wall(walls, -T_FAC, KIT_Y1 + T_PART, KIT_X[0] - 0.165, "y", 0, H, 0.33, EXT, "wall_tile",
         bands=[(0, 1.6, EXT, "wall_tile"), (1.6, H, EXT, "wall_grey")])                # west wall
    wall(walls, KIT_X[0] - 0.33, UPW_X[1], KIT_Y1 + T_PART / 2, "x", 0, H, T_PART, "wall_tile", EXT,
         bands=[(0, 1.6, "wall_tile", EXT), (1.6, H, "wall_grey", EXT)])                # north wall
    # partition hall|kitchen: solid above the opening, lintel over the opening, pier on the kitchen side
    wall(walls, PART_OPEN_Y[1], KIT_Y1, (PART_X[0] + PART_X[1]) / 2, "y", 0, H, T_PART, "wall_tile", "wall_tile",
         bands=[(0, 1.6, "wall_tile", "wall_tile"), (1.6, 2.2, "wall_grey", "wall_tile"), (2.2, H, "wall_grey", "wall_grey")])
    walls.box(PART_X[0], PART_OPEN_Y[0], 2.7, PART_X[1], PART_OPEN_Y[1], H, "wall_grey")
    walls.box(-6.97, PART_PIER_Y[0], 0, PART_X[0], PART_PIER_Y[1], H, "wall_tile", fmat={"zp": "wall_grey"})

    # ---------------------------------------------------------------- corridor / WC / office block
    wall(walls, KIT_Y1, HALL_D + 0.25, (UPW_X[0] + UPW_X[1]) / 2, "y", 0, H, T_PART, EXT, "wall_grey",
         bands=[(0, H, EXT, "wall_grey")])                                             # upper-left wall
    # office south wall (corridor/WC | office), door 0.90 at the corridor end
    yS = (COR_Y[1] + OFF_Y[0]) / 2
    wall(walls, COR_X[0], WC_X[0], yS, "x", 0, H, OFF_Y[0] - COR_Y[1], "wall_grey", "wall_light",
         openings=[(OFF_DOOR_X[0], OFF_DOOR_X[1], 0, 2.05)])
    wall(walls, WC_X[0], OFF_EAST_OUT, yS, "x", 0, H, OFF_Y[0] - COR_Y[1], "wall_tile", "wall_light",
         bands=[(0, 1.5, "wall_tile", "wall_light"), (1.5, H, "wall_light", "wall_light")])
    # office east wall (0.33) with the recess, hall face dark + chalk
    for (y0, y1, xin) in [(COR_Y[1], OFF_NICHE_Y[0], OFF_X[1]), (OFF_NICHE_Y[0], OFF_NICHE_Y[1], -3.08),
                          (OFF_NICHE_Y[1], HALL_D, OFF_X[1])]:
        walls.box(xin, y0, 0, OFF_EAST_OUT, y1, 2.25, "wall_light", fmat={"xp": D})
        walls.box(xin, y0, 2.25, OFF_EAST_OUT, y1, H, "wall_light", fmat={"xp": CH})
    # WC walls
    wall(walls, WC_OUT[2], COR_Y[1], (WC_OUT[0] + WC_X[0]) / 2, "y", 0, H, WC_X[0] - WC_OUT[0], "wall_grey", "wall_tile",
         openings=[(WC_DOOR_Y[0], WC_DOOR_Y[1], 0, 2.05)],
         bands=[(0, 1.5, "wall_grey", "wall_tile"), (1.5, H, "wall_grey", "wall_light")])
    wall(walls, WC_OUT[0], WC_OUT[1], (WC_OUT[2] + WC_Y[0]) / 2, "x", 0, H, WC_Y[0] - WC_OUT[2], D, "wall_tile",
         bands=[(0, 1.5, D, "wall_tile"), (1.5, 2.25, D, "wall_light"), (2.25, H, CH, "wall_light")])
    wall(walls, WC_OUT[2], COR_Y[1], (WC_X[1] + WC_OUT[1]) / 2, "y", 0, H, WC_OUT[1] - WC_X[1], "wall_tile", D,
         bands=[(0, 1.5, "wall_tile", D), (1.5, 2.25, "wall_light", D), (2.25, H, "wall_light", CH)])
    walls.box(SHAFT[0], SHAFT[2], 0, SHAFT[1], SHAFT[3], H, "wall_tile", fmat={"zp": "wall_light"})
    # MAMA cladding + granite ledge at the corridor entrance (seen on the left when entering)
    walls.box(COR_X[0], KIT_Y1, 0.08, COR_X[0] + 0.03, 6.65, 0.95, "mama_panel")
    walls.box(COR_X[0], KIT_Y1, 0.95, COR_X[0] + 0.12, 6.65, 1.0, "granite")

    # ---------------------------------------------------------------- north facade, y = HALL_D
    yN = HALL_D + 0.125
    wall(walls, UPW_X[0], NORTH_PIER[0], yN, "x", 0, H, 0.25, "wall_light", EXT,
         openings=[(OFF_WIN_X[0], OFF_WIN_X[1], 0.9, 2.6)])
    walls.box(NORTH_PIER[0], HALL_D, 0, NORTH_PIER[1], HALL_D + 1.14, H, EXT, fmat={"yn": D})
    walls.box(NORTH_OPEN[1], HALL_D, 0, 0, HALL_D + 0.25, H, EXT, fmat={"yn": D})
    walls.box(NORTH_OPEN[0], HALL_D + 0.2, 3.2, NORTH_OPEN[1], HALL_D + 0.25, H, "frame_white")
    walls.obj("Walls", c)

    # exterior band above the ceiling (upper storeys start here) - hidden in the plan render
    up = MB()
    up.box(KIT_X[0] - 0.33, -T_FAC - 0.05, H, T_EXT, -0.0, H + 0.9, "fascia")
    up.box(UPW_X[0], HALL_D, H, T_EXT, HALL_D + 0.25, H + 0.9, EXT)
    up.box(-2.96, -T_FAC - 0.12, H - 0.02, -0.24, -T_FAC - 0.06, H, "led_green")      # glow strip (first frame)
    up.obj("Facade_Upper", c)

    # ---------------------------------------------------------------- ceiling
    ceil.box(X_PART, 0, H, T_EXT, HALL_D + 0.25, H + 0.1, "ceiling")
    ceil.box(KIT_X[0] - 0.33, 0, H, X_PART, KIT_Y1 + T_PART, H + 0.1, "ceiling")
    ceil.obj("Ceilings", c)

    storefront_street(c)
    windows_street(c)
    storefront_north(c)
    office_window(c)
    return c


def two_tone_bar(mb, x0, x1, z0, z1, y=0.0):
    """Facade profile: anthracite outside (-Y), white inside (+Y)."""
    mb.box(x0, y - 0.07, z0, x1, y, z1, "frame_black")
    mb.box(x0, y, z0, x1, y + 0.05, z1, "frame_white")


def storefront_street(c):
    """Bay 3.02 / 2.72: left pane, door, right pane, transom with the MA PIZZA sign."""
    mb = MB()
    x0, x1 = BAY_B
    d0, d1 = STREET_DOOR
    for x in (x0 + 0.04, d0 - 0.04, d1 + 0.04, x1 - 0.04):
        two_tone_bar(mb, x - 0.04, x + 0.04, 0, 3.2)
    two_tone_bar(mb, x0, x1, 2.26, 2.34)
    two_tone_bar(mb, x0, x1, 3.12, 3.2)
    two_tone_bar(mb, x0, d0 - 0.08, 0, 0.08)
    two_tone_bar(mb, d1 + 0.08, x1, 0, 0.08)
    for (a, b, z0, z1) in [(x0 + 0.08, d0 - 0.08, 0.08, 2.26), (d1 + 0.08, x1 - 0.08, 0.08, 2.26),
                           (x0 + 0.08, x1 - 0.08, 2.34, 3.12)]:
        mb.box(a, -0.01, z0, b, 0.01, z1, "glass")
    mb.obj("Facade_Street_Storefront", c)
    d = MB()   # door leaf, hinge on the east jamb, opens outwards (as in the video)
    w, h = d1 - d0, 2.24
    d.box(-w, -0.06, 0, 0, 0, 0.1, "frame_black")
    d.box(-w, -0.06, h - 0.1, 0, 0, h, "frame_black")
    d.box(-w, -0.06, 0, -w + 0.09, 0, h, "frame_black")
    d.box(-0.09, -0.06, 0, 0, 0, h, "frame_black")
    d.box(-w + 0.09, -0.035, 0.1, -0.09, -0.025, h - 0.1, "glass")
    d.box(-w + 0.12, -0.18, 0.75, -w + 0.15, -0.06, 1.35, "chrome")
    d.box(-w + 0.12, 0.0, 0.95, -w + 0.15, 0.08, 1.15, "chrome")
    door = d.obj("Door_Street_MA_PIZZA", c, loc=(d1, 0.0, 0.0))
    door["hinge"] = "east jamb, swings outwards (towards -Y)"
    s = MB()
    s.plane_y(x0 + 0.12, x1 - 0.12, 0.08, 2.43, 2.43 + (x1 - x0 - 0.24) * 320 / 1536, "sign_ma_pizza", facing=-1)
    s.obj("Sign_MA_PIZZA", c)


def windows_street(c):
    """Bay 3.04 / 2.74 (former door, now a 3-pane window) and the kitchen window of 1106-2."""
    for name, (x0, x1) in [("Window_Street_Bay_3_04", BAY_A), ("Window_Street_Kitchen", BAY_K)]:
        mb = MB()
        step = (x1 - x0) / 3
        for k in range(4):
            x = x0 + k * step
            two_tone_bar(mb, x - 0.04 if k else x, x + 0.04 if k < 3 else x, SILL, 3.2)
        for z in (SILL, 2.4, 3.2):
            two_tone_bar(mb, x0, x1, z - 0.04, z + 0.04)
        mb.box(x0, -0.01, SILL, x1, 0.01, 3.2, "glass")
        mb.box(x0, 0.0, SILL - 0.05, x1, 0.22, SILL, "white_plastic")                 # inner sill board
        mb.obj(name, c)


def storefront_north(c):
    """North opening 3.00: white PVC door with fixed panes, neon 'МАРКЕТ МА ПІЦА' on the transom."""
    mb = MB()
    y = HALL_D + 0.12
    x0, x1 = NORTH_OPEN
    d0, d1 = NORTH_DOOR
    for x in (x0 + 0.04, d0 - 0.04, d1 + 0.04, x1 - 0.04):
        mb.box(x - 0.04, y, 0, x + 0.04, y + 0.12, 3.2, "frame_white")
    for z in (2.31, 3.16):
        mb.box(x0, y, z - 0.04, x1, y + 0.12, z + 0.04, "frame_white")
    mb.box(x0, y, 0, d0 - 0.08, y + 0.12, 0.08, "frame_white")
    mb.box(d1 + 0.08, y, 0, x1, y + 0.12, 0.08, "frame_white")
    mb.box(x0 + 0.08, y + 0.05, 0.08, d0 - 0.08, y + 0.07, 2.27, "glass")
    mb.box(d1 + 0.08, y + 0.05, 0.08, x1 - 0.08, y + 0.07, 2.27, "glass")
    mb.box(x0 + 0.08, y + 0.05, 2.35, x1 - 0.08, y + 0.07, 3.12, "glass")
    mb.obj("Facade_North_Door_Frame", c)
    d = MB()
    w, h = d1 - d0 - 0.04, 2.22
    d.box(0, 0, 0, w, 0.07, 0.12, "frame_white")
    d.box(0, 0, h - 0.1, w, 0.07, h, "frame_white")
    d.box(0, 0, 0, 0.1, 0.07, h, "frame_white")
    d.box(w - 0.1, 0, 0, w, 0.07, h, "frame_white")
    d.box(0.1, 0.03, 0.12, w - 0.1, 0.04, h - 0.1, "glass")
    d.box(w - 0.2, -0.06, 1.0, w - 0.16, 0.0, 1.1, "chrome")
    d.box(w - 0.35, -0.02, 2.05, w - 0.05, 0.0, 2.12, "steel_dark")                  # door closer
    door = d.obj("Door_North_Market", c, loc=(d0 + 0.02, y + 0.03, 0.0))
    door["hinge"] = "west jamb"
    n = MB()
    n.plane_y(x0 + 0.06, x1 - 0.06, y + 0.02, 2.45, 2.45 + (x1 - x0 - 0.12) * 320 / 2048, "neon_market", facing=+1)
    n.obj("Sign_Neon_MARKET_MA_PIZZA", c)
    e = MB()
    e.box((d0 + d1) / 2 - 0.15, y - 0.05, 2.4, (d0 + d1) / 2 + 0.15, y, 2.53, "exit_sign")
    e.obj("Exit_Sign_North", c)


def office_window(c):
    mb = MB()
    y = HALL_D + 0.125
    x0, x1 = OFF_WIN_X
    for xx in (x0, x1):
        mb.box(xx - 0.03, y - 0.06, 0.9, xx + 0.03, y + 0.06, 2.6, "frame_white")
    for zz in (0.9, 2.6):
        mb.box(x0, y - 0.06, zz - 0.03, x1, y + 0.06, zz + 0.03, "frame_white")
    mb.box(x0 + 0.03, y - 0.01, 0.93, x1 - 0.03, y + 0.01, 2.57, "glass")
    mb.plane_y(x0 + 0.03, x1 - 0.03, y - 0.02, 0.93, 2.57, "window_print", facing=-1)
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
def led_lines(name, c, segs, z=H):
    """Ceiling LED profiles: segs = [(x0, y0, x1, y1), ...] (axis aligned, 6 cm wide)."""
    mb = MB()
    for (x0, y0, x1, y1) in segs:
        if abs(x1 - x0) < 1e-6:
            mb.box(x0 - 0.03, y0, z - 0.04, x0 + 0.03, y1, z, "led")
        else:
            mb.box(x0, y0 - 0.03, z - 0.04, x1, y0 + 0.03, z, "led")
    return mb.obj(name, c)


def build_hall(root):
    c = coll("02_Sales_Hall", root)
    # ---- east wall, from the street door to the north door
    glass_fridge("Hall_E01_BeerCooler_Black_1", c, 0.7, (-0.38, 0.6, 0), "W", prod="prod_drinks")
    glass_fridge("Hall_E02_BeerCooler_Black_2", c, 0.7, (-0.38, 1.31, 0), "W", prod="prod_drinks")
    shelving("Hall_E03_GreenPromoRack", c, 0.85, 0.5, 1.8, [0.45, 0.8, 1.15, 1.5], "prod_snacks", (-0.25, 2.12, 0), "W",
             frame="green_rack")
    m = MB()   # MA PIZZA A-frame floor stand in front of the green rack
    m.box(-0.3, -0.02, 0.0, 0.3, 0.02, 1.0, "white_plastic", fmat={"yn": "sign_ma_pizza"}, fit={"yn": (1, 1)})
    m.obj("Hall_E03b_FloorStand_MA", c, loc=(-0.72, 2.45, 0), rot_z=math.radians(-70))
    for i in range(3):
        multideck(f"Hall_E{4 + i:02d}_Multideck_{i + 1}", c, 1.5, (-0.475, 3.35 + i * 1.5, 0), "W",
                  prod="prod_dairy" if i < 2 else "prod_grocery")
    for i in range(2):
        shelving(f"Hall_E{7 + i:02d}_SnackWall_{i + 1}", c, 1.35, 0.45, 2.2, [0.5, 0.85, 1.2, 1.55, 1.9], "prod_snacks",
                 (-0.225, 7.825 + i * 1.35, 0), "W", top_prod="prod_snacks")
    fz = MB()   # ice-cream chest freezer in front of the north door's right pane
    fz.box(-0.5, -0.32, 0.0, 0.5, 0.32, 0.82, "teal")
    fz.box(-0.48, -0.3, 0.82, 0.48, 0.3, 0.86, "glass")
    fz.box(-0.5, -0.32, 0.86, 0.5, -0.28, 0.9, "steel_dark")
    fz.box(-0.5, 0.28, 0.86, 0.5, 0.32, 0.9, "steel_dark")
    fz.obj("Hall_E09_IceCreamFreezer", c, loc=(-0.8, 10.3, 0), rot_z=FACING["S"])
    w = MB()
    for (x, y, n) in [(-2.0, 10.45, 3)]:
        for k in range(n):
            w.box(x - 0.18, y - 0.13, k * 0.33, x + 0.18, y + 0.13, k * 0.33 + 0.32, "water")
    w.obj("Hall_E10_WaterPacks", c)
    cr = MB()   # chip clip-strip rack (red wire base, yellow header)
    cr.box(-0.25, -0.2, 0.0, 0.25, 0.2, 0.03, "red_paint")
    for sx in (-0.24, 0.22):
        cr.box(sx, -0.02, 0.03, sx + 0.02, 0.02, 1.75, "red_paint")
    cr.box(-0.22, -0.03, 0.15, 0.22, 0.03, 1.55, "black_plastic", fmat={"yn": "prod_snacks", "yp": "prod_snacks"},
           fit={"yn": (0.6, 1.0), "yp": (0.6, 1.0)})
    cr.box(-0.22, -0.03, 1.55, 0.22, 0.03, 1.85, "chips_header", fit={"yn": (1, 1), "yp": (1, 1)})
    cr.obj("Hall_E11_ChipsRack", c, loc=(-0.78, 9.6, 0))

    # ---- west side of the aisle, from the street door to the north door
    # tall wooden bread shelving between the centre-pier stem and the column (solid back to the kitchen)
    shelving("Hall_W01_BakeryWood", c, COL_Y[0] - STEM_D, 0.36, 2.2, [0.45, 0.85, 1.25, 1.65], "prod_bakery",
             (-3.18, (STEM_D + COL_Y[0]) / 2, 0), "E", frame="wood_oak", wood_shelves=True, top_prod="prod_bakery")
    # wooden coffee / pizza order counter with the helmet, right next to the street door
    hc = MB()
    L = 0.85
    hc.box(-L / 2, -0.3, 0.0, L / 2, 0.3, 1.0, "wood_oak")
    hc.box(-L / 2 + 0.06, -0.31, 0.12, L / 2 - 0.06, -0.3, 0.88, "black_plastic")
    hc.box(-L / 2 - 0.02, -0.32, 1.0, L / 2 + 0.02, 0.32, 1.04, "wood_oak")
    hc.box(-0.38, -0.05, 1.04, -0.05, 0.25, 1.45, "black_plastic")                   # coffee machine
    hc.box(-0.35, -0.06, 1.25, -0.08, -0.05, 1.4, "steel")
    hc.cyl(0.12, 0.12, 1.04, 1.3, 0.04, "white_plastic", seg=12)                     # cup stacks
    hc.cyl(0.24, 0.14, 1.04, 1.36, 0.045, "white_plastic", seg=12)
    hc.box(0.15, -0.2, 1.04, 0.33, -0.05, 1.12, "black_plastic")                    # card terminal
    hc.box(-0.42, 0.24, 1.04, 0.2, 0.26, 2.15, "menu_board", fit={"yn": (1, 1)}, fmat={"yp": "black_plastic"})
    hc.obj("Hall_W02_CoffeeCounter", c, loc=(-2.7, 1.0, 0), rot_z=FACING["E"])
    hel = bpy.data.meshes.new("Helmet")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.16)
    bm.to_mesh(hel)
    bm.free()
    hel.materials.append(MATS["helmet"])
    ho = bpy.data.objects.new("Hall_W02b_Helmet", hel)
    ho.location = (-2.62, 0.78, 1.2)
    ho.scale = (1.0, 1.15, 0.95)
    c.objects.link(ho)
    # free-standing column of the plan, clad in wood, with the oils / jars shelf on its aisle side
    col = MB()
    col.box(COL_X[0] - 0.02, COL_Y[0] - 0.02, 0, COL_X[1] + 0.02, COL_Y[1] + 0.02, H, "wood_oak")
    col.obj("Hall_W03_Column_Wood", c)
    shelving("Hall_W04_OilsJars_OnColumn", c, COL_Y[1] - COL_Y[0], 0.45, 2.0, [0.45, 0.8, 1.15, 1.5, 1.8],
             "prod_grocery", (COL_X[1] + 0.245, (COL_Y[0] + COL_Y[1]) / 2, 0), "E", top_prod="prod_grocery")
    # chocolate gondola on the WC's outer wall, 4 drink coolers on the office's outer wall
    shelving("Hall_W05_Chocolate", c, COR_Y[1] - WC_OUT[2] - 0.06, 0.5, 1.75, [0.4, 0.7, 1.0, 1.3], "prod_choco",
             (WC_OUT[1] + 0.25, (WC_OUT[2] + COR_Y[1]) / 2, 0), "E", top_prod="prod_choco")
    specs = [("frame_black", "header_green", "led_green"), ("red_paint", "header_red", None),
             ("frame_black", "black_plastic", "led_green"), ("frame_black", "black_plastic", None)]
    for i, (fr, hd, led) in enumerate(specs):
        glass_fridge(f"Hall_W{6 + i:02d}_DrinkCooler_{i + 1}", c, 0.7, (OFF_EAST_OUT + 0.375, 8.17 + i * 0.7, 0), "E",
                     frame=fr, header=hd, led=led)
    led_lines("LED_Hall", c, [(-1.6, 0.5, -1.6, 3.8), (-1.6, 3.95, -1.6, 7.2), (-1.6, 7.35, -1.6, 10.3),
                              (-2.6, 1.6, -1.9, 1.6), (-2.6, 5.4, -1.9, 5.4), (-2.6, 9.2, -1.9, 9.2)])
    cam = MB()
    cam.cyl(-1.45, 10.35, H - 0.12, H, 0.07, "white_plastic", seg=12)
    cam.obj("Hall_CCTV_Dome", c)
    return c


def build_counter_zone(root):
    c = coll("03_CashDesk_PizzaCounter", root)
    cx = (COUNTER_X[0] + COUNTER_X[1]) / 2
    cy = (COUNTER_Y[0] + COUNTER_Y[1]) / 2
    counter_mama("Counter_MAMA_Pizza", c, COUNTER_Y[1] - COUNTER_Y[0], (cx, cy, 0), "E")
    # black cash desk along the WC wall, candy rack on its east end facing the aisle
    cd = MB()
    x0, x1, y0, y1 = -4.25, -3.2, 4.4, 5.0
    cd.box(x0, y0, 0.0, x1, y1, 0.92, "black_plastic")
    cd.box(x0 - 0.03, y0 - 0.03, 0.92, x1 + 0.03, y1 + 0.03, 0.96, "black_plastic")
    for k in range(2):                                                                 # drawers, cashier side
        cd.box(x0 + 0.08 + k * 0.5, y1, 0.62, x0 + 0.45 + k * 0.5, y1 + 0.01, 0.86, "anthracite")
    cd.box(-3.95, 4.6, 0.96, -3.6, 4.8, 1.0, "black_plastic")                        # POS stand
    cd.box(-3.9, 4.75, 1.0, -3.65, 4.77, 1.3, "black_plastic")
    cd.box(-3.92, 4.775, 1.05, -3.63, 4.785, 1.3, "screen_pos", fit={"yp": (1, 1)}, faces=("yp",))
    cd.box(-4.2, 4.5, 0.96, -3.95, 4.8, 1.02, "steel")                               # scale
    cd.box(-3.5, 4.45, 0.96, -3.38, 4.57, 1.06, "black_plastic")                     # card terminal
    cd.box(x1, y0 + 0.02, 0.0, x1 + 0.32, y1 - 0.02, 0.95, "shelf_dark")              # candy rack
    for z in (0.12, 0.42, 0.72):
        cd.box(x1 + 0.02, y0 + 0.04, z, x1 + 0.33, y1 - 0.04, z + 0.24, "prod_side",
               fmat={"xp": "prod_candy"}, fit={"xp": (0.6, 1.0)})
    cd.obj("CashDesk", c)
    # snack shelves + CCTV monitors on the WC's outer wall behind the cashier
    shelving("Cash_SnackShelf", c, 1.2, 0.34, 2.0, [0.5, 0.85, 1.2, 1.55], "prod_snacks", (-3.25, WC_OUT[2] - 0.17, 0), "S",
             top_prod="prod_choco")
    tv = MB()
    for xm in (-3.55, -2.95):
        tv.box(xm - 0.3, WC_OUT[2] - 0.06, 2.2, xm + 0.3, WC_OUT[2], 2.6, "black_plastic",
               fmat={"yn": "screen_cctv"}, fit={"yn": (1, 1)})
    tv.obj("Cash_CCTV_Monitors", c)
    # grey drinks rack at the corridor entrance (right side) + paper menus on top
    shelving("Cash_DrinksRack", c, 0.85, 0.45, 1.35, [0.35, 0.7, 1.05], "prod_drinks", (-4.075, 5.45, 0), "W",
             frame="shelf_grey")
    pm = MB()
    pm.box(-0.15, -0.2, 1.35, 0.15, 0.1, 1.75, "menu_board", fit={"xn": (1, 1)})
    pm.obj("Cash_PaperMenus", c, loc=(-4.05, 5.3, 0))
    ch = MB()   # staff folding chair
    ch.box(-0.22, -0.2, 0.44, 0.22, 0.2, 0.47, "steel_dark")
    ch.box(-0.22, 0.17, 0.47, 0.22, 0.2, 0.9, "steel_dark")
    for sx in (-0.21, 0.19):
        ch.box(sx, -0.2, 0.0, sx + 0.02, -0.18, 0.46, "chrome")
        ch.box(sx, 0.18, 0.0, sx + 0.02, 0.2, 0.9, "chrome")
    ch.obj("Cash_FoldingChair", c, loc=(-4.75, 5.12, 0), rot_z=math.radians(-60))
    ms = MB()   # menu screen above the counter's north end
    ms.box(-0.04, -0.3, 2.62, 0.0, 0.3, 2.97, "black_plastic", fmat={"xp": "screen_laptop"}, fit={"xp": (1, 1)})
    ms.box(-0.03, -0.01, 2.97, -0.01, 0.01, H, "black_plastic")
    ms.obj("Counter_MenuScreen", c, loc=(COUNTER_X[1] + 0.05, 4.55, 0))
    led_lines("LED_Counter", c, [(-3.9, 2.4, -3.9, 4.3), (-4.6, 5.25, -2.9, 5.25), (-5.9, 2.6, -5.9, 4.6)])
    du = MB()   # exposed ducts over the counter and the kitchen
    du.cyl_y(0.3, KIT_Y1 - 0.2, -5.8, 3.15, 0.16, "steel_dark", seg=16)
    du.cyl_x(KIT_X[0] + 0.2, -5.8, 1.6, 3.2, 0.12, "steel_dark", seg=16)
    du.obj("Kitchen_Ducts", c)
    return c


def build_kitchen(root):
    c = coll("04_Kitchen", root)
    # ---------------- kitchen front part (hall south-west, behind the bread shelving, window bay 3.04)
    ps = MB()   # pizza box stacks in a wood/white frame against the bread shelving's back
    fx0, fx1, fy0, fy1 = -3.9, -3.36, STEM_D + 0.05, COL_Y[0] - 0.02
    for px in (fx0, fx1 - 0.04):
        for py in (fy0, fy1 - 0.04):
            ps.box(px, py, 0, px + 0.04, py + 0.04, H, "wood_oak")
    for pz in (0.0, 1.45, 2.95):
        ps.box(fx0, fy0, pz, fx0 + 0.04, fy1, pz + 0.05, "frame_white")
    for k, (y0, y1) in enumerate([(fy0 + 0.05, fy0 + 0.5), (fy0 + 0.52, fy0 + 0.97), (fy0 + 0.99, fy1 - 0.05)]):
        pizza_stack(ps, fx0 + 0.06, y0, fx1 - 0.04, y1, 0.0, 2.6 + 0.15 * k)
    ps.obj("Kit_F01_PizzaBoxStacks", c)
    steel_table("Kit_F02_Table_Window", c, 1.2, 0.65, (-4.6, 0.38, 0), "N", items="prod_kitchen")
    shelving("Kit_F03_MetalShelving_Window", c, 0.9, 0.45, 1.8, [0.4, 0.8, 1.2, 1.6], "prod_kitchen", (-5.7, 0.28, 0), "N",
             frame="steel", back=False, top_prod="prod_kitchen")
    bin_round("Kit_F04_Bin", c, -6.0, 0.85)
    # worker aisle behind the MAMA counter: white tiles + recipe sheets + steel shelves on the partition
    wk = MB()
    wk.plane_x(PART_X[1] + 0.005, 2.6, 4.4, 1.3, 1.9, "kitchen_papers", facing=+1)
    for z in (2.05, 2.45):
        wk.box(PART_X[1], 2.4, z - 0.03, PART_X[1] + 0.32, 4.6, z, "steel")
        wk.box(PART_X[1] + 0.03, 2.5, z, PART_X[1] + 0.3, 4.5, z + 0.25, "prod_side", fmat={"xp": "prod_kitchen"},
               fit={"xp": (2.0, 1)})
    wk.obj("Kit_F05_WorkerAisle_Papers_Shelves", c)
    led_lines("LED_KitchenFront", c, [(-6.1, 1.25, -3.6, 1.25)])

    # ---------------- 1106-2 kitchen
    kx0, kx1 = KIT_X
    steel_table("Kit_K01_Table_Window_1", c, 1.2, 0.7, (-8.85, 0.4, 0), "N", items="prod_kitchen")
    steel_table("Kit_K02_Table_Window_2", c, 1.2, 0.7, (-7.6, 0.4, 0), "N", items="prod_kitchen")
    bb = MB()
    bb.box(-9.42, 0.08, 0.9, -7.03, 0.72, 0.92, "blue_board")
    bb.box(-8.2, 0.25, 0.92, -7.9, 0.55, 1.0, "steel")                               # scale
    bb.obj("Kit_K03_BlueBoards_Scale", c)
    rc = MB()   # rice cooker on a small steel stand, white panel leaning on the wall
    rc.box(kx0 + 0.02, 0.95, 0, kx0 + 0.52, 1.5, 0.85, "steel")
    rc.cyl(kx0 + 0.27, 1.22, 0.85, 1.2, 0.17, "steel", seg=20)
    rc.cyl(kx0 + 0.27, 1.22, 1.2, 1.25, 0.12, "black_plastic", seg=16)
    rc.box(kx0 + 0.02, 1.6, 0, kx0 + 0.04, 1.95, 2.15, "white_plastic")
    rc.obj("Kit_K04_RiceCooker_WhitePanel", c)
    glass_fridge("Kit_K05_RedCooler_Double", c, 1.15, (kx0 + 0.35, 2.62, 0), "E", frame="red_paint", header="header_mama",
                 prod="prod_kitchen", D=0.7, doors=2)
    glass_fridge("Kit_K06_RedCooler_Single", c, 0.7, (kx0 + 0.35, 3.57, 0), "E", frame="red_paint", header="header_mama",
                 prod="prod_kitchen", D=0.7)
    fe = MB()
    fe.cyl(kx0 + 0.15, 4.02, 0.0, 0.5, 0.08, "red_paint", seg=12)
    fe.obj("Kit_K07_FireExtinguisher", c)
    shelving("Kit_K08_TallSteelRack", c, 0.7, 0.5, 2.0, [0.4, 0.8, 1.2, 1.6], "prod_kitchen", (kx0 + 0.25, 4.4, 0), "E",
             frame="steel", back=False, top_prod="prod_kitchen")
    steel_table("Kit_K09_Table_North", c, 1.2, 0.7, (-8.95, KIT_Y1 - 0.35, 0), "S", items="prod_kitchen", splash=True)
    sh = MB()   # wall shelves + knife magnets on the north wall
    wall_shelf(sh, kx0 + 0.05, -7.3, KIT_Y1, 0.35, 1.7, sign=-1)
    wall_shelf(sh, kx0 + 0.05, -7.3, KIT_Y1, 0.35, 2.1, sign=-1)
    for x in (-9.3, -8.7):
        sh.box(x, KIT_Y1 - 0.03, 1.25, x + 0.35, KIT_Y1, 1.3, "black_plastic")
        for k in range(3):
            sh.box(x + 0.05 + k * 0.1, KIT_Y1 - 0.045, 1.0, x + 0.08 + k * 0.1, KIT_Y1 - 0.03, 1.3, "chrome")
    sh.box(-9.45, 5.05, 0.9, -9.1, 5.35, 1.05, "wood_oak")                            # wooden bowl
    sh.cyl(-8.55, 5.15, 0.9, 1.15, 0.13, "steel", seg=16)                              # second rice cooker
    sh.obj("Kit_K10_WallShelves_Knives", c)
    mx = MB()   # spiral dough mixer on a white stand + white dough trays
    mx.box(-0.3, -0.3, 0.0, 0.3, 0.3, 0.55, "white_plastic")
    mx.cyl(0.0, -0.05, 0.55, 0.9, 0.3, "steel", seg=24, caps=False)
    mx.cyl(0.0, -0.05, 0.55, 0.57, 0.3, "steel", seg=24)
    mx.box(-0.15, 0.2, 0.55, 0.15, 0.4, 1.25, "white_plastic")
    mx.box(-0.15, -0.1, 1.05, 0.15, 0.4, 1.25, "white_plastic")
    mx.obj("Kit_K11_DoughMixer", c, loc=(-7.98, 5.05, 0), rot_z=FACING["S"])
    tr = MB()
    for k in range(9):
        tr.box(-7.62, 4.98, 0.05 + k * 0.17, -7.18, 5.4, 0.2 + k * 0.17, "white_plastic")
    tr.obj("Kit_K12_DoughTrayStack", c)
    sk = MB()   # double sink + hand sink along the partition, electric water boiler above (north-east corner)
    sx = PART_X[0]
    sk.box(sx - 0.55, 4.25, 0, sx, KIT_Y1 - 0.02, 0.85, "steel")
    sk.box(sx - 0.5, 4.32, 0.85, sx - 0.05, 4.82, 0.9, "steel_dark")
    sk.box(sx - 0.5, 4.88, 0.85, sx - 0.05, 5.38, 0.9, "steel_dark")
    for y in (4.57, 5.13):
        sk.box(sx - 0.05, y - 0.02, 0.9, sx, y + 0.02, 1.25, "chrome")
        sk.box(sx - 0.25, y - 0.02, 1.21, sx, y + 0.02, 1.25, "chrome")
    sk.cyl(sx - 0.24, 4.8, 1.85, 2.6, 0.22, "white_plastic", seg=20)
    sk.obj("Kit_K13_Sinks_Boiler", c)
    # double-deck pizza oven against the partition, north of the pier, hood above
    ov = MB()
    ov.box(-0.5, -0.45, 0.0, 0.5, 0.45, 0.85, "steel")
    ov.box(-0.48, -0.43, 0.25, 0.48, 0.43, 0.28, "steel")
    for k in range(2):
        z0 = 0.88 + k * 0.42
        ov.box(-0.5, -0.45, z0, 0.5, 0.45, z0 + 0.4, "steel")
        ov.box(-0.38, -0.46, z0 + 0.1, 0.38, -0.45, z0 + 0.3, "black_plastic")
        ov.box(-0.3, -0.5, z0 + 0.33, 0.3, -0.46, z0 + 0.36, "black_plastic")
        ov.box(0.35, -0.46, z0 + 0.12, 0.45, -0.45, z0 + 0.3, "steel_dark")
    ov.box(-0.65, -0.65, 2.25, 0.65, 0.5, 2.65, "steel")
    ov.box(-0.15, -0.1, 2.65, 0.15, 0.2, H, "steel_dark")
    ov.obj("Kit_K14_PizzaOven_DoubleDeck", c, loc=(PART_X[0] - 0.46, 3.65, 0), rot_z=FACING["W"])
    fridge_counter("Kit_K15_PrepCounter_BlueBoard", c, 1.2, (-8.0, 2.5, 0), "W", board=True)
    bin_round("Kit_K17_Bin_1", c, -7.75, 4.45)
    bin_round("Kit_K18_Bin_Cloth", c, -8.55, 4.45, cloth=True)
    led_lines("LED_Kitchen", c, [(-9.4, 1.5, -6.8, 1.5), (-9.4, 3.0, -6.8, 3.0), (-9.4, 4.5, -6.8, 4.5)])
    return c


def build_back_of_house(root):
    c = coll("05_Corridor_WC", root)
    df = MB()
    door_frame(df, OFF_DOOR_X[0], OFF_DOOR_X[1], (COR_Y[1] + OFF_Y[0]) / 2, axis="x", t=OFF_Y[0] - COR_Y[1] + 0.02)
    door_frame(df, WC_DOOR_Y[0], WC_DOOR_Y[1], (WC_OUT[0] + WC_X[0]) / 2, axis="y", t=WC_X[0] - WC_OUT[0] + 0.02)
    df.obj("Door_Casings", c)
    # office door: open outwards, leaf lying along the corridor's west wall (as in the video)
    door_leaf("Door_Office", c, (OFF_DOOR_X[0] + 0.02, COR_Y[1] - 0.02, 0), 0.78, -90, along="x")
    # WC door: pushed open into the WC, swings along its south wall
    door_leaf("Door_WC", c, ((WC_OUT[0] + WC_X[0]) / 2 + 0.03, WC_DOOR_Y[0] + 0.02, 0), 0.68, -95, along="y")
    led_lines("LED_Corridor", c, [(-4.73, 6.0, -4.73, 7.3)])

    w = MB()
    xe = WC_X[1]                                   # inner face of the WC east wall
    yc = 6.62                                      # toilet axis
    w.box(xe - 0.22, yc - 0.4, 0, xe, yc + 0.4, 1.15, "wall_tile", fmat={"zp": "ceramic"})   # installation box
    w.box(xe - 0.225, yc - 0.13, 0.95, xe - 0.22, yc + 0.13, 1.1, "white_plastic")             # flush plate
    w.box(xe - 0.3, WC_Y[0] + 0.05, 1.72, xe, SHAFT[2], 1.75, "black_plastic")                   # shelf
    w.box(xe - 0.28, WC_Y[0] + 0.1, 1.75, xe - 0.02, SHAFT[2] - 0.05, 2.05, "prod_side",
          fmat={"xn": "wc_shelf"}, fit={"xn": (1, 1)})
    w.box(xe - 0.3, WC_Y[0] + 0.05, 2.2, xe, SHAFT[2], 2.23, "black_plastic")
    w.cyl(xe - 0.48, yc, 0.28, 0.42, 0.19, "ceramic", seg=20, r_top=0.21)                       # wall-hung toilet
    w.box(xe - 0.48, yc - 0.18, 0.25, xe - 0.22, yc + 0.18, 0.42, "ceramic")
    w.cyl(xe - 0.48, yc, 0.42, 0.44, 0.2, "white_plastic", seg=20)
    w.box(xe - 0.26, yc - 0.2, 0.44, xe - 0.22, yc + 0.2, 0.85, "white_plastic")
    w.cyl_y(SHAFT[2] - 0.11, SHAFT[2], -3.05, 1.15, 0.16, "black_plastic", seg=20)              # jumbo roll dispenser
    w.box(WC_X[0] + 0.03, WC_Y[1] - 0.36, 0, WC_X[0] + 0.45, WC_Y[1], 0.72, "white_plastic")   # sink cabinet (NW corner)
    w.box(WC_X[0] + 0.01, WC_Y[1] - 0.42, 0.72, WC_X[0] + 0.5, WC_Y[1], 0.82, "ceramic")
    w.box(WC_X[0] + 0.22, WC_Y[1] - 0.16, 0.82, WC_X[0] + 0.29, WC_Y[1] - 0.06, 0.98, "chrome")
    w.box(WC_X[0] + 0.03, WC_Y[1] - 0.015, 1.15, WC_X[0] + 0.48, WC_Y[1], 1.75, "chrome")        # mirror
    w.cyl(-3.3, WC_Y[0] + 0.17, 0, 0.3, 0.14, "green_rack", seg=14)                              # mop bucket
    w.cyl(-3.3, WC_Y[0] + 0.17, 0.3, 0.36, 0.15, "red_paint", seg=14)
    w.box(xe - 0.06, WC_Y[0] + 0.05, 0, xe - 0.04, WC_Y[0] + 0.08, 1.4, "blue_board")
    w.box(-3.65, 6.65, H - 0.03, -3.25, 7.05, H, "led")
    w.obj("WC_Fixtures", c)
    return c


def build_office(root):
    c = coll("06_Office_Storage", root)
    x0, x1 = OFF_X
    y0, y1 = OFF_Y
    o = MB()
    # west wall: whiteboard + high wooden shelves with boxes
    o.box(x0, 8.3, 1.0, x0 + 0.02, 9.4, 1.9, "whiteboard", fit={"xp": (1, 1)}, fmat={"xn": "whiteboard"})
    for z in (2.1, 2.45):
        o.box(x0, y0 + 0.1, z - 0.025, x0 + 0.32, 9.9, z, "wood_beech")
        o.box(x0 + 0.02, y0 + 0.2, z, x0 + 0.3, 9.0, z + 0.22, "cardboard")
    # desk under the window with laptop + monitor, waste bin
    o.box(x0, y1 - 0.58, 0.72, x0 + 0.95, y1, 0.75, "white_plastic")
    for ax in (x0 + 0.03, x0 + 0.89):
        o.box(ax, y1 - 0.56, 0, ax + 0.03, y1 - 0.04, 0.72, "steel_dark")
    o.box(x0 + 0.3, y1 - 0.45, 0.75, x0 + 0.62, y1 - 0.2, 0.77, "black_plastic")
    o.box(x0 + 0.3, y1 - 0.21, 0.77, x0 + 0.62, y1 - 0.19, 0.98, "black_plastic", fmat={"yn": "screen_laptop"}, fit={"yn": (1, 1)})
    o.box(x0 + 0.64, y1 - 0.14, 0.75, x0 + 0.9, y1 - 0.11, 1.0, "black_plastic")
    o.cyl(x0 + 0.18, y1 - 0.85, 0.0, 0.35, 0.14, "bag_black", seg=14)
    # beech wardrobe in the north-east corner, pizza boxes on top up to the ceiling
    wx0, wx1 = OFF_WIN_X[1] + 0.02, x1 - 0.02
    o.box(wx0, y1 - 0.55, 0, wx1, y1, 2.0, "wood_beech")
    o.box((wx0 + wx1) / 2 - 0.004, y1 - 0.556, 0.05, (wx0 + wx1) / 2 + 0.004, y1 - 0.55, 1.95, "black_plastic")
    for hx in ((wx0 + wx1) / 2 - 0.05, (wx0 + wx1) / 2 + 0.03):
        o.box(hx, y1 - 0.58, 0.95, hx + 0.02, y1 - 0.55, 1.15, "black_plastic")
    pizza_stack(o, wx0 + 0.02, y1 - 0.5, wx1 - 0.02, y1 - 0.05, 2.0, H)
    # pizza box stacks to the ceiling in the recess of the east wall
    pizza_stack(o, x1 - 0.36, OFF_NICHE_Y[0] + 0.03, -3.1, 9.55, 0, H)
    pizza_stack(o, x1 - 0.36, 9.55, -3.1, OFF_NICHE_Y[1] - 0.03, 0, H - 0.1)
    # cardboard boxes + a pizza box with a paper on top, in front of the stacks
    o.box(x1 - 0.85, 9.2, 0, x1 - 0.38, 9.65, 1.0, "cardboard")
    pizza_stack(o, x1 - 0.82, 9.23, x1 - 0.41, 9.62, 1.0, 1.06)
    o.box(x1 - 0.78, 9.27, 1.06, x1 - 0.48, 9.58, 1.065, "white_plastic")
    # coats on hooks on the east wall
    o.box(x1 - 0.04, 8.7, 1.85, x1, 9.1, 1.88, "steel_dark")
    o.plane_x(x1 - 0.12, 8.68, 9.12, 0.55, 1.9, "coats", facing=-1)
    o.box(-4.35, 9.15, H - 0.03, -3.95, 9.55, H, "led")
    o.obj("Office_Furniture", c)
    shelving("Office_MetalRack", c, 0.75, 0.48, 2.0, [0.45, 0.85, 1.25, 1.65], "prod_storage", (x1 - 0.24, 8.3, 0), "W",
             frame="shelf_dark", back=False, wood_shelves=True, top_prod="prod_drinks")
    ch = MB()
    ch.box(-0.24, -0.24, 0.45, 0.24, 0.24, 0.53, "black_plastic")
    ch.box(-0.22, 0.2, 0.55, 0.22, 0.26, 1.15, "black_plastic")
    ch.cyl(0, 0, 0.1, 0.45, 0.025, "chrome", seg=8)
    for k in range(5):
        a = k * 2 * math.pi / 5
        ch.box(min(0, 0.3 * math.cos(a)) - 0.02, min(0, 0.3 * math.sin(a)) - 0.02, 0.05,
               max(0, 0.3 * math.cos(a)) + 0.02, max(0, 0.3 * math.sin(a)) + 0.02, 0.1, "black_plastic")
    ch.obj("Office_Chair", c, loc=(x0 + 0.5, y1 - 0.95, 0), rot_z=math.radians(160))
    fc = MB()
    fc.box(-0.2, -0.2, 0.44, 0.2, 0.2, 0.47, "shelf_grey")
    fc.box(-0.2, 0.17, 0.47, 0.2, 0.2, 0.9, "shelf_grey")
    fc.obj("Office_FoldingChair", c, loc=(-4.25, 9.4, 0), rot_z=math.radians(80))
    return c


def build_signage_and_lights(root):
    c = coll("07_Lights_Render", root)

    def area(name, loc, size, energy, color=(1.0, 0.97, 0.92)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size
        ld.energy = energy
        ld.color = color
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        c.objects.link(ob)

    z = H - 0.06
    for (y0, y1) in [(0.5, 3.8), (3.95, 7.2), (7.35, 10.3)]:
        area(f"L_Hall_{y0}", (-1.6, (y0 + y1) / 2, z), (0.12, y1 - y0), 330)
    area("L_Counter", (-3.9, 3.35, z), (0.12, 1.9), 170)
    area("L_Cash", (-3.75, 5.25, z), (1.7, 0.12), 110)
    area("L_WorkerAisle", (-5.9, 3.6, z), (0.12, 2.0), 110)
    area("L_KitchenFront", (-4.85, 1.25, z), (2.5, 0.12), 170)
    for y in (1.5, 3.0, 4.5):
        area(f"L_Kitchen_{y}", (-8.1, y, z), (2.6, 0.12), 170)
    area("L_Corridor", (-4.73, 6.65, z), (0.12, 1.3), 55)
    area("L_WC", (-3.45, 6.85, z), (0.4, 0.4), 30)
    area("L_Office", (-4.15, 9.35, z), (0.4, 0.4), 70)
    area("L_Street", (-1.5, -2.5, 4.5), (6.0, 3.0), 48, color=(0.7, 0.75, 0.9))
    area("L_NorthStreet", (-1.5, HALL_D + 2.5, 4.0), (4.0, 2.0), 20, color=(0.7, 0.75, 0.9))
    return c


def build_markers(root):
    c = coll("08_Game_Markers", root)
    sp = bpy.data.objects.new("PlayerStart_Street", None)
    sp.empty_display_type = "ARROWS"
    sp.location = ((STREET_DOOR[0] + STREET_DOOR[1]) / 2, -2.5, 0.0)
    sp.rotation_euler = (0, 0, 0)        # +Y (north) is forward: walk in through the MA PIZZA door
    c.objects.link(sp)
    names = {
        "Zone_SalesHall_1106-1": (-1.7, 5.0), "Zone_CashDesk": (-3.7, 5.3), "Zone_PizzaCounter": (-3.9, 3.4),
        "Zone_KitchenFront": (-4.9, 1.2), "Zone_Kitchen_1106-2": (-8.65, 2.6), "Zone_Corridor": (-4.73, 6.6),
        "Zone_WC_1106-4": (-3.45, 6.85), "Zone_Office_1106-3": (-4.2, 9.3), "Door_North_Exit": (-1.45, HALL_D + 0.6),
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
    ("CAM_01_Street", (-1.5, -2.6, 1.4), (-1.6, 6.0, 1.75), 14, "0.0 s  outside the MA PIZZA door"),
    ("CAM_02_Entry", (-1.5, -0.4, 1.45), (-1.1, 6.0, 1.3), 14, "2.2 s  stepping in, coffee counter left"),
    ("CAM_03_AisleNorth", (-1.55, 6.9, 1.5), (-1.55, 12.0, 1.4), 14, "11 s  coolers left, north door ahead"),
    ("CAM_04_AisleSouth", (-1.45, 9.7, 1.5), (-1.9, 1.0, 1.2), 14, "16.5 s looking back to the street door"),
    ("CAM_05_Counter", (-2.35, 3.55, 1.5), (-5.6, 4.6, 1.2), 14, "19 s  cash desk right, MAMA counter ahead"),
    ("CAM_06_Kitchen", (-4.0, 2.55, 1.5), (-4.5, -1.0, 1.5), 14, "23.5 s kitchen part in front of the 3.04 window"),
    ("CAM_07_KitchenNorth", (-8.66, 1.45, 1.5), (-8.3, 6.5, 1.2), 14, "30.5 s kitchen 1106-2, north wall"),
    ("CAM_08_Corridor", (-4.73, 4.95, 1.5), (-4.75, 10.0, 1.2), 14, "38 s  corridor: office ahead, WC right"),
    ("CAM_09_WC", (-4.75, 6.75, 1.5), (-2.7, 6.65, 0.85), 14, "41 s  WC 1106-4"),
    ("CAM_10_Office", (-4.75, 7.55, 1.5), (-4.2, 11.0, 1.1), 14, "50.5 s office / storage 1106-3"),
    ("CAM_11_KitchenToCounter", (-8.6, 1.3, 1.5), (-4.5, 2.8, 1.1), 14, "34 s  kitchen looking back at the counter"),
    ("CAM_12_CashFromStaffGap", (-5.6, 5.15, 1.5), (-2.4, 4.9, 1.2), 14, "36.5 s cash desk seen from the staff pass"),
]
PLAN_CENTER = (-4.85, 5.2)
PLAN_SCALE = 13.2                  # metres across the 1250 px image height


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
    cd = bpy.data.cameras.new("CAM_Plan_Top")      # orthographic top-down plan camera
    cd.type = "ORTHO"
    cd.ortho_scale = PLAN_SCALE
    ob = bpy.data.objects.new("CAM_Plan_Top", cd)
    ob.location = (PLAN_CENTER[0], PLAN_CENTER[1], 30)
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
            hide = [o for o in bpy.data.objects if o.name.startswith(("Ceilings", "LED_", "Kitchen_Ducts", "Kit_K14",
                                                                      "Hall_CCTV", "Facade_Upper", "Counter_MenuScreen"))]
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
    build_architecture(root)
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
