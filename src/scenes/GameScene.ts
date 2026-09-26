import Phaser from 'phaser';
import { K, L, hudTop } from '../core/layout';
import { audio } from '../core/audio';
import { persist, save } from '../core/save';
import { TABLE_Y, GROUND_Y } from '../core/background';
import { ITEM_PX } from '../core/textures';
import { chance, clamp, lerp, pick, rand, sign, vibrate, weighted } from '../core/util';
import {
  BONUS_KINDS,
  COMBO_STEPS,
  ENDLESS,
  EVENTS,
  HEAD_CAPTIONS,
  ITEMS,
  LINES,
  ROUNDS,
  comboMult,
  type ItemDef,
  type ItemKind,
  type RoundDef,
  type ThrowBackKind,
} from '../data/config';
import { Stage } from '../game/Stage';
import { Sergii } from '../game/Sergii';
import { Fx } from '../game/Fx';
import { Crowd, QUEUE_TEXT, crowdJoinText, randJoin } from '../game/Crowd';
import { Speech } from '../game/Speech';
import type { HudScene } from './HudScene';

export interface GameData {
  mode: 'campaign' | 'endless';
  round: number;
  runScore: number;
}

export interface RoundStats {
  thrown: number;
  hits: number;
  heads: number;
  bestCombo: number;
  hitBy: number;
  dodges: number;
  score: number;
  catches: number;
}

type Act =
  | 'free'
  | 'windup'
  | 'bellyWindup'
  | 'bellyRecover'
  | 'recover'
  | 'catching'
  | 'catchHold'
  | 'offscreen'
  | 'returning'
  | 'tantrum'
  | 'intro'
  | 'exhausted'
  | 'laugh';

interface Proj {
  active: boolean;
  def: ItemDef;
  X: number;
  Y: number;
  Z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  resolved: boolean;
  debris: boolean;
  npc: boolean;
  T: number;
  X1: number;
  Y1: number;
  age: number;
  catchPlanned: boolean;
  trail: { x: number; y: number }[];
}

interface Incoming {
  active: boolean;
  kind: ItemKind;
  img: Phaser.GameObjects.Image;
  X0: number;
  Y0: number;
  Xt: number;
  Yt: number;
  T: number;
  t: number;
  lane: number;
  rot: number;
  vrot: number;
  resolved: boolean;
  dodged: boolean;
}

interface Plan {
  t: number;
  type: 'dodge' | 'catch';
  proj: Proj;
}

const G = 2600;
const Z0 = 0.42;
const ZEND = 0.2;
const LANE_X = 95;
const BELLY_FLIGHT = 0.58;

export const itemScale = (kind: ItemKind, z = 1) => (ITEMS[kind].size * K) / (0.78 * ITEM_PX) / z;

export class GameScene extends Phaser.Scene {
  mode: 'campaign' | 'endless' = 'campaign';
  roundIdx = 0;
  def!: RoundDef;
  stage!: Stage;
  sergii!: Sergii;
  fx!: Fx;
  crowd!: Crowd;
  speech!: Speech;
  hud!: HudScene;
  trail!: Phaser.GameObjects.Graphics;

  state: 'intro' | 'play' | 'end' = 'intro';
  act: Act = 'intro';
  actT = 0;
  patience = 100;
  hearts = 3;
  score = 0;
  runStart = 0;
  combo = 0;
  missStreak = 0;
  moodLevel = 0;
  stats: RoundStats = { thrown: 0, hits: 0, heads: 0, bestCombo: 0, hitBy: 0, dodges: 0, score: 0, catches: 0 };
  wave = 1;
  ammo = { poop: 0, can: 0 };
  bonus: { kind: ItemKind | null; count: number } = { kind: null, count: 0 };
  selected = 0;
  private poopT = 0;
  private canT = 0;
  private dropT = 12;

  rage = false;
  rageUsed = false;
  rageTime = 0;
  rageTotal = 18;
  rageElapsed = 0;

  lane = 0;
  laneHold = 0;

  timeScale = 1;
  private slowT = 0;
  private slowTarget = 1;
  hitStop = 0;
  simTime = 0;

  private projs: Proj[] = [];
  private incoming: Incoming[] = [];
  private plans: Plan[] = [];
  private tableJunk: { img: Phaser.GameObjects.Image; life: number }[] = [];

  // AI
  private targetX = 0;
  private moveT = 0;
  private sidestepT = 0;
  private flinchT = 0;
  private dodgeT = 0;
  private dodgeCD = 0;
  private catchCD = 0;
  private catchProj: Proj | null = null;
  private attackT = 8;
  private atkKind: ItemKind = 'tomato';
  atkLane = 0;
  private atkCombo = 0;
  private eventT = 25;
  private lastEvent = '';
  private rushT = 0;
  private shieldT = 0;
  private bellyCooldown = 3;
  private bellyLane = 0;
  private bellyFlight = 0;
  private bellyFx!: Phaser.GameObjects.Graphics;
  private offSide = 1;
  private offT = 0;
  private crowdJoinT = 3;
  private crowdThrowT = 4;
  private queueAnnounced = false;
  private lastCaption = '';
  private firstHitDone = false;
  private tutorialAttackHold = false;

  // tuned difficulty (per round / endless wave)
  tune = { speed: 1, dodge: 1, catchC: 1, atk: 1, tele: 0, flight: 1, dmg: 1 };

  constructor() {
    super('Game');
  }

  init(data: GameData) {
    this.mode = data?.mode ?? 'campaign';
    this.roundIdx = clamp((data?.round ?? 1) - 1, 0, ROUNDS.length - 1);
    this.def = this.mode === 'endless' ? { ...ENDLESS } : ROUNDS[this.roundIdx];
    this.runStart = data?.runScore ?? 0;
    this.score = this.runStart;
    this.state = 'intro';
    this.act = 'intro';
    this.patience = 100;
    this.hearts = 3;
    this.combo = 0;
    this.missStreak = 0;
    this.moodLevel = 0;
    this.stats = { thrown: 0, hits: 0, heads: 0, bestCombo: 0, hitBy: 0, dodges: 0, score: 0, catches: 0 };
    this.wave = 1;
    this.rage = false;
    this.rageUsed = false;
    this.rageElapsed = 0;
    this.lane = 0;
    this.laneHold = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.slowTarget = 1;
    this.hitStop = 0;
    this.simTime = 0;
    this.lastThrow = -1;
    this.projs = [];
    this.incoming = [];
    this.plans = [];
    this.tableJunk = [];
    this.targetX = 0;
    this.moveT = 1;
    this.dodgeT = 0;
    this.dodgeCD = 0;
    this.catchCD = 3;
    this.catchProj = null;
    this.atkCombo = 0;
    this.rushT = 0;
    this.shieldT = 0;
    this.bellyCooldown = 3;
    this.bellyLane = 0;
    this.bellyFlight = 0;
    this.crowdJoinT = 3.5;
    this.crowdThrowT = 5;
    this.queueAnnounced = false;
    this.firstHitDone = false;
    const easy = save.difficulty === 'easy';
    this.tune = {
      speed: easy ? 0.8 : 1,
      dodge: easy ? 0.5 : 1,
      catchC: easy ? 0.6 : 1,
      atk: easy ? 1.3 : 1,
      tele: easy ? 0.35 : 0,
      flight: easy ? 1.15 : 1,
      dmg: easy ? 1.2 : 1,
    };
    this.attackT = rand(this.def.attackEvery[0], this.def.attackEvery[1]) * this.tune.atk * (this.def.id === 1 ? 1.1 : 0.8);
    this.eventT = rand(16, 26);
    this.tutorialAttackHold = this.def.id === 1 && !save.tutorialDone;
    const early = this.mode === 'campaign' && this.def.id === 1;
    this.ammo = { poop: early ? 0 : this.def.id === 2 ? 8 : 10, can: early ? 4 : this.def.id === 2 ? 5 : 6 };
    this.bonus = { kind: null, count: 0 };
    this.selected = 0;
    this.poopT = 5;
    this.canT = 7;
    this.dropT = this.def.id >= 3 || this.mode === 'endless' ? rand(7, 11) : rand(16, 22);
  }

  // ================================================================== inventory
  slotKind(i: number): ItemKind | null {
    return i === 0 ? 'tomato' : i === 1 ? 'poop' : i === 2 ? 'can' : this.bonus.kind;
  }

  slotCount(i: number) {
    if (i === 0) return Infinity;
    if (i === 1) return this.ammo.poop;
    if (i === 2) return this.ammo.can;
    return this.bonus.count;
  }

  slotLocked(i: number) {
    return i === 1 && this.mode === 'campaign' && this.def.id === 1;
  }

