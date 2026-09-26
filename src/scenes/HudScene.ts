import Phaser from 'phaser';
import { L, hudTop, trayY } from '../core/layout';
import { audio } from '../core/audio';
import { persist, save } from '../core/save';
import { shareScore } from '../core/share';
import { clamp, fmt, rand } from '../core/util';
import { ITEMS, comboMult, type ItemKind } from '../data/config';
import { FONT_UI, textStyle } from '../game/Fx';
import { Button } from '../ui/Button';
import { itemScale, type GameScene, type RoundStats } from './GameScene';

interface Card {
  i: number;
  x: number;
  y: number;
  g: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  key: string;
}

interface Drag {
  slot: number;
  id: number;
  samples: { x: number; y: number; t: number }[];
  x: number;
  y: number;
  sx: number;
  sy: number;
  t0: number;
  onCard: boolean;
}

const Z0 = 0.42;
const CARD_W = 156;
const CARD_H = 150;
const now = () => performance.now();

const uiText = (size: number, color = '#ffffff', weight = '800', extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
  ({
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    resolution: Math.min(3.5, L.Z * 1.25),
    ...extra,
  }) as Phaser.Types.GameObjects.Text.TextStyle;

export class HudScene extends Phaser.Scene {
  game2!: GameScene;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreShown = 0;
  private hearts: Phaser.GameObjects.Image[] = [];
  private heartsShown = 3;
  private barG!: Phaser.GameObjects.Graphics;
  private barPct!: Phaser.GameObjects.Text;
  private barShown = 100;
  private barGhost = 100;
  private barShake = 0;
  private rageLabel!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboCap!: Phaser.GameObjects.Text;
  private comboShown = 0;
  private cards: Card[] = [];
  private held!: Phaser.GameObjects.Image;
  private drag: Drag | null = null;
  private tutorial?: Phaser.GameObjects.Container;
  private threatTitle!: Phaser.GameObjects.Text;
  private dodgeText!: Phaser.GameObjects.Text;
  private chevrons: Phaser.GameObjects.Text[] = [];
  private threatActive = false;
  private threatLane = 0;
  private threatT = 0;
  private dodgeHint!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Image;
  private threatVig!: Phaser.GameObjects.Image;
  private rageTint!: Phaser.GameObjects.Rectangle;
  private danger = 0;
  private flash!: Phaser.GameObjects.Rectangle;
  private splats: Phaser.GameObjects.Image[] = [];
  private bannerBox!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private bannerBand!: Phaser.GameObjects.Rectangle;
  private ribbon!: Phaser.GameObjects.Container;
  private ribbonText!: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Text[] = [];
  private toastIdx = 0;
  private signSide = 1;
  private modal?: Phaser.GameObjects.Container;
  private t = 0;
  private cardState = '';
  private topUi: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Hud');
  }

  init(data: { game: GameScene }) {
    this.game2 = data.game;
    this.cards = [];
    this.hearts = [];
    this.toasts = [];
    this.splats = [];
    this.chevrons = [];
    this.drag = null;
    this.modal = undefined;
    this.tutorial = undefined;
    this.threatActive = false;
    this.danger = 0;
    this.scoreShown = data.game.score;
    this.heartsShown = 3;
    this.barShown = 100;
    this.barGhost = 100;
    this.comboShown = 0;
    this.cardState = '';
    this.topUi = [];
  }

  create() {
    this.cameras.main.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    this.input.addPointer(2);
    const top = hudTop();
    const W = L.W;
    const g = this.game2;

    // full-screen layers under the widgets
    this.rageTint = this.add.rectangle(W / 2, L.H / 2, W, L.H, 0xff6a50, 1).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0).setDepth(0);
    this.vignette = this.add.image(W / 2, L.H / 2, 'vignette').setDisplaySize(W * 1.1, L.H * 1.08).setAlpha(0).setDepth(0.5);
    this.threatVig = this.add.image(W / 2, L.H / 2, 'vignette').setDisplaySize(W * 1.1, L.H * 1.08).setAlpha(0).setDepth(0.6).setTint(0xff1a2a);
    this.flash = this.add.rectangle(W / 2, L.H / 2, W, L.H, 0xff2030, 1).setAlpha(0).setDepth(2);
    for (let i = 0; i < 4; i++) this.splats.push(this.add.image(0, 0, 'sp_red_0').setVisible(false).setDepth(1));

    const topShade = this.add.graphics().setDepth(3);
    topShade.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0.78, 0.78, 0, 0);
    topShade.fillRect(0, 0, W, top + 230);

    // hearts (top-left)
    for (let i = 0; i < 3; i++) {
      this.hearts.push(
        this.add
          .image(36 + i * 50, top + 34, 'heart')
          .setScale(0.74 / L.TS)
          .setDepth(10),
      );
    }
    // round title (centre)
    const isEndless = g.mode === 'endless';
    this.add
      .text(W / 2, top + 16, isEndless ? 'Нескінченний режим' : `Раунд ${g.def.id}`, uiText(21, '#ffd23f', '800', { stroke: '#1a0f1f', strokeThickness: 5 }))
      .setOrigin(0.5)
      .setDepth(10);
    const title = this.add
      .text(W / 2, top + 50, g.def.title, textStyle(25, '#ffffff', { strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(10);
    if (title.width > 360) title.setScale(360 / title.width);
    // pause (top-right)
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.35);
    pg.fillRoundedRect(-30, -26, 60, 60, 16);
    pg.fillStyle(0x2a1f33, 0.92);
    pg.fillRoundedRect(-30, -30, 60, 60, 16);
    pg.lineStyle(2.5, 0xffffff, 0.25);
    pg.strokeRoundedRect(-30, -30, 60, 60, 16);
    pg.fillStyle(0xffffff, 1);
    pg.fillRoundedRect(-11, -13, 8, 26, 3);
    pg.fillRoundedRect(3, -13, 8, 26, 3);
    const pause = this.add.container(W - 46, top + 34, [pg]).setDepth(10).setSize(84, 84);
    pause.setInteractive();
    pause.on('pointerup', () => {
      audio.click();
      this.game2.pauseGame();
    });

    // patience bar
    this.add
      .text(38, top + 92, 'ТЕРПІННЯ СЕРГІЯ', uiText(17, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 4 }))
      .setOrigin(0, 0.5)
      .setDepth(10)
      .setLetterSpacing(1);
    this.barG = this.add.graphics().setDepth(10);
    this.barPct = this.add
      .text(W - 50, top + 124, '100%', textStyle(19, '#ffffff', { strokeThickness: 5 }))
      .setOrigin(1, 0.5)
      .setDepth(11);
    this.rageLabel = this.add
      .text(W / 2, top + 196, 'СЕРГІЙ ПСИХАНУВ!', textStyle(40, '#ff2b2b', { stroke: '#ffffff', strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(12)
      .setAngle(-4)
      .setVisible(false);

    // score + combo row
    this.scoreText = this.add
      .text(38, top + 164, `★ ${fmt(this.scoreShown)}`, textStyle(28, '#ffd23f', { strokeThickness: 6 }))
      .setOrigin(0, 0.5)
      .setDepth(10);
    this.comboText = this.add.text(W - 38, top + 162, '', textStyle(30, '#ffd23f')).setOrigin(1, 0.5).setDepth(10).setVisible(false);
    this.comboCap = this.add
      .text(W - 38, top + 196, '', uiText(18, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 5 }))
      .setOrigin(1, 0.5)
      .setDepth(10)
      .setVisible(false);

    // inventory tray
    const ty = trayY();
    const tg = this.add.graphics().setDepth(4);
    tg.fillGradientStyle(0x0e0710, 0x0e0710, 0x0e0710, 0x0e0710, 0, 0, 0.88, 0.88);
    tg.fillRect(0, ty - 150, W, 70);
    tg.fillStyle(0x0e0710, 0.88);
    tg.fillRect(0, ty - 80, W, L.H - ty + 80);
    const gap = 12;
    const x0 = (W - (4 * CARD_W + 3 * gap)) / 2 + CARD_W / 2;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (CARD_W + gap);
      const glow = this.add.image(x, ty - 12, 'rays').setDepth(5).setVisible(false).setScale(0.9);
      const cg = this.add.graphics().setDepth(5).setPosition(x, ty);
      const icon = this.add.image(x, ty - 16, 'it_tomato').setDepth(6);
      const count = this.add.text(x, ty + 50, '', textStyle(24, '#ffffff', { strokeThickness: 5 })).setOrigin(0.5).setDepth(7);
      const lock = this.add.image(x, ty - 14, 'lock').setScale(0.9 / L.TS).setDepth(7).setVisible(false);
      this.cards.push({ i, x, y: ty, g: cg, icon, count, lock, glow, key: '' });
    }
    this.held = this.add.image(0, 0, 'it_tomato').setDepth(8).setVisible(false);

    // threat indicators («Сергій кидає в тебе!» / «УХИЛИСЬ!»)
    this.threatTitle = this.add
      .text(W / 2, top + 238, 'Сергій кидає в тебе!', textStyle(32, '#ffffff', { stroke: '#8a0010', strokeThickness: 9 }))
      .setOrigin(0.5)
      .setDepth(9)
      .setAngle(-3)
      .setVisible(false);
    const dy = L.H * 0.66;
    this.dodgeText = this.add.text(W / 2, dy, 'УХИЛИСЬ!', textStyle(44, '#ffffff', { strokeThickness: 10 })).setOrigin(0.5).setDepth(9).setVisible(false);
    this.chevrons = [
      this.add.text(70, dy, '‹', textStyle(120, '#ffd23f', { strokeThickness: 12 })).setOrigin(0.5).setDepth(9).setVisible(false),
      this.add.text(W - 70, dy, '›', textStyle(120, '#ffd23f', { strokeThickness: 12 })).setOrigin(0.5).setDepth(9).setVisible(false),
    ];
    this.dodgeHint = this.add
      .text(W / 2, dy + 76, 'тапни ліворуч або праворуч', uiText(24, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(9)
      .setVisible(false);

    // banners
    this.bannerBand = this.add.rectangle(W / 2, L.H * 0.36, W, 200, 0x0e0710, 0.6).setDepth(20).setVisible(false);
    this.bannerTitle = this.add.text(0, 0, '', textStyle(58, '#ffd23f')).setOrigin(0.5);
    this.bannerSub = this.add
      .text(0, 64, '', uiText(26, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 7, align: 'center', wordWrap: { width: W - 80 } }))
      .setOrigin(0.5, 0);
    this.bannerBox = this.add.container(W / 2, L.H * 0.4, [this.bannerTitle, this.bannerSub]).setDepth(21).setVisible(false);

    const rg = this.add.graphics();
    rg.fillStyle(0x1a0f1f, 1);
    rg.fillRect(-W / 2 - 20, -36, W + 40, 72);
    rg.fillStyle(0xe8323c, 1);
    rg.fillRect(-W / 2 - 20, -30, W + 40, 60);
    rg.fillStyle(0xffffff, 0.2);
    rg.fillRect(-W / 2 - 20, -30, W + 40, 8);
    this.ribbonText = this.add.text(0, 0, '', textStyle(30, '#ffffff')).setOrigin(0.5);
    this.ribbon = this.add.container(W / 2, top + 290, [rg, this.ribbonText]).setDepth(19).setVisible(false).setAngle(-3);

    for (let i = 0; i < 4; i++) {
      this.toasts.push(
        this.add
          .text(W / 2, top + 240, '', uiText(24, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 6, align: 'center', wordWrap: { width: W - 100 } }))
          .setOrigin(0.5)
          .setDepth(18)
          .setVisible(false),
      );
    }

    this.refreshCards(true);
    this.topUi = this.children.list.filter((o) => (o as any).depth >= 3 && (o as any).depth <= 12 && (o as any).y < top + 240);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    const onLayout = () => this.scene.restart({ game: this.game2 });
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => this.game.events.off('layout', onLayout));
  }

  // ================================================================== inventory cards
  private cardAt(x: number, y: number) {
    for (const c of this.cards) if (Math.abs(x - c.x) < CARD_W / 2 + 4 && Math.abs(y - c.y) < CARD_H / 2 + 10) return c;
    return null;
  }

  private refreshCards(force = false) {
    const g = this.game2;
    const st = this.cards
      .map((c) => `${g.slotKind(c.i)}:${g.slotCount(c.i)}:${g.slotLocked(c.i)}`)
      .concat(String(g.selected), String(this.drag?.slot ?? -1))
      .join('|');
    if (!force && st === this.cardState) return;
    this.cardState = st;
    for (const c of this.cards) {
      const kind = g.slotKind(c.i);
      const count = g.slotCount(c.i);
      const locked = g.slotLocked(c.i);
      const sel = g.selected === c.i && !locked && count > 0;
      const empty = !kind || count <= 0;
      const gr = c.g;
      gr.clear();
      const w = CARD_W;
      const h = CARD_H;
      gr.fillStyle(0x000000, 0.4);
      gr.fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, 24);
      if (sel) {
        gr.fillStyle(0xffffff, 1);
        gr.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 27);
        gr.fillGradientStyle(0xffe066, 0xffe066, 0xf59e1b, 0xf59e1b, 1);
        gr.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      } else {
        gr.fillStyle(0x4d3f5a, 1);
        gr.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 26);
        gr.fillGradientStyle(0x2e2338, 0x2e2338, 0x17101c, 0x17101c, 1);
        gr.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      }
      gr.fillStyle(0xffffff, sel ? 0.35 : 0.07);
      gr.fillRoundedRect(-w / 2 + 12, -h / 2 + 8, w - 24, 16, 8);
      if (kind) {
        if (c.key !== kind) {
          c.key = kind;
          c.icon.setTexture('it_' + kind);
        }
        c.icon.setVisible(true).setScale((104 / 256) * (kind === 'fish' ? 1.05 : 1));
        c.icon.setAlpha(locked ? 0.22 : empty ? 0.35 : 1);
      } else {
        c.icon.setVisible(false);
      }
      c.lock.setVisible(locked);
      const inf = count === Infinity;
      c.count.setText(locked ? '' : !kind ? '—' : inf ? '∞' : String(count));
      c.count.setFontFamily(inf ? 'system-ui, -apple-system, "Segoe UI", sans-serif' : 'Unbounded, Rubik, sans-serif');
      c.count.setFontSize(inf ? 40 : 24);
      c.count.setColor(sel ? '#1a0f1f' : '#ffffff');
      c.count.setStroke(sel ? '#ffe98a' : '#1a0f1f', 5);
      c.glow.setVisible(kind === 'gold' && count > 0);
    }
  }

  // ================================================================== input
  private lp(p: Phaser.Input.Pointer) {
    return { x: p.x / L.Z, y: p.y / L.Z };
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.modal) return;
    if (over && over.length) return;
    const { x, y } = this.lp(p);
    const g = this.game2;
    if (g.state !== 'play' && g.state !== 'intro') return;
    if (this.drag) return;
    const card = this.cardAt(x, y);
    let slot = g.selected;
    if (card) {
      if (g.slotLocked(card.i)) {
        this.shakeCard(card, 'Какашки відкриються в раунді 2');
        return;
      }
      if (g.slotCount(card.i) <= 0 || !g.slotKind(card.i)) {
        this.shakeCard(card, card.i === 3 ? 'Бонуси випадають під час гри' : 'Закінчилось. Зараз підвезуть.');
        return;
      }
      slot = card.i;
      if (g.selected !== slot) {
        g.selected = slot;
        audio.pickup();
      }
    } else if (y < hudTop() + 150) return;
    if (g.slotCount(slot) <= 0) slot = g.selected = 0;
    this.drag = { slot, id: p.id, samples: [{ x, y, t: now() }], x, y, sx: x, sy: y, t0: now(), onCard: !!card };
    const kind = g.slotKind(slot) ?? 'tomato';
    this.held.setTexture('it_' + kind).setPosition(x, y).setVisible(!!card).setAlpha(1).setScale(itemScale(kind, Z0) * (card ? 0.9 : 1));
    this.refreshCards(true);
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || d.id !== p.id) return;
    const { x, y } = this.lp(p);
    d.x = x;
    d.y = y;
    d.samples.push({ x, y, t: now() });
    if (d.samples.length > 16) d.samples.shift();
    if (!this.held.visible && Math.hypot(x - d.sx, y - d.sy) > 14) this.held.setVisible(true);
  }

  private onUp(p: Phaser.Input.Pointer) {
    const { x, y } = this.lp(p);
    const d = this.drag;
    if (!d || d.id !== p.id) return;
    this.drag = null;
    const t = now();
    d.samples.push({ x, y, t });
    let i0 = d.samples.length - 1;
    while (i0 > 0 && t - d.samples[i0 - 1].t < 100) i0--;
    if (i0 === d.samples.length - 1 && i0 > 0) i0--;
    const a = d.samples[i0];
    const dt = Math.max(0.012, (t - a.t) / 1000);
    let vx = (x - a.x) / dt;
    let vy = (y - a.y) / dt;
    const tx = x - d.sx;
    const ty = y - d.sy;
    const dist = Math.hypot(tx, ty);
    // finger stopped before release: fall back to the average gesture speed
    const total = Math.max(0.05, (t - d.t0) / 1000);
    if (Math.hypot(vx, vy) < dist / total) {
      vx = tx / total;
      vy = ty / total;
    }
    if (dist > 30) {
      // blend release velocity with the overall gesture direction (stable aim)
      const sp = Math.hypot(vx, vy) || 1;
      const bx = (vx / sp) * 0.55 + (tx / dist) * 0.45;
      const by = (vy / sp) * 0.55 + (ty / dist) * 0.45;
      const bl = Math.hypot(bx, by) || 1;
      vx = (bx / bl) * sp;
      vy = (by / bl) * sp;
    }
    const speedCss = (Math.hypot(vx, vy) * L.cssW) / L.W;
    const g = this.game2;
    const upward = ty < -24 && -ty > Math.abs(tx) * 0.5 && (vy < -250 || -ty > 80);
    if (upward && vy > -120) vy = -120;
    if (upward) {
      const ok = g.throwItem(d.slot, this.held.x, this.held.y, vx, vy, speedCss);
      this.held.setVisible(false);
      if (ok) {
        const c = this.cards[d.slot];
        this.punch(c.icon, 0.8);
      }
      this.refreshCards(true);
      return;
    }
    this.held.setVisible(false);
    this.refreshCards(true);
    if (Math.abs(vx) > 650 && Math.abs(tx) > 40 && Math.abs(tx) > Math.abs(ty)) {
      g.dodge(Math.sign(tx));
      return;
    }
    // a tap (not on a card) dodges toward that side
    if (!d.onCard && dist < 24 && t - d.t0 < 450) g.dodge(x < L.W / 2 ? -1 : 1);
  }

  private shakeCard(c: Card, msg: string) {
    audio.heart();
    this.tweens.add({ targets: [c.icon, c.count], x: '+=8', duration: 50, yoyo: true, repeat: 3 });
    this.toast(msg, '#ffb020');
  }

  // ================================================================== API used by GameScene
  roundIntro(title: string, sub: string, desc: string) {
    this.banner(title, sub + (desc ? `\n${desc}` : ''), '#ffffff', 1.7, true);
  }

  banner(title: string, sub: string, color = '#ffd23f', dur = 1.4, big = false) {
    const box = this.bannerBox;
    this.tweens.killTweensOf(box);
    this.tweens.killTweensOf(this.bannerBand);
    this.bannerTitle.setStyle(textStyle(big ? 60 : 50, color));
    this.bannerTitle.setText(title);
    const maxW = L.W - 40;
    this.bannerTitle.setScale(this.bannerTitle.width > maxW ? maxW / this.bannerTitle.width : 1);
    this.bannerSub.setText(sub).setColor('#ffffff');
    this.bannerSub.setY(this.bannerTitle.displayHeight / 2 + 8);
    box.setVisible(true).setAlpha(1).setScale(2.2).setAngle(rand(-4, 4));
    const h = this.bannerTitle.displayHeight + (sub ? this.bannerSub.height + 30 : 20) + 40;
    this.bannerBand.setVisible(true).setAlpha(0).setSize(L.W, h).setPosition(L.W / 2, box.y + (sub ? this.bannerSub.height / 2 : 0));
    this.tweens.add({ targets: box, scale: 1, duration: 320, ease: 'Back.Out' });
    this.tweens.add({ targets: this.bannerBand, alpha: 1, duration: 200 });
    this.tweens.add({
      targets: [box, this.bannerBand],
      alpha: 0,
      delay: dur * 1000,
      duration: 260,
      onComplete: () => {
        box.setVisible(false);
        this.bannerBand.setVisible(false);
      },
    });
    audio.pop(0.8);
  }

  eventBanner(text: string) {
    const r = this.ribbon;
    this.tweens.killTweensOf(r);
    this.ribbonText.setText(text);
    this.ribbonText.setScale(Math.min(1, (L.W - 60) / this.ribbonText.width));
    r.setVisible(true).setX(-L.W);
    this.tweens.add({ targets: r, x: L.W / 2, duration: 320, ease: 'Back.Out' });
    this.tweens.add({ targets: r, x: L.W * 2, delay: 1900, duration: 300, ease: 'Cubic.In', onComplete: () => r.setVisible(false) });
    audio.whistle();
  }

  toast(text: string, color = '#ffffff') {
    const t = this.toasts[this.toastIdx];
    this.toastIdx = (this.toastIdx + 1) % this.toasts.length;
    this.tweens.killTweensOf(t);
    const busy = this.toasts.filter((q) => q !== t && q.visible).length;
    t.setText(text).setColor(color).setVisible(true).setAlpha(0).setY(hudTop() + (this.rageLabel.visible ? 262 : 236) + busy * 36).setScale(0.8);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, delay: 1900, duration: 400, onComplete: () => t.setVisible(false) });
  }

  warn(text: string) {
    this.toast('⚠ ' + text, '#ffb020');
    audio.warn();
  }

  /** Cardboard sign held up by the crowd: «+3 приєдналися!» */
  sign(text: string) {
    this.signSide = -this.signSide;
    const side = this.signSide;
    const bg = this.add.image(0, 0, 'sign').setScale(1 / L.TS);
    const tx = this.add.text(0, 2, text, uiText(text.length > 18 ? 20 : 27, '#2a1a10', '800', { align: 'center', wordWrap: { width: 270 } })).setOrigin(0.5);
    const c = this.add.container(L.W / 2 + side * 190, L.H * 0.44 + rand(-40, 40), [bg, tx]).setDepth(17).setAngle(side * -7 + rand(-3, 3));
    c.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: c, scale: 0.95, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: c, y: c.y - 16, duration: 900, yoyo: true, ease: 'Sine.InOut' });
    this.tweens.add({ targets: c, alpha: 0, y: c.y + 40, delay: 2100, duration: 350, onComplete: () => c.destroy() });
    audio.pop(1.2);
  }

  bonusDropped(kind: ItemKind) {
    const c = this.cards[3];
    const img = this.add.image(L.W / 2, L.H * 0.35, 'it_' + kind).setScale(0.6).setDepth(16);
    this.tweens.add({
      targets: img,
      x: c.x,
      y: c.y - 16,
      scale: 104 / 256,
      duration: 520,
      ease: 'Cubic.In',
      onComplete: () => {
        img.destroy();
        this.refreshCards(true);
        this.punch(c.icon, 1.35);
        audio.pop(1.5);
      },
    });
    const name = ITEMS[kind].name.toUpperCase();
    if (kind !== 'gold') this.toast(`БОНУС: ${name}!`, '#9dd8ff');
    else this.banner('ЗОЛОТА КАКАШКА', 'Рідкісна. x10 очок.', '#ffd23f', 1.2);
  }

  comboCaption(mult: number, caption: string) {
    this.comboCap.setText(caption).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.comboCap);
    this.comboCap.setScale(1.5);
    this.tweens.add({ targets: this.comboCap, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: this.comboCap, alpha: 0, delay: 2200, duration: 500 });
    this.punch(this.comboText, 1.5);
    if (mult >= 10) this.cameras.main.shake(120, 0.004);
  }

  comboBroken() {
    this.tweens.add({ targets: this.comboText, angle: { from: -10, to: 0 }, duration: 300, ease: 'Elastic.Out' });
  }

  dodged() {
    const t = this.toasts[this.toastIdx];
    this.toastIdx = (this.toastIdx + 1) % this.toasts.length;
    this.tweens.killTweensOf(t);
    t.setText('УХИЛИВСЯ! +50').setColor('#7dffb0').setVisible(true).setAlpha(1).setY(L.H * 0.56).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1.1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 600, duration: 350, onComplete: () => t.setVisible(false) });
  }

  showThreat(lane: number, _dur: number) {
    this.threatActive = true;
    this.threatLane = lane;
    this.threatT = 0;
    this.threatTitle.setVisible(true).setScale(0.3);
    this.tweens.add({ targets: this.threatTitle, scale: 1, duration: 220, ease: 'Back.Out' });
  }

  clearThreat() {
    this.threatActive = false;
    this.threatTitle.setVisible(false);
    this.dodgeText.setVisible(false);
    for (const a of this.chevrons) a.setVisible(false);
    this.tweens.add({ targets: this.threatVig, alpha: 0, duration: 250 });
  }

  showDodgeHint(on: boolean) {
    this.dodgeHint.setVisible(on);
  }

  screenHit(kind: ItemKind) {
    const W = L.W;
    const H = L.H;
    const img = this.splats.find((s) => !s.visible) ?? this.splats[0];
    this.tweens.killTweensOf(img);
    const x = W / 2 + rand(-120, 120);
    const y = H * 0.46 + rand(-80, 80);
    let key = 'sp_red_1';
    let scale = 3.2;
    if (kind === 'can') {
      key = 'crack';
      scale = 3.4;
    } else if (kind === 'slipper') {
      key = 'print';
      scale = 3.4 / L.TS;
    } else if (kind === 'tp') {
      key = 'tp_strip';
      scale = 3.6 / L.TS;
    }
    img.setTexture(key).setPosition(x, y).setVisible(true).setAlpha(1).setRotation(rand(-0.5, 0.5)).setScale(scale * 0.6);
    this.tweens.add({ targets: img, scale, duration: 120, ease: 'Back.Out' });
    this.tweens.add({ targets: img, y: y + 120, alpha: 0, delay: 900, duration: 900, ease: 'Cubic.In', onComplete: () => img.setVisible(false) });
    this.flash.setAlpha(0.3);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 320 });
    const label = kind === 'can' ? 'БАМ!' : kind === 'slipper' ? 'ШЛЬОП!' : kind === 'tp' ? 'ФШШ!' : 'ЧВЯК!';
    const t = this.add.text(x, y - 40, label, textStyle(64, '#ffffff')).setOrigin(0.5).setDepth(12).setAngle(rand(-12, 12));
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 300, onComplete: () => t.destroy() });
  }

  heartsChanged(lost = false) {
    const n = this.game2.hearts;
    this.hearts.forEach((h, i) => {
      const full = i < n;
      if (!full && h.texture.key === 'heart' && lost) {
        const ghost = this.add.image(h.x, h.y, 'heart').setScale(h.scale).setDepth(11);
        this.tweens.add({ targets: ghost, y: h.y + 80, angle: 40, alpha: 0, scale: h.scale * 1.4, duration: 600, onComplete: () => ghost.destroy() });
      }
      h.setTexture(full ? 'heart' : 'heart_empty');
      if (full && !lost && i === n - 1) this.punch(h, 1.3);
    });
    this.heartsShown = n;
  }

  setDanger(level: number) {
    this.danger = level;
    if (level === 0) {
      this.tweens.add({ targets: [this.vignette, this.rageTint], alpha: 0, duration: 400 });
      this.rageLabel.setVisible(false);
    } else this.vignette.setTint(level >= 2 ? 0xff1020 : 0x8a0c18);
    if (level >= 2) {
      this.rageLabel.setVisible(true).setScale(0.2);
      this.tweens.add({ targets: this.rageLabel, scale: 1, duration: 400, ease: 'Back.Out' });
    }
  }

  showTutorial() {
    if (this.tutorial) return;
    const ty = trayY();
    const txt = this.add.text(0, -330, 'ПРОВЕДИ ПАЛЬЦЕМ І КИНЬ', textStyle(34, '#ffffff')).setOrigin(0.5);
    const hand = this.add.image(0, 0, 'hand').setScale(1.1 / L.TS).setOrigin(0.45, 0.05);
    const dots = this.add.graphics();
    dots.fillStyle(0xffffff, 0.85);
    for (let i = 0; i < 7; i++) dots.fillCircle(0, -110 - i * 28, 6 - i * 0.5);
    const c0 = this.cards[0];
    this.tutorial = this.add.container(c0.x, ty, [dots, txt, hand]).setDepth(15);
    txt.setX(L.W / 2 - c0.x);
    this.tweens.add({ targets: txt, scale: { from: 0.95, to: 1.05 }, yoyo: true, repeat: -1, duration: 600 });
    const loop = () => {
      if (!this.tutorial) return;
      hand.setPosition(10, -20).setAlpha(0);
      this.tweens.add({
        targets: hand,
        alpha: 1,
        duration: 200,
        onComplete: () =>
          this.tweens.add({
            targets: hand,
            y: -300,
            x: 40,
            duration: 520,
            ease: 'Cubic.In',
            onComplete: () => this.tweens.add({ targets: hand, alpha: 0, duration: 200, onComplete: () => this.time.delayedCall(350, loop) }),
          }),
      });
    };
    loop();
  }

  hideTutorial() {
    const t = this.tutorial;
    if (!t) return;
    this.tutorial = undefined;
    this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
  }

  // ================================================================== overlays
  private openModal(children: Phaser.GameObjects.GameObject[], dim = 0.62) {
    this.closeModal();
    const bg = this.add.rectangle(L.W / 2, L.H / 2, L.W, L.H, 0x0d0710, dim).setInteractive();
    const c = this.add.container(0, 0, [bg, ...children]).setDepth(50);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 220 });
    this.modal = c;
    this.drag = null;
    this.held.setVisible(false);
    return c;
  }

  private closeModal() {
    if (this.modal) {
      this.modal.destroy();
      this.modal = undefined;
    }
  }

  private panel(x: number, y: number, w: number, h: number, color = 0x241829) {
    const g = this.add.graphics();
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

  /** Four compact stat columns (like the reference final screen). */
  private statCols(stats: RoundStats, x: number, y: number, w: number) {
    const acc = stats.thrown ? Math.round((stats.hits / stats.thrown) * 100) : 0;
    const cols: [string, string][] = [
      ['ВЛУЧНІСТЬ', `${acc}%`],
      ['НАЙБІЛЬШЕ\nКОМБО', `x${stats.bestCombo}`],
      ['КИНУТО\nПРЕДМЕТІВ', `${stats.thrown}`],
      ['УДАРІВ\nВІД СЕРГІЯ', `${stats.hitBy}`],
    ];
    const out: Phaser.GameObjects.GameObject[] = [];
    const cw = w / 4;
    cols.forEach(([k, v], i) => {
      const cx = x - w / 2 + cw * i + cw / 2;
      if (i > 0) {
        const sep = this.add.graphics();
        sep.fillStyle(0xffffff, 0.1);
        sep.fillRect(cx - cw / 2 - 1, y - 30, 2, 80);
        out.push(sep);
      }
      out.push(this.add.text(cx, y - 8, k, uiText(14, '#cbb8da', '800', { align: 'center', lineSpacing: -2 })).setOrigin(0.5, 1));
      out.push(this.add.text(cx, y + 26, v, textStyle(28, '#ffffff', { strokeThickness: 0 })).setOrigin(0.5));
    });
    return out;
  }

  private countUp(text: Phaser.GameObjects.Text, from: number, to: number, dur = 900) {
    const o = { v: from };
    this.tweens.add({
      targets: o,
      v: to,
      duration: dur,
      ease: 'Cubic.Out',
      onUpdate: () => text.setText(fmt(o.v)),
      onComplete: () => {
        text.setText(fmt(to));
        this.punch(text, 1.25);
        audio.score();
      },
    });
  }

  showPause() {
    const W = L.W;
    const cy = L.H / 2;
    const p = this.panel(W / 2, cy, 540, 600);
    const title = this.add.text(W / 2, cy - 236, 'ПАУЗА', textStyle(50, '#ffd23f')).setOrigin(0.5);
    const sub = this.add.text(W / 2, cy - 186, 'Сергій чекає. Підозріло спокійно.', uiText(20, '#d9c9e6', '700')).setOrigin(0.5);
    const resume = new Button(this, W / 2, cy - 96, {
      w: 420,
      h: 88,
      label: 'ПРОДОВЖИТИ',
      onClick: () => {
        this.closeModal();
        this.game2.resumeGame();
      },
    });
    const snd = new Button(this, W / 2 - 106, cy + 16, {
      w: 204,
      h: 72,
      size: 20,
      font: 'ui',
      color: 0x4b3a5c,
      textColor: '#ffffff',
      label: save.sound ? '🔊 ЗВУК' : '🔇 ЗВУК',
      onClick: () => {
        audio.setSound(!save.sound);
        persist();
        snd.setLabel(save.sound ? '🔊 ЗВУК' : '🔇 ЗВУК');
      },
    });
    const mus = new Button(this, W / 2 + 106, cy + 16, {
      w: 204,
      h: 72,
      size: 20,
      font: 'ui',
      color: 0x4b3a5c,
      textColor: '#ffffff',
      label: save.music ? '🎵 МУЗИКА' : '🚫 МУЗИКА',
      onClick: () => {
        audio.setMusic(!save.music);
        persist();
        mus.setLabel(save.music ? '🎵 МУЗИКА' : '🚫 МУЗИКА');
      },
    });
    const restart = new Button(this, W / 2, cy + 120, {
      w: 420,
      h: 72,
      size: 22,
      color: 0x7d6a8f,
      textColor: '#ffffff',
      label: 'ПОЧАТИ РАУНД ЗНОВУ',
      onClick: () => this.restartRound(),
    });
    const menu = new Button(this, W / 2, cy + 214, {
      w: 420,
      h: 72,
      size: 22,
      color: 0xe8323c,
      textColor: '#ffffff',
      label: 'У МЕНЮ',
      onClick: () => this.toMenu(),
    });
    this.openModal([p, title, sub, resume, snd, mus, restart, menu]);
  }

  private restartRound() {
    this.closeModal();
    audio.muffle(false);
    const g = this.game2;
    this.scene.stop();
    g.scene.restart({ mode: g.mode, round: g.def.id, runScore: g.runStart });
  }

  private toMenu() {
    this.closeModal();
    audio.muffle(false);
    const g = this.game2;
    this.scene.stop();
    g.scene.start('Menu');
  }

  showResults(d: {
    kind: 'win';
    title: string;
    line: string;
    stats: RoundStats;
    bonus: { win: number; lives: number; acc: number };
    total: number;
    round: number;
  }) {
    const W = L.W;
    const H = L.H;
    const ph = 640;
    const cy = H - Math.max(L.safeBottom, 12) - ph / 2 - 20;
    const p = this.panel(W / 2, cy, 640, ph);
    const top = cy - ph / 2;
    const hdr = this.add.text(W / 2, top + 36, `РАУНД ${d.round} ПРОЙДЕНО`, uiText(20, '#9dff8a', '800')).setOrigin(0.5).setLetterSpacing(3);
    const title = this.add.text(W / 2, top + 86, d.title, textStyle(38, '#ffd23f')).setOrigin(0.5);
    if (title.width > 580) title.setScale(580 / title.width);
    const line = this.add.text(W / 2, top + 132, d.line, uiText(21, '#ffffff', '700', { align: 'center', wordWrap: { width: 560 } })).setOrigin(0.5, 0);
    const scoreLbl = this.add.text(W / 2, top + 196, 'ОЧКИ ЗА РАУНД', uiText(16, '#cbb8da', '800')).setOrigin(0.5).setLetterSpacing(3);
    const score = this.add.text(W / 2, top + 244, '0', textStyle(58, '#ffffff')).setOrigin(0.5);
    const bonus = this.add
      .text(W / 2, top + 292, `перемога +${fmt(d.bonus.win)} · життя +${fmt(d.bonus.lives)} · влучність +${fmt(d.bonus.acc)}`, uiText(16, '#ffd23f', '700'))
      .setOrigin(0.5);
    const cols = this.statCols(d.stats, W / 2, top + 372, 580);
    const total = this.add.text(W / 2, top + 452, `ЗАГАЛОМ: ${fmt(d.total)}`, textStyle(22, '#ffffff', { strokeThickness: 0 })).setOrigin(0.5);
    const next = new Button(this, W / 2 + 80, top + 548, {
      w: 380,
      h: 90,
      label: 'ДАЛІ  →',
      size: 30,
      onClick: () => {
        this.closeModal();
        const g = this.game2;
        this.scene.stop();
        g.scene.restart({ mode: 'campaign', round: Math.min(5, d.round + 1), runScore: d.total });
      },
    });
    const menu = new Button(this, W / 2 - 200, top + 548, {
      w: 150,
      h: 90,
      label: 'МЕНЮ',
      size: 22,
      color: 0x7d6a8f,
      textColor: '#ffffff',
      onClick: () => this.toMenu(),
    });
    this.openModal([p, hdr, title, line, scoreLbl, score, bonus, ...cols, total, next, menu], 0.3);
    this.countUp(score, 0, d.stats.score);
  }

  showGameOver(d: { endless: boolean; stats: RoundStats; total: number; wave: number; record: boolean; round: number }) {
    const W = L.W;
    const H = L.H;
    const ph = 640;
    const cy = H - Math.max(L.safeBottom, 12) - ph / 2 - 20;
    const p = this.panel(W / 2, cy, 640, ph, 0x2c1422);
    const top = cy - ph / 2;
    const title = this.add.text(W / 2, top + 60, 'СЕРГІЙ ВИСТОЯВ', textStyle(46, '#ff4a4a')).setOrigin(0.5);
    const lineStr = d.endless ? `Хвиля ${d.wave}. Він усе ще тут.` : 'Цього разу. Він запам’ятає.';
    const line = this.add.text(W / 2, top + 114, lineStr, uiText(22, '#ffffff', '700')).setOrigin(0.5);
    const scoreLbl = this.add
      .text(W / 2, top + 166, d.record ? 'НОВИЙ РЕКОРД!' : 'РАХУНОК', uiText(18, d.record ? '#9dff8a' : '#cbb8da', '800'))
      .setOrigin(0.5)
      .setLetterSpacing(3);
    const score = this.add.text(W / 2, top + 218, '0', textStyle(60, '#ffd23f')).setOrigin(0.5);
    const best = d.endless ? save.endlessHigh : save.highScore;
    const bestT = this.add.text(W / 2, top + 266, `Найкращий результат: ${fmt(best)}`, uiText(18, '#cbb8da', '700')).setOrigin(0.5);
    const cols = this.statCols(d.stats, W / 2, top + 344, 580);
    const again = new Button(this, W / 2 + 80, top + 452, {
      w: 380,
      h: 88,
      label: 'ЩЕ РАЗ',
      onClick: () => {
        this.closeModal();
        const g = this.game2;
        this.scene.stop();
        g.scene.restart({ mode: g.mode, round: g.def.id, runScore: g.runStart });
      },
    });
    const menu = new Button(this, W / 2 - 200, top + 452, {
      w: 150,
      h: 88,
      label: 'МЕНЮ',
      size: 22,
      color: 0x7d6a8f,
      textColor: '#ffffff',
      onClick: () => this.toMenu(),
    });
    const share = new Button(this, W / 2, top + 560, {
      w: 560,
      h: 70,
      label: '↗  ПОДІЛИТИСЯ РЕЗУЛЬТАТОМ',
      size: 20,
      color: 0x2a2233,
      textColor: '#ffffff',
      onClick: () => this.doShare(d.total, d.endless),
    });
    this.openModal([p, title, line, scoreLbl, score, bestT, ...cols, again, menu, share], 0.4);
    this.countUp(score, 0, d.total);
  }

  showVictory(d: { total: number; stats: RoundStats; bonus: { win: number; lives: number; acc: number }; firstClear: boolean }) {
    const W = L.W;
    const H = L.H;
    const top0 = hudTop();
    // big title over the scene, like the reference
    const t1 = this.add.text(W / 2, top0 + 70, 'СЕРГІЙ', textStyle(84, '#ff3b30', { stroke: '#ffffff', strokeThickness: 12 })).setOrigin(0.5).setAngle(-3);
    const t2 = this.add.text(W / 2, top0 + 150, 'ПРОГРАВ ВСІМ', textStyle(56, '#ffffff', { stroke: '#1a0f1f', strokeThickness: 12 })).setOrigin(0.5).setAngle(-3);
    const t3 = this.add.text(W / 2, top0 + 214, 'Дивно. Хто б міг подумати.', uiText(26, '#ffffff', '800', { stroke: '#1a0f1f', strokeThickness: 7 })).setOrigin(0.5);
    const ph = 640;
    const cy = H - Math.max(L.safeBottom, 12) - ph / 2 - 10;
    const p = this.panel(W / 2, cy, 640, ph, 0x1f1726);
    const top = cy - ph / 2;
    const lbl = this.add.text(W / 2, top + 36, 'ФІНАЛЬНИЙ РЕЗУЛЬТАТ', uiText(20, '#cbb8da', '800')).setOrigin(0.5).setLetterSpacing(3);
    const score = this.add.text(W / 2, top + 92, '0', textStyle(70, '#ffd23f')).setOrigin(0.5);
    const rec = this.add.text(W / 2, top + 140, `Найкращий результат: ${fmt(save.highScore)}`, uiText(17, '#cbb8da', '700')).setOrigin(0.5);
    const cols = this.statCols(d.stats, W / 2, top + 206, 590);
    const unlock = this.add
      .text(W / 2, top + 286, d.firstClear ? '🔓 Відкрито: «СЕРГІЙ: НЕ ТРЕБА БУЛО»' : '«СЕРГІЙ: НЕ ТРЕБА БУЛО» чекає на реванш', uiText(19, '#9dff8a', '800', { align: 'center' }))
      .setOrigin(0.5);
    const again = new Button(this, W / 2, top + 366, {
      w: 580,
      h: 80,
      label: 'ЩЕ РАЗ',
      size: 28,
      color: 0xffc93c,
      onClick: () => {
        this.closeModal();
        const g = this.game2;
        this.scene.stop();
        g.scene.restart({ mode: 'campaign', round: 1, runScore: 0 });
      },
    });
    const rematch = new Button(this, W / 2, top + 460, {
      w: 580,
      h: 80,
      label: 'РЕВАНШ ІЗ СЕРГІЄМ',
      size: 26,
      color: 0x2f8fff,
      textColor: '#ffffff',
      onClick: () => {
        this.closeModal();
        const g = this.game2;
        this.scene.stop();
        g.scene.start('Endless');
      },
    });
    const share = new Button(this, W / 2, top + 556, {
      w: 580,
      h: 74,
      label: '↗  ПОДІЛИТИСЯ РЕЗУЛЬТАТОМ',
      size: 21,
      color: 0x2a2233,
      textColor: '#ffffff',
      onClick: () => this.doShare(d.total, false),
    });
    this.tweens.add({ targets: this.topUi, alpha: 0, duration: 300 });
    const c = this.openModal([t1, t2, t3, p, lbl, score, rec, ...cols, unlock, again, rematch, share], 0.12);
    for (const o of [t1, t2]) {
      o.setScale(0);
      this.tweens.add({ targets: o, scale: 1, duration: 500, ease: 'Back.Out', delay: o === t2 ? 150 : 0 });
    }
    void c;
    this.countUp(score, 0, d.total, 1400);
  }

  private async doShare(score: number, endless: boolean) {
    const r = await shareScore(score, endless);
    if (r === 'copied') this.toast('Скопійовано! Встав у чат 😉', '#9dff8a');
    else if (r === 'fail') this.toast('Не вдалося поділитися', '#ff8a8a');
  }

  // ================================================================== frame
  private punch(o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, k = 1.2) {
    const obj = o as any;
    const base = obj.__baseScale ?? obj.scaleX;
    obj.__baseScale = base;
    this.tweens.killTweensOf(o);
    obj.setScale(base * k);
    this.tweens.add({ targets: o, scale: base, duration: 260, ease: 'Back.Out' });
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    const g = this.game2;
    if (!g || (!g.sys.isActive() && !g.sys.isPaused())) return;
    const top = hudTop();

    if (this.scoreShown !== g.score) {
      const diff = g.score - this.scoreShown;
      this.scoreShown += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 10)));
      if (Math.abs(g.score - this.scoreShown) < 2) this.scoreShown = g.score;
      this.scoreText.setText(`★ ${fmt(this.scoreShown)}`);
    }
    if (this.heartsShown !== g.hearts) this.heartsChanged(g.hearts < this.heartsShown);

    // patience bar
    const target = g.patienceDisplay;
    this.barShown += (target - this.barShown) * Math.min(1, dt * 12);
    if (this.barShown < this.barGhost) this.barGhost = Math.max(this.barShown, this.barGhost - dt * 22);
    else this.barGhost = this.barShown;
    if (Math.abs(target - this.barShown) > 1.5) this.barShake = 0.25;
    this.barShake = Math.max(0, this.barShake - dt);
    this.drawBar(top + 124, g.rage);
    this.barPct.setText(`${Math.ceil(this.barShown)}%`);
    if (this.rageLabel.visible) this.rageLabel.setAngle(-4 + Math.sin(this.t * 20) * 1.5);

    // combo
    const mult = comboMult(g.combo);
    if (g.combo !== this.comboShown) {
      this.comboShown = g.combo;
      if (mult >= 2) {
        this.comboText.setVisible(true).setText(`КОМБО x${mult}`).setAlpha(1);
        this.punch(this.comboText, 1.25);
      } else this.comboText.setVisible(false);
      if (g.combo === 0) this.comboCap.setVisible(false);
    }

    // inventory
    this.refreshCards();
    if (this.drag && this.held.visible) {
      const d = this.drag;
      this.held.x += (d.x - this.held.x) * Math.min(1, dt * 35);
      this.held.y += (d.y - this.held.y) * Math.min(1, dt * 35);
      this.held.setRotation((d.x - d.sx) * 0.002);
    }
    for (const c of this.cards) if (c.glow.visible) c.glow.setRotation(this.t * 0.8).setScale(0.85 + Math.sin(this.t * 6) * 0.08);
    const sel = this.cards[g.selected];
    if (sel && !this.tweens.isTweening(sel.icon)) sel.icon.setY(sel.y - 16 + Math.sin(this.t * 4) * 3);

    // threat indicators
    if (this.threatActive) {
      this.threatT += dt;
      const inDanger = g.lane === this.threatLane;
      const pulse = 1 + Math.sin(this.t * 16) * 0.07;
      this.dodgeText.setVisible(inDanger).setScale(pulse);
      if (!inDanger) this.dodgeHint.setVisible(false);
      for (const a of this.chevrons) a.setVisible(inDanger).setAlpha(0.65 + Math.sin(this.t * 14) * 0.35);
      this.chevrons[0].x = 70 - Math.abs(Math.sin(this.t * 7)) * 18;
      this.chevrons[1].x = L.W - 70 + Math.abs(Math.sin(this.t * 7)) * 18;
      this.threatVig.setAlpha(inDanger ? 0.55 + Math.sin(this.t * 10) * 0.2 : 0.15);
      this.threatTitle.setAlpha(inDanger ? 1 : 0.5);
    }

    if (this.danger > 0) {
      const base = this.danger >= 2 ? 0.8 : 0.45;
      const sp = this.danger >= 2 ? 7 : 2.5;
      this.vignette.setAlpha(base + Math.sin(this.t * sp) * 0.15);
      this.rageTint.setAlpha(this.danger >= 2 ? 0.5 + Math.sin(this.t * 7) * 0.06 : 0.12);
    }
  }

  private drawBar(y: number, rage: boolean) {
    const g = this.barG;
    const W = L.W;
    const x0 = 36;
    const w = W - 72;
    const h = 34;
    const sx = this.barShake > 0 ? Math.sin(this.t * 90) * 4 * (this.barShake / 0.25) : 0;
    g.clear();
    g.fillStyle(0x0e0710, 1);
    g.fillRoundedRect(x0 - 4 + sx, y - h / 2 - 4, w + 8, h + 8, 14);
    g.fillStyle(0x3a2a44, 1);
    g.fillRoundedRect(x0 + sx, y - h / 2, w, h, 11);
    const v = clamp(this.barShown / 100, 0, 1);
    const ghost = clamp(this.barGhost / 100, 0, 1);
    if (ghost > v) {
      g.fillStyle(0xffffff, 0.75);
      g.fillRoundedRect(x0 + sx, y - h / 2, Math.max(22, w * ghost), h, 11);
    }
    let c1 = 0x7be34a;
    let c2 = 0x2f9e2f;
    if (this.barShown <= 75) (c1 = 0xd8e84a), (c2 = 0x9ab020);
    if (this.barShown <= 50) (c1 = 0xffc233), (c2 = 0xe08a10);
    if (this.barShown <= 25) (c1 = 0xff7a3a), (c2 = 0xd2381a);
    if (this.barShown <= 10 || rage) {
      const on = this.t % 0.4 < 0.2;
      c1 = on ? 0xff3a3a : 0xd00020;
      c2 = 0x8a0010;
    }
    if (v > 0.004) {
      const bw = Math.max(22, w * v);
      g.fillGradientStyle(c1, c1, c2, c2, 1);
      g.fillRoundedRect(x0 + sx, y - h / 2, bw, h, 11);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(x0 + 8 + sx, y - h / 2 + 5, Math.max(8, bw - 16), 7, 3.5);
    }
    this.barPct.setX(W - 50 + sx);
  }
}
