import Phaser from 'phaser';
import { ARM, BODY } from '../core/textures';
import { TABLE_Y } from '../core/background';
import { Spring, clamp, lerp, rand, wobble } from '../core/util';
import type { Stage } from './Stage';
import { ITEMS, type ItemKind, type SplatKind } from '../data/config';

// head texture geometry (pixels in sergii-head.webp, 547x798)
const HEAD_W = 547;
const HEAD_H = 798;
const PIVOT_X = 250;
const PIVOT_Y = 722;
export const HEAD_SCALE = 0.46;
/** Points on the photo, relative to the neck pivot, in texture px. */
export const FACE = {
  center: { x: 15, y: -340 },
  forehead: { x: 10, y: -585 },
  eyeL: { x: -130, y: -430 },
  eyeR: { x: 60, y: -415 },
  nose: { x: -65, y: -320 },
  mouth: { x: -60, y: -222 },
  chin: { x: -20, y: -40 },
  top: { x: 50, y: -700 },
  earR: { x: 255, y: -320 },
  anger: { x: 205, y: -600 },
  sweat: { x: -215, y: -470 },
};
const HEAD_RX = 250;
const HEAD_RY = 345;

const NECK_Y = 194; // world Y of the neck (eyes on the horizon)
const HIP_DY = BODY.h - BODY.neckY; // from neck to hips
const FOREARM_OUT = ARM.out; // the hand sits this far outward of the shoulder, in texture units

interface Decal {
  img: Phaser.GameObjects.Image;
  head: boolean;
  lx: number;
  ly: number;
  rot: number;
  scale: number;
  life: number;
  max: number;
  drip: number;
}

export type Hit = 'head' | 'body' | 'shield' | null;

export class Sergii {
  // locomotion (world units)
  x = 0;
  vx = 0;
  y = new Spring(0, 0, 160, 16);
  lean = new Spring(0, 0, 150, 13);
  headX = new Spring(0, 0, 190, 12);
  headY = new Spring(0, 0, 190, 12);
  headRot = new Spring(0, 0, 160, 10);
  headScale = new Spring(1, 1, 220, 13);
  squash = new Spring(0, 0, 260, 11);
  armR = new Spring(0.12, 0.12, 120, 14);
  armL = new Spring(-0.12, -0.12, 120, 14);
  armRS = new Spring(1, 1, 200, 16);
  armLS = new Spring(1, 1, 200, 16);
  scaleAll = new Spring(0.9, 0.9, 120, 14);

  t = 0;
  moodLevel = 0; // 0..4
  rage = false;
  shake = 0;
  exhausted = false;
  heldKind: ItemKind | null = null;
  shieldOn = false;
  visibleBang = false;
  tintTarget = 0; // 0..1 redness
  private tint = 0;
  private hitFlash = 0;
  private smileTime = 0;
  private angerTime = 0;
  private happyAlpha = 0;
  private angryAlpha = 0;

  body: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  headHappy: Phaser.GameObjects.Image;
  headAngry: Phaser.GameObjects.Image;
  headShadow: Phaser.GameObjects.Image;
  collar: Phaser.GameObjects.Image;
  armLImg: Phaser.GameObjects.Image;
  armRImg: Phaser.GameObjects.Image;
  held: Phaser.GameObjects.Image;
  lid: Phaser.GameObjects.Image;
  anger: Phaser.GameObjects.Image;
  sweat: Phaser.GameObjects.Image;
  bang: Phaser.GameObjects.Image;
  flag: Phaser.GameObjects.Image;
  crown: Phaser.GameObjects.Image;
  phone: Phaser.GameObjects.Image;
  phoneOn = false;
  private decals: Decal[] = [];
  private steamTimer = 0;
  onSteam?: (x: number, y: number) => void;

  // cached rig (world coords)
  neck = { x: 0, y: 0 };
  headPos = { x: 0, y: 0, rot: 0, s: HEAD_SCALE };
  shoulderR = { x: 0, y: 0 };
  shoulderL = { x: 0, y: 0 };
  handR = { x: 0, y: 0 };
  handL = { x: 0, y: 0 };

