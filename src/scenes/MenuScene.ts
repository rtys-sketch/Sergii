import Phaser from 'phaser';
import { L, hudTop } from '../core/layout';
import { audio } from '../core/audio';
import { persist, resetProgress, save } from '../core/save';
import { fmt, pick, rand } from '../core/util';
import { LINES, SIGNATURE, isSignature } from '../data/config';
import { Stage } from '../game/Stage';
import { Sergii } from '../game/Sergii';
import { Speech } from '../game/Speech';
import { Fx, FONT_TITLE, textStyle } from '../game/Fx';
import { Button } from '../ui/Button';
import { Modal, ui } from '../ui/Modal';

export const MENU_K = 1.45;

/** Title text with a vertical gold gradient. */
export function goldTitle(scene: Phaser.Scene, x: number, y: number, str: string, size: number, top = '#fff3a0', bottom = '#ff9f1c') {
  const t = scene.add.text(x, y, str, textStyle(size, '#ffd23f', { strokeThickness: Math.round(size * 0.17), stroke: '#2a1206' })).setOrigin(0.5);
  const grd = t.context.createLinearGradient(0, 0, 0, t.height / (t.style.resolution || 1));
  grd.addColorStop(0.2, top);
  grd.addColorStop(0.85, bottom);
  t.setFill(grd);
  t.setShadow(0, 6, '#000000', 8, true, true);
  return t;
}

export function plaque(scene: Phaser.Scene, x: number, y: number, w: number, h: number, str: string, size = 22) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 8, w, h, 10);
  g.fillStyle(0x2a1508, 1);
  g.fillRoundedRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 12);
  g.fillGradientStyle(0x9a5c2e, 0x9a5c2e, 0x5e3417, 0x5e3417, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  g.lineStyle(1.5, 0x2a1508, 0.4);
  for (let i = 1; i < 3; i++) g.lineBetween(x - w / 2 + 6, y - h / 2 + (h * i) / 3, x + w / 2 - 6, y - h / 2 + (h * i) / 3 + 2);
  g.fillStyle(0xffe0b0, 0.25);
  g.fillRoundedRect(x - w / 2 + 8, y - h / 2 + 4, w - 16, 5, 2);
  for (const sx of [-1, 1]) {
    g.fillStyle(0x2a1508, 1);
    g.fillCircle(x + sx * (w / 2 - 14), y, 5);
    g.fillStyle(0xd9a86a, 1);
    g.fillCircle(x + sx * (w / 2 - 14) - 1, y - 1, 2);
  }
  const t = scene.add
    .text(x, y, str, { fontFamily: FONT_TITLE, fontSize: `${size}px`, fontStyle: '900', color: '#fff1d6', stroke: '#3a1d0a', strokeThickness: 4, resolution: L.Z * 1.25 })
    .setOrigin(0.5);
  return [g, t] as const;
}

export function iconButton(scene: Phaser.Scene, x: number, y: number, icon: string, label: string, onClick: () => void) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-44, -40, 88, 88, 24);
  g.fillStyle(0x3a2c46, 0.95);
  g.fillRoundedRect(-44, -44, 88, 88, 24);
  g.lineStyle(2.5, 0xffffff, 0.2);
  g.strokeRoundedRect(-44, -44, 88, 88, 24);
  const img = scene.add.image(0, 0, icon).setScale(0.52 / L.TS);
  const t = scene.add.text(0, 66, label, ui(15, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 4 })).setOrigin(0.5);
  const c = scene.add.container(x, y, [g, img, t]).setSize(130, 170);
  c.setInteractive();
  c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.92, duration: 70 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 120 }));
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.Out' });
    audio.click();
    onClick();
  });
  return c;
}

export function backButton(scene: Phaser.Scene, onClick: () => void) {
  const g = scene.add.graphics();
  g.fillStyle(0x2a1f33, 0.92);
  g.fillRoundedRect(-30, -30, 60, 60, 16);
  g.lineStyle(2.5, 0xffffff, 0.25);
  g.strokeRoundedRect(-30, -30, 60, 60, 16);
  const img = scene.add.image(0, 0, 'ic_back').setScale(0.36 / L.TS);
  const c = scene.add.container(46, hudTop() + 34, [g, img]).setSize(84, 84).setDepth(100);
  c.setInteractive();
  c.on('pointerup', () => {
    audio.click();
    onClick();
  });
  return c;
}

export class MenuScene extends Phaser.Scene {
  stage!: Stage;
  sergii!: Sergii;
  speech!: Speech;
  fx!: Fx;
  private t = 0;
  private lookT = 2;
  private pokes = 0;
  private lastPoke = -9;
  private starting = false;
  private modal: Modal | null = null;

