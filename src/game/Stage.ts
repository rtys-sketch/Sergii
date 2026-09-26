import Phaser from 'phaser';
import { BG, TABLE_Y } from '../core/background';
import { K, L, horizonY } from '../core/layout';
import { Spring } from '../core/util';

/**
 * The pseudo-3D stage. World units: Sergii's plane is z = 1 and is magnified by
 * K on screen (close-up camera). Y is measured downwards from the horizon
 * (Sergii's eye level). The player's camera leans left/right to dodge, which
 * produces parallax across the layers.
 */
export class Stage {
  cx = L.W / 2;
  hy = 0;
  K = K;
  cam = new Spring(0, 0, 300, 34); // critically damped: the view glides, never wobbles
  far: Phaser.GameObjects.Image;
  mid: Phaser.GameObjects.Image;
  ground: Phaser.GameObjects.Image;
  table: Phaser.GameObjects.Image;
  fg: Phaser.GameObjects.Image;
  grade: Phaser.GameObjects.Image;

  constructor(public scene: Phaser.Scene, public horizon: () => number = horizonY, k = K) {
    this.K = k;
    const inv = 1 / BG.scale;
    this.far = scene.add.image(0, 0, 'bg_far').setOrigin(0.5, BG.far.horizon / BG.far.h).setScale(inv).setDepth(0);
    this.ground = scene.add.image(0, 0, 'bg_ground').setOrigin(0.5, 0).setScale(inv).setDepth(2);
    this.mid = scene.add.image(0, 0, 'bg_mid').setOrigin(0.5, BG.mid.horizon / BG.mid.h).setScale(inv).setDepth(4);
    const tScale = (1 / Math.max(1.5, BG.scale)) * this.K;
    this.table = scene.add.image(0, 0, 'bg_table').setOrigin(0.5, 0).setScale(tScale).setDepth(30);
    this.fg = scene.add.image(0, 0, 'bg_fg').setOrigin(0.5, 0).setDepth(80).setAlpha(0.85);
    // cinematic grade: soft dark corners over the world
    this.grade = scene.add.image(L.W / 2, L.H / 2, 'vignette').setDepth(79).setAlpha(0.55).setDisplaySize(L.W * 1.15, L.H * 1.1);
    this.layout();
  }

  get camX() {
    return this.cam.x;
  }

  layout() {
    this.cx = L.W / 2;
    this.hy = this.horizon();
    this.grade.setPosition(L.W / 2, L.H / 2).setDisplaySize(L.W * 1.15, L.H * 1.1);
    this.update(0);
  }

  /** world (X, Y, z) -> screen */
  px(X: number, z = 1) {
    return this.cx + ((X - this.cam.x) * this.K) / z;
  }
  py(Y: number, z = 1) {
    return this.hy + (Y * this.K) / z;
  }
  /** screen -> world at depth z */
  wx(sx: number, z: number) {
    return this.cam.x + ((sx - this.cx) * z) / this.K;
  }
  wy(sy: number, z: number) {
    return ((sy - this.hy) * z) / this.K;
  }

  update(dt: number) {
    if (dt > 0) this.cam.step(dt);
    const c = this.cam.x * this.K;
    this.far.setPosition(this.cx - c / BG.far.depth, this.hy);
    this.mid.setPosition(this.cx - c / BG.mid.depth, this.hy);
    this.ground.setPosition(this.cx - c / BG.ground.depth, this.hy + BG.ground.top);
    this.table.setPosition(this.cx - c / BG.table.depth, this.hy + (TABLE_Y - 6) * this.K);
    this.fg.setPosition(this.cx - c / BG.fg.depth, Math.min(0, this.hy - 560));
  }
}