  private consume(i: number) {
    if (i === 1) this.ammo.poop--;
    else if (i === 2) this.ammo.can--;
    else if (i === 3) {
      this.bonus.count--;
      if (this.bonus.count <= 0) this.bonus.kind = null;
    }
    if (i !== 0 && this.slotCount(i) <= 0 && this.selected === i) this.selected = 0;
  }

  private updateAmmo(dt: number) {
    if (this.state !== 'play') return;
    if (!this.slotLocked(1)) {
      this.poopT -= dt;
      if (this.poopT <= 0) {
        this.poopT = 5;
        if (this.ammo.poop < 12) this.ammo.poop++;
      }
    }
    this.canT -= dt;
    if (this.canT <= 0) {
      this.canT = 7;
      if (this.ammo.can < 8) this.ammo.can++;
    }
    if (this.def.bonus > 0) {
      this.dropT -= dt;
      if (this.dropT <= 0) {
        this.dropT = this.def.id >= 3 || this.mode === 'endless' ? rand(8, 14) : rand(18, 26);
        this.dropBonus();
      }
    }
  }

  private dropBonus() {
    const goldP = Math.min(0.12, this.def.gold * 4 * (this.mode === 'endless' ? 1 + this.wave * 0.1 : 1));
    const kind: ItemKind = chance(goldP) ? 'gold' : pick(BONUS_KINDS);
    if (this.bonus.kind === kind) this.bonus.count += kind === 'egg' ? 2 : 1;
    else this.bonus = { kind, count: kind === 'egg' ? 2 : 1 };
    this.hud.bonusDropped(kind);
    if (kind === 'gold') this.onGoldenAppear();
  }


