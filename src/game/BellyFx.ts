import Phaser from 'phaser';
import { L } from '../core/layout';
import { clamp } from '../core/util';
import { textStyle } from './Fx';

const GOLD = 0xffd23f;
const ORANGE = 0xff9f1c;
const STREAKS = 28;

/**
 * Visuals for «СИЛА ПУПКА»: a halo of rays behind Sergii, a swelling glow on
 * the belly, golden energy streaming in, a danger strip toward the player
 * with arrows running down it, a 3-2-1 countdown and the release blast.
 * Pure presentation — GameScene owns the timing and the gameplay.
 */
export class BellyFx {
  private rays: Phaser.GameObjects.Image;
  private rays2: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private core: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private num: Phaser.GameObjects.Text;
  private seeds: { a: number; r: number; v: number; w: number }[] = [];
  private spin = 0;

  constructor(private scene: Phaser.Scene) {
    const add = Phaser.BlendModes.ADD;
    // behind Sergii: shows as a burning halo around his silhouette
    this.rays = scene.add.image(0, 0, 'rays').setDepth(19.4).setBlendMode(add).setTint(GOLD).setVisible(false);
    this.rays2 = scene.add.image(0, 0, 'rays').setDepth(19.3).setBlendMode(add).setTint(ORANGE).setVisible(false);
    // on the belly, under the arms
    this.glow = scene.add.image(0, 0, 'glow').setDepth(21.9).setBlendMode(add).setTint(0xffc23a).setVisible(false);
    this.core = scene.add.image(0, 0, 'glow').setDepth(21.95).setBlendMode(add).setTint(0xffffff).setVisible(false);
    this.g = scene.add.graphics().setDepth(55);
    this.num = scene.add.text(0, 0, '', textStyle(120, '#ffd23f', { strokeThickness: 16 })).setOrigin(0.5).setDepth(62).setVisible(false);
    for (let i = 0; i < STREAKS; i++) this.seeds.push({ a: (i / STREAKS) * Math.PI * 2 + Math.random() * 0.2, r: Math.random(), v: 0.8 + Math.random() * 0.8, w: 3 + Math.random() * 4 });
  }

  /**
   * Charging frame. (bx, by) belly on screen, (tx, bottom) where the strip
   * lands, u = charge progress 0..1, intro = the title-card beat before it.
   */
  charge(dt: number, bx: number, by: number, tx: number, bottom: number, u: number, t: number, intro: boolean) {
    const g = this.g;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(t * (8 + u * 22));
    this.spin += dt * (0.5 + u * 3.5);

    this.rays.setVisible(true).setPosition(bx, by - 120).setRotation(this.spin).setScale(3.4 + u * 1.4).setAlpha(clamp(0.4 + u * 0.55, 0, 0.95));
    this.rays2.setVisible(true).setPosition(bx, by - 120).setRotation(-this.spin * 0.7).setScale(2.6 + u * 1.1).setAlpha(clamp(0.18 + u * 0.4, 0, 0.6));
    const gs = 1.1 + u * 2.4 + pulse * (0.25 + u * 0.4);
    this.glow.setVisible(true).setPosition(bx, by).setScale(gs).setAlpha(0.45 + u * 0.45);
    this.core.setVisible(true).setPosition(bx, by).setScale(0.35 + u * 0.9 + pulse * 0.2).setAlpha(0.35 + u * 0.6);

    // energy streaming into the belly button
    const reach = 330 - u * 60;
    for (const s of this.seeds) {
      s.r -= dt * s.v * (0.9 + u * 2.4);
      if (s.r <= 0.08) {
        s.r = 1;
        s.a += 2.4;
      }
      const r1 = 40 + s.r * reach;
      const r0 = r1 + 30 + (1 - s.r) * 40 + u * 30;
      const ca = Math.cos(s.a);
      const sa = Math.sin(s.a);
      const al = (intro ? 0.35 : 0.55 + u * 0.45) * Math.min(1, (1 - s.r) * 3);
      g.lineStyle(s.w * (0.6 + u), s.r > 0.5 ? ORANGE : GOLD, al);
      g.lineBetween(bx + ca * r0, by + sa * r0 * 0.8, bx + ca * r1, by + sa * r1 * 0.8);
    }

    // danger strip from the belly to the player, arrows running down it
    const topW = 34;
    const botW = 150 + u * 20;
    const a0 = (intro ? 0.08 : 0.14 + u * 0.12) + pulse * 0.08;
    g.fillStyle(ORANGE, a0 * 0.6);
    g.fillTriangle(bx - topW * 1.8, by, tx - botW * 1.25, bottom, tx + botW * 1.25, bottom);
    g.fillTriangle(bx - topW * 1.8, by, bx + topW * 1.8, by, tx + botW * 1.25, bottom);
    g.fillStyle(GOLD, a0);
    g.fillTriangle(bx - topW, by, tx - botW, bottom, tx + botW, bottom);
    g.fillTriangle(bx - topW, by, bx + topW, by, tx + botW, bottom);
    g.lineStyle(5, GOLD, 0.35 + pulse * 0.35);
    g.lineBetween(bx - topW, by, tx - botW, bottom);
    g.lineBetween(bx + topW, by, tx + botW, bottom);
    if (!intro) {
      for (let i = 0; i < 4; i++) {
        const f = ((t * (0.9 + u * 1.6) + i / 4) % 1);
        const cx = bx + (tx - bx) * f;
        const cy = by + (bottom - by) * f;
        const w = topW + (botW - topW) * f;
        const s = 0.35 + f * 0.65;
        g.lineStyle(10 * s, 0xffffff, (0.25 + u * 0.55) * Math.sin(f * Math.PI));
        g.beginPath();
        g.moveTo(cx - w * 0.55, cy - 26 * s);
        g.lineTo(cx, cy + 12 * s);
        g.lineTo(cx + w * 0.55, cy - 26 * s);
        g.strokePath();
      }
    }
    // crackling ring on the belly
    g.lineStyle(4 + pulse * 5, 0xffffff, 0.3 + u * 0.5);
    g.strokeCircle(bx, by, 50 + u * 40 + pulse * 14);
  }