  constructor() {
    super('Menu');
  }

  create() {
    this.starting = false;
    this.modal = null;
    this.pokes = 0;
    this.lastPoke = -9;
    const cam = this.cameras.main;
    cam.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    cam.setBackgroundColor('#1a1020');
    const top = hudTop();
    const W = L.W;
    const bottom = L.H - Math.max(L.safeBottom, 10) - 12;
    const menuHorizon = () => Math.round(Math.min(top + 262 + 150 * MENU_K - 20, bottom - 520 - 194 * MENU_K + 120));
    this.stage = new Stage(this, menuHorizon, MENU_K);
    this.sergii = new Sergii(this, this.stage);
    this.speech = new Speech(this);
    this.fx = new Fx(this);
    this.sergii.onSteam = (x, y) => this.fx.steam(x, y);

    // legibility gradients
    const shade = this.add.graphics().setDepth(84);
    shade.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0.8, 0.8, 0, 0);
    shade.fillRect(0, 0, W, top + 300);
    shade.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0, 0, 0.95, 0.95);
    shade.fillRect(0, bottom - 380, W, L.H - bottom + 400);

    // title (crown · СЕРГІЙ · ПРОТИ ВСІХ · plaque)
    const crown = this.add.image(W / 2 + 150, top + 28, 'ic_crown').setScale(0.62 / L.TS).setDepth(91).setAngle(14);
    const t1 = goldTitle(this, W / 2, top + 84, 'СЕРГІЙ', 94).setDepth(90).setAngle(-3);
    const t2 = goldTitle(this, W / 2, top + 168, 'ПРОТИ ВСІХ', 64, '#ffffff', '#ffd23f').setDepth(90).setAngle(-3);
    const [pg, pt] = plaque(this, W / 2, top + 238, 480, 50, 'ОСТАННІЙ НЕРВ КОЛЕКТИВУ', 20);
    pg.setDepth(90);
    pt.setDepth(91);
    for (const [o, d] of [
      [t1, 0],
      [t2, 120],
      [crown, 260],
    ] as const) {
      const s = o.scale;
      o.setScale(0);
      this.tweens.add({ targets: o, scale: s, delay: 150 + d, duration: 500, ease: 'Back.Out' });
    }
    this.tweens.add({ targets: [t1, t2], angle: { from: -3, to: -1.5 }, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.InOut' });
    this.tweens.add({ targets: crown, angle: { from: 10, to: 18 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });

    // paper note with the status line
    const status = save.played ? 'Сергій знову тут.\nНа жаль.' : 'Сергій поки нічого\nне підозрює.';
    const note = this.add.graphics();
    note.fillStyle(0x000000, 0.35);
    note.fillRect(-146, -48, 300, 104);
    note.fillStyle(0xf3e6c8, 1);
    note.fillRect(-150, -54, 300, 104);
    note.fillStyle(0xe2d0a8, 1);
    note.fillRect(-150, 38, 300, 12);
    note.fillStyle(0xd8c7a0, 0.8);
    note.fillRect(-26, -64, 52, 18);
    const noteT = this.add.text(0, -2, status, ui(23, '#2a1a10', '800', { align: 'center', lineSpacing: 2 })).setOrigin(0.5);
    const noteC = this.add.container(W / 2 - 150, bottom - 330, [note, noteT]).setDepth(90).setAngle(-6);
    noteC.setScale(0);
    this.tweens.add({ targets: noteC, scale: 1, delay: 500, duration: 400, ease: 'Back.Out' });

    // main button
    const cta = new Button(this, W / 2, bottom - 206, {
      w: 580,
      h: 110,
      label: 'ПРИЄДНАТИСЯ ДО ВСІХ',
      size: 31,
      color: 0xffc93c,
      onClick: () => {
        if (!save.played) this.start('Game', { mode: 'campaign', round: 1, runScore: 0 });
        else this.start('Rounds');
      },
    }).setDepth(91);
    this.tweens.add({ targets: cta, scale: { from: 1, to: 1.035 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });

    // bottom icons
    const iy = bottom - 78;
    iconButton(this, W / 2 - 200, iy, 'ic_gear', 'НАЛАШТУВАННЯ', () => this.settings()).setDepth(91);
    iconButton(this, W / 2, iy, 'ic_trophy', 'РЕКОРДИ', () => this.records()).setDepth(91);
    iconButton(this, W / 2 + 200, iy, 'ic_help', 'ПРАВИЛА', () => this.rules()).setDepth(91);

    // poke Sergii
    const zone = this.add.zone(W / 2, this.stage.hy + 60, 360, 480).setInteractive().setDepth(50);
    zone.on('pointerdown', () => {
      if (this.modal) return;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.sergii.punch(dir, 0.7, true);
      audio.slap();
      const hc = this.sergii.headCenter();
      this.fx.ring(this.stage.px(hc.x), this.stage.py(hc.y), 0xffffff, 0.8);
      // poke him too often and he escalates
      const now = this.t;
      this.pokes = now - this.lastPoke < 2.5 ? this.pokes + 1 : 1;
      this.lastPoke = now;
      if (this.pokes === 5) {
        this.sergii.angryFor(3);
        this.sergii.shake = 0.6;
        this.time.delayedCall(900, () => (this.sergii.shake = 0));
        this.say('Ще раз — і голову об холодильник кину.');
      } else if (this.pokes === 9) {
        this.sergii.angryFor(4);
        this.sergii.tintTarget = 0.5;
        this.fx.shake(0.5);
        audio.rage();
        this.say('Все. Це вже особисте. Натискай «Приєднатися».');
        this.time.delayedCall(2200, () => (this.sergii.tintTarget = 0));
      } else if (this.pokes < 5) this.say(pick(LINES.poke));
      else this.sergii.angryFor(1.5);
    });

    audio.startMusic('menu');
    audio.setIntensity(0);
    cam.fadeIn(350, 26, 16, 32);
    this.time.delayedCall(900, () => this.say(save.played ? 'Знову ти?' : 'Я нічого не підозрюю.'));

    const onLayout = () => this.scene.restart();
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => this.game.events.off('layout', onLayout));
  }

  private say(s: string) {
    this.speech.say(s, isSignature(s));
  }

  private toggle(label: string, on: boolean) {
    return `${label}: ${on ? 'ТАК' : 'НІ'}`;
  }

  private settings() {
    if (this.modal) return;
    const m = new Modal(this, 'НАЛАШТУВАННЯ', 640, () => (this.modal = null));
    this.modal = m;
    const W = L.W;
    const y0 = m.top + 140;
    const snd: Button = new Button(this, W / 2, y0, {
      w: 480,
      h: 76,
      size: 22,
      font: 'ui',
      color: 0x4b3a5c,
      textColor: '#ffffff',
      label: this.toggle('🔊 ЗВУК', save.sound),
      onClick: () => {
        audio.setSound(!save.sound);
        persist();
        snd.setLabel(this.toggle('🔊 ЗВУК', save.sound));
      },
    });
    const mus: Button = new Button(this, W / 2, y0 + 96, {
      w: 480,
      h: 76,
      size: 22,
      font: 'ui',
      color: 0x4b3a5c,
      textColor: '#ffffff',
      label: this.toggle('🎵 МУЗИКА', save.music),
      onClick: () => {
        audio.setMusic(!save.music);
        persist();
        mus.setLabel(this.toggle('🎵 МУЗИКА', save.music));
        if (save.music) audio.startMusic('menu');
      },
    });
    const diffLabel = () => (save.difficulty === 'easy' ? '🙂 СКЛАДНІСТЬ: ЛЕГКО' : '😐 СКЛАДНІСТЬ: НОРМАЛЬНО');
    const diff: Button = new Button(this, W / 2, y0 + 192, {
      w: 480,
      h: 76,
      size: 21,
      font: 'ui',
      color: save.difficulty === 'easy' ? 0x3f9e4f : 0x4b3a5c,
      textColor: '#ffffff',
      label: diffLabel(),
      onClick: () => {
        save.difficulty = save.difficulty === 'easy' ? 'normal' : 'easy';
        persist();
        diff.setLabel(diffLabel()).setColor(save.difficulty === 'easy' ? 0x3f9e4f : 0x4b3a5c);
        this.say(save.difficulty === 'easy' ? 'Легкий? Ну-ну.' : 'Оце вже розмова.');
      },
    });
    const hint = this.add
      .text(W / 2, y0 + 250, 'На «Легко» є автоприціл і більше часу на ухиляння', ui(16, '#cbb8da', '700'))
      .setOrigin(0.5);
    let armed = false;
    const reset: Button = new Button(this, W / 2, y0 + 330, {
      w: 480,
      h: 66,
      size: 19,
      font: 'ui',
      color: 0x6a2330,
      textColor: '#ffffff',
      label: 'СКИНУТИ ПРОГРЕС',
      onClick: () => {
        if (!armed) {
          armed = true;
          reset.setLabel('ТОЧНО? ТАПНИ ЩЕ РАЗ');
          return;
        }
        resetProgress();
        m.destroy();
        this.scene.restart();
      },
    });
    m.add([snd, mus, diff, hint, reset]);
  }

  private records() {
    if (this.modal) return;
    const m = new Modal(this, 'РЕКОРДИ', 900, () => (this.modal = null));
    this.modal = m;
    const W = L.W;
    const rows: [string, string][] = [
      ['Найкращий результат', save.highScore ? fmt(save.highScore) : '—'],
      ['«Не треба було»', save.endlessHigh ? fmt(save.endlessHigh) : save.secretUnlocked ? '—' : '🔒'],
      ['Найбільше комбо', save.bestCombo ? `x${save.bestCombo}` : '—'],
      ['Відкрито раундів', `${save.unlockedRound} / 5`],
      ['Сергій переможений', save.completed ? `так (${save.runs}×)` : 'ще ні'],
    ];
    rows.forEach(([k, v], i) => {
      const y = m.top + 130 + i * 66;
      const g = this.add.graphics();
      g.fillStyle(0xffffff, i % 2 ? 0.04 : 0.08);
      g.fillRoundedRect(W / 2 - 270, y - 26, 540, 52, 14);
      m.add([
        g,
        this.add.text(W / 2 - 250, y, k, ui(21, '#d9c9e6', '700')).setOrigin(0, 0.5),
        this.add.text(W / 2 + 250, y, v, textStyle(22, '#ffd23f', { strokeThickness: 0 })).setOrigin(1, 0.5),
      ]);
    });
    // phrase collection
    const y0 = m.top + 130 + rows.length * 66 + 18;
    m.add(this.add.text(W / 2, y0, `ФРАЗИ СЕРГІЯ  ${save.heard.length} / ${SIGNATURE.length}`, textStyle(22, '#ffffff', { strokeThickness: 0 })).setOrigin(0.5));
    SIGNATURE.forEach((ph, i) => {
      const got = save.heard.includes(i);
      m.add(
        this.add
          .text(W / 2, y0 + 44 + i * 40, got ? `«${ph.replace(/[.!]+$/, '')}»` : '???  (кинь ще — почуєш)', ui(got ? 20 : 18, got ? '#ffe066' : '#8a7a99', got ? '800' : '700'))
          .setOrigin(0.5),
      );
    });
  }

  private rules() {
    if (this.modal) return;
    const m = new Modal(this, 'ПРАВИЛА', 980, () => (this.modal = null));
    this.modal = m;
    const W = L.W;
    const items: [string, string][] = [
      ['👆', 'Свайпни вгору — кинь. Сильніше = вище, у голову.'],
      ['🍅', 'Тапни картку внизу — вибери предмет. Помідори нескінченні, решту підвозять.'],
      ['↔️', 'Сергій замахується — тапни ліворуч або праворуч, щоб ухилитися.'],
      ['🔥', 'Влучай підряд — росте комбо і множник очок.'],
      ['😤', 'Опусти «Терпіння Сергія» до нуля. 3 серця на раунд.'],
      ['🥫', 'Банки він може зловити. Це погана ідея.'],
      ['📣', 'Події: червона стрічка підкаже, що робити.'],
      ['💬', 'Збирай фрази Сергія — вони в «Рекордах».'],
      ['👑', 'Пройди 5 раундів — відкриється секретний режим.'],
    ];
    items.forEach(([ic, txt], i) => {
      const y = m.top + 124 + i * 82;
      m.add([
        this.add.text(W / 2 - 250, y, ic, ui(34)).setOrigin(0.5),
        this.add.text(W / 2 - 210, y, txt, ui(20, '#ffffff', '700', { wordWrap: { width: 460 }, lineSpacing: 2 })).setOrigin(0, 0.5),
      ]);
    });
  }

  private start(scene: string, data?: object) {
    if (this.starting) return;
    this.starting = true;
    audio.unlock();
    this.cameras.main.fadeOut(240, 26, 16, 32);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.lookT -= dt;
    const s = this.sergii;
    if (this.lookT <= 0) {
      this.lookT = rand(2, 4.5);
      s.headRot.target = rand(-0.08, 0.08);
    }
    s.x = Math.sin(this.t * 0.35) * 10;
    this.stage.update(dt);
    s.update(dt);
    const top = s.facePoint({ x: 40, y: -690 });
    this.speech.update(dt, this.stage.px(s.headCenter().x), Math.max(hudTop() + 336, this.stage.py(top.y) - 20));
    this.fx.camera(dt);
  }
}