  create() {
    const cam = this.cameras.main;
    cam.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    cam.setBackgroundColor('#1a1020');
    this.stage = new Stage(this);
    this.sergii = new Sergii(this, this.stage);
    this.fx = new Fx(this);
    this.crowd = new Crowd(this, this.stage);
    this.speech = new Speech(this);
    this.trail = this.add.graphics().setDepth(39);
    this.bellyFx = this.add.graphics().setDepth(55);
    this.sergii.onSteam = (x, y) => this.fx.steam(x, y);
    if (this.mode === 'endless') this.sergii.crown.setVisible(true);
    this.sergii.x = 0;
    this.sergii.y.x = -40;
    this.sergii.y.target = 0;

    save.played = true;
    persist();

    this.scene.launch('Hud', { game: this });
    this.hud = this.scene.get('Hud') as HudScene;

    audio.startMusic('game');
    audio.setIntensity(0);
    audio.setRush(false);

    const onVis = () => {
      if (document.hidden && this.state !== 'end' && this.scene.isActive()) this.pauseGame();
    };
    document.addEventListener('visibilitychange', onVis);
    const onLayout = () => this.relayout();
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVis);
      this.game.events.off('layout', onLayout);
      this.tweens.killAll();
    });

    this.cameras.main.fadeIn(280, 26, 16, 32);
    this.time.delayedCall(80, () => this.startIntro());
  }

  relayout() {
    this.cameras.main.setZoom(L.Z).centerOn(L.W / 2, L.H / 2);
    this.stage.layout();
  }

  // ================================================================== flow
  private startIntro() {
    const title = this.mode === 'endless' ? this.def.title : `РАУНД ${this.def.id}`;
    const sub = this.mode === 'endless' ? this.def.intro : this.def.title;
    const line = this.mode === 'endless' ? 'Не треба було.' : this.def.id === 5 ? 'Ну все.' : pick(LINES.start);
    this.hud.roundIntro(title, sub, this.mode === 'endless' ? '' : this.def.intro);
    this.time.delayedCall(700, () => this.say(line, true));
    this.time.delayedCall(1900, () => {
      this.state = 'play';
      this.act = 'free';
      audio.whistle();
      if (this.def.id === 1 && !save.tutorialDone && this.mode === 'campaign') this.hud.showTutorial();
    });
  }

  pauseGame() {
    if (this.state === 'end' || !this.scene.isActive()) return;
    this.scene.pause();
    audio.muffle(true);
    this.hud.showPause();
  }

  resumeGame() {
    audio.muffle(false);
    this.scene.resume();
  }

  get patienceDisplay() {
    if (this.rage) return (this.def.rageAt * Math.max(0, this.rageTime)) / this.rageTotal;
    return this.patience;
  }

  get threat() {
    return this.act === 'windup' || this.act === 'bellyWindup' || this.bellyFlight > 0 || this.incoming.some((i) => i.active && !i.resolved);
  }

  // ================================================================== input API (called by HUD)
  private lastThrow = 0;

  canThrow() {
    return (
      this.state === 'play' &&
      this.simTime - this.lastThrow > 0.26 &&
      this.projs.filter((p) => p.active && !p.resolved && !p.npc).length < 5
    );
  }

  onGoldenAppear() {
    audio.golden();
    this.slowmo(0.35, 0.75);
    this.say(LINES.golden, true);
  }

  /** sx, sy: release point (logical). vx, vy: swipe velocity (logical px/s). speedCss: swipe speed in CSS px/s */
  throwItem(slot: number, sx: number, sy: number, vx: number, vy: number, speedCss: number) {
    if (!this.canThrow()) return false;
    const kind = this.slotKind(slot);
    if (!kind || this.slotLocked(slot) || this.slotCount(slot) <= 0) return false;
    this.consume(slot);
    this.lastThrow = this.simTime;
    const def = ITEMS[kind];
    let p = speedCss / 1050;
    if (p > 1) p = 1 + 0.25 * Math.tanh((speedCss - 1050) / 900);
    p = clamp(p, 0.22, 1.25);
    const st = this.stage;
    const X0 = st.wx(sx, Z0);
    const Y0 = st.wy(sy, Z0);
    const head = this.sergii.headCenter();
    let Y1 = p <= 1 ? head.y + (1 - p) * 560 : head.y - (p - 1) * 300;
    const T = (0.62 / def.speed) * (1.2 - 0.24 * Math.min(p, 1.2));
    const ang = clamp(Math.atan2(vx, -vy), -0.8, 0.8);
    const tgtY = st.py(Y1);
    const xAim = sx + Math.tan(ang) * Math.max(0, sy - tgtY);
    let X1 = st.wx(xAim, 1);
    // aim assist
    const ph = this.sergii.predictHead(T);
    const dx = ph.x - X1;
    if (save.difficulty === 'easy') {
      if (Math.abs(dx) < 175) X1 += dx * 0.6;
      if (p > 0.5 && Math.abs(Y1 - head.y) < 280) Y1 += (head.y - Y1) * 0.5;
    } else if (Math.abs(dx) < 60) X1 += dx * 0.2;
    const pr = this.spawnProj(def, X0, Y0, Z0, X1, Y1, T, false);
    this.stats.thrown++;
    audio.whoosh(p);
    this.aiReact(pr);
    return true;
  }

  dodge(dir: number) {
    if (this.state !== 'play') return;
    const nl = dir < 0 ? -1 : 1;
    if (this.lane !== nl) audio.whoosh(0.5);
    this.lane = nl;
    this.laneHold = 0.55;
  }

  // ================================================================== projectiles
  private spawnProj(def: ItemDef, X0: number, Y0: number, z0: number, X1: number, Y1: number, T: number, npc: boolean) {
    let p = this.projs.find((q) => !q.active);
    if (!p) {
      p = {
        active: false,
        def,
        X: 0,
        Y: 0,
        Z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rot: 0,
        vrot: 0,
        img: this.add.image(0, 0, 'it_' + def.kind),
        shadow: this.add.image(0, 0, 'shadow').setDepth(3),
        resolved: false,
        debris: false,
        npc,
        T,
        X1,
        Y1,
        age: 0,
        catchPlanned: false,
        trail: [],
      };
      this.projs.push(p);
    }
    p.active = true;
    p.def = def;
    p.img.setTexture('it_' + def.kind).setVisible(true).setAlpha(1).clearTint();
    p.shadow.setVisible(true);
    p.X = X0;
    p.Y = Y0;
    p.Z = z0;
    p.vz = (1 - z0) / T;
    p.vx = (X1 - X0) / T;
    p.vy = (Y1 - Y0 - 0.5 * G * T * T) / T;
    p.rot = rand(-0.4, 0.4);
    p.vrot = def.spin * (Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1.2);
    p.resolved = false;
    p.debris = false;
    p.npc = npc;
    p.T = T;
    p.X1 = X1;
    p.Y1 = Y1;
    p.age = 0;
    p.catchPlanned = false;
    p.trail.length = 0;
    return p;
  }

  private killProj(p: Proj) {
    p.active = false;
    p.img.setVisible(false);
    p.shadow.setVisible(false);
    p.trail.length = 0;
  }

  private updateProjs(dt: number) {
    const st = this.stage;
    for (const p of this.projs) {
      if (!p.active) continue;
      const prevZ = p.Z;
      p.age += dt;
      p.X += p.vx * dt;
      p.Y += p.vy * dt;
      p.vy += G * dt;
      p.Z += p.vz * dt;
      p.rot += p.vrot * dt;
      if (!p.resolved && prevZ < 1 && p.Z >= 1) {
        // back-step to the exact crossing of Sergii's plane
        const f = (p.Z - 1) / Math.max(1e-4, p.vz * dt);
        p.X -= p.vx * dt * f;
        p.Y -= p.vy * dt * f;
        p.Z = 1;
        this.resolve(p);
        if (!p.active) continue;
      }
      if (p.debris) {
        if (p.vy > 0 && p.Y >= TABLE_Y + 8 && p.Z > 0.78 && p.Z < 1.12 && Math.abs(st.px(p.X, p.Z) - L.W / 2) < 560) {
          this.settleOnTable(p);
          continue;
        }
        if (p.Z < 0.35 || st.py(p.Y, p.Z) > L.H + 120 || p.age > 4) {
          this.killProj(p);
          continue;
        }
      } else if (p.resolved) {
        // missed: flying behind Sergii
        const sy = st.py(p.Y, p.Z);
        if (p.Z > 1.02 && sy > st.hy + TABLE_Y - 6) {
          audio.thud();
          this.killProj(p);
          continue;
        }
        if (p.Y >= GROUND_Y || p.Z > 5) {
          this.fx.smoke(st.px(p.X, p.Z), st.py(Math.min(p.Y, GROUND_Y), p.Z), 3, 0xc9d8b0);
          this.killProj(p);
          continue;
        }
      }
      const z = Math.max(0.1, p.Z);
      const sx = st.px(p.X, z);
      const sy = st.py(p.Y, z);
      const sc = itemScale(p.def.kind, z);
      p.img.setPosition(sx, sy).setRotation(p.rot).setScale(sc * (p.def.kind === 'fish' ? 1.1 : 1));
      p.img.setDepth(p.Z > 1.0 ? 10 : 40 + (1 - p.Z));
      if (p.Z > 1.6) p.img.setAlpha(clamp(1 - (p.Z - 1.6) / 3, 0, 1));
      // shadow on the ground
      const gy = st.py(GROUND_Y, z);
      const h = clamp((GROUND_Y - p.Y) / 700, 0, 1);
      p.shadow.setPosition(sx, gy).setScale((sc * ITEM_PX) / 128 * (1.1 - h * 0.4), (sc * ITEM_PX) / 128 * 0.9 * (1.1 - h * 0.4));
      p.shadow.setAlpha((1 - h) * 0.55 + 0.1).setVisible(z < 0.95 || z > 1.4);
      // motion trail
      if (!p.debris && !p.resolved) {
        p.trail.unshift({ x: sx, y: sy });
        if (p.trail.length > 8) p.trail.pop();
      } else if (p.trail.length) p.trail.pop();
    }
  }

  private drawTrails() {
    const g = this.trail;
    g.clear();
    for (const p of this.projs) {
      if (!p.active || p.trail.length < 2) continue;
      const w0 = (p.def.size * 0.55) / Math.max(0.3, p.Z);
      const col = p.def.kind === 'gold' ? 0xffe066 : 0xffffff;
      for (let i = 1; i < p.trail.length; i++) {
        const k = 1 - i / p.trail.length;
        g.lineStyle(Math.max(1, w0 * k), col, 0.28 * k);
        g.lineBetween(p.trail[i - 1].x, p.trail[i - 1].y, p.trail[i].x, p.trail[i].y);
      }
    }
    for (const inc of this.incoming) {
      if (!inc.active || inc.resolved) continue;
    }
  }

  private resolve(p: Proj) {
    p.resolved = true;
    if (p.catchPlanned && this.act === 'catching' && this.catchProj === p) {
      this.doCatch(p);
      return;
    }
    const r = p.def.size * 0.5;
    const hit = this.sergii.hitTest(p.X, p.Y, r);
    if (hit === 'head' || hit === 'body') this.onHit(p, hit);
    else if (hit === 'shield') this.onBlocked(p);
    else if (p.Y > TABLE_Y - r * 0.4 && p.Y < TABLE_Y + 170) this.onTable(p);
    else this.onMiss(p);
  }

  private makeDebris(p: Proj, awayX: number, up = 1) {
    p.debris = true;
    p.vz = -rand(0.1, 0.26);
    p.vy = -rand(620, 900) * up;
    p.vx = sign(awayX) * rand(140, 380);
    p.vrot = rand(12, 20) * (Math.random() < 0.5 ? -1 : 1);
    p.trail.length = 0;
  }

  private settleOnTable(p: Proj) {
    const st = this.stage;
    const img = this.add
      .image(st.px(p.X, p.Z), st.py(TABLE_Y + 16, 0.95), 'it_' + p.def.kind)
      .setScale(itemScale(p.def.kind, 0.95))
      .setRotation(p.def.kind === 'can' || p.def.kind === 'tp' ? (Math.random() < 0.5 ? -1.45 : 1.45) : rand(-0.5, 0.5))
      .setDepth(31);
    this.tableJunk.push({ img, life: 9 });
    if (this.tableJunk.length > 9) {
      const old = this.tableJunk.shift()!;
      old.img.destroy();
    }
    if (p.def.kind === 'can') audio.clang();
    else audio.thud();
    this.fx.smoke(img.x, img.y + 10, 2, 0xd8c7a8);
    this.killProj(p);
  }

  private tableSplat(x: number, kind: string) {
    const st = this.stage;
    const img = this.add
      .image(st.px(x, 0.93), st.py(TABLE_Y + 22, 0.93) + rand(0, 20), `sp_${kind}_0`)
      .setScale(0.5 * K, 0.26 * K)
      .setDepth(30.5);
    this.tableJunk.push({ img, life: 6 });
    if (this.tableJunk.length > 9) this.tableJunk.shift()!.img.destroy();
  }

  private onHit(p: Proj, where: 'head' | 'body') {
    const head = where === 'head';
    const st = this.stage;
    const sx = st.px(p.X);
    const sy = st.py(p.Y);
    const def = p.def;
    let pts: number;
    if (!p.npc) {
      this.combo++;
      this.stats.hits++;
      if (head) this.stats.heads++;
      this.missStreak = 0;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      pts = def.points * (head ? 2 : 1) * comboMult(this.combo);
    } else {
      pts = 25;
    }
    this.addScore(pts);

    // damage
    let dmg = def.damage * this.def.dmgMul * this.tune.dmg * (head ? 1.35 : 1);
    if (p.npc) dmg *= 0.55;
    if (this.mode === 'endless') dmg *= Math.max(0.6, 1 - (this.wave - 1) * 0.05);

    // juice
    const hc = this.sergii.headCenter();
    const dirX = Math.abs(p.X - hc.x) < 12 ? sign(p.vx || 1) : sign(hc.x - p.X);
    const strength = clamp(def.damage / 5, 0.7, 1.6) * (head ? 1 : 0.8);
    this.sergii.punch(dirX, strength, head);
    if (chance(head ? 0.6 : 0.35)) this.flinch(p.X < hc.x ? -1 : 1, false);
    const tints = def.tint;
    switch (def.kind) {
      case 'tomato':
        this.fx.splash(sx, sy, tints, 1.1, 22);
        audio.splat('red');
        break;
      case 'poop':
        this.fx.splash(sx, sy, tints, 0.9, 18);
        audio.splat('brown');
        break;
      case 'can':
        this.fx.clang(sx, sy);
        audio.clang();
        this.fx.float(sx + rand(-20, 20), sy - 30, 'ДЗЕНЬ!', 30, '#bfe3ff', 60, 250);
        break;
      case 'egg':
        this.fx.eggShards(sx, sy);
        this.fx.splash(sx, sy, tints, 0.8, 12);
        audio.crack();
        audio.splat('yolk');
        break;
      case 'slipper':
        this.fx.clang(sx, sy);
        audio.slap();
        this.fx.float(sx, sy - 30, 'ШЛЬОП!', 30, '#ffd1a8', 60, 250);
        break;
      case 'tp':
        this.fx.papers(sx, sy, 14);
        audio.paper();
        break;
      case 'fish':
        this.fx.splash(sx, sy, [0xc9d8e8, 0xffffff], 0.7, 10);
        audio.slap();
        this.fx.float(sx, sy - 30, 'ЛЯП!', 30, '#ffe0a0', 60, 250);
        break;
      case 'pie':
        this.fx.splash(sx, sy, tints, 1.3, 26);
        audio.splat('cream');
        break;
      case 'gold':
        this.fx.splash(sx, sy, tints, 1.3, 26);
        this.fx.sparkles(sx, sy, 30);
        this.fx.confetti(sx, sy, 40);
        audio.splat('gold');
        break;
    }
    this.fx.ring(sx, sy, head ? 0xffffff : 0xffe0c0, head ? 1.1 : 0.8);
    if (def.splat) this.sergii.addDecal(def.splat, p.X, p.Y, head, def.linger);
    if (def.kind === 'tp' && head) this.sergii.addDecal('tp', p.X, hc.y - 60, true, def.linger);
    if (def.bounce) this.makeDebris(p, p.X - hc.x, head ? 1 : 0.8);
    else this.killProj(p);

    this.hitStop = Math.max(this.hitStop, (head ? 0.085 : 0.055) + (def.kind === 'can' || def.kind === 'pie' || def.kind === 'gold' ? 0.025 : 0));
    this.fx.shake(head ? 0.3 : 0.18);
    this.fx.punchZoom(head ? 1.028 : 1.012);
    vibrate(head ? 22 : 12);

    // texts
    const ptsCol = def.kind === 'gold' ? '#ffe066' : head ? '#ffd23f' : '#ffffff';
    this.fx.float(clamp(sx + (head ? 90 : 0), 80, L.W - 80), sy + (head ? 40 : -50), `+${pts}`, head ? 36 : 32, ptsCol, 80, 380);
    if (head && !p.npc) {
      let cap = pick(HEAD_CAPTIONS);
      if (cap === this.lastCaption) cap = pick(HEAD_CAPTIONS);
      this.lastCaption = cap;
      this.fx.float(clamp(sx, 200, L.W - 200), sy - 40, cap, 42, '#ffffff', 60, 480);
    }
    if (def.kind === 'gold') this.hud.banner('ЗОЛОТЕ ВЛУЧАННЯ', 'x10 ОЧОК', '#ffd23f', 1.2);

    // combo milestones
    if (!p.npc) {
      const step = COMBO_STEPS.find((s) => s.at === this.combo);
      if (step) {
        this.hud.comboCaption(step.mult, step.caption);
        if ((step.at === 10 || step.at === 20 || step.at === 30) && this.hearts < 3) {
          this.hearts++;
          this.hud.toast('Сергій розгубився: +1 ❤️', '#ff8a9a');
        }
        audio.combo(COMBO_STEPS.indexOf(step));
        this.fx.sparkles(sx, sy, 12 + COMBO_STEPS.indexOf(step) * 6);
      } else if (this.combo > 30 && this.combo % 10 === 0) {
        this.hud.comboCaption(20, `${this.combo} ПІДРЯД`);
        audio.combo(5);
      }
    }
    if (!this.firstHitDone) {
      this.firstHitDone = true;
      if (!save.tutorialDone) {
        save.tutorialDone = true;
        persist();
        this.hud.hideTutorial();
        this.attackT = Math.max(this.attackT, 4);
      }
      this.tutorialAttackHold = false;
    }
    if (chance(0.2)) this.say(pick(LINES.hit));
    this.applyDamage(dmg);
  }

  private onBlocked(p: Proj) {
    const st = this.stage;
    audio.clang();
    this.fx.clang(st.px(p.X), st.py(p.Y));
    this.fx.float(st.px(p.X), st.py(p.Y) - 40, 'ЩИТ!', 30, '#cfe6ff', 60, 250);
    this.sergii.armL.kick(-6);
    if (!p.npc) this.breakCombo();
    if (p.def.bounce || true) this.makeDebris(p, p.X - this.sergii.handL.x, 0.9);
  }

  private onTable(p: Proj) {
    const st = this.stage;
    if (!p.npc) {
      this.breakCombo();
      this.missStreak++;
      this.missLines();
    }
    if (p.def.splat) {
      audio.splat(p.def.splat);
      this.fx.splash(st.px(p.X), st.py(TABLE_Y + 10), p.def.tint, 0.7, 10);
      this.tableSplat(p.X, p.def.splat);
      this.killProj(p);
    } else {
      audio.thud();
      this.makeDebris(p, rand(-1, 1), 0.6);
    }
  }

  private onMiss(p: Proj) {
    if (p.npc) return;
    this.breakCombo();
    this.missStreak++;
    this.missLines();
  }

  private missLines() {
    this.sergii.smileFor(1.2);
    if (this.missStreak === 3) this.say(save.difficulty === 'easy' ? LINES.miss3easy : LINES.miss3, true);
    else if (this.missStreak === 5) this.say(LINES.miss5, true);
    else if (chance(0.22)) this.say(pick(LINES.miss));
  }

  private breakCombo() {
    if (this.combo >= 5) this.hud.comboBroken();
    this.combo = 0;
  }

  private addScore(n: number) {
    this.score += n;
    this.stats.score += n;
  }

  // ================================================================== patience / rage
  private applyDamage(dmg: number) {
    if (this.state !== 'play') return;
    if (this.rage) {
      this.rageTime -= dmg * 0.09;
      return;
    }
    this.patience = Math.max(0, this.patience - dmg);
    this.checkMood();
    if (this.mode === 'endless') {
      if (this.patience <= 0) this.nextWave();
    } else if (this.def.rageAt > 0 && !this.rageUsed && this.patience <= this.def.rageAt) {
      this.startRage();
    } else if (this.def.rageAt === 0 && this.patience <= 0) {
      this.winRound();
    }
  }

  private checkMood() {
    const p = this.patience;
    const lvl = p <= 10 ? 4 : p <= 25 ? 3 : p <= 50 ? 2 : p <= 75 ? 1 : 0;
    if (lvl <= this.moodLevel) return;
    this.moodLevel = lvl;
    this.sergii.moodLevel = lvl;
    if (lvl === 1) this.say('Та ну вас…');
    if (lvl === 2) {
      this.hud.toast('Сергій почав ухилятися активніше');
      if (this.hearts < 3) {
        this.hearts++;
        this.time.delayedCall(900, () => this.hud.toast('Колектив підтримує: +1 ❤️', '#ff8a9a'));
      }
    }
    if (lvl === 3) {
      this.sergii.tintTarget = 0.28;
      this.hud.warn('Схоже, Сергій починає щось підозрювати.');
    }
    if (lvl === 4) {
      this.sergii.tintTarget = 0.5;
      this.sergii.shake = 0.35;
      this.hud.setDanger(1);
      audio.setIntensity(1);
      this.hud.toast('Він на межі…');
    }
  }

  private startRage() {
    this.rageUsed = true;
    this.rage = true;
    this.rageTotal = 18;
    this.rageTime = this.rageTotal;
    this.rageElapsed = 0;
    this.patience = this.def.rageAt;
    this.clearIncoming();
    this.bellyCooldown = 4;
    this.act = 'tantrum';
    this.actT = 1.6;
    const s = this.sergii;
    s.rage = true;
    s.tintTarget = 0.9;
    s.shake = 1;
    s.scaleAll.kick(1.4);
    s.headScale.kick(3);
    s.armR.target = -2.6;
    s.armL.target = 2.6;
    s.setHeld(null);
    s.visibleBang = false;
    this.hud.clearThreat();
    this.hud.banner('СЕРГІЙ ПСИХАНУВ', 'Протримайся!', '#ff4040', 1.8, true);
    if (this.hearts < 3) {
      this.hearts++;
      this.time.delayedCall(1900, () => this.hud.toast('Колектив прикриває: +1 ❤️', '#ff8a9a'));
    }
    audio.rage();
    audio.setIntensity(2);
    this.hud.setDanger(2);
    this.fx.shake(0.9);
    this.fx.punchZoom(1.06);
    this.slowmo(0.5, 0.9);
    this.time.delayedCall(900, () => this.say(pick(LINES.rage), true));
  }

  private nextWave() {
    this.wave++;
    this.patience = 100;
    this.moodLevel = 0;
    this.sergii.moodLevel = 0;
    this.sergii.tintTarget = 0;
    this.sergii.shake = 0;
    this.bellyCooldown = 5;
    this.hearts = Math.min(3, this.hearts + 1);
    this.hud.setDanger(0);
    audio.setIntensity(this.wave >= 5 ? 1 : 0);
    const w = this.wave - 1;
    this.tune.speed *= 1.08;
    this.tune.atk *= 0.93;
    this.tune.flight = Math.max(0.72, this.tune.flight * 0.97);
    this.tune.tele = Math.max(-0.3, this.tune.tele - 0.04);
    this.tune.dodge = Math.min(1.6, this.tune.dodge * 1.07);
    this.tune.catchC = Math.min(1.4, this.tune.catchC * 1.05);
    this.addScore(1000 * w);
    this.hud.banner(`ХВИЛЯ ${this.wave}`, `+${1000 * w} · Сергій прискорюється`, '#ffd23f', 1.6);
    this.hud.heartsChanged();
    audio.rage();
    this.act = 'tantrum';
    this.actT = 1.1;
    this.sergii.shake = 1;
    this.clearIncoming();
    if (this.wave === 3 && this.crowd.count === 0) this.crowdJoinT = 1;
  }

  private clearIncoming() {
    for (const i of this.incoming) {
      if (i.active) {
        i.active = false;
        i.img.setVisible(false);
      }
    }
    this.hud.clearThreat();
    this.hud.showDodgeHint(false);
    this.bellyFlight = 0;
    this.bellyFx.clear();
    this.sergii.setHeld(null);
    this.sergii.visibleBang = false;
    this.sergii.squash.target = 0;
    this.sergii.headScale.target = 1;
  }

  private finishState() {
    this.state = 'end';
    this.lane = 0;
    this.clearIncoming();
    this.plans.length = 0;
    this.sergii.visibleBang = false;
    this.sergii.setShield(false);
    this.hud.hideTutorial();
    this.hud.clearThreat();
  }

  private winRound() {
    this.finishState();
    this.act = 'tantrum';
    this.actT = 99;
    const s = this.sergii;
    s.shake = 1;
    s.tintTarget = 0.85;
    s.setHeld(null);
    audio.rage();
    this.fx.shake(0.7);
    this.hud.setDanger(0);
    this.hud.banner('СЕРГІЙ ПСИХАНУВ', 'Терпіння: 0%. Раунд твій.', '#ff4040', 2.0, true);
    this.time.delayedCall(1500, () => {
      s.shake = 0;
      s.exhausted = true;
      s.y.target = 70;
      s.tintTarget = 0.35;
      s.armR.target = 0.35;
      s.armL.target = -0.35;
      this.act = 'exhausted';
      audio.victory();
      this.fx.confetti(L.W / 2, this.stage.py(0) + 100, 60);
    });
    const acc = this.stats.thrown ? this.stats.hits / this.stats.thrown : 0;
    const winBonus = 1000 + this.def.id * 500;
    const livesBonus = this.hearts * 750;
    const accBonus = Math.round((acc * 1500) / 50) * 50;
    this.addScore(winBonus + livesBonus + accBonus);
    save.unlockedRound = Math.max(save.unlockedRound, Math.min(5, this.def.id + 1));
    save.highScore = Math.max(save.highScore, this.score);
    save.bestCombo = Math.max(save.bestCombo, this.stats.bestCombo);
    persist();
    this.time.delayedCall(2700, () =>
      this.hud.showResults({
        kind: 'win',
        title: this.def.endTitle,
        line: this.def.endLine,
        stats: this.stats,
        bonus: { win: winBonus, lives: livesBonus, acc: accBonus },
        total: this.score,
        round: this.def.id,
      }),
    );
  }

  private finalVictory() {
    this.finishState();
    this.rage = false;
    const s = this.sergii;
    s.rage = false;
    s.shake = 0;
    s.tintTarget = 0.3;
    s.exhausted = true;
    s.y.target = 30;
    s.moodLevel = 2;
    this.targetX = 0;
    s.armR.target = 0.5;
    s.armL.target = 0.25;
    s.flag.setVisible(true);
    this.act = 'exhausted';
    audio.setIntensity(0);
    audio.victory();
    this.hud.setDanger(0);
    this.say('Все. Я все.', true);
    // leftovers all around
    const kinds: ItemKind[] = ['can', 'tp', 'slipper', 'fish', 'can', 'egg'];
    kinds.forEach((k, i) => {
      const X = -330 + i * 130 + rand(-30, 30);
      const img = this.add
        .image(this.stage.px(X, 0.95), this.stage.py(TABLE_Y + 16, 0.95), 'it_' + k)
        .setScale(itemScale(k, 0.95))
        .setRotation(k === 'can' || k === 'tp' ? 1.45 : rand(-0.6, 0.6))
        .setDepth(31);
      this.tableJunk.push({ img, life: 999 });
    });
    for (let i = 0; i < 4; i++) this.tableSplat(rand(-300, 300), pick(['red', 'brown', 'cream']));
    for (const j of this.tableJunk) j.life = 999;
    const hc = s.headCenter();
    s.addDecal('cream', hc.x + 30, hc.y - 150, true, 999, 0.55);
    s.addDecal('red', hc.x - 100, hc.y + 70, true, 999, 0.45);
    s.addDecal('red', hc.x + 60, hc.y + 250, false, 999);
    s.addDecal('brown', hc.x - 110, hc.y + 300, false, 999);
    const burst = () => this.fx.confetti(rand(100, L.W - 100), this.stage.hy - 100, 70);
    burst();
    this.time.delayedCall(500, burst);
    this.time.delayedCall(1100, burst);
    const livesBonus = this.hearts * 750;
    const winBonus = 5000;
    const acc = this.stats.thrown ? this.stats.hits / this.stats.thrown : 0;
    const accBonus = Math.round((acc * 2000) / 50) * 50;
    this.addScore(winBonus + livesBonus + accBonus);
    const firstClear = !save.completed;
    save.completed = true;
    save.secretUnlocked = true;
    save.unlockedRound = 5;
    save.highScore = Math.max(save.highScore, this.score);
    save.bestCombo = Math.max(save.bestCombo, this.stats.bestCombo);
    save.runs++;
    persist();
    this.hud.banner('СЕРГІЙ ПРОГРАВ ВСІМ', 'Дивно. Хто б міг подумати.', '#ffd23f', 2.2, true);
    this.time.delayedCall(2800, () =>
      this.hud.showVictory({
        total: this.score,
        stats: this.stats,
        bonus: { win: winBonus, lives: livesBonus, acc: accBonus },
        firstClear,
      }),
    );
  }

  private loseRound() {
    this.finishState();
    this.act = 'laugh';
    this.actT = 0;
    this.sergii.rage = false;
    this.sergii.smileFor(99);
    audio.lose();
    this.hud.setDanger(0);
    this.say(this.mode === 'endless' ? 'Не треба було.' : 'Ха. Ще хтось?', true);
    const isRecord = this.mode === 'endless' ? this.score > save.endlessHigh : this.score > save.highScore;
    if (this.mode === 'endless') {
      save.endlessHigh = Math.max(save.endlessHigh, this.score);
      this.registry.set('lastEndless', this.score);
    }
    else save.highScore = Math.max(save.highScore, this.score);
    save.bestCombo = Math.max(save.bestCombo, this.stats.bestCombo);
    persist();
    this.time.delayedCall(1700, () =>
      this.hud.showGameOver({
        endless: this.mode === 'endless',
        stats: this.stats,
        total: this.score,
        wave: this.wave,
        record: isRecord,
        round: this.def.id,
      }),
    );
  }

  // ================================================================== Sergii AI
  private say(text: string, force = false) {
    if (!force && this.speech.cooldown > 0) return;
    this.speech.say(text);
    this.speech.cooldown = 6.5;
  }

  private get pFactor() {
    return 1 - this.patience / 100;
  }

  private aiReact(p: Proj) {
    const s = this.sergii;
    if (this.act !== 'free' || this.state !== 'play' || this.hitStop > 0.5) return;
    // will it hit if he keeps doing what he does?
    const lead = s.vx * Math.min(p.T, 0.4) * 0.6;
    const hit = s.hitTest(p.X1 - lead, p.Y1, p.def.size * 0.5);
    if (!hit || hit === 'shield') return;
    const canCatch =
      this.def.catchChance > 0 &&
      !s.heldKind &&
      this.catchCD <= 0 &&
      !p.npc &&
      (p.def.kind === 'can' || (this.def.id >= 5 && (p.def.kind === 'slipper' || p.def.kind === 'fish')));
    if (canCatch && chance(this.def.catchChance * this.tune.catchC * (this.rage ? 1.2 : 1))) {
      p.catchPlanned = true;
      this.plans.push({ t: Math.max(0.05, p.T - 0.3), type: 'catch', proj: p });
      this.catchCD = 7;
      return;
    }
    const dodgeP = this.def.dodge * this.tune.dodge * (1 + this.pFactor * 0.8) * (this.rage ? 1.2 : 1) * (p.npc ? 0.5 : 1);
    if (this.dodgeCD <= 0 && chance(dodgeP)) {
      this.plans.push({ t: Math.max(0.03, p.T - rand(0.26, 0.34)), type: 'dodge', proj: p });
      this.dodgeCD = Math.max(0.7, 1.4 - this.def.id * 0.12);
    }
  }

  private runPlans(dt: number) {
    for (let i = this.plans.length - 1; i >= 0; i--) {
      const pl = this.plans[i];
      pl.t -= dt;
      if (pl.t > 0) continue;
      this.plans.splice(i, 1);
      if (!pl.proj.active || pl.proj.resolved) continue;
      if (pl.type === 'dodge') this.execDodge(pl.proj);
      else this.execCatch(pl.proj);
    }
  }

  /** Mockup-style reaction: an open palm goes up toward the threat (or both arms). */
  private flinch(side: number, both: boolean) {
    const s = this.sergii;
    if (this.act !== 'free' || this.state !== 'play') return;
    const hc = s.headCenter();
    if (side > 0 || both) s.armR.target = s.aimArm(1, hc.x + 150, hc.y + 20);
    if ((side < 0 || both) && !s.shieldOn) s.armL.target = s.aimArm(-1, hc.x - 150, hc.y + 20);
    this.flinchT = 0.5;
  }

  private execDodge(p: Proj) {
    const s = this.sergii;
    if (this.act !== 'free') return;
    const hc = s.headCenter();
    const dx = p.X1 - hc.x;
    const dir = Math.abs(dx) < 25 ? (Math.random() < 0.5 ? -1 : 1) : -sign(dx);
    const aimedHead = p.Y1 < s.neck.y;
    const r = Math.random();
    if (aimedHead && r < 0.45) {
      s.lean.target = dir * 0.36;
      this.dodgeT = 0.55;
    } else if (aimedHead && r < 0.68) {
      s.y.target = 200;
      s.y.k = 420;
      this.dodgeT = 0.5;
    } else {
      const range = 140;
      this.targetX = clamp(s.x + dir * 170, -range, range);
      if (Math.abs(this.targetX - s.x) < 120) this.targetX = clamp(s.x - dir * 170, -range, range);
      this.sidestepT = 0.32;
      this.moveT = 0.5;
    }
    s.headRot.kick(dir * 1.5);
    this.flinch(-dir, chance(0.5));
  }

  private execCatch(p: Proj) {
    const s = this.sergii;
    if (this.act !== 'free' || s.heldKind) {
      p.catchPlanned = false;
      return;
    }
    this.act = 'catching';
    this.catchProj = p;
    s.vx = 0;
    const tx = p.X1;
    const ty = p.Y1;
    s.armR.target = s.aimArm(1, tx, ty + 14);
    const dist = Math.hypot(tx - s.shoulderR.x, ty - s.shoulderR.y);
    s.armRS.target = clamp(dist / 198, 0.8, 1.55);
    s.armR.k = 400;
  }

  private doCatch(p: Proj) {
    const s = this.sergii;
    const kind = p.def.kind;
    this.killProj(p);
    this.catchProj = null;
    s.armR.k = 120;
    s.heldKind = kind;
    s.held.setTexture('it_' + kind).setVisible(true).setScale(0.3);
    this.act = 'catchHold';
    this.actT = 0.45;
    this.stats.catches++;
    s.smileFor(2.2);
    this.breakCombo();
    audio.slap();
    audio.sting();
    audio.duckMusic(0.25, 1.4);
    const hc = s.headCenter();
    this.fx.focus.x = this.stage.px(hc.x);
    this.fx.focus.y = this.stage.py(hc.y);
    this.fx.focus.k = 0.09;
    this.hud.banner('ПОГАНА ІДЕЯ.', '', '#ffffff', 1.3, true);
    this.say(LINES.caught, true);
    this.fx.clang(this.stage.px(s.handR.x), this.stage.py(s.handR.y));
  }

  private startAttack(kind: ItemKind, tele: number, combo = 0) {
    const s = this.sergii;
    this.act = 'windup';
    this.actT = Math.max(0.55, tele);
    this.atkKind = kind;
    this.atkCombo = combo;
    this.atkLane = this.lane;
    s.angryFor(1.2);
    s.vx = 0;
    if (s.heldKind !== kind) s.setHeld(kind);
    s.armR.target = -3.2;
    s.armRS.target = 1;
    s.armR.k = 160;
    s.visibleBang = true;
    s.lean.target = 0;
    this.fx.focus.k = 0;
    this.hud.showThreat(this.atkLane, this.actT);
    audio.warn();
    audio.windup();
    if (!save.dodgeTutorialDone) {
      this.slowmo(0.5, this.actT + 0.6);
      this.hud.showDodgeHint(true);
    }
  }

  private release() {
    const s = this.sergii;
    const kind = this.atkKind;
    s.setHeld(null);
    s.visibleBang = false;
    s.armR.target = -0.5;
    s.armR.kick(22);
    s.armRS.kick(5);
    s.headScale.kick(1.2);
    s.lean.kick(-0.6);
    this.spawnIncoming(kind, this.atkLane);
    this.act = 'recover';
    this.actT = 0.32;
    audio.whoosh(1.3);
    if (chance(0.3)) this.say(pick(LINES.throw));
  }

  private spawnIncoming(kind: ItemKind, lane: number) {
    const s = this.sergii;
    let inc = this.incoming.find((i) => !i.active);
    if (!inc) {
      inc = {
        active: false,
        kind,
        img: this.add.image(0, 0, 'it_' + kind).setDepth(60),
        X0: 0,
        Y0: 0,
        Xt: 0,
        Yt: 0,
        T: 1,
        t: 0,
        lane,
        rot: 0,
        vrot: 0,
        resolved: false,
        dodged: false,
      };
      this.incoming.push(inc);
    }
    inc.active = true;
    inc.kind = kind;
    inc.img.setTexture('it_' + kind).setVisible(true).setAlpha(1);
    inc.X0 = s.handR.x;
    inc.Y0 = s.handR.y - 20;
    inc.Xt = lane * LANE_X;
    inc.Yt = this.stage.wy(L.H * 0.47, ZEND);
    inc.T = this.def.flight * this.tune.flight * (this.rage ? 0.92 : 1);
    inc.t = 0;
    inc.lane = lane;
    inc.rot = 0;
    inc.vrot = rand(7, 12) * (Math.random() < 0.5 ? -1 : 1);
    inc.resolved = false;
    inc.dodged = false;
  }

  private updateIncoming(dt: number) {
    const st = this.stage;
    for (const inc of this.incoming) {
      if (!inc.active) continue;
      inc.t += dt;
      const u = inc.t / inc.T;
      if (!inc.resolved && u >= 1) {
        inc.resolved = true;
        if (inc.lane === this.lane) {
          this.playerHit(inc);
          inc.active = false;
          inc.img.setVisible(false);
          continue;
        }
        this.playerDodged(inc);
      }
      if (u > 1.3) {
        inc.active = false;
        inc.img.setVisible(false);
        this.hud.clearThreat();
        continue;
      }
      const Z = Math.max(0.06, 1 - (1 - ZEND) * u);
      const X = lerp(inc.X0, inc.Xt, u);
      const Y = lerp(inc.Y0, inc.Yt, u) - 110 * 4 * u * (1 - u);
      inc.rot += inc.vrot * dt;
      inc.img.setPosition(st.px(X, Z), st.py(Y, Z)).setScale(itemScale(inc.kind, Z)).setRotation(inc.rot);
      if (u > 1) inc.img.setAlpha(clamp(1 - (u - 1) / 0.3, 0, 1));
    }
  }

  private playerHit(inc: Incoming) {
    this.hearts = Math.max(0, this.hearts - 1);
    this.stats.hitBy++;
    this.hud.screenHit(inc.kind);
    this.hud.heartsChanged(true);
    this.hud.clearThreat();
    this.hud.showDodgeHint(false);
    this.fx.shake(0.75);
    audio.hurt();
    audio.heart();
    if (inc.kind === 'can') audio.clang();
    else if (inc.kind === 'tomato') audio.splat('red');
    else if (inc.kind === 'slipper') audio.slap();
    else audio.paper();
    vibrate([40, 30, 60]);
    this.sergii.headRot.kick(2.5);
    this.sergii.headY.kick(-150);
    this.sergii.smileFor(2.2);
    if (!save.dodgeTutorialDone) {
      save.dodgeTutorialDone = true;
      persist();
    }
    this.slowT = 0;
    this.slowTarget = 1;
    if (chance(0.55)) this.say(pick(LINES.hitPlayer), true);
    if (this.hearts <= 0) this.loseRound();
  }

  private playerDodged(inc: Incoming) {
    inc.dodged = true;
    this.stats.dodges++;
    this.addScore(50);
    audio.dodge();
    this.hud.dodged();
    this.hud.clearThreat();
    this.hud.showDodgeHint(false);
    this.sergii.angryFor(1.2);
    if (!save.dodgeTutorialDone) {
      save.dodgeTutorialDone = true;
      persist();
      this.slowT = 0;
      this.slowTarget = 1;
    }
    if (chance(0.25)) this.say(pick(LINES.dodged));
  }

  private nextAttackDelay() {
    const [a, b] = this.def.attackEvery;
    let d = rand(a, b) * this.tune.atk;
    if (this.rage) d *= 0.72;
    if (this.rushT > 0) d *= 0.7;
    d *= 1 - this.pFactor * 0.2;
    return Math.max(1.6, d);
  }

  private pickBack(): ItemKind {
    return weighted(this.def.back) as ThrowBackKind;
  }

  private teleTime() {
    const t = this.def.telegraph + this.tune.tele;
    return Math.max(0.6, t);
  }

  /** Sergii charges a directed shockwave from his belly. The marked lane is
   * locked when charging starts, so a left/right dodge always has a safe side. */
  private startBellyPower() {
    const s = this.sergii;
    this.act = 'bellyWindup';
    this.actT = save.difficulty === 'easy' ? 1.9 : 1.55;
    this.bellyLane = this.lane;
    this.bellyCooldown = rand(16, 21);
    this.attackT = Math.max(this.attackT, 2.5);
    s.vx = 0;
    s.armR.target = -1.5;
    s.armL.target = 1.5;
    s.headScale.target = 1.08;
    s.visibleBang = true;
    s.angryFor(3);
    this.hud.showThreat(this.bellyLane, this.actT, 'СИЛА ПУПКА!');
    this.hud.showDodgeHint(true);
    this.say(LINES.belly, true);
    audio.warn();
    audio.windup();
  }

  private releaseBellyPower() {
    const s = this.sergii;
    s.visibleBang = false;
    s.armR.target = 0.12;
    s.armL.target = -0.12;
    s.headScale.target = 1;
    s.squash.kick(3.5);
    this.bellyFlight = BELLY_FLIGHT;
    this.act = 'bellyRecover';
    this.actT = 0.85;
    this.fx.shake(0.4);
    this.fx.punchZoom(1.045);
    audio.belly();
    vibrate(30);
  }

  private updateBellyPower(dt: number) {
    const g = this.bellyFx;
    g.clear();
    const charging = this.act === 'bellyWindup';
    if (!charging && this.bellyFlight <= 0) return;
    const bx = this.stage.px(this.sergii.neck.x);
    const by = this.stage.py(this.sergii.neck.y + 195);
    const tx = L.W / 2 + this.bellyLane * 175;
    const bottom = L.H * 0.82;
    if (charging) {
      const pulse = 0.5 + 0.5 * Math.sin(this.simTime * 20);
      const radius = 32 + pulse * 18;
      g.fillStyle(0xffd23f, 0.16 + pulse * 0.14).fillCircle(bx, by, radius);
      g.lineStyle(5 + pulse * 3, 0xff9f1c, 0.7).strokeCircle(bx, by, radius + 10);
      g.lineStyle(4, 0xffd23f, 0.2 + pulse * 0.2).lineBetween(bx, by, tx, bottom);
    } else {
      this.bellyFlight = Math.max(0, this.bellyFlight - dt);
      const u = 1 - this.bellyFlight / BELLY_FLIGHT;
      const reach = by + (bottom - by) * Math.min(1, u * 1.8);
      const width = 40 + 100 * u;
      g.fillStyle(0xffd23f, 0.28 * (1 - u)).fillTriangle(bx, by, tx - width, reach, tx + width, reach);
      g.lineStyle(12 * (1 - u) + 3, 0xffffff, 0.85 * (1 - u)).strokeCircle(bx, by, 45 + u * L.W);
      g.lineStyle(7, 0xff9f1c, 0.8 * (1 - u)).strokeCircle(bx, by, 20 + u * L.W * 0.8);
      if (this.bellyFlight <= 0) this.resolveBellyPower();
    }
  }

  private resolveBellyPower() {
    this.hud.clearThreat();
    this.hud.showDodgeHint(false);
    if (!save.dodgeTutorialDone) {
      save.dodgeTutorialDone = true;
      persist();
    }
    if (this.bellyLane === this.lane) {
      this.hearts = Math.max(0, this.hearts - 1);
      this.stats.hitBy++;
      this.hud.powerHit();
      this.hud.heartsChanged(true);
      this.fx.shake(0.75);
      audio.hurt();
      audio.heart();
      vibrate([45, 30, 60]);
      this.sergii.smileFor(2.3);
      this.say('Оце сила!', true);
      if (this.hearts <= 0) this.loseRound();
    } else {
      this.stats.dodges++;
      this.addScore(150);
      this.hud.dodged();
      this.hud.toast('СИЛА ПУПКА ПОВЗ! +150', '#ffe066');
      this.fx.sparkles(L.W / 2 + this.bellyLane * 175, L.H * 0.7, 10, [0xffd23f, 0xffffff]);
      this.sergii.angryFor(1.3);
      audio.dodge();
    }
  }

  private triggerEvent() {
    const opts = ['can', 'shield', 'rush', 'shoe'].filter((e) => e !== this.lastEvent);
    const ev = pick(opts);
    this.lastEvent = ev;
    const s = this.sergii;
    if (ev === 'can') {
      this.hud.eventBanner(EVENTS.can);
      this.say(LINES.back, true);
      this.act = 'offscreen';
      this.offSide = s.x >= 0 ? 1 : -1;
      this.offT = 0;
      this.targetX = this.offSide * 760;
    } else if (ev === 'shield') {
      this.hud.eventBanner(EVENTS.shield);
      s.setShield(true);
      this.shieldT = 5;
      this.time.delayedCall(500, () => this.say(LINES.shield, true));
      audio.clang();
    } else if (ev === 'rush') {
      this.hud.eventBanner(EVENTS.rush);
      this.rushT = 5;
      audio.setRush(true);
      audio.whistle();
      this.attackT = Math.min(this.attackT, 1.2);
    } else {
      this.hud.eventBanner(EVENTS.shoe);
      this.time.delayedCall(350, () => this.say(LINES.shoe, true));
      this.startAttack('slipper', this.teleTime() + 0.2);
    }
  }

  private updateAI(dt: number) {
    const s = this.sergii;
    const def = this.def;
    const speedMul = this.tune.speed * (this.rushT > 0 ? 1.35 : 1) * (this.rage ? 1.25 : 1) * (1 + this.pFactor * 0.35);
    if (this.state === 'play' && this.moodLevel >= 2) this.bellyCooldown -= dt;
    this.dodgeCD -= dt;
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      if (this.flinchT <= 0 && this.act === 'free') {
        s.armR.target = 0.12;
        if (!s.shieldOn) s.armL.target = -0.12;
      }
    }
    this.catchCD -= dt;
    this.runPlans(dt);
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      if (this.dodgeT <= 0) {
        s.lean.target = 0;
        s.y.target = 0;
        s.y.k = 160;
      }
    }
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      s.armL.target = s.aimArm(-1, s.neck.x + 20, s.neck.y + 10);
      if (this.shieldT <= 0) {
        s.setShield(false);
        s.armL.target = -0.12;
      }
    }
    if (this.rushT > 0) {
      this.rushT -= dt;
      if (this.rushT <= 0) audio.setRush(false);
    }

    let moveMax = def.moveSpeed * speedMul;
    switch (this.act) {
      case 'free': {
        if (this.moveT > 0) this.moveT -= dt;
        else if (Math.abs(s.x - this.targetX) < 6) {
          this.moveT = rand(def.pause[0], def.pause[1]) * (this.rage ? 0.5 : 1);
          const range = def.moveRange;
          let nx = rand(-range, range);
          if (Math.abs(nx - s.x) < range * 0.4) nx = -sign(s.x || 1) * rand(range * 0.3, range);
          this.targetX = nx;
        }
        if (this.sidestepT > 0) {
          this.sidestepT -= dt;
          moveMax = 900;
        }
        if (this.state === 'play' && this.moodLevel >= 2 && this.bellyCooldown <= 0 && !s.shieldOn && !this.incoming.some((i) => i.active && !i.resolved)) {
          this.startBellyPower();
          break;
        }
        // attacks
        if (!this.tutorialAttackHold && this.state === 'play') {
          this.attackT -= dt;
          if (this.attackT <= 0) {
            const combo = def.combo > 1 && chance(this.rage ? 0.35 : 0.25) ? Math.floor(rand(1, def.combo)) : 0;
            this.startAttack(this.pickBack(), this.teleTime(), combo);
            this.attackT = this.nextAttackDelay();
            break;
          }
        }
        if (def.events && !this.rage && this.state === 'play' && !s.shieldOn) {
          this.eventT -= dt;
          if (this.eventT <= 0) {
            this.eventT = rand(20, 38);
            this.triggerEvent();
          }
        }
        break;
      }
      case 'windup': {
        this.actT -= dt;
        s.armR.target = -3.2 - Math.sin(this.simTime * 18) * 0.1;
        s.headScale.target = 0.97;
        if (this.actT <= 0) {
          s.headScale.target = 1;
          this.release();
        }
        break;
      }
      case 'bellyWindup': {
        this.actT -= dt;
        s.squash.target = 0.5 + Math.sin(this.simTime * 16) * 0.15;
        if (this.actT <= 0) {
          s.squash.target = 0;
          this.releaseBellyPower();
        }
        break;
      }
      case 'bellyRecover': {
        this.actT -= dt;
        if (this.actT <= 0) this.act = 'free';
        break;
      }
      case 'recover': {
        this.actT -= dt;
        if (this.actT <= 0) {
          s.armR.target = 0.12;
          s.armR.k = 120;
          if (this.atkCombo > 0 && this.state === 'play') {
            this.startAttack(this.pickBack(), Math.max(0.6, this.teleTime() * 0.75), this.atkCombo - 1);
          } else this.act = 'free';
        }
        break;
      }
      case 'catching': {
        if (!this.catchProj || !this.catchProj.active || (this.catchProj.resolved && this.act === 'catching')) {
          this.act = 'free';
          this.catchProj = null;
          s.armR.target = 0.12;
          s.armRS.target = 1;
          s.armR.k = 120;
        }
        break;
      }
      case 'catchHold': {
        this.actT -= dt;
        s.armRS.target = 1;
        s.armR.target = -1.9;
        s.headRot.target = 0;
        s.headScale.target = 1.1;
        if (this.actT <= 0) {
          s.headScale.target = 1;
          this.startAttack(s.heldKind ?? 'can', Math.max(0.65, this.teleTime() * 0.85));
        }
        break;
      }
      case 'offscreen': {
        moveMax = 560;
        if (Math.abs(s.x) > 640) {
          this.offT += dt;
          if (this.offT > 2) {
            s.setHeld('can');
            this.act = 'returning';
            this.targetX = this.offSide * 40;
          }
        }
        break;
      }
      case 'returning': {
        moveMax = 480;
        if (Math.abs(s.x - this.targetX) < 12) this.startAttack('can', this.teleTime());
        break;
      }
      case 'tantrum': {
        this.actT -= dt;
        if (this.actT <= 0 && this.state === 'play') {
          this.act = 'free';
          s.armR.target = 0.12;
          s.armL.target = -0.12;
          if (!this.rage) s.shake = this.moodLevel >= 4 ? 0.35 : 0;
          else s.shake = 0.6;
          this.attackT = this.rage ? 0.8 : 2;
        } else {
          s.armR.target = -2.4 + Math.sin(this.simTime * 20) * 0.4;
          s.armL.target = 2.4 - Math.sin(this.simTime * 20 + 1) * 0.4;
        }
        break;
      }
      case 'laugh': {
        this.actT -= dt;
        if (this.actT <= 0) {
          this.actT = 0.28;
          s.headY.kick(-260);
          s.squash.kick(2);
        }
        s.armR.target = -1.2;
        s.armL.target = 1.2;
        break;
      }
      default:
        break;
    }

    // locomotion
    const moving = this.act === 'free' || this.act === 'offscreen' || this.act === 'returning' || this.act === 'exhausted';
    if (moving) {
      const dist = this.targetX - s.x;
      const desired = clamp(dist * 6, -moveMax, moveMax);
      s.vx += (desired - s.vx) * Math.min(1, dt * (this.sidestepT > 0 ? 20 : 8));
    } else {
      s.vx *= Math.max(0, 1 - dt * 12);
    }
    s.x += s.vx * dt;
  }

  private updateCrowd(dt: number) {
    const def = this.def;
    const enabled = def.crowd && (this.mode !== 'endless' || this.wave >= 3);
    if (!enabled || this.state !== 'play') return;
    this.crowdJoinT -= dt;
    if (this.crowdJoinT <= 0 && this.crowd.count < 6) {
      const n = Math.min(6 - this.crowd.count, randJoin());
      this.crowd.add(n);
      this.hud.sign(crowdJoinText(n));
      audio.pop(1.2);
      this.crowdJoinT = rand(6, 11);
      if (this.crowd.count >= 6 && !this.queueAnnounced) {
        this.queueAnnounced = true;
        this.time.delayedCall(2000, () => this.hud.sign(QUEUE_TEXT));
      }
    }
    if (this.crowd.count > 0 && this.act !== 'offscreen' && this.act !== 'returning') {
      this.crowdThrowT -= dt;
      if (this.crowdThrowT <= 0) {
        this.crowdThrowT = rand(def.crowdEvery[0], def.crowdEvery[1]) * (this.rage ? 0.6 : 1) * (1.2 - Math.min(0.4, this.crowd.count * 0.06));
        this.npcThrow();
      }
    }
  }

  private npcThrow() {
    const from = this.crowd.throwFrom();
    if (!from) return;
    const st = this.stage;
    const kind = weighted<ItemKind>({ tomato: 5, poop: 3, egg: 2, tp: 1, can: 1, pie: 1 });
    const z0 = 0.8;
    const X0 = st.wx(from.x, z0);
    const Y0 = st.wy(from.y, z0);
    const s = this.sergii;
    const T = 0.62;
    const ph = s.predictHead(T);
    const accurate = chance(0.8);
    const X1 = ph.x + (accurate ? rand(-50, 50) : rand(-220, 220));
    const Y1 = ph.y + (accurate ? rand(-60, 160) : rand(-220, 60));
    const p = this.spawnProj(ITEMS[kind], X0, Y0, z0, X1, Y1, T, true);
    this.aiReact(p);
    audio.whoosh(0.7);
  }

  private slowmo(scale: number, dur: number) {
    this.slowTarget = scale;
    this.slowT = dur;
  }

  // ================================================================== frame
  update(_time: number, delta: number) {
    const dtR = Math.min(delta, 50) / 1000;
    if (this.slowT > 0) {
      this.slowT -= dtR;
      if (this.slowT <= 0) this.slowTarget = 1;
    }
    this.timeScale = lerp(this.timeScale, this.slowTarget, Math.min(1, dtR * 10));
    let dt: number;
    if (this.hitStop > 0) {
      this.hitStop -= dtR;
      dt = 0;
    } else dt = dtR * this.timeScale;
    this.simTime += dt;

    if (this.state === 'play' || this.state === 'end' || this.state === 'intro') {
      if (this.state !== 'intro') this.updateAI(dt);
      this.updateProjs(dt);
      this.updateIncoming(dt);
      this.updateCrowd(dt);
      this.updateAmmo(dt);
    }

    // rage countdown
    if (this.rage && this.state === 'play' && this.act !== 'tantrum') {
      this.rageTime -= dt;
      this.rageElapsed += dt;
      if (this.rageTime <= 0 && this.rageElapsed >= 14) this.finalVictory();
      else if (this.rageTime <= 0) this.rageTime = 0.001;
    }

    // player lean / dodge lanes
    if (!this.threat) {
      this.laneHold -= dtR;
      if (this.laneHold <= 0 && this.lane !== 0) this.lane = 0;
    }
    this.stage.cam.target = this.lane * LANE_X;
    this.stage.update(dtR);

    // junk on the table fades out
    for (let i = this.tableJunk.length - 1; i >= 0; i--) {
      const j = this.tableJunk[i];
      j.life -= dt;
      j.img.x += 0;
      if (j.life < 1) j.img.setAlpha(Math.max(0, j.life));
      if (j.life <= 0) {
        j.img.destroy();
        this.tableJunk.splice(i, 1);
      }
    }

    this.sergii.update(dt);
    this.crowd.update(dt);
    this.updateBellyPower(dt);
    this.drawTrails();
    const top = this.sergii.facePoint({ x: 40, y: -690 });
    this.speech.update(dtR, this.stage.px(this.sergii.headCenter().x), Math.max(hudTop() + 330, this.stage.py(top.y) - 30));
    this.fx.camera(dtR);
    if (this.fx.focus.k > 0 && this.act !== 'catchHold') this.fx.focus.k = Math.max(0, this.fx.focus.k - dtR * 0.3);
  }
}
