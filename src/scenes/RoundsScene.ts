import Phaser from 'phaser';
import { L, hudTop } from '../core/layout';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { ROUNDS } from '../data/config';
import { textStyle } from '../game/Fx';
import { ui } from '../ui/Modal';
import { backButton, goldTitle } from './MenuScene';

const LEVEL = ['Легкий рівень', 'Середній рівень', 'Складний рівень', 'Дуже складний', 'Фінальний бос'];
const COLORS: [number, number][] = [
  [0x2fbf8f, 0x1b6f5a],
  [0xf2b233, 0x9c5a14],
  [0xf07a2a, 0x8a3412],
  [0x8a4fd8, 0x40207a],
  [0xe8323c, 0x6e0f1a],
];

/** «ВИБІР РАУНДУ» — list of round cards with real-photo thumbnails. */
export class RoundsScene extends Phaser.Scene {
  constructor() {
    super('Rounds');
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    cam.setBackgroundColor('#140b18');
    const W = L.W;
    const top = hudTop();
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a1426, 0x2a1426, 0x0e0710, 0x0e0710, 1);
    bg.fillRect(0, 0, W, L.H);
    this.add.image(W / 2, top + 40, 'glow').setTint(0xff8a3c).setAlpha(0.25).setScale(6, 3);
    backButton(this, () => this.go('Menu'));
    goldTitle(this, W / 2, top + 40, 'ВИБІР РАУНДУ', 40);

    const bottom = L.H - Math.max(L.safeBottom, 10) - 10;
    const avail = bottom - (top + 100);
    const cardH = Math.min(150, (avail - 5 * 14 - 110) / 5);
    let y = top + 100 + cardH / 2;
    ROUNDS.forEach((r, i) => {
      const unlocked = r.id <= save.unlockedRound;
      this.card(y, cardH, i, unlocked, r.title);
      y += cardH + 14;
    });
    // secret endless mode
    const sy = y + 110 / 2 - cardH / 2 - 4;
    const unlocked = save.secretUnlocked;
    const g = this.add.graphics();
    const w = W - 60;
    const h = 100;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 22);
    g.fillStyle(unlocked ? 0xffd23f : 0x3a2c46, 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 24);
    g.fillGradientStyle(unlocked ? 0x5a1020 : 0x231a2a, unlocked ? 0x5a1020 : 0x231a2a, 0x1a0a12, 0x1a0a12, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (unlocked) {
      parts.push(this.add.image(w / 2 - 70, 0, 'thumb6').setDisplaySize(118, 92));
      parts.push(this.add.text(-w / 2 + 30, -16, 'СЕРГІЙ: НЕ ТРЕБА БУЛО', textStyle(24, '#ffd23f', { strokeThickness: 5 })).setOrigin(0, 0.5));
      parts.push(this.add.text(-w / 2 + 30, 22, `Нескінченний режим · рекорд ${save.endlessHigh}`, ui(17, '#ffffff', '700')).setOrigin(0, 0.5));
    } else {
      parts.push(this.add.image(-w / 2 + 50, 0, 'lock').setScale(0.9 / L.TS).setAlpha(0.7));
      parts.push(this.add.text(-w / 2 + 96, -16, 'СЕРГІЙ: НЕ ТРЕБА БУЛО', textStyle(22, '#8f7fa0', { strokeThickness: 0 })).setOrigin(0, 0.5));
      parts.push(this.add.text(-w / 2 + 96, 20, 'Нескінченний режим · пройди всі 5 раундів', ui(16, '#8f7fa0', '700')).setOrigin(0, 0.5));
    }
    const c = this.add.container(W / 2, Math.min(sy, bottom - 55), parts).setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.press(c, () => {
      if (unlocked) this.go('Endless');
      else {
        audio.heart();
        this.tweens.add({ targets: c, x: '+=8', duration: 50, yoyo: true, repeat: 3 });
      }
    });

    audio.startMusic('menu');
    cam.fadeIn(250, 20, 11, 24);
    const onLayout = () => this.scene.restart();
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => this.game.events.off('layout', onLayout));
  }

  private press(c: Phaser.GameObjects.Container, fn: () => void) {
    c.on('pointerdown', () => this.tweens.add({ targets: c, scale: 0.96, duration: 70 }));
    c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.Out' });
      audio.click();
      fn();
    });
  }

  private card(y: number, h: number, i: number, unlocked: boolean, title: string) {
    const W = L.W;
    const w = W - 60;
    const [c1, c2] = COLORS[i];
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 7, w, h, 22);
    g.fillStyle(unlocked ? 0xffffff : 0x3a2c46, unlocked ? 0.9 : 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 24);
    if (unlocked) g.fillGradientStyle(c1, c2, c1, c2, 1);
    else g.fillStyle(0x251b2c, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.fillStyle(0xffffff, unlocked ? 0.18 : 0.04);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + 8, w - 24, 14, 7);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    const thumbW = Math.min(180, h * 1.3);
    const thumb = this.add.image(w / 2 - thumbW / 2 - 10, 0, 'thumb' + (i + 1)).setDisplaySize(thumbW, h - 16);
    if (!unlocked) thumb.setTint(0x555555).setAlpha(0.5);
    parts.push(thumb);
    // number badge
    const b = this.add.graphics();
    b.fillStyle(0x1a0f1f, 1);
    b.fillRoundedRect(-w / 2 + 16, -h / 2 + 16, h - 32 + 6, h - 32 + 6, 16);
    b.fillStyle(unlocked ? 0xffd23f : 0x4b3a5c, 1);
    b.fillRoundedRect(-w / 2 + 16, -h / 2 + 16, h - 32, h - 32, 14);
    parts.push(b);
    const bx = -w / 2 + 16 + (h - 32) / 2;
    if (unlocked) parts.push(this.add.text(bx, 0, String(i + 1), textStyle(Math.round(h * 0.42), '#1a0f1f', { strokeThickness: 0 })).setOrigin(0.5));
    else parts.push(this.add.image(bx, 0, 'lock').setScale(0.75 / L.TS));
    const tx = -w / 2 + h + 8;
    const tt = this.add.text(tx, -12, title, textStyle(Math.round(h * 0.17), unlocked ? '#ffffff' : '#8f7fa0', { strokeThickness: unlocked ? 5 : 0, wordWrap: { width: w - h - thumbW - 30 }, align: 'left' })).setOrigin(0, 0.5);
    parts.push(tt);
    parts.push(this.add.text(tx, h / 2 - 26, LEVEL[i], ui(Math.round(h * 0.12), unlocked ? '#fff6dc' : '#6f607e', '700')).setOrigin(0, 0.5));
    if (unlocked && i + 1 < save.unlockedRound) parts.push(this.add.text(w / 2 - 22, -h / 2 + 22, '✓', textStyle(26, '#7be34a')).setOrigin(0.5));
    const c = this.add.container(L.W / 2, y, parts).setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.press(c, () => {
      if (unlocked) this.go('Game', { mode: 'campaign', round: i + 1, runScore: 0 });
      else {
        audio.heart();
        this.tweens.add({ targets: c, x: '+=8', duration: 50, yoyo: true, repeat: 3 });
      }
    });
  }

  private go(scene: string, data?: object) {
    audio.unlock();
    this.cameras.main.fadeOut(200, 20, 11, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}