  count(n: number, x: number, y: number) {
    const t = this.num;
    this.scene.tweens.killTweensOf(t);
    t.setText(String(n))
      .setColor(n === 1 ? '#ff4a3c' : n === 2 ? '#ffb020' : '#ffe066')
      .setPosition(x, y)
      .setVisible(true)
      .setAlpha(1)
      .setScale(2.4);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, scale: 0.7, delay: 330, duration: 170 });
  }

  /** Release frame: u 0..1 over the flight of the wave. */
  blast(bx: number, by: number, tx: number, bottom: number, u: number) {
    const g = this.g;
    g.clear();
    this.num.setVisible(false);
    const k = 1 - u;
    this.rays.setVisible(k > 0.05).setScale(4.6 + u * 2).setAlpha(0.85 * k);
    this.rays2.setVisible(false);
    this.glow.setScale(3.6 + u * 2).setAlpha(0.9 * k);
    this.core.setScale(1.6 * k).setAlpha(k);
    // the beam races to the player, then fades
    const reach = by + (bottom + 60 - by) * Math.min(1, u * 2.6);
    const f = (reach - by) / Math.max(1, bottom - by);
    const ex = bx + (tx - bx) * f;
    const w = 60 + 170 * Math.min(1, u * 2);
    g.fillStyle(ORANGE, 0.35 * k);
    g.fillTriangle(bx - 70, by, ex - w * 1.3, reach, ex + w * 1.3, reach);
    g.fillTriangle(bx - 70, by, bx + 70, by, ex + w * 1.3, reach);
    g.fillStyle(GOLD, 0.6 * k);
    g.fillTriangle(bx - 44, by, ex - w, reach, ex + w, reach);
    g.fillTriangle(bx - 44, by, bx + 44, by, ex + w, reach);
    g.fillStyle(0xffffff, 0.75 * k);
    g.fillTriangle(bx - 16, by, ex - w * 0.35, reach, ex + w * 0.35, reach);
    g.fillTriangle(bx - 16, by, bx + 16, by, ex + w * 0.35, reach);
    // shockwave rings
    for (let i = 0; i < 3; i++) {
      const ui = clamp(u * 1.3 - i * 0.14, 0, 1);
      if (ui <= 0) continue;
      g.lineStyle((16 - i * 4) * (1 - ui) + 3, i === 1 ? GOLD : 0xffffff, 0.9 * (1 - ui));
      g.strokeEllipse(bx, by, (60 + ui * L.W * 1.2) * 2, (60 + ui * L.W * 0.9) * 2);
    }
  }

  clear() {
    this.g.clear();
    this.rays.setVisible(false);
    this.rays2.setVisible(false);
    this.glow.setVisible(false);
    this.core.setVisible(false);
    this.num.setVisible(false);
  }
}
