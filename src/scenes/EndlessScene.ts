import Phaser from 'phaser';
import { L, hudTop } from '../core/layout';
import { audio } from '../core/audio';
import { save } from '../core/save';
import { fmt } from '../core/util';
import { Stage } from '../game/Stage';
import { Sergii } from '../game/Sergii';
import { Fx, textStyle } from '../game/Fx';
import { Button } from '../ui/Button';
import { panelGfx, ui } from '../ui/Modal';
import { backButton, goldTitle } from './MenuScene';

/** Intro card of the secret endless mode «СЕРГІЙ: НЕ ТРЕБА БУЛО». */
export class EndlessScene extends Phaser.Scene {
  stage!: Stage;
  sergii!: Sergii;
  fx!: Fx;
  private t = 0;

  constructor() {
    super('Endless');
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    const W = L.W;
    const top = hudTop();
    const bottom = L.H - Math.max(L.safeBottom, 10) - 12;
    this.stage = new Stage(this, () => Math.round(top + 330 + 150 * 1.5 - 20), 1.5);
    this.sergii = new Sergii(this, this.stage);
    this.fx = new Fx(this);
    this.sergii.crown.setVisible(true);
    this.sergii.moodLevel = 1;
    this.sergii.addDecal('red', 110, 60, true, 999);
    this.sergii.onSteam = (x, y) => this.fx.steam(x, y);
    const tint = this.add.rectangle(W / 2, L.H / 2, W, L.H, 0xff7a40, 1).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.28).setDepth(83);
    void tint;
    const shade = this.add.graphics().setDepth(84);
    shade.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0.85, 0.85, 0, 0);
    shade.fillRect(0, 0, W, top + 300);
    shade.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0, 0, 0.95, 0.95);
    shade.fillRect(0, bottom - 420, W, L.H - bottom + 440);
    backButton(this, () => this.go('Rounds'));
    this.add.image(W / 2, top + 20, 'ic_crown').setScale(0.55 / L.TS).setDepth(91);
    goldTitle(this, W / 2, top + 100, 'СЕРГІЙ:', 64).setDepth(90).setAngle(-3);
    goldTitle(this, W / 2, top + 170, 'НЕ ТРЕБА БУЛО', 56).setDepth(90).setAngle(-3);
    this.add.text(W / 2, top + 234, 'Нескінченний режим', ui(28, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 7 })).setOrigin(0.5).setDepth(90);

    const py = bottom - 250;
    panelGfx(this, W / 2, py, 560, 200, 0x2a1830).setDepth(90);
    this.add.text(W / 2, py - 66, 'Останній рахунок', ui(19, '#cbb8da', '800')).setOrigin(0.5).setDepth(91);
    this.add.text(W / 2, py - 26, fmt((this.registry.get('lastEndless') as number) || 0), textStyle(40, '#ffd23f')).setOrigin(0.5).setDepth(91);
    this.add.text(W / 2, py + 26, 'Найкращий результат', ui(19, '#cbb8da', '800')).setOrigin(0.5).setDepth(91);
    this.add.text(W / 2, py + 66, fmt(save.endlessHigh), textStyle(40, '#ffffff')).setOrigin(0.5).setDepth(91);
    const play = new Button(this, W / 2, bottom - 70, {
      w: 480,
      h: 104,
      label: 'ГРАТИ',
      size: 38,
      color: 0xe8323c,
      textColor: '#ffffff',
      onClick: () => this.go('Game', { mode: 'endless', round: 3, runScore: 0 }),
    }).setDepth(91);
    this.tweens.add({ targets: play, scale: { from: 1, to: 1.04 }, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.InOut' });
    audio.startMusic('menu');
    cam.fadeIn(300, 20, 11, 24);
  }

  private go(scene: string, data?: object) {
    audio.unlock();
    this.cameras.main.fadeOut(220, 20, 11, 24);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.sergii.x = Math.sin(this.t * 0.5) * 8;
    this.sergii.headRot.target = Math.sin(this.t * 0.8) * 0.05;
    this.stage.update(dt);
    this.sergii.update(dt);
    this.fx.camera(dt);
  }
}
