import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI } from '../game/Fx';
import { L } from '../core/layout';
import { audio } from '../core/audio';

export interface ButtonOpts {
  w: number;
  h: number;
  label: string;
  color?: number;
  color2?: number;
  textColor?: string;
  size?: number;
  font?: 'title' | 'ui';
  onClick: () => void;
  radius?: number;
  icon?: string;
}

const darken = (c: number, k: number) => {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return Phaser.Display.Color.GetColor(col.red * k, col.green * k, col.blue * k);
};

/** Chunky, tactile mobile button (press squash + click). */
export class Button extends Phaser.GameObjects.Container {
  g: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  opts: ButtonOpts;
  enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.g = scene.add.graphics();
    this.label = scene.add
      .text(0, -3, opts.label, {
        fontFamily: opts.font === 'ui' ? FONT_UI : FONT_TITLE,
        fontSize: `${opts.size ?? 30}px`,
        fontStyle: opts.font === 'ui' ? '800' : '900',
        color: opts.textColor ?? '#1a0f1f',
        align: 'center',
        resolution: Math.min(3.5, L.Z * 1.25),
      })
      .setOrigin(0.5);
    this.add([this.g, this.label]);
    this.draw();
    // container hit areas are measured from the top-left corner (x + width/2)
    this.setSize(opts.w + 12, opts.h + 12);
    this.setInteractive();
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      scene.tweens.killTweensOf(this);
      scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.9, duration: 70 });
    });
    const release = () => scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.Out' });
    this.on('pointerout', release);
    this.on('pointerup', () => {
      release();
      if (!this.enabled) return;
      audio.click();
      opts.onClick();
    });
    scene.add.existing(this);
  }

  setLabel(t: string) {
    this.label.setText(t);
    return this;
  }

  setColor(c: number, c2?: number) {
    this.opts.color = c;
    this.opts.color2 = c2;
    this.draw();
    return this;
  }

  draw() {
    const { w, h } = this.opts;
    const r = this.opts.radius ?? h / 2;
    const c = this.opts.color ?? 0xffc93c;
    const c2 = this.opts.color2 ?? darken(c, 0.72);
    const g = this.g;
    g.clear();
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 8, w, h, r);
    g.fillStyle(0x1a0f1f, 1);
    g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 4);
    g.fillStyle(c2, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(c, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 8, Math.max(2, r - 2));
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + 6, w - 24, Math.min(14, h * 0.22), 7);
  }
}
