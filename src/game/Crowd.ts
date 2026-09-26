import Phaser from 'phaser';
import { L } from '../core/layout';
import { CREW_COUNT } from '../core/textures';
import { rand } from '../core/util';
import type { Stage } from './Stage';

/**
 * «Весь колектив»: a crowd of colleagues gathers behind Sergii (silhouettes
 * with phones and tomatoes). Their throws come in from the screen edges.
 */
export class Crowd {
  groups: { img: Phaser.GameObjects.Image; need: number; depth: number; dx: number; dy: number; a: number }[] = [];
  arms: Phaser.GameObjects.Image[] = [];
  count = 0;
  t = 0;

  constructor(public scene: Phaser.Scene, public stage: Stage) {
    const S = L.TS;
    const defs: [string, number, number, number, number, number][] = [
      ['crowd_c', 6, 3.4, 0, -10, (1 / (S * 0.5)) * 0.8],
      ['crowd_a', 1, 2.3, -250, 60, (1 / (S * 0.55)) * 0.85],
      ['crowd_b', 3, 2.3, 250, 60, (1 / (S * 0.55)) * 0.85],
    ];
    for (const [key, need, depth, dx, dy, sc] of defs) {
      const img = scene.add.image(0, 0, key).setOrigin(0.5, 0.3).setScale(sc).setDepth(5 + (3.4 - depth)).setAlpha(0);
      this.groups.push({ img, need, depth, dx, dy, a: 0 });
    }
    for (let i = 0; i < 2; i++) {
      this.arms.push(
        scene.add
          .image(0, 0, 'npcarm' + (i * 3) % CREW_COUNT)
          .setOrigin(0.5, 0.95)
          .setScale(1.1 / (S * 0.8))
          .setDepth(45)
          .setVisible(false),
      );
    }
  }

  add(n: number) {
    this.count += n;
  }

  /** Returns the screen point an item enters from (left/right edge) and animates an arm. */
  throwFrom(): { x: number; y: number; side: number } | null {
    if (this.count <= 0) return null;
    const side = Math.random() < 0.5 ? -1 : 1;
    const y = this.stage.hy + rand(160, 320);
    const arm = this.arms[side < 0 ? 0 : 1];
    const x0 = side < 0 ? -70 : L.W + 70;
    arm.setVisible(true).setPosition(x0, y + 170).setRotation(side * 0.9).setFlipX(side > 0);
    this.scene.tweens.killTweensOf(arm);
    this.scene.tweens.add({
      targets: arm,
      x: x0 - side * 90,
      rotation: side * 0.35,
      duration: 180,
      ease: 'Cubic.Out',
      yoyo: true,
      hold: 120,
      onComplete: () => arm.setVisible(false),
    });
    return { x: side < 0 ? 10 : L.W - 10, y, side };
  }

  update(dt: number) {
    this.t += dt;
    const st = this.stage;
    for (const g of this.groups) {
      const target = this.count >= g.need ? 1 : 0;
      g.a += (target - g.a) * Math.min(1, dt * 2);
      g.img.setAlpha(g.a);
      if (g.a < 0.01) continue;
      const bob = Math.sin(this.t * 3 + g.dx) * 4;
      g.img.setPosition(st.cx + g.dx - (st.camX * st.K) / g.depth, st.hy + g.dy + bob + (1 - g.a) * 60);
    }
  }

  reset() {
    this.count = 0;
  }

  get anyActive() {
    return this.count > 0;
  }
}

export function crowdJoinText(n: number) {
  if (n === 1) return '+1 приєднався!';
  if (n >= 2 && n <= 4) return `+${n} приєдналися!`;
  return `+${n} приєдналося!`;
}

export const QUEUE_TEXT = 'Схоже, черга сформована.';
export const randJoin = () => (Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3);
