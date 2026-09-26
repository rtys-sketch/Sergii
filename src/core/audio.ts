import { save } from './save';

/**
 * Fully procedural Web Audio: no audio files to download, works offline and
 * unlocks on the first user gesture (required by iOS Safari).
 */
type Track = 'menu' | 'game' | 'none';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  private distCurve!: Float32Array<ArrayBuffer>;
  private last: Record<string, number> = {};

  // music state
  private track: Track = 'none';
  private wantTrack: Track = 'none';
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  bpm = 112;
  private targetBpm = 112;
  intensity = 0; // 0 normal, 1 tense, 2 rage

  unlock = () => {
    try {
      if (!this.ctx) this.create();
      const ctx = this.ctx!;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      // iOS: play a silent buffer inside the gesture to fully unlock output
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      if (this.wantTrack !== 'none' && this.track !== this.wantTrack) this.startMusic(this.wantTrack);
    } catch {
      /* no audio support */
    }
  };

  private create() {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = save.sound ? 1 : 0;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = save.music ? 0.34 : 0;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = 1024;
    this.distCurve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      this.distCurve[i] = Math.tanh(x * 3.2);
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  setSound(on: boolean) {
    save.sound = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }
  setMusic(on: boolean) {
    save.music = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, this.ctx.currentTime, 0.05);
  }

  private ok(key: string, gap = 0.03) {
    if (!this.ctx || this.ctx.state !== 'running' || !save.sound) return false;
    const t = this.ctx.currentTime;
    if (this.last[key] !== undefined && t - this.last[key] < gap) return false;
    this.last[key] = t;
    return true;
  }

  // ---------- primitives ----------
  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t0: number,
    dur: number,
    gain: number,
    dest: AudioNode = this.sfxBus,
    attack = 0.004,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return o;
  }

  private noise(
    t0: number,
    dur: number,
    gain: number,
    ftype: BiquadFilterType,
    f0: number,
    f1 = f0,
    q = 1,
    dest: AudioNode = this.sfxBus,
    attack = 0.003,
  ) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    const off = Math.random() * 0.5;
    s.start(t0, off, dur + 0.05);
  }

  private get now() {
    return this.ctx!.currentTime + 0.005;
  }

  // ---------- SFX ----------
  whoosh(power = 1) {
    if (!this.ok('whoosh', 0.05)) return;
    const t = this.now;
    const p = Math.min(1.4, Math.max(0.4, power));
    this.noise(t, 0.2 + 0.08 * p, 0.28 + 0.12 * p, 'bandpass', 500, 2600 * p, 1.4, this.sfxBus, 0.06);
  }

  splat(kind: 'red' | 'brown' | 'yolk' | 'cream' | 'gold' = 'red') {
    if (!this.ok('splat', 0.04)) return;
    const t = this.now;
    const low = kind === 'brown' ? 0.6 : kind === 'cream' ? 0.75 : 1;
    this.noise(t, 0.2, 0.75, 'lowpass', 1800 * low, 260, 0.8);
    this.tone('sine', 190 * low, 55, t, 0.13, 0.55);
    this.noise(t + 0.02, 0.14, 0.35, 'bandpass', 1100 * low, 420, 5);
    if (kind === 'brown') this.tone('sine', 320, 80, t + 0.03, 0.18, 0.3);
    if (kind === 'yolk') {
      for (let i = 0; i < 3; i++) this.noise(t - 0.02 + i * 0.018, 0.018, 0.4, 'bandpass', 3400, 3400, 3);
    }
    if (kind === 'gold') this.bells(t + 0.04, 0.35);
  }

  clang() {
    if (!this.ok('clang', 0.05)) return;
    const t = this.now;
    const b = 520 * (0.94 + Math.random() * 0.12);
    const partials = [
      [1, 0.34, 0.9],
      [2.01, 0.22, 0.6],
      [2.93, 0.16, 0.45],
      [4.12, 0.1, 0.32],
      [5.4, 0.06, 0.22],
    ];
    for (const [m, g, d] of partials) this.tone('sine', b * m, b * m * 0.995, t, d, g);
    this.noise(t, 0.03, 0.5, 'highpass', 3500, 3500, 0.7);
  }

  thud() {
    if (!this.ok('thud', 0.05)) return;
    const t = this.now;
    this.tone('sine', 120, 48, t, 0.16, 0.6);
    this.noise(t, 0.08, 0.35, 'lowpass', 500, 200, 0.7);
  }

  slap() {
    if (!this.ok('slap', 0.04)) return;
    const t = this.now;
    this.noise(t, 0.07, 0.9, 'highpass', 1400, 900, 0.6, this.sfxBus, 0.001);
    this.noise(t, 0.09, 0.5, 'bandpass', 2600, 1200, 2);
    this.tone('sine', 220, 90, t, 0.08, 0.4);
  }

  paper() {
    if (!this.ok('paper', 0.05)) return;
    const t = this.now;
    this.noise(t, 0.22, 0.45, 'bandpass', 1400, 700, 0.6, this.sfxBus, 0.01);
    this.tone('sine', 140, 70, t, 0.1, 0.3);
  }

  crack() {
    if (!this.ok('crack', 0.05)) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) this.noise(t + i * 0.022, 0.02, 0.45, 'bandpass', 3000 + i * 400, 3000, 3);
  }

  click() {
    if (!this.ok('click', 0.03)) return;
    const t = this.now;
    this.tone('sine', 900, 1400, t, 0.06, 0.22);
    this.tone('triangle', 1800, 1800, t, 0.03, 0.06);
  }

  pop(pitch = 1) {
    if (!this.ok('pop', 0.03)) return;
    const t = this.now;
    this.tone('sine', 380 * pitch, 900 * pitch, t, 0.09, 0.22);
  }

  pickup() {
    if (!this.ok('pickup', 0.04)) return;
    const t = this.now;
    this.tone('sine', 520, 780, t, 0.06, 0.12);
  }

  combo(level: number) {
    if (!this.ok('combo', 0.05)) return;
    const t = this.now;
    const base = [72, 74, 76, 79, 81, 84, 86, 88];
    const n = Math.min(3 + Math.floor(level / 2), 6);
    for (let i = 0; i < n; i++) {
      const note = base[Math.min(base.length - 1, i + Math.min(level, 3))];
      this.tone('square', midi(note), midi(note), t + i * 0.045, 0.1, 0.07);
      this.tone('sine', midi(note + 12), midi(note + 12), t + i * 0.045, 0.12, 0.06);
    }
  }

  score() {
    if (!this.ok('score', 0.05)) return;
    const t = this.now;
    this.tone('sine', 1320, 1320, t, 0.05, 0.08);
    this.tone('sine', 1760, 1760, t + 0.035, 0.07, 0.07);
  }

  hurt() {
    if (!this.ok('hurt', 0.1)) return;
    const t = this.now;
    this.tone('sine', 110, 32, t, 0.38, 0.9);
    this.noise(t, 0.25, 0.7, 'lowpass', 2200, 300, 0.7);
    const ctx = this.ctx!;
    const ws = ctx.createWaveShaper();
    ws.curve = this.distCurve;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    ws.connect(g);
    g.connect(this.sfxBus);
    this.tone('square', 70, 45, t, 0.22, 0.6, ws);
  }

  warn() {
    if (!this.ok('warn', 0.2)) return;
    const t = this.now;
    this.tone('square', 988, 988, t, 0.07, 0.07);
    this.tone('square', 740, 740, t + 0.1, 0.09, 0.07);
    this.noise(t, 0.25, 0.12, 'bandpass', 800, 3200, 3, this.sfxBus, 0.2);
  }

  windup() {
    if (!this.ok('windup', 0.2)) return;
    const t = this.now;
    this.tone('sawtooth', 180, 520, t, 0.35, 0.05, this.sfxBus, 0.25);
  }

  belly() {
    if (!this.ok('belly', 0.3)) return;
    const t = this.now;
    this.tone('sine', 180, 42, t, 0.55, 0.85);
    this.tone('sawtooth', 92, 38, t + 0.03, 0.4, 0.12);
    this.noise(t, 0.45, 0.35, 'lowpass', 800, 120, 0.8);
  }

  dodge() {
    if (!this.ok('dodge', 0.1)) return;
    const t = this.now;
    this.noise(t, 0.3, 0.5, 'bandpass', 2400, 400, 1.2, this.sfxBus, 0.02);
    this.tone('sine', 1560, 1560, t + 0.12, 0.12, 0.08);
  }

  sting() {
    if (!this.ok('sting', 0.4)) return;
    const t = this.now;
    const notes = [50, 50, 53];
    notes.forEach((n, i) => {
      const tt = t + i * 0.17;
      const d = i === 2 ? 0.7 : 0.13;
      this.tone('square', midi(n), midi(n), tt, d, 0.1);
      this.tone('sawtooth', midi(n - 12), midi(n - 12), tt, d, 0.08);
      this.tone('sine', midi(n - 24), midi(n - 24), tt, d, 0.3);
    });
  }

  rage() {
    if (!this.ok('rage', 0.5)) return;
    const t = this.now;
    const ctx = this.ctx!;
    const ws = ctx.createWaveShaper();
    ws.curve = this.distCurve;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
    f.frequency.exponentialRampToValueAtTime(260, t + 1.3);
    const g = ctx.createGain();
    g.gain.value = 0.5;
    ws.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    for (const d of [0, 3.5, -4]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(72 + d, t);
      o.frequency.linearRampToValueAtTime(98 + d, t + 0.4);
      o.frequency.linearRampToValueAtTime(60 + d, t + 1.3);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.5, t + 0.08);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(og);
      og.connect(ws);
      o.start(t);
      o.stop(t + 1.45);
    }
    this.noise(t, 1.2, 0.35, 'lowpass', 900, 120, 0.7, this.sfxBus, 0.05);
    this.tone('sine', 60, 30, t, 0.8, 0.8);
  }

  heart() {
    if (!this.ok('heart', 0.1)) return;
    const t = this.now;
    this.tone('square', 660, 220, t, 0.28, 0.08);
  }

  whistle() {
    if (!this.ok('whistle', 0.3)) return;
    const t = this.now;
    const ctx = this.ctx!;
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.2;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 2300;
      lfo.frequency.value = 38;
      lg.gain.value = 90;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.1, tt + 0.01);
      g.gain.setValueAtTime(0.1, tt + (i ? 0.3 : 0.12));
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (i ? 0.36 : 0.16));
      o.connect(g);
      g.connect(this.sfxBus);
      o.start(tt);
      lfo.start(tt);
      o.stop(tt + 0.4);
      lfo.stop(tt + 0.4);
    }
  }

  private bells(t: number, gain: number) {
    [84, 88, 91, 96].forEach((n, i) => {
      this.tone('sine', midi(n), midi(n), t + i * 0.06, 0.9, gain * 0.35);
      this.tone('sine', midi(n) * 2.76, midi(n) * 2.76, t + i * 0.06, 0.35, gain * 0.08);
    });
  }

  golden() {
    if (!this.ok('golden', 0.5)) return;
    const t = this.now;
    const ctx = this.ctx!;
    // "aaah" choir: saw through formant filters
    for (const n of [62, 66, 69, 74]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 800;
      f1.Q.value = 6;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1150;
      f2.Q.value = 7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.25);
      g.gain.setValueAtTime(0.2, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(f1);
      o.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(this.sfxBus);
      o.start(t);
      o.stop(t + 1.75);
    }
    this.bells(t + 0.1, 0.9);
    this.tone('sine', midi(38), midi(38), t, 1.4, 0.25, this.sfxBus, 0.1);
  }

  victory() {
    if (!this.ok('victory', 0.5)) return;
    const t = this.now;
    const seq = [60, 64, 67, 72, 67, 72, 76, 79];
    seq.forEach((n, i) => {
      const tt = t + i * 0.1;
      const d = i === seq.length - 1 ? 0.9 : 0.12;
      this.tone('square', midi(n), midi(n), tt, d, 0.07);
      this.tone('triangle', midi(n), midi(n), tt, d, 0.14);
    });
    [60, 64, 67, 72].forEach((n) => this.tone('sawtooth', midi(n - 12), midi(n - 12), t + 0.8, 1.2, 0.04, this.sfxBus, 0.05));
    this.bells(t + 0.8, 0.5);
  }

  lose() {
    if (!this.ok('lose', 0.5)) return;
    const t = this.now;
    const seq = [55, 54, 53, 52];
    seq.forEach((n, i) => {
      const tt = t + i * 0.32;
      const d = i === 3 ? 0.9 : 0.3;
      const o = this.tone('sawtooth', midi(n), midi(n), tt, d, 0.12, this.sfxBus, 0.03);
      if (i === 3) {
        const ctx = this.ctx!;
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = 6;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(tt);
        lfo.stop(tt + d);
      }
    });
  }

  tick() {
    if (!this.ok('tick', 0.05)) return;
    this.tone('square', 1200, 1200, this.now, 0.03, 0.05);
  }

  // ---------- music ----------
  startMusic(track: Track) {
    this.wantTrack = track;
    if (!this.ctx) return;
    if (this.track === track && this.timer !== null) return;
    this.track = track;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.bpm = this.targetBpm = track === 'menu' ? 96 : 112;
    this.intensity = 0;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.wantTrack = 'none';
    this.track = 'none';
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntensity(level: number) {
    this.intensity = level;
    this.targetBpm = this.track === 'menu' ? 96 : level >= 2 ? 150 : level >= 1 ? 128 : 112;
  }

  /** Temporary tempo boost ("break is over"). */
  setRush(on: boolean) {
    const base = this.intensity >= 2 ? 150 : this.intensity >= 1 ? 128 : 112;
    this.targetBpm = on ? base + 18 : base;
  }

  /** Lowpass the music (pause menu / dramatic moments). */
  muffle(on: boolean) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.08);
  }

  duckMusic(amount: number, time = 0.4) {
    if (!this.ctx || !save.music) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0.34 * amount, t, 0.03);
    this.musicBus.gain.setTargetAtTime(0.34, t + time, 0.25);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.track === 'none') return;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.bpm += (this.targetBpm - this.bpm) * 0.08;
      if (save.music) this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, t: number) {
    const bus = this.musicBus;
    const bar = Math.floor(s / 16) % 4;
    const i = s % 16;
    const rage = this.intensity >= 2;
    const tense = this.intensity >= 1;
    const menu = this.track === 'menu';
    const stepDur = 60 / this.bpm / 4;

    // --- drums ---
    if (!menu) {
      const kick = rage ? i % 4 === 0 : i === 0 || i === 7 || i === 8 || (bar === 3 && i === 14);
      if (kick) {
        this.tone('sine', 150, 42, t, 0.22, 0.85, bus, 0.002);
      }
      if (i === 4 || i === 12 || (rage && bar === 3 && i >= 13)) {
        this.noise(t, 0.13, 0.42, 'bandpass', 1900, 1500, 0.8, bus, 0.001);
        this.tone('triangle', 200, 150, t, 0.07, 0.25, bus);
      }
      const hat = rage || tense ? true : i % 2 === 0;
      if (hat) this.noise(t, i === 14 ? 0.16 : 0.035, i % 4 === 2 ? 0.14 : 0.07, 'highpass', 7500, 7500, 0.7, bus, 0.001);
    } else {
      if (i === 4 || i === 12) this.noise(t, 0.09, 0.12, 'bandpass', 2500, 1800, 0.8, bus, 0.001);
      if (i % 4 === 2) this.noise(t, 0.03, 0.05, 'highpass', 8000, 8000, 0.7, bus, 0.001);
    }

    // --- bass --- D minor funk: Dm | Dm | Bb | A
    const roots = [38, 38, 34, 33];
    const root = roots[bar];
    const pattern: (number | null)[] = rage
      ? [0, null, 12, 0, null, 0, 12, null, 0, null, 12, 0, 3, null, 5, 7]
      : [0, null, 12, 0, null, null, 3, null, 5, null, 5, 7, null, null, 10, null];
    const iv = pattern[i];
    if (iv !== null && iv !== undefined) {
      const f = midi(root + iv);
      const o = this.ctx!.createOscillator();
      const flt = this.ctx!.createBiquadFilter();
      const g = this.ctx!.createGain();
      o.type = menu ? 'triangle' : rage ? 'sawtooth' : 'square';
      o.frequency.value = f;
      flt.type = 'lowpass';
      flt.Q.value = rage ? 8 : 5;
      flt.frequency.setValueAtTime(menu ? 700 : rage ? 2200 : 1300, t);
      flt.frequency.exponentialRampToValueAtTime(180, t + stepDur * 1.6);
      const len = stepDur * (iv === 12 ? 0.8 : 1.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(menu ? 0.34 : 0.26, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(flt);
      flt.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + len + 0.02);
    }

    // --- chord stabs on the off-beats ---
    const chords = [
      [62, 65, 69],
      [62, 65, 69],
      [58, 62, 65],
      [57, 61, 64],
    ];
    const stab = menu ? i === 6 || i === 14 : rage ? i % 4 === 2 : i === 6 || i === 10 || i === 14;
    if (stab) {
      for (const n of chords[bar]) {
        this.tone(menu ? 'triangle' : 'square', midi(n), midi(n), t, stepDur * (menu ? 1.8 : 0.9), menu ? 0.045 : 0.03, bus, 0.003);
      }
    }

    // --- sneaky lead motif (every other phrase) ---
    if (!rage && (menu || this.step >= 32)) {
      const lead: Record<number, number> = { 0: 74, 3: 77, 6: 76, 8: 74, 11: 72, 12: 69 };
      const leadB: Record<number, number> = { 0: 70, 3: 74, 6: 72, 8: 69, 10: 73, 12: 76 };
      const src = bar < 2 ? lead : leadB;
      const n = src[i];
      if (n && bar % 2 === 0) this.tone('triangle', midi(n), midi(n), t, stepDur * 1.6, menu ? 0.06 : 0.045, bus, 0.005);
    }
    if (rage && i % 2 === 0) {
      const arp = chords[bar];
      const n = arp[(i / 2) % 3] + 12;
      this.tone('sawtooth', midi(n), midi(n), t, stepDur * 0.8, 0.025, bus);
    }
  }
}

export const audio = new AudioEngine();

export function installAudioUnlock() {
  const h = () => audio.unlock();
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
    window.addEventListener(ev, h, { capture: true, passive: true });
  }
}
