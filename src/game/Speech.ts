import Phaser from 'phaser';
import { FONT_UI } from './Fx';
import { L } from '../core/layout';
import { clamp } from '../core/util';

/** How long a line stays up: long enough to actually read it mid-game. */
export function readTime(str: string) {
  return clamp(1.5 + str.length * 0.065, 2.3, 4.8);
}

/**
 * Floating speech bubble that follows Sergii's head.
 * A new line never wipes the current one before it has been readable for a
 * moment — it waits (only the latest waiting line is kept). Signature phrases
 * get a yellow «catchphrase» bubble.
 */
export class Speech {
  box: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  life = 0;
  side = 1;
  cooldown = 0;
  /** seconds the current line has been visible */
  shown = 0;
  private minShow = 0;
  private pending: { str: string; special: boolean } | null = null;
  private placed = false;

  constructor(public scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '34px',
        fontStyle: '800',
        color: '#1a0f1f',
        align: 'center',
        wordWrap: { width: 380 },
        resolution: Math.min(3.5, L.Z * 1.25),
      })
      .setOrigin(0.5);
    this.box = scene.add.container(0, 0, [this.g, this.text]).setDepth(76).setVisible(false);
  }

  get busy() {
    return this.life > 0;
  }

  /** Returns true when the line went up right away (false = queued). */
  say(str: string, special = false) {
    if (this.life > 0 && this.shown < this.minShow) {
      this.pending = { str, special };
      return false;
    }
    this.show(str, special);
    return true;
  }

  clear() {
    this.pending = null;
    this.life = 0;
    this.box.setVisible(false);
  }

  private show(str: string, special: boolean) {
    this.pending = null;
    this.text.setText(str);
    const w = Math.max(130, this.text.width + 64);
    const h = this.text.height + 34;
    const fill = special ? 0xffe066 : 0xffffff;
    const ink = 0x1a0f1f;
    this.g.clear();
    this.g.fillStyle(ink, 0.22);
    this.g.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 24);
    this.g.fillStyle(fill, 1);
    this.g.lineStyle(special ? 6 : 5, ink, 1);
    this.g.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    this.g.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    // tail
    const tx = -this.side * (w / 2 - 34);
    this.g.fillStyle(fill, 1);
    this.g.beginPath();
    this.g.moveTo(tx - 14, h / 2 - 3);
    this.g.lineTo(tx - this.side * -26, h / 2 + 26);
    this.g.lineTo(tx + 14, h / 2 - 3);
    this.g.closePath();
    this.g.fillPath();
    this.g.lineStyle(special ? 6 : 5, ink, 1);
    this.g.beginPath();
    this.g.moveTo(tx - 14, h / 2);
    this.g.lineTo(tx - this.side * -26, h / 2 + 26);
    this.g.lineTo(tx + 14, h / 2);
    this.g.strokePath();
    const dur = readTime(str) + (special ? 0.4 : 0);
    this.life = dur;
    this.shown = 0;
    this.minShow = Math.min(1.7, dur * 0.6);
    this.box.setVisible(true).setScale(0.2).setAlpha(1).setAngle(special ? -2 : 0);
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.add({ targets: this.box, scale: special ? 1.06 : 1, duration: 280, ease: 'Back.Out' });
  }

  update(dt: number, headX: number, headTop: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.life <= 0) {
      this.placed = false;
      if (this.pending) this.show(this.pending.str, this.pending.special);
      return;
    }
    this.life -= dt;
    this.shown += dt;
    if (this.pending && this.shown >= this.minShow) {
      this.show(this.pending.str, this.pending.special);
    }
    const w = this.text.width + 64;
    this.side = headX > L.W / 2 ? -1 : 1;
    let x = headX + this.side * (w / 2 + 40);
    x = Math.max(w / 2 + 12, Math.min(L.W - w / 2 - 12, x));
    const y = headTop - 20 + Math.sin(this.shown * 4) * 2;
    // glide after the head instead of jittering with every step he takes
    if (!this.placed) {
      this.box.setPosition(x, y);
      this.placed = true;
    } else {
      const k = Math.min(1, dt * 6);
      this.box.setPosition(this.box.x + (x - this.box.x) * k, this.box.y + (y - this.box.y) * k);
    }
    if (this.life <= 0 && !this.pending) {
      this.scene.tweens.add({
        targets: this.box,
        alpha: 0,
        scale: 0.8,
        duration: 180,
        onComplete: () => {
          if (this.life <= 0) this.box.setVisible(false);
        },
      });
    }
  }
}