  constructor(public scene: Phaser.Scene, public stage: Stage) {
    this.body = scene.add.image(0, 0, 'body').setDepth(20);
    this.body.setOrigin(0.5, BODY.h / (BODY.h + 10));
    this.headShadow = scene.add.image(0, 0, 'sergii-head').setDepth(20.5).setTintFill(0x000000).setAlpha(0.25);
    this.headShadow.setOrigin(PIVOT_X / HEAD_W, PIVOT_Y / HEAD_H);
    this.head = scene.add.image(0, 0, 'sergii-head').setDepth(21);
    this.head.setOrigin(PIVOT_X / HEAD_W, PIVOT_Y / HEAD_H);
    this.headHappy = scene.add.image(0, 0, 'sergii-head-happy').setDepth(21.05).setOrigin(PIVOT_X / HEAD_W, PIVOT_Y / HEAD_H).setAlpha(0);
    this.headAngry = scene.add.image(0, 0, 'sergii-head-angry').setDepth(21.1).setOrigin(PIVOT_X / HEAD_W, PIVOT_Y / HEAD_H).setAlpha(0);
    this.collar = scene.add.image(0, 0, 'collar').setDepth(21.5).setOrigin(0.5, 8 / 70);
    // one continuous arm per side (sleeve + skin + hand), pivoting at the shoulder
    this.armLImg = scene.add.image(0, 0, 'arm-l').setDepth(22).setOrigin(1 - ARM.px / ARM.w, ARM.py / ARM.h);
    this.armRImg = scene.add.image(0, 0, 'arm-r').setDepth(22).setOrigin(ARM.px / ARM.w, ARM.py / ARM.h);
    this.held = scene.add.image(0, 0, 'it_can').setDepth(23).setVisible(false);
    this.lid = scene.add.image(0, 0, 'lid').setDepth(24).setVisible(false);
    this.anger = scene.add.image(0, 0, 'anger').setDepth(23).setVisible(false);
    this.sweat = scene.add.image(0, 0, 'sweat').setDepth(23).setVisible(false);
    this.bang = scene.add.image(0, 0, 'bang').setDepth(75).setVisible(false);
    this.flag = scene.add.image(0, 0, 'flag').setDepth(22.9).setVisible(false).setOrigin(0.15, 0.9);
    this.crown = scene.add.image(0, 0, 'ic_crown').setDepth(21.6).setVisible(false).setOrigin(0.5, 0.85);
    this.phone = scene.add.image(0, 0, 'phone').setDepth(23).setVisible(false);
    this.update(0);
  }

  get texScale() {
    return 1 / (this.scene.textures.get('body').getSourceImage().width / (BODY.w));
  }

