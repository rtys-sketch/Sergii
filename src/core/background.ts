import Phaser from 'phaser';
import { canvas, circle, ellipse, linear, radial, rng, roundRect, type Ctx } from './draw';
import { K } from './layout';

/**
 * Cartoon version of the place from Sergii's photo: willow & birches behind a
 * wooden fence, lawn, paving stones, the dark mosaic column and a thuja bush.
 * Layers are painted once and parallax-shifted at runtime.
 */
export const BG = {
  scale: 1.25,
  far: { w: 860, h: 1000, horizon: 700, depth: 6 },
  mid: { w: 900, h: 1000, horizon: 700, depth: 2.4 },
  ground: { w: 1000, h: 1120, top: 30, depth: 1.6 },
  table: { w: 1040, h: 300, depth: 0.92, topY: 430 },
  fg: { w: 1000, h: 520, depth: 0.45 },
};

export const GROUND_Y = 530; // world Y of the ground at Sergii's plane
export const TABLE_Y = 440; // world Y of the table top (back edge)

function add(scene: Phaser.Scene, key: string, w: number, h: number, s: number, paint: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const { c, ctx } = canvas(w * s, h * s);
  ctx.scale(s, s);
  paint(ctx);
  scene.textures.addCanvas(key, c);
}

function leafMass(ctx: Ctx, r: () => number, x: number, y: number, rad: number, cols: string[], n = 40) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * rad;
    const px = x + Math.cos(a) * d * 1.2;
    const py = y + Math.sin(a) * d * 0.8;
    const rr = rad * (0.18 + r() * 0.22);
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    circle(ctx, px, py, rr);
    ctx.fill();
  }
}

function bokeh(ctx: Ctx, r: () => number, n: number, w: number, y0: number, y1: number, cols: string[], rmin = 8, rmax = 34) {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = y0 + r() * (y1 - y0);
    const rr = rmin + r() * (rmax - rmin);
    const c = cols[Math.floor(r() * cols.length)];
    ctx.fillStyle = radial(ctx, x, y, rr, [[0, c], [0.7, c.replace(/[\d.]+\)$/, '0.12)')], [1, 'rgba(255,200,120,0)']]);
    circle(ctx, x, y, rr);
    ctx.fill();
  }
}

