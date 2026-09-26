import Phaser from 'phaser';
import { L } from '../core/layout';
import { audio } from '../core/audio';
import { FONT_UI, textStyle } from '../game/Fx';
import { Button } from './Button';

export const ui = (size: number, color = '#ffffff', weight = '800', extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
  ({
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    resolution: Math.min(3.5, L.Z * 1.25),
    ...extra,
  }) as Phaser.Types.GameObjects.Text.TextStyle;

export function panelGfx(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = 0x241829) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 12, w, h, 30);
  g.fillStyle(0x5a4a66, 1);
  g.fillRoundedRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 33);
  g.fillGradientStyle(color, color, 0x120b16, 0x120b16, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 30);
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(x - w / 2 + 14, y - h / 2 + 10, w - 28, 44, 18);
  return g;
}

/** Simple centred modal window with a title and a close button. */
export class Modal {
  root: Phaser.GameObjects.Container;
  top: number;
  constructor(public scene: Phaser.Scene, title: string, h: number, onClose?: () => void) {
    const W = L.W;
    const cy = L.H / 2;
    const bg = scene.add.rectangle(W / 2, L.H / 2, W, L.H, 0x0d0710, 0.72).setInteractive();
    const p = panelGfx(scene, W / 2, cy, 620, h);
    this.top = cy - h / 2;
    const t = scene.add.text(W / 2, this.top + 50, title, textStyle(34, '#ffd23f')).setOrigin(0.5);
    const close = new Button(scene, W / 2, this.top + h - 60, {
      w: 300,
      h: 76,
      label: 'ЗАКРИТИ',
      size: 24,
      color: 0x7d6a8f,
      textColor: '#ffffff',
      onClick: () => {
        this.destroy();
        onClose?.();
      },
    });
    this.root = scene.add.container(0, 0, [bg, p, t, close]).setDepth(200);
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
    audio.pop(0.9);
  }
  add(o: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) {
    this.root.add(o);
    return this;
  }
  destroy() {
    this.root.destroy();
  }
}