  // ------------------------------------------------------------ geometry
  private rot(lx: number, ly: number, a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: lx * c - ly * s, y: lx * s + ly * c };
  }

  /** Face point (texture px relative to pivot) -> world. */
  facePoint(p: { x: number; y: number }) {
    const h = this.headPos;
    const r = this.rot(p.x * h.s, p.y * h.s, h.rot);
    return { x: h.x + r.x, y: h.y + r.y };
  }

  headCenter() {
    return this.facePoint(FACE.center);
  }

  /** Predicted face centre after `t` seconds of current locomotion. */
  predictHead(t: number) {
    const c = this.headCenter();
    return { x: c.x + this.vx * Math.min(t, 0.5) * 0.8, y: c.y };
  }

  hitTest(X: number, Y: number, r: number): Hit {
    if (this.shieldOn) {
      const dx = X - this.handL.x;
      const dy = Y - (this.handL.y - 20);
      if (dx * dx + dy * dy < (92 + r * 0.4) ** 2) return 'shield';
    }
    const h = this.headPos;
    const c = this.headCenter();
    const d = this.rot(X - c.x, Y - c.y, -h.rot);
    const rx = HEAD_RX * h.s + r * 0.5;
    const ry = HEAD_RY * h.s + r * 0.5;
    if ((d.x * d.x) / (rx * rx) + (d.y * d.y) / (ry * ry) <= 1) return 'head';
    const bodyTop = this.neck.y + 22;
    const bx = this.neck.x + Math.sin(this.lean.x) * 120;
    const belly = clamp((Y - this.neck.y - 115 * this.scaleAll.x) / (125 * this.scaleAll.x), 0, 1);
    const bodyRadius = lerp(188, 242, belly) * this.scaleAll.x;
    if (Y > bodyTop && Y < TABLE_Y + 4 && Math.abs(X - bx) < bodyRadius + r * 0.4) return 'body';
    return null;
  }

  /** Converts a world impact point into head-local texture px. */
  toHeadLocal(X: number, Y: number) {
    const h = this.headPos;
    const d = this.rot(X - h.x, Y - h.y, -h.rot);
    return { x: d.x / h.s, y: d.y / h.s };
  }

  // ------------------------------------------------------------ reactions
  smileFor(seconds = 1.8) {
    this.smileTime = Math.max(this.smileTime, seconds);
    this.angerTime = 0;
  }

  angryFor(seconds = 1.5) {
    this.angerTime = Math.max(this.angerTime, seconds);
    this.smileTime = 0;
  }

  punch(dirX: number, strength: number, head: boolean) {
    this.angryFor();
    const s = strength;
    if (head) {
      this.headY.kick(-420 * s);
      this.headX.kick(dirX * 520 * s);
      this.headRot.kick(dirX * 5.5 * s + rand(-1.5, 1.5) * s);
      this.headScale.kick(-1.9 * s);
      this.squash.kick(3.2 * s);
      this.lean.kick(dirX * 1.2 * s);
    } else {
      this.lean.kick(dirX * 2.2 * s);
      this.squash.kick(2 * s);
      this.headY.kick(160 * s);
      this.headRot.kick(-dirX * 2.5 * s);
    }
    this.armR.kick(rand(-3, 3) * s);
    this.armL.kick(rand(-3, 3) * s);
    this.hitFlash = 1;
  }

  addDecal(kind: SplatKind | 'tp', X: number, Y: number, head: boolean, linger: number, size = 1) {
    let d = this.decals.find((q) => q.life <= 0);
    if (!d) {
      if (this.decals.length >= 10) {
        d = this.decals.reduce((a, b) => (a.life < b.life ? a : b));
      } else {
        const img = this.scene.add.image(0, 0, 'sp_red_0').setDepth(head ? 21.2 : 20.2);
        d = { img, head, lx: 0, ly: 0, rot: 0, scale: 1, life: 0, max: 1, drip: 0 };
        this.decals.push(d);
      }
    }
    const key = kind === 'tp' ? 'tp_strip' : `sp_${kind}_${Math.random() < 0.5 ? 0 : 1}`;
    d.img.setTexture(key).setVisible(true).setAlpha(1);
    d.head = head;
    d.img.setDepth(head ? 21.2 : 20.2);
    if (head) {
      const l = this.toHeadLocal(X, Y);
      // keep splats on the face
      const ex = l.x - FACE.center.x;
      const ey = l.y - FACE.center.y;
      const k = Math.min(1, 0.9 / Math.sqrt((ex * ex) / (HEAD_RX * HEAD_RX) + (ey * ey) / (HEAD_RY * HEAD_RY) + 1e-6));
      d.lx = FACE.center.x + ex * k;
      d.ly = FACE.center.y + ey * k;
      d.scale = kind === 'tp' ? 1 / this.lidTexScale : kind === 'cream' ? 0.95 : kind === 'yolk' ? 0.62 : 0.7;
    } else {
      d.lx = X - this.neck.x;
      d.ly = Y - this.neck.y;
      d.scale = kind === 'tp' ? 0.8 / this.lidTexScale : kind === 'cream' ? 0.62 : 0.5;
    }
    d.scale *= size;
    d.rot = rand(-0.6, 0.6);
    d.life = d.max = linger;
    d.drip = kind === 'tp' ? 0 : rand(6, 16);
    if (kind === 'tp') d.img.setTint(0xffffff);
    else d.img.clearTint();
  }

  clearDecals() {
    for (const d of this.decals) {
      d.life = 0;
      d.img.setVisible(false);
    }
  }

  // ------------------------------------------------------------ poses
  setHeld(kind: ItemKind | null) {
    this.heldKind = kind;
    if (kind) {
      this.held.setTexture('it_' + kind).setVisible(true);
      this.held.setScale(0);
      this.scene.tweens.add({ targets: this.held, scale: this.heldScale, duration: 220, ease: 'Back.Out' });
    } else {
      this.held.setVisible(false);
    }
  }

  setShield(on: boolean) {
    this.shieldOn = on;
    this.lid.setVisible(on);
    if (!on) this.armL.target = -0.12;
    if (on) {
      this.lid.setScale(0);
      this.scene.tweens.add({ targets: this.lid, scale: this.stage.K / this.lidTexScale, duration: 260, ease: 'Back.Out' });
    }
  }

  get heldScale() {
    const size = this.heldKind ? ITEMS[this.heldKind].size : 56;
    return 0.27 * this.stage.K * (size / 56) * (this.heldKind === 'fridge' ? 0.9 : 1);
  }

  setPhone(on: boolean) {
    this.phoneOn = on;
    this.phone.setVisible(on);
    if (on) {
      this.phone.setScale(0);
      this.scene.tweens.add({ targets: this.phone, scale: (0.9 * this.stage.K) / this.lidTexScale, duration: 220, ease: 'Back.Out' });
    } else this.armL.target = -0.12;
  }

  private get lidTexScale() {
    return this.scene.textures.get('lid').getSourceImage().width / 180;
  }

  /** Angle for an arm so that the hand reaches (tx, ty). */
  aimArm(side: 1 | -1, tx: number, ty: number, outside = false) {
    const sh = side === 1 ? this.shoulderR : this.shoulderL;
    const vx = tx - sh.x;
    const vy = ty - sh.y;
    let a = Math.atan2(-vx, vy) + Math.atan2(side * FOREARM_OUT, ARM.handY - ARM.py) - this.lean.x;
    if (outside) {
      // raise the arm around the outside (like a real shoulder), not sweeping across the chest
      if (side === 1 && a > 1.2) a -= Math.PI * 2;
      if (side === -1 && a < -1.2) a += Math.PI * 2;
    }
    return a;
  }

  // ------------------------------------------------------------ frame
  update(dt: number) {
    this.t += dt;
    const t = this.t;
    this.smileTime = Math.max(0, this.smileTime - dt);
    this.angerTime = Math.max(0, this.angerTime - dt);
    for (const s of [this.y, this.lean, this.headX, this.headY, this.headRot, this.headScale, this.squash, this.armR, this.armL, this.armRS, this.armLS, this.scaleAll]) s.step(dt);

    const KK = this.stage.K;
    const ts = this.texScale * KK;
    const breathe = Math.sin(t * 1.9) * 0.012;
    const walkBob = Math.min(1, Math.abs(this.vx) / 160);
    const bob = -Math.abs(Math.sin(t * 9)) * 7 * walkBob;
    const shakeX = this.shake > 0 ? Math.sin(t * 70) * this.shake * 5 : 0;
    const idleRot = wobble(t * 0.7, 3) * 0.035;
    const ex = this.exhausted ? 1 : 0;

    const sc = this.scaleAll.x;
    const leanA = this.lean.x + (this.vx / 400) * 0.08 + ex * 0.1;
    const hipX = this.x + shakeX;
    const hipY = NECK_Y + HIP_DY * sc + this.y.x + bob;
    const neckOff = this.rot(0, -HIP_DY * sc * (1 + breathe), leanA);
    this.neck.x = hipX + neckOff.x;
    this.neck.y = hipY + neckOff.y;

    // body
    const p = this.stage;
    this.body.setPosition(p.px(hipX), p.py(hipY));
    this.body.setRotation(leanA);
    this.body.setScale(ts * sc * (1 + this.squash.x * 0.04), ts * sc * (1 + breathe - this.squash.x * 0.03));

    // head
    const hs = HEAD_SCALE * sc * this.headScale.x;
    const sq = this.squash.x * 0.06;
    const hx = this.neck.x + this.headX.x + (this.shake > 0 ? Math.sin(t * 83) * this.shake * 3 : 0);
    const hy = this.neck.y + this.headY.x + Math.sin(t * 1.9 + 0.6) * 1.5;
    const hr = leanA * 0.6 + this.headRot.x + idleRot + ex * 0.28;
    this.headPos.x = hx;
    this.headPos.y = hy;
    this.headPos.rot = hr;
    this.headPos.s = hs;
    this.head.setPosition(p.px(hx), p.py(hy)).setRotation(hr).setScale(hs * KK * (1 + sq), hs * KK * (1 - sq));
    for (const face of [this.headHappy, this.headAngry]) {
      face.setPosition(this.head.x, this.head.y).setRotation(hr).setScale(this.head.scaleX, this.head.scaleY);
    }
    this.headShadow.setPosition(p.px(hx + 6), p.py(hy + 10)).setRotation(hr).setScale(hs * KK * 1.01);

    // The photo changes expression with the action. A brief victory smile can
    // interrupt normal irritation, while rage always keeps the angry face.
    const angry = this.rage || (this.smileTime <= 0 && (this.angerTime > 0 || this.moodLevel >= 2));
    const happy = !angry && (this.smileTime > 0 || this.moodLevel === 0);
    this.happyAlpha = lerp(this.happyAlpha, happy ? 1 : 0, Math.min(1, dt * 9));
    this.angryAlpha = lerp(this.angryAlpha, angry ? 1 : 0, Math.min(1, dt * 9));
    this.headHappy.setAlpha(this.happyAlpha);
    this.headAngry.setAlpha(this.angryAlpha);

    // collar sits on the shirt
    const col = this.rot(0, -10 * sc, leanA);
    this.collar.setPosition(p.px(this.neck.x + col.x), p.py(this.neck.y + col.y)).setRotation(leanA).setScale(ts * sc * 0.95);

    // arms
    const shOff = 163 * sc;
    const shY = 68 * sc;
    const r1 = this.rot(shOff, shY, leanA);
    const r2 = this.rot(-shOff, shY, leanA);
    this.shoulderR.x = this.neck.x + r1.x;
    this.shoulderR.y = this.neck.y + r1.y;
    this.shoulderL.x = this.neck.x + r2.x;
    this.shoulderL.y = this.neck.y + r2.y;
    const aR = leanA + this.armR.x;
    const aL = leanA + this.armL.x;
    const armLen = (ARM.handY - ARM.py) * sc;
    const elbowOut = FOREARM_OUT * sc;
    const hR = this.rot(elbowOut, armLen * this.armRS.x, aR);
    const hL = this.rot(-elbowOut, armLen * this.armLS.x, aL);
    this.handR.x = this.shoulderR.x + hR.x;
    this.handR.y = this.shoulderR.y + hR.y;
    this.handL.x = this.shoulderL.x + hL.x;
    this.handL.y = this.shoulderL.y + hL.y;
    this.armRImg.setPosition(p.px(this.shoulderR.x), p.py(this.shoulderR.y)).setRotation(aR).setScale(ts * sc, ts * sc * this.armRS.x);
    this.armLImg.setPosition(p.px(this.shoulderL.x), p.py(this.shoulderL.y)).setRotation(aL).setScale(ts * sc, ts * sc * this.armLS.x);

    if (this.held.visible) {
      if (this.heldKind === 'fridge') {
        // strongman: the fridge balanced on one raised palm
        this.held.setPosition(p.px(this.handR.x + 6), p.py(this.handR.y - 88)).setRotation(Math.sin(t * 5) * 0.07);
      } else {
        this.held.setPosition(p.px(this.handR.x), p.py(this.handR.y - 18));
        this.held.setRotation(Math.sin(t * 3) * 0.2 + aR * 0.3);
      }
      if (!this.scene.tweens.isTweening(this.held)) this.held.setScale(this.heldScale);
    }
    if (this.phone.visible) {
      this.phone.setPosition(p.px(this.handL.x + 6), p.py(this.handL.y - 30)).setRotation(aL * 0.2 - 0.3);
      if (!this.scene.tweens.isTweening(this.phone)) this.phone.setScale((0.9 * KK) / this.lidTexScale);
    }
    if (this.lid.visible) {
      this.lid.setPosition(p.px(this.handL.x), p.py(this.handL.y - 20));
      this.lid.setRotation(Math.sin(t * 2) * 0.05);
      if (!this.scene.tweens.isTweening(this.lid)) this.lid.setScale(KK / this.lidTexScale);
    }
    if (this.flag.visible) {
      this.flag.setPosition(p.px(this.handL.x + 4), p.py(this.handL.y - 8));
      this.flag.setRotation(-0.25 + Math.sin(t * 2.2) * 0.12);
      this.flag.setScale(KK / this.lidTexScale);
    }

    if (this.crown.visible) {
      const top = this.facePoint({ x: 30, y: -600 });
      this.crown.setPosition(p.px(top.x), p.py(top.y)).setRotation(hr - 0.12).setScale((1.05 * KK * hs) / HEAD_SCALE / this.lidTexScale);
    }

    // mood overlays (cartoon marks on top of the real photo)
    const ang = this.facePoint(FACE.anger);
    const showAnger = this.moodLevel >= 1 || this.rage;
    this.anger.setVisible(showAnger);
    if (showAnger) {
      const pulse = 1 + Math.sin(t * (this.rage ? 18 : 6)) * 0.12;
      const base = ((this.moodLevel >= 3 || this.rage ? 0.95 : 0.7) * KK) / this.lidTexScale;
      this.anger.setPosition(p.px(ang.x), p.py(ang.y)).setScale(base * pulse).setRotation(hr);
    }
    const sw = this.facePoint(FACE.sweat);
    const showSweat = this.moodLevel >= 2 || this.exhausted;
    this.sweat.setVisible(showSweat);
    if (showSweat) {
      const k = (t * 0.6) % 1;
      this.sweat.setPosition(p.px(sw.x), p.py(sw.y + k * 40)).setAlpha(1 - k * 0.8).setScale((0.7 * KK) / this.lidTexScale).setRotation(hr);
    }
    if (this.visibleBang) {
      const top = this.facePoint(FACE.top);
      this.bang.setVisible(true);
      this.bang.setPosition(p.px(top.x + 70), p.py(top.y - 40 + Math.sin(t * 14) * 5));
      this.bang.setScale(((1 + Math.sin(t * 16) * 0.08) * KK) / this.lidTexScale);
    } else this.bang.setVisible(false);

    // steam from the ears when angry
    if ((this.moodLevel >= 3 || this.rage) && this.onSteam) {
      this.steamTimer -= dt;
      if (this.steamTimer <= 0) {
        this.steamTimer = this.rage ? 0.12 : 0.45;
        const e = this.facePoint(FACE.earR);
        const e2 = this.facePoint({ x: -240, y: -330 });
        this.onSteam(p.px(e.x), p.py(e.y));
        if (this.rage) this.onSteam(p.px(e2.x), p.py(e2.y));
      }
    }

    // tint: redness for anger + white flash on hits
    this.tint = lerp(this.tint, this.tintTarget, Math.min(1, dt * 3));
    this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
    const red = clamp(this.tint, 0, 1);
    const g = Math.round(255 - red * 95);
    const b = Math.round(255 - red * 105);
    const flash = this.hitFlash;
    const rr = 255;
    const gg = Math.round(lerp(g, 200, flash * 0.5));
    const bb = Math.round(lerp(b, 190, flash * 0.5));
    const faceTint = Phaser.Display.Color.GetColor(rr, gg, bb);
    this.head.setTint(faceTint);
    this.headHappy.setTint(faceTint);
    this.headAngry.setTint(faceTint);

    // decals follow the head / body
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.ly += d.drip * dt * (d.head ? 1 / hs : 1) * 0.6;
      const fade = clamp(d.life / Math.min(0.8, d.max), 0, 1);
      if (d.life <= 0) {
        d.img.setVisible(false);
        continue;
      }
      let wx: number;
      let wy: number;
      let rotW: number;
      let s: number;
      if (d.head) {
        const w = this.facePoint({ x: d.lx, y: d.ly });
        wx = w.x;
        wy = w.y;
        rotW = hr + d.rot;
        s = (d.scale * hs) / HEAD_SCALE;
      } else {
        const w = this.rot(d.lx, d.ly, leanA - this.lean.x * 0);
        wx = this.neck.x + w.x;
        wy = this.neck.y + w.y;
        rotW = leanA + d.rot;
        s = d.scale;
      }
      d.img.setPosition(p.px(wx), p.py(wy)).setRotation(rotW).setScale(s * KK).setAlpha(fade);
    }
  }

  setVisible(v: boolean) {
    for (const o of [this.body, this.head, this.headHappy, this.headAngry, this.headShadow, this.collar, this.armLImg, this.armRImg]) o.setVisible(v);
  }
}
