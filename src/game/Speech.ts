import Phaser from 'phaser';
import { FONT_UI } from './Fx';
import { L } from '../core/layout';

/** Floating speech bubble that follows Sergii's head. */
export class Speech {
  box: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  life = 0;
  side = 1;
  cooldown = 0;

  constructor(public scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '30px',
        fontStyle: '800',
        color: '#1a0f1f',
        align: 'center',
        wordWrap: { width: 330 },
        resolution: Math.min(3.5, L.Z * 1.25),
      })
      .setOrigin(0.5);
    this.box = scene.add.container(0, 0, [this.g, this.text]).setDepth(76).setVisible(false);
  }

  say(str: string, duration = 1.9) {
    this.text.setText(str);
    const w = Math.max(120, this.text.width + 60);
    const h = this.text.height + 30;
    this.g.clear();
    this.g.fillStyle(0x1a0f1f, 0.22);
    this.g.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 22);
    this.g.fillStyle(0xffffff, 1);
    this.g.lineStyle(5, 0x1a0f1f, 1);
    this.g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    this.g.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    // tail
    const tx = -this.side * (w / 2 - 34);
    this.g.fillStyle(0xffffff, 1);
    this.g.beginPath();
    this.g.moveTo(tx - 14, h / 2 - 3);
    this.g.lineTo(tx - this.side * -26, h / 2 + 26);
    this.g.lineTo(tx + 14, h / 2 - 3);
    this.g.closePath();
    this.g.fillPath();
    this.g.lineStyle(5, 0x1a0f1f, 1);
    this.g.beginPath();
    this.g.moveTo(tx - 14, h / 2);
    this.g.lineTo(tx - this.side * -26, h / 2 + 26);
    this.g.lineTo(tx + 14, h / 2);
    this.g.strokePath();
    this.life = duration;
    this.box.setVisible(true).setScale(0.2).setAlpha(1);
    this.scene.tweens.killTweensOf(this.box);
    this.scene.tweens.add({ targets: this.box, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  update(dt: number, headX: number, headTop: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.life <= 0) return;
    this.life -= dt;
    const w = this.text.width + 60;
    this.side = headX > L.W / 2 ? -1 : 1;
    let x = headX + this.side * (w / 2 + 40);
    x = Math.max(w / 2 + 12, Math.min(L.W - w / 2 - 12, x));
    this.box.setPosition(x, headTop - 20 + Math.sin(this.life * 5) * 2);
    if (this.life <= 0) {
      this.scene.tweens.add({
        targets: this.box,
        alpha: 0,
        scale: 0.8,
        duration: 160,
        onComplete: () => this.box.setVisible(false),
      });
    }
  }
}