function paintFar(ctx: Ctx) {
  const { w, h, horizon: H0 } = BG.far;
  const r = rng(1234);
  // golden-hour sky
  ctx.fillStyle = linear(ctx, 0, 0, 0, H0, [
    [0, '#23305a'],
    [0.35, '#6b4a78'],
    [0.62, '#d9765a'],
    [0.85, '#f6b36a'],
    [1, '#ffd89a'],
  ]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = radial(ctx, w * 0.78, H0 - 250, 420, [[0, 'rgba(255,236,190,0.95)'], [0.25, 'rgba(255,200,120,0.55)'], [1, 'rgba(255,170,90,0)']]);
  ctx.fillRect(0, 0, w, h);
  // distant tree silhouettes with warm rim
  const treeCols = ['#24361f', '#2c4226', '#1f2f1b', '#34502c'];
  for (let x = -40; x < w + 60; x += 46) leafMass(ctx, r, x, H0 - 300 - r() * 200, 120, treeCols, 22);
  leafMass(ctx, r, 620, H0 - 440, 230, treeCols, 90);
  leafMass(ctx, r, 170, H0 - 420, 200, treeCols, 70);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = radial(ctx, w * 0.78, H0 - 250, 520, [[0, 'rgba(255,190,110,0.55)'], [1, 'rgba(255,190,110,0)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  bokeh(ctx, r, 26, w, 60, H0 - 220, ['rgba(255,214,140,0.55)', 'rgba(255,170,100,0.45)', 'rgba(255,240,200,0.5)'], 10, 40);
  // wooden fence (vertical planks) right behind the terrace
  const fy = H0 - 300;
  for (let x = -10; x < w + 20; x += 44) {
    const v = r();
    ctx.fillStyle = linear(ctx, x, 0, x + 42, 0, [
      [0, v > 0.5 ? '#5a3521' : '#4f2e1c'],
      [0.5, v > 0.5 ? '#7a4a2b' : '#6c4126'],
      [1, '#4a2a19'],
    ]);
    ctx.fillRect(x, fy + r() * 10, 40, h - fy);
    ctx.fillStyle = 'rgba(255,190,120,0.08)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x + 4 + r() * 30, fy + 20 + r() * 200, 1.5, 60 + r() * 120);
  }
  ctx.fillStyle = linear(ctx, 0, fy - 20, 0, fy + 10, [[0, '#8a5733'], [1, '#5e3820']]);
  ctx.fillRect(0, fy - 22, w, 30);
  ctx.fillStyle = 'rgba(255,210,150,0.25)';
  ctx.fillRect(0, fy - 22, w, 4);
  // warm light spill on the fence
  ctx.fillStyle = radial(ctx, w * 0.5, H0 - 60, 520, [[0, 'rgba(255,180,100,0.28)'], [1, 'rgba(255,180,100,0)']]);
  ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = linear(ctx, 0, fy, 0, h, [[0, 'rgba(20,10,10,0)'], [1, 'rgba(20,10,10,0.35)']]);
  ctx.fillRect(0, fy, w, h - fy);
}

function paintMid(ctx: Ctx) {
  const { w, horizon: H0 } = BG.mid;
  const r = rng(77);
  const base = H0 + 300;
  // mosaic column from the photo (dark glossy tiles), left edge
  const cx0 = 18;
  const cw = 120;
  ctx.fillStyle = '#17110f';
  ctx.fillRect(cx0, 0, cw, base - 10);
  const tw = 14;
  const th = 16;
  for (let y = 0; y < base - 14; y += th) {
    for (let x = 0; x < cw; x += tw) {
      const t = (x + tw / 2) / cw;
      const lum = Math.sin(t * Math.PI);
      const v = 26 + lum * 40 + r() * 12;
      ctx.fillStyle = `rgb(${v + 14},${v + 2},${v - 6})`;
      roundRect(ctx, cx0 + x + 2, y + 2, tw - 4, th - 4, 2);
      ctx.fill();
      if (t > 0.62 && t < 0.8) {
        ctx.fillStyle = 'rgba(255,190,120,0.35)';
        ctx.fillRect(cx0 + x + 3, y + 3, 3, th - 7);
      }
    }
  }
  ctx.fillStyle = linear(ctx, cx0, 0, cx0 + cw, 0, [[0, 'rgba(0,0,0,0.6)'], [0.4, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0.5)']]);
  ctx.fillRect(cx0, 0, cw, base - 10);
  // pergola posts + beam
  const post = (x: number) => {
    ctx.fillStyle = linear(ctx, x, 0, x + 46, 0, [[0, '#3e2414'], [0.4, '#7a4a2a'], [1, '#2e1a0e']]);
    ctx.fillRect(x, H0 - 700, 46, base - (H0 - 700));
  };
  post(w - 96);
  ctx.fillStyle = linear(ctx, 0, H0 - 600, 0, H0 - 560, [[0, '#6a3f22'], [1, '#3a2212']]);
  ctx.fillRect(0, H0 - 600, w, 40);
  // thuja bush, warm-lit
  const bcols = ['#1f3a1c', '#2a4a24', '#193118', '#34582c', '#2c4e27'];
  for (let i = 0; i < 520; i++) {
    const t = r();
    const y = base - 20 - t * 420;
    const spread = 60 + Math.sin(t * Math.PI * 0.9) * 150;
    const x = 800 + (r() - 0.5) * 2 * spread;
    ctx.fillStyle = bcols[Math.floor(r() * bcols.length)];
    ellipse(ctx, x, y, 14 + r() * 16, 8 + r() * 8, r() * Math.PI);
    ctx.fill();
  }
  for (let i = 0; i < 140; i++) {
    const t = r();
    const y = base - 30 - t * 400;
    const spread = 40 + Math.sin(t * Math.PI * 0.9) * 130;
    ctx.fillStyle = 'rgba(255,190,110,0.22)';
    ellipse(ctx, 760 + (r() - 0.7) * 2 * spread, y, 10, 4, r() * 3);
    ctx.fill();
  }
  // hanging flower pot
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w - 150, H0 - 560);
  ctx.lineTo(w - 165, H0 - 470);
  ctx.moveTo(w - 150, H0 - 560);
  ctx.lineTo(w - 135, H0 - 470);
  ctx.stroke();
  ctx.fillStyle = '#c9b8a2';
  ellipse(ctx, w - 150, H0 - 458, 28, 18);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 3 === 0 ? '#3f7a32' : '#e0344a';
    circle(ctx, w - 150 + (r() - 0.5) * 56, H0 - 478 + (r() - 0.5) * 22, 6 + r() * 4);
    ctx.fill();
  }
  // string lights across the pergola (catenary) with glow
  const strings: [number, number, number][] = [
    [H0 - 470, 60, 0],
    [H0 - 420, 44, 1],
  ];
  for (const [y0, sag, k] of strings) {
    ctx.strokeStyle = 'rgba(20,12,8,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 10) {
      const t = x / w;
      const y = y0 + Math.sin(t * Math.PI * (k ? 3 : 2)) * sag * (k ? 0.6 : 1) + sag * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let x = 20 + k * 30; x < w; x += 62) {
      const t = x / w;
      const y = y0 + Math.sin(t * Math.PI * (k ? 3 : 2)) * sag * (k ? 0.6 : 1) + sag * 0.3 + 8;
      ctx.fillStyle = radial(ctx, x, y, 36, [[0, 'rgba(255,228,160,0.75)'], [0.3, 'rgba(255,190,110,0.28)'], [1, 'rgba(255,170,90,0)']]);
      circle(ctx, x, y, 36);
      ctx.fill();
      ctx.fillStyle = '#fff2c8';
      ellipse(ctx, x, y, 4.5, 6);
      ctx.fill();
    }
  }
}

function paintGround(ctx: Ctx) {
  const { w, h, top } = BG.ground;
  // coordinates: horizon at y = -top (texture starts `top` units below the horizon)
  const r = rng(555);
  const cx = w / 2;
  const hy = -top;
  const Yg = 530 * K;
  const syOf = (z: number) => hy + Yg / z;
  // lawn strip near the horizon
  ctx.fillStyle = '#4a2c1a';
  ctx.fillRect(0, 0, w, syOf(4.6) + 4);
  // paving
  const zs: number[] = [];
  for (let z = 4.6; z > 0.2; z -= z > 2 ? 0.34 : z > 1 ? 0.16 : 0.07) zs.push(z);
  zs.push(0.2);
  for (let row = 0; row < zs.length - 1; row++) {
    const z0 = zs[row];
    const z1 = zs[row + 1];
    const y0 = syOf(z0);
    const y1 = Math.min(h + 20, syOf(z1));
    if (y0 > h + 20) break;
    const redRow = row % 9 === 4 || row % 9 === 5;
    const off = (row % 2) * 70;
    for (let X = -3000 - off; X < 3000; X += 140) {
      const xa0 = cx + (X * K) / z0;
      const xb0 = cx + ((X + 140) * K) / z0;
      const xa1 = cx + (X * K) / z1;
      const xb1 = cx + ((X + 140) * K) / z1;
      if (Math.max(xb0, xb1) < -50 || Math.min(xa0, xa1) > w + 50) continue;
      const v = r();
      ctx.fillStyle = redRow ? (v > 0.5 ? '#8c5448' : '#7e4a3f') : v > 0.66 ? '#9c8f80' : v > 0.33 ? '#8f8374' : '#a69a8a';
      ctx.beginPath();
      const g = 1.2 / z1 + 0.6;
      ctx.moveTo(xa0 + g, y0 + g * 0.5);
      ctx.lineTo(xb0 - g, y0 + g * 0.5);
      ctx.lineTo(xb1 - g, y1 - g * 0.5);
      ctx.lineTo(xa1 + g, y1 - g * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  // soft darkening toward the camera + dappled shade from trees
  ctx.fillStyle = radial(ctx, cx, 0, 700, [[0, 'rgba(255,170,90,0.25)'], [1, 'rgba(255,170,90,0)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(20,12,10,0.1)'], [1, 'rgba(12,8,10,0.6)']]);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = 'rgba(40,50,30,0.1)';
    ellipse(ctx, r() * w, 100 + r() * (h - 100), 80 + r() * 120, 20 + r() * 30);
    ctx.fill();
  }
}

function paintTable(ctx: Ctx) {
  const { w } = BG.table;
  const r = rng(9);
  // legs (behind the apron)
  for (const lx of [120, w - 160]) {
    ctx.fillStyle = linear(ctx, lx, 0, lx + 40, 0, [[0, '#4a2c1a'], [1, '#6b4128']]);
    ctx.fillRect(lx, 90, 40, 210);
  }
  // table top surface (seen slightly from above)
  ctx.fillStyle = linear(ctx, 0, 0, 0, 66, [[0, '#6e4024'], [0.6, '#a86a3c'], [1, '#c98a55']]);
  roundRect(ctx, 0, 6, w, 64, 6);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const y = 6 + i * 16;
    ctx.fillStyle = 'rgba(60,30,10,0.35)';
    ctx.fillRect(0, y + 14, w, 2);
    for (let k = 0; k < 18; k++) {
      ctx.strokeStyle = 'rgba(80,40,15,0.18)';
      ctx.lineWidth = 1.2;
      const x = r() * w;
      ctx.beginPath();
      ctx.moveTo(x, y + 4 + r() * 8);
      ctx.bezierCurveTo(x + 40, y + r() * 14, x + 80, y + r() * 14, x + 140, y + 4 + r() * 8);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(255,230,190,0.25)';
  ctx.fillRect(0, 62, w, 4);
  // front apron
  ctx.fillStyle = linear(ctx, 0, 68, 0, 128, [[0, '#6e3f21'], [1, '#3a2011']]);
  ctx.fillRect(0, 68, w, 58);
  ctx.strokeStyle = '#2f1a0c';
  ctx.lineWidth = 3;
  ctx.strokeRect(-4, 68, w + 8, 58);
  for (let x = 90; x < w; x += 180) {
    ctx.fillStyle = '#3a2213';
    circle(ctx, x, 96, 4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 126, w, 10);
}

function paintFg(ctx: Ctx) {
  const { w } = BG.fg;
  const r = rng(4242);
  const cols = ['rgba(22,34,18,0.92)', 'rgba(34,50,26,0.9)', 'rgba(16,26,14,0.95)'];
  for (const side of [0, 1]) {
    for (let i = 0; i < 26; i++) {
      const x0 = side ? w - r() * 190 : r() * 190;
      const len = 120 + r() * 300;
      let x = x0;
      let y = -10;
      for (let k = 0; k < 9; k++) {
        const ny = y + len / 9;
        const nx = x + (side ? -1 : 1) * r() * 5;
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ellipse(ctx, nx, ny, 5 + r() * 3, 13 + r() * 5, (side ? -1 : 1) * (0.3 + r() * 0.4));
        ctx.fill();
        x = nx;
        y = ny;
      }
    }
  }
}

export function buildBackground(scene: Phaser.Scene) {
  const s = BG.scale;
  add(scene, 'bg_far', BG.far.w, BG.far.h, s, paintFar);
  add(scene, 'bg_mid', BG.mid.w, BG.mid.h, s, paintMid);
  add(scene, 'bg_ground', BG.ground.w, BG.ground.h, s, paintGround);
  add(scene, 'bg_table', BG.table.w, BG.table.h, Math.max(1.5, s), paintTable);
  add(scene, 'bg_fg', BG.fg.w, BG.fg.h, 1, paintFg);
}
