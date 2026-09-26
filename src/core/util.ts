export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;
export const sign = (v: number) => (v < 0 ? -1 : 1);

/** "14 250" */
export function fmt(n: number) {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function weighted<T extends string>(weights: Partial<Record<T, number>>): T {
  let total = 0;
  for (const k in weights) total += weights[k] ?? 0;
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k] ?? 0;
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0] as T;
}

/** Critically-damped-ish spring for organic puppet motion. */
export class Spring {
  v = 0;
  constructor(public x = 0, public target = 0, public k = 170, public d = 13) {}
  step(dt: number) {
    // semi-implicit Euler in small sub-steps: stays stable on slow frames / hitches
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 240);
      const a = (this.target - this.x) * this.k - this.v * this.d;
      this.v += a * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }
  kick(impulse: number) {
    this.v += impulse;
  }
}

/** Cheap smooth 1D noise (sum of sines) for idle motion. */
export function wobble(t: number, seed = 0) {
  return (
    Math.sin(t * 1.3 + seed) * 0.5 +
    Math.sin(t * 2.7 + seed * 1.7) * 0.3 +
    Math.sin(t * 5.1 + seed * 0.3) * 0.2
  );
}

export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
export function easeInCubic(t: number) {
  return t * t * t;
}

export function vibrate(ms: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* iOS Safari: no vibration API */
  }
}
