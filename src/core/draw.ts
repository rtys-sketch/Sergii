/** Small Canvas2D toolkit used to paint all non-photo art at runtime (crisp at any DPR). */
export type Ctx = CanvasRenderingContext2D;

export const OUTLINE = '#2a1720';

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

/** Seeded PRNG so procedural art looks the same every launch. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Fill current path with an outline drawn behind (cartoon look). */
export function fillOutlined(ctx: Ctx, fill: string | CanvasGradient, lw: number, stroke = OUTLINE) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Organic blob made of overlapping circles (splats, bushes, clouds). */
export function blobCircles(
  r: () => number,
  cx: number,
  cy: number,
  radius: number,
  n: number,
  spread = 0.85,
  minR = 0.3,
  maxR = 0.6,
) {
  const out: [number, number, number][] = [[cx, cy, radius]];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8;
    const d = radius * spread * (0.6 + r() * 0.5);
    out.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (minR + r() * (maxR - minR))]);
  }
  return out;
}

export function fillCircles(ctx: Ctx, circles: [number, number, number][], grow = 0) {
  ctx.beginPath();
  for (const [x, y, rr] of circles) {
    ctx.moveTo(x + rr + grow, y);
    ctx.arc(x, y, rr + grow, 0, Math.PI * 2);
  }
  ctx.fill();
}
