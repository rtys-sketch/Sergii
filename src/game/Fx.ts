import Phaser from 'phaser';
import { L } from '../core/layout';
import { Spring, clamp, rand } from '../core/util';

export const FONT_TITLE = 'Unbounded, Rubik, "Arial Black", sans-serif';
export const FONT_UI = 'Rubik, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export function textStyle(size: number, color = '#ffffff', opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  return {
    fontFamily: FONT_TITLE,
    fontSize: `${size}px`,
    fontStyle: '900',
    color,
    stroke: '#1a0f1f',
    strokeThickness: Math.max(3, Math.round(size * 0.16)),
    align: 'center',
    resolution: Math.min(3.5, L.Z * 1.25),
    ...opts,
  } as Phaser.Types.GameObjects.Text.TextStyle;
}

/** In-world juice: particles, floating texts, camera shake / punch zoom. */
export class Fx {
  goo: Phaser.GameObjects.Particles.ParticleEmitter;
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
  stars: Phaser.GameObjects.Particles.ParticleEmitter;
  conf: Phaser.GameObjects.Particles.ParticleEmitter;
  puff: Phaser.GameObjects.Particles.ParticleEmitter;
  shards: Phaser.GameObjects.Particles.ParticleEmitter;
  paper: Phaser.GameObjects.Particles.ParticleEmitter;
  rings: Phaser.GameObjects.Image[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private textIdx = 0;
  trauma = 0;
  zoom = new Spring(1, 1, 160, 16);
  focus = { x: L.W / 2, y: L.H / 2, k: 0 };
  private t = 0;

  constructor(public scene: Phaser.Scene) {
    const base = { emitting: false } as const;
    this.goo = scene.add
      .particles(0, 0, 'p_blob', {
        ...base,
        lifespan: { min: 380, max: 760 },
        speed: { min: 180, max: 620 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.75, end: 0.1 },
        gravityY: 1500,
        maxParticles: 160,
      })
      .setDepth(50);
    this.dust = scene.add
      .particles(0, 0, 'p_dot', {
        ...base,
        lifespan: { min: 250, max: 520 },
        speed: { min: 60, max: 260 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 },
        maxParticles: 120,
      })
      .setDepth(51);
    this.stars = scene.add
      .particles(0, 0, 'p_star', {
        ...base,
        lifespan: { min: 400, max: 900 },
        speed: { min: 80, max: 380 },
        scale: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 180 },
        blendMode: Phaser.BlendModes.ADD,
        maxParticles: 120,
      })
      .setDepth(52);
    this.conf = scene.add
      .particles(0, 0, 'p_conf', {
        ...base,
        lifespan: { min: 1400, max: 2600 },
        speed: { min: 200, max: 700 },
        angle: { min: 220, max: 320 },
        gravityY: 700,
        rotate: { start: 0, end: 720 },
        scaleX: { start: 1, end: 0.4 },
        tint: [0xff3b5c, 0xffcf33, 0x33c2ff, 0x5cff8a, 0xb45cff, 0xffffff],
        maxParticles: 260,
      })
      .setDepth(78);
    this.puff = scene.add
      .particles(0, 0, 'p_puff', {
        ...base,
        lifespan: { min: 600, max: 1100 },
        speedY: { min: -160, max: -60 },
        speedX: { min: -50, max: 50 },
        scale: { start: 0.6, end: 1.8 },
        alpha: { start: 0.75, end: 0 },
        maxParticles: 80,
      })
      .setDepth(53);
    this.shards = scene.add
      .particles(0, 0, 'p_shard', {
        ...base,
        lifespan: { min: 400, max: 800 },
        speed: { min: 200, max: 520 },
        gravityY: 1600,
        rotate: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0.4 },
        maxParticles: 60,
      })
      .setDepth(50);
    this.paper = scene.add
      .particles(0, 0, 'p_paper', {
        ...base,
        lifespan: { min: 900, max: 1600 },
        speed: { min: 120, max: 420 },
        gravityY: 500,
        rotate: { start: 0, end: 540 },
        scale: { start: 0.9, end: 0.5 },
        maxParticles: 60,
      })
      .setDepth(50);
    for (let i = 0; i < 4; i++) this.rings.push(scene.add.image(0, 0, 'p_ring').setVisible(false).setDepth(49));
    for (let i = 0; i < 12; i++) {
      this.texts.push(scene.add.text(0, 0, '', textStyle(30)).setOrigin(0.5).setDepth(77).setVisible(false));
    }
  }

  /** Phaser's setParticleTint only accepts a number after creation, so multi-colour bursts are split. */
  private burst(em: Phaser.GameObjects.Particles.ParticleEmitter, tints: number | number[], n: number, x: number, y: number) {
    const list = Array.isArray(tints) ? tints : [tints];
    const per = Math.max(1, Math.round(n / list.length));
    for (const t of list) {
      em.setParticleTint(t);
      em.explode(per, x, y);
    }
  }

  splash(x: number, y: number, tints: number[], power = 1, count = 18) {
    this.burst(this.goo, tints, Math.round(count * clamp(power, 0.6, 1.6)), x, y);
    this.dust.setParticleTint(tints[0]);
    this.dust.explode(6, x, y);
  }

  clang(x: number, y: number) {
    this.burst(this.stars, [0xffffff, 0xfff2a8, 0xbfe3ff], 10, x, y);
    this.ring(x, y, 0xffffff, 0.9);
  }

  sparkles(x: number, y: number, n = 16, tint: number | number[] = [0xffe066, 0xffffff, 0xffc93c]) {
    this.burst(this.stars, tint, n, x, y);
  }

  confetti(x: number, y: number, n = 80) {
    this.conf.explode(n, x, y);
  }

  steam(x: number, y: number) {
    this.puff.setParticleTint(0xffffff);
    this.puff.explode(2, x, y);
  }

  smoke(x: number, y: number, n = 6, tint = 0xd9d2c8) {
    this.puff.setParticleTint(tint);
    this.puff.explode(n, x, y);
  }

  eggShards(x: number, y: number) {
    this.burst(this.shards, [0xffffff, 0xf2e9d6], 10, x, y);
  }

  papers(x: number, y: number, n = 12) {
    this.paper.explode(n, x, y);
  }

  ring(x: number, y: number, tint: number, scale = 1) {
    const r = this.rings.find((q) => !q.visible) ?? this.rings[0];
    this.scene.tweens.killTweensOf(r);
    r.setPosition(x, y).setTint(tint).setVisible(true).setAlpha(0.9).setScale(0.2 * scale);
    this.scene.tweens.add({
      targets: r,
      scale: 1.3 * scale,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => r.setVisible(false),
    });
  }

  float(x: number, y: number, str: string, size = 30, color = '#ffffff', rise = 70, hold = 520) {
    const t = this.texts[this.textIdx];
    this.textIdx = (this.textIdx + 1) % this.texts.length;
    this.scene.tweens.killTweensOf(t);
    t.setStyle(textStyle(size, color));
    t.setText(str).setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.3).setAngle(rand(-6, 6));
    this.scene.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t,
      y: y - rise,
      alpha: 0,
      delay: hold,
      duration: 480,
      ease: 'Cubic.In',
      onComplete: () => t.setVisible(false),
    });
    return t;
  }

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  punchZoom(k: number) {
    this.zoom.x = Math.max(this.zoom.x, k);
  }

  /** Apply shake + zoom to the main camera (logical coordinates). */
  camera(dt: number) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.zoom.target = 1 + this.focus.k;
    this.zoom.step(dt);
    const cam = this.scene.cameras.main;
    const s = this.trauma * this.trauma;
    const ox = s * 16 * (Math.sin(this.t * 61) * 0.6 + Math.sin(this.t * 97) * 0.4);
    const oy = s * 12 * (Math.sin(this.t * 71 + 1) * 0.6 + Math.sin(this.t * 113) * 0.4);
    const k = Math.max(0.5, this.zoom.x);
    cam.setZoom(L.Z * k);
    const cx = L.W / 2;
    const cy = L.H / 2;
    const fx = this.focus.k > 0 ? this.focus.x : cx;
    const fy = this.focus.k > 0 ? this.focus.y : cy;
    cam.centerOn(fx + (cx - fx) / k + ox, fy + (cy - fy) / k + oy);
  }
}
