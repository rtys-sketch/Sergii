import Phaser from 'phaser';
import {
  canvas,
  circle,
  ellipse,
  fillOutlined,
  linear,
  radial,
  roundRect,
  rng,
  blobCircles,
  fillCircles,
  OUTLINE,
  type Ctx,
} from './draw';
import { L } from './layout';
import type { ItemKind, SplatKind } from '../data/config';

export const ITEM_PX = 256;

type Painter = (ctx: Ctx) => void;

function add(scene: Phaser.Scene, key: string, w: number, h: number, scale: number, paint: Painter) {
  if (scene.textures.exists(key)) return;
  const { c, ctx } = canvas(w * scale, h * scale);
  ctx.scale(scale, scale);
  paint(ctx);
  scene.textures.addCanvas(key, c);
}

// ------------------------------------------------------------------ items
function tomato(ctx: Ctx) {
  ellipse(ctx, 50, 56, 40, 35);
  fillOutlined(ctx, radial(ctx, 36, 42, 56, [[0, '#ff8f74'], [0.42, '#ee3323'], [1, '#9c120c']]), 4.5);
  ctx.strokeStyle = 'rgba(110,8,4,0.28)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(40, 24);
  ctx.bezierCurveTo(26, 44, 28, 74, 40, 88);
  ctx.moveTo(60, 24);
  ctx.bezierCurveTo(74, 44, 72, 74, 60, 88);
  ctx.stroke();
  ellipse(ctx, 34, 42, 11, 6.5, -0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fill();
  ellipse(ctx, 47, 33, 3.2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  // calyx
  ctx.save();
  ctx.translate(50, 24);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2 - Math.PI / 2 + 0.3);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(9, -5, 17, 0);
    ctx.quadraticCurveTo(9, 5, 0, 3);
    ctx.closePath();
    fillOutlined(ctx, '#3f9e46', 3);
    ctx.restore();
  }
  circle(ctx, 0, 0, 4.5);
  fillOutlined(ctx, '#2f7a33', 2.5);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(2, -8, 6, -12);
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#3b8c3f';
  ctx.stroke();
  ctx.restore();
}

function poopShape(ctx: Ctx, fills: [number, string][], line: string, hi: string) {
  const tiers: [number, number, number, number][] = [
    [50, 77, 41, 15],
    [50, 60, 32, 13.5],
    [51, 44, 23, 11.5],
  ];
  for (const [x, y, rx, ry] of tiers) {
    ellipse(ctx, x, y, rx, ry);
    fillOutlined(ctx, radial(ctx, x - rx * 0.3, y - ry * 0.6, rx * 1.4, fills), 4.5, line);
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.1, y - ry * 0.2, rx * 0.72, ry * 0.55, 0, Math.PI * 1.08, Math.PI * 1.62);
    ctx.strokeStyle = hi;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(42, 38);
  ctx.quadraticCurveTo(46, 17, 62, 16);
  ctx.quadraticCurveTo(57, 27, 61, 37);
  ctx.closePath();
  fillOutlined(ctx, radial(ctx, 50, 24, 20, fills), 4, line);
}

function poop(ctx: Ctx) {
  poopShape(ctx, [[0, '#a8743c'], [0.55, '#734621'], [1, '#4a2b13']], OUTLINE, 'rgba(255,225,180,0.38)');
}

function gold(ctx: Ctx) {
  const g = radial(ctx, 50, 55, 50, [[0, 'rgba(255,230,120,0.55)'], [1, 'rgba(255,200,40,0)']]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 100, 100);
  poopShape(ctx, [[0, '#fff6b8'], [0.45, '#ffc93c'], [1, '#b87800']], '#5a3b00', 'rgba(255,255,255,0.7)');
  sparkle(ctx, 22, 28, 7);
  sparkle(ctx, 80, 40, 5);
  sparkle(ctx, 70, 88, 4);
}

function sparkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function can(ctx: Ctx) {
  ellipse(ctx, 50, 86, 21, 4.8);
  fillOutlined(ctx, linear(ctx, 29, 0, 71, 0, [[0, '#7c8590'], [0.35, '#eef2f6'], [1, '#6b737d']]), 4);
  roundRect(ctx, 29, 18, 42, 68, 5);
  fillOutlined(
    ctx,
    linear(ctx, 29, 0, 71, 0, [
      [0, '#0c3272'],
      [0.16, '#2c7ee0'],
      [0.3, '#96c8ff'],
      [0.42, '#3a88ea'],
      [0.78, '#1a4ea2'],
      [1, '#0a2a5e'],
    ]),
    4,
  );
  // label band
  ctx.save();
  roundRect(ctx, 29, 18, 42, 68, 5);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(20, 46);
  ctx.bezierCurveTo(40, 40, 60, 52, 80, 44);
  ctx.lineTo(80, 62);
  ctx.bezierCurveTo(60, 70, 40, 58, 20, 64);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.fill();
  ctx.fillStyle = '#0d3a82';
  ctx.font = '900 11px Unbounded, Rubik, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ПИВО', 50, 54.5);
  circle(ctx, 50, 32, 5.5);
  ctx.fillStyle = '#ffcf5a';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(36, 18, 5, 68);
  ctx.restore();
  // shoulder + lid
  ellipse(ctx, 50, 18, 21, 5.2);
  fillOutlined(ctx, linear(ctx, 29, 0, 71, 0, [[0, '#8d96a1'], [0.35, '#f5f7fa'], [1, '#727a85']]), 3.5);
  ellipse(ctx, 50, 18, 15.5, 3.3);
  ctx.fillStyle = '#b8c0c9';
  ctx.fill();
  roundRect(ctx, 45, 15.5, 10, 4, 2);
  ctx.fillStyle = '#9aa3ad';
  ctx.fill();
}

function egg(ctx: Ctx) {
  ellipse(ctx, 50, 53, 29, 37);
  fillOutlined(ctx, radial(ctx, 40, 40, 50, [[0, '#ffffff'], [0.5, '#f4ecda'], [1, '#c9b995']]), 4);
  ellipse(ctx, 39, 37, 7, 12, -0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  const r = rng(7);
  ctx.fillStyle = 'rgba(160,130,90,0.25)';
  for (let i = 0; i < 9; i++) {
    circle(ctx, 38 + r() * 26, 45 + r() * 34, 0.8 + r() * 1.2);
    ctx.fill();
  }
}

function slipper(ctx: Ctx) {
  const sole = () => {
    ctx.beginPath();
    ctx.moveTo(50, 7);
    ctx.bezierCurveTo(73, 7, 77, 30, 75, 48);
    ctx.bezierCurveTo(73, 66, 71, 81, 64, 91);
    ctx.bezierCurveTo(58, 98, 42, 98, 36, 91);
    ctx.bezierCurveTo(29, 81, 27, 66, 25, 48);
    ctx.bezierCurveTo(23, 30, 27, 7, 50, 7);
    ctx.closePath();
  };
  sole();
  fillOutlined(ctx, '#5e3526', 4.5);
  ctx.save();
  ctx.translate(50, 54);
  ctx.scale(0.84, 0.86);
  ctx.translate(-50, -54);
  sole();
  ctx.fillStyle = linear(ctx, 0, 10, 0, 95, [[0, '#f1e2cc'], [1, '#d7bf9f']]);
  ctx.fill();
  ctx.restore();
  // upper (classic plaid «тапок»)
  const upper = () => {
    ctx.beginPath();
    ctx.moveTo(25, 47);
    ctx.bezierCurveTo(24, 20, 35, 8, 50, 8);
    ctx.bezierCurveTo(65, 8, 76, 20, 75, 47);
    ctx.bezierCurveTo(63, 55, 37, 55, 25, 47);
    ctx.closePath();
  };
  upper();
  fillOutlined(ctx, '#b8323a', 4);
  ctx.save();
  upper();
  ctx.clip();
  ctx.fillStyle = 'rgba(110,20,30,0.55)';
  for (let x = 18; x < 84; x += 12) ctx.fillRect(x, 0, 5, 60);
  for (let y = 6; y < 60; y += 12) ctx.fillRect(0, y, 100, 5);
  ctx.fillStyle = 'rgba(255,210,110,0.55)';
  for (let x = 24; x < 84; x += 12) ctx.fillRect(x, 0, 1.2, 60);
  for (let y = 12; y < 60; y += 12) ctx.fillRect(0, y, 100, 1.2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ellipse(ctx, 42, 22, 12, 7, -0.4);
  ctx.fill();
  ctx.restore();
  upper();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.stroke();
}

function tp(ctx: Ctx) {
  // tail
  ctx.beginPath();
  ctx.moveTo(72, 40);
  ctx.bezierCurveTo(86, 52, 88, 74, 82, 95);
  ctx.lineTo(70, 93);
  ctx.bezierCurveTo(74, 74, 72, 58, 64, 48);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 64, 0, 88, 0, [[0, '#e7e7de'], [1, '#ffffff']]), 3.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.setLineDash([2, 2]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(73, 70);
  ctx.lineTo(85, 72);
  ctx.stroke();
  ctx.setLineDash([]);
  // cylinder
  ctx.beginPath();
  ctx.moveTo(23, 32);
  ctx.lineTo(23, 76);
  ctx.ellipse(50, 76, 27, 10, 0, Math.PI, 0, true);
  ctx.lineTo(77, 32);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 23, 0, 77, 0, [[0, '#c9c9bf'], [0.35, '#ffffff'], [0.7, '#ececE4'], [1, '#b5b5aa']]), 4);
  ellipse(ctx, 50, 32, 27, 10);
  fillOutlined(ctx, radial(ctx, 50, 32, 27, [[0, '#ffffff'], [1, '#e9e9e1']]), 3.5);
  ellipse(ctx, 50, 32, 9.5, 3.8);
  fillOutlined(ctx, '#b08d62', 2.5, '#6b5033');
  ellipse(ctx, 50, 33, 6.5, 2.3);
  ctx.fillStyle = '#5c4329';
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 44; y < 80; y += 7) for (let x = 28; x < 74; x += 7) {
    circle(ctx, x + ((y / 7) % 2) * 3.5, y, 1);
    ctx.fill();
  }
}

function fish(ctx: Ctx) {
  // tail
  ctx.beginPath();
  ctx.moveTo(74, 50);
  ctx.lineTo(93, 30);
  ctx.quadraticCurveTo(86, 50, 93, 72);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 74, 30, 93, 72, [[0, '#8a5a22'], [1, '#c9913f']]), 3.5);
  // dorsal fin
  ctx.beginPath();
  ctx.moveTo(36, 33);
  ctx.lineTo(50, 21);
  ctx.lineTo(60, 34);
  ctx.closePath();
  fillOutlined(ctx, '#8d6128', 3);
  // belly fin
  ctx.beginPath();
  ctx.moveTo(44, 64);
  ctx.lineTo(52, 76);
  ctx.lineTo(58, 63);
  ctx.closePath();
  fillOutlined(ctx, '#a5732f', 3);
  // body
  ctx.beginPath();
  ctx.moveTo(8, 50);
  ctx.bezierCurveTo(20, 28, 56, 26, 78, 48);
  ctx.bezierCurveTo(58, 72, 22, 72, 8, 50);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 0, 30, 0, 70, [[0, '#6f5028'], [0.45, '#c9913f'], [1, '#f0cf8a']]), 4);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(80,50,15,0.35)';
  ctx.lineWidth = 1.2;
  for (let x = 30; x < 76; x += 6)
    for (let y = 36; y < 66; y += 6) {
      ctx.beginPath();
      ctx.arc(x + ((y / 6) % 2) * 3, y, 3.2, -1.2, 1.2);
      ctx.stroke();
    }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ellipse(ctx, 34, 40, 18, 4, -0.1);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(28, 50, 9, -1, 1);
  ctx.strokeStyle = 'rgba(60,35,10,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, 19, 46, 4.8);
  fillOutlined(ctx, '#fff7e0', 2);
  circle(ctx, 19.5, 46.3, 2.5);
  ctx.fillStyle = '#1b1b1b';
  ctx.fill();
  circle(ctx, 18.5, 45.2, 0.9);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 51);
  ctx.lineTo(14, 53);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function pie(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(12, 58);
  ctx.lineTo(88, 58);
  ctx.lineTo(79, 84);
  ctx.lineTo(21, 84);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 0, 58, 0, 84, [[0, '#f2f2f8'], [1, '#8f8f9e']]), 4);
  ctx.strokeStyle = 'rgba(80,80,100,0.35)';
  ctx.lineWidth = 1.5;
  for (let x = 20; x <= 80; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x + (50 - x) * 0.1, 82);
    ctx.stroke();
  }
  ellipse(ctx, 50, 57, 39, 10);
  fillOutlined(ctx, linear(ctx, 0, 47, 0, 67, [[0, '#f0b567'], [1, '#c77f2e']]), 3.5);
  const cream: [number, number, number][] = [
    [22, 52, 10],
    [33, 46, 12],
    [47, 42, 14],
    [62, 44, 13],
    [75, 50, 10],
    [50, 52, 20],
    [36, 54, 12],
    [64, 54, 12],
  ];
  ctx.fillStyle = OUTLINE;
  fillCircles(ctx, cream, 2);
  ctx.fillStyle = '#fffaf2';
  fillCircles(ctx, cream);
  ctx.fillStyle = 'rgba(220,190,150,0.35)';
  fillCircles(
    ctx,
    cream.map(([x, y, r]) => [x + 2, y + 3, r * 0.6] as [number, number, number]),
  );
  ctx.fillStyle = '#fffdf8';
  fillCircles(
    ctx,
    cream.map(([x, y, r]) => [x - 2, y - 3, r * 0.55] as [number, number, number]),
  );
  ctx.beginPath();
  ctx.moveTo(52, 30);
  ctx.quadraticCurveTo(56, 18, 64, 14);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#4a7a2a';
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, 51, 32, 7.5);
  fillOutlined(ctx, radial(ctx, 48, 29, 9, [[0, '#ff6a78'], [1, '#b30f26']]), 3);
  circle(ctx, 48.5, 29.5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
}

function wrench(ctx: Ctx) {
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate(-Math.PI / 4);
  const steel = linear(ctx, -8, 0, 8, 0, [[0, '#8e98a3'], [0.45, '#f4f7fa'], [1, '#76808b']]);
  roundRect(ctx, -7, -30, 14, 60, 6);
  fillOutlined(ctx, steel, 4);
  // open jaw (top)
  ctx.beginPath();
  ctx.arc(0, -36, 15, 0, Math.PI * 2);
  fillOutlined(ctx, radial(ctx, -4, -40, 20, [[0, '#ffffff'], [1, '#8a939e']]), 4);
  ctx.beginPath();
  ctx.moveTo(-6, -54);
  ctx.lineTo(-5, -38);
  ctx.lineTo(5, -38);
  ctx.lineTo(6, -54);
  ctx.closePath();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // ring end (bottom)
  ctx.beginPath();
  ctx.arc(0, 36, 14, 0, Math.PI * 2);
  fillOutlined(ctx, radial(ctx, -4, 32, 20, [[0, '#ffffff'], [1, '#8a939e']]), 4);
  ctx.beginPath();
  ctx.arc(0, 36, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-3, -24, 2.5, 48);
  ctx.restore();
}

function fridge(ctx: Ctx) {
  // retro fridge with magnets
  roundRect(ctx, 24, 5, 52, 88, 12);
  fillOutlined(ctx, linear(ctx, 24, 0, 76, 0, [[0, '#d9dfe6'], [0.3, '#ffffff'], [0.75, '#eef2f6'], [1, '#b9c2cc']]), 4);
  ctx.strokeStyle = 'rgba(40,50,60,0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(26, 36);
  ctx.lineTo(74, 36);
  ctx.stroke();
  // chrome handles
  for (const [y0, y1] of [
    [14, 30],
    [44, 66],
  ]) {
    roundRect(ctx, 66, y0, 5, y1 - y0, 2.5);
    fillOutlined(ctx, linear(ctx, 66, 0, 71, 0, [[0, '#ffffff'], [1, '#8a939e']]), 2);
  }
  // magnets
  for (const [x, y, c] of [
    [34, 48, '#e8323c'],
    [44, 58, '#ffc93c'],
    [36, 70, '#2f7fe0'],
  ] as const) {
    circle(ctx, x, y, 4);
    fillOutlined(ctx, c, 1.8);
  }
  roundRect(ctx, 30, 14, 26, 14, 2);
  ctx.fillStyle = '#fff6d6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.font = '900 5px Unbounded, Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ПИВО', 43, 23);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(30, 91, 8, 5);
  ctx.fillRect(62, 91, 8, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(29, 9, 3, 80);
}

const ITEM_PAINTERS: Record<ItemKind, Painter> = { tomato, poop, can, egg, slipper, tp, fish, pie, gold, wrench, fridge };

// ------------------------------------------------------------------ splats
interface SplatStyle {
  main: string;
  dark: string;
  light: string;
  drips: boolean;
  seeds?: string;
  yolk?: boolean;
  sparkle?: boolean;
}
const SPLATS: Record<SplatKind, SplatStyle> = {
  red: { main: '#e0281c', dark: '#8c0f09', light: '#ff6a50', drips: true, seeds: '#ffe27a' },
  brown: { main: '#6e4421', dark: '#3b220d', light: '#9c6a3a', drips: true },
  yolk: { main: '#fffcf0', dark: '#cfc4a4', light: '#ffffff', drips: true, yolk: true },
  cream: { main: '#fffaf2', dark: '#d9c7a6', light: '#ffffff', drips: true },
  gold: { main: '#ffc93c', dark: '#a86f00', light: '#fff3a0', drips: true, sparkle: true },
};

function paintSplat(ctx: Ctx, style: SplatStyle, seed: number) {
  const r = rng(seed);
  const circles = blobCircles(r, 50, 46, 22, 13, 0.95, 0.26, 0.5);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 32 + r() * 14;
    circles.push([50 + Math.cos(a) * d, 46 + Math.sin(a) * d * 0.9, 1.6 + r() * 3]);
  }
  const drips: [number, number, number][] = [];
  if (style.drips) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = 34 + r() * 32;
      const len = 14 + r() * 26;
      const w = 2.8 + r() * 2.6;
      drips.push([x, len, w]);
    }
  }
  const drawDrips = (grow: number) => {
    for (const [x, len, w] of drips) {
      roundRect(ctx, x - w - grow, 52 - grow, (w + grow) * 2, len + grow * 2, w + grow);
      ctx.fill();
      circle(ctx, x, 52 + len, w * 1.35 + grow);
      ctx.fill();
    }
  };
  ctx.fillStyle = style.dark;
  fillCircles(ctx, circles, 1.8);
  drawDrips(1.8);
  ctx.fillStyle = style.main;
  fillCircles(ctx, circles);
  drawDrips(0);
  ctx.fillStyle = style.light;
  ctx.globalAlpha = 0.55;
  fillCircles(
    ctx,
    circles.slice(0, 8).map(([x, y, rr]) => [x - 3, y - 4, rr * 0.55] as [number, number, number]),
  );
  ctx.globalAlpha = 1;
  if (style.yolk) {
    circle(ctx, 50, 46, 14);
    fillOutlined(ctx, radial(ctx, 46, 42, 16, [[0, '#ffe06a'], [0.6, '#ffb814'], [1, '#e08a00']]), 2, '#c27400');
    ellipse(ctx, 45, 41, 4.5, 3, -0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  }
  if (style.seeds) {
    ctx.fillStyle = style.seeds;
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 18;
      ellipse(ctx, 50 + Math.cos(a) * d, 46 + Math.sin(a) * d, 1.6, 1, a);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 4; i++) {
    circle(ctx, 40 + r() * 16, 36 + r() * 12, 0.9 + r() * 1.5);
    ctx.fill();
  }
  if (style.sparkle) {
    sparkle(ctx, 30, 30, 6);
    sparkle(ctx, 70, 40, 5);
    sparkle(ctx, 55, 70, 4);
  }
}

// ------------------------------------------------------------------ particles & ui
function particles(scene: Phaser.Scene) {
  add(scene, 'p_dot', 32, 32, 1, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 32, 32);
  });
  add(scene, 'p_blob', 32, 32, 1, (ctx) => {
    circle(ctx, 16, 16, 14);
    ctx.fillStyle = '#fff';
    ctx.fill();
    circle(ctx, 12, 11, 4);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fill();
  });
  add(scene, 'p_star', 48, 48, 1, (ctx) => {
    ctx.fillStyle = radial(ctx, 24, 24, 24, [[0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 48, 48);
    sparkle(ctx, 24, 24, 22);
  });
  add(scene, 'p_conf', 12, 20, 1, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 12, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(6, 0, 6, 20);
  });
  add(scene, 'p_puff', 64, 64, 1, (ctx) => {
    const r = rng(11);
    for (let i = 0; i < 7; i++) {
      const x = 20 + r() * 24;
      const y = 20 + r() * 24;
      const rr = 12 + r() * 10;
      ctx.fillStyle = radial(ctx, x, y, rr, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
      circle(ctx, x, y, rr);
      ctx.fill();
    }
  });
  add(scene, 'p_ring', 128, 128, 1, (ctx) => {
    circle(ctx, 64, 64, 56);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9;
    ctx.stroke();
  });
  add(scene, 'p_shard', 24, 24, 1, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 20);
    ctx.lineTo(10, 2);
    ctx.lineTo(22, 12);
    ctx.lineTo(14, 22);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  add(scene, 'p_paper', 28, 28, 1, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(2, 2, 24, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(26, 2);
    ctx.lineTo(26, 26);
    ctx.lineTo(2, 26);
    ctx.closePath();
    ctx.fill();
  });
  add(scene, 'p_line', 16, 96, 1, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 96, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    roundRect(ctx, 4, 0, 8, 96, 4);
    ctx.fill();
  });
}

function heartPath(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.32);
  ctx.bezierCurveTo(x, y - s * 0.05, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.28);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.1, y + s * 0.72, x, y + s * 0.88);
  ctx.bezierCurveTo(x + s * 0.1, y + s * 0.72, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.28);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y - s * 0.05, x, y + s * 0.32);
  ctx.closePath();
}

function ui(scene: Phaser.Scene, S: number) {
  add(scene, 'heart', 64, 64, S, (ctx) => {
    heartPath(ctx, 32, 6, 56);
    fillOutlined(ctx, radial(ctx, 22, 20, 40, [[0, '#ff7a86'], [0.5, '#f0243c'], [1, '#a50f22']]), 5, '#2a0c14');
    ellipse(ctx, 20, 22, 7, 4.5, -0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  });
  add(scene, 'heart_empty', 64, 64, S, (ctx) => {
    heartPath(ctx, 32, 6, 56);
    fillOutlined(ctx, 'rgba(40,10,20,0.55)', 5, 'rgba(255,255,255,0.35)');
  });
  add(scene, 'vignette', 128, 256, 1, (ctx) => {
    const g = ctx.createRadialGradient(64, 128, 40, 64, 128, 150);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.save();
    ctx.scale(1, 1.9);
    ctx.translate(0, -128 + 128 / 1.9);
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, 150, 300);
    ctx.restore();
  });
  add(scene, 'reticle', 128, 128, S, (ctx) => {
    ctx.strokeStyle = '#ff2d3a';
    ctx.lineWidth = 7;
    circle(ctx, 64, 64, 50);
    ctx.stroke();
    ctx.lineWidth = 5;
    circle(ctx, 64, 64, 28);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const [a, b, c, d] of [
      [64, 0, 64, 24],
      [64, 104, 64, 128],
      [0, 64, 24, 64],
      [104, 64, 128, 64],
    ])
      ctx.moveTo(a, b), ctx.lineTo(c, d);
    ctx.stroke();
    circle(ctx, 64, 64, 7);
    ctx.fillStyle = '#ff2d3a';
    ctx.fill();
  });
  add(scene, 'bang', 72, 88, S, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(36, 4);
    ctx.lineTo(68, 76);
    ctx.quadraticCurveTo(70, 84, 62, 84);
    ctx.lineTo(10, 84);
    ctx.quadraticCurveTo(2, 84, 4, 76);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 0, 0, 0, 88, [[0, '#ffe45c'], [1, '#ff9f1c']]), 6, '#2a1208');
    roundRect(ctx, 31, 28, 10, 32, 5);
    ctx.fillStyle = '#2a1208';
    ctx.fill();
    circle(ctx, 36, 70, 6);
    ctx.fill();
  });
  add(scene, 'lid', 180, 180, S, (ctx) => {
    circle(ctx, 90, 90, 82);
    fillOutlined(ctx, radial(ctx, 65, 60, 130, [[0, '#ffffff'], [0.35, '#d5dbe2'], [0.8, '#8f99a5'], [1, '#6d7682']]), 6);
    circle(ctx, 90, 90, 70);
    ctx.strokeStyle = 'rgba(60,70,85,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
    circle(ctx, 90, 90, 46);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipse(ctx, 90, 90, 22, 16);
    fillOutlined(ctx, radial(ctx, 84, 84, 26, [[0, '#5a5a5a'], [1, '#161616']]), 4);
    ellipse(ctx, 84, 85, 7, 4, -0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    ellipse(ctx, 58, 52, 26, 12, -0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  });
  add(scene, 'anger', 64, 64, S, (ctx) => {
    ctx.strokeStyle = '#2a0c14';
    ctx.lineCap = 'round';
    const arcs = (w: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(32, 32);
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.arc(-17, -17, 12, 0.1, Math.PI / 2 - 0.1);
        ctx.stroke();
        ctx.restore();
      }
    };
    arcs(11, '#2a0c14');
    arcs(6, '#ff2438');
  });
  add(scene, 'sweat', 40, 56, S, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(20, 4);
    ctx.bezierCurveTo(26, 18, 36, 28, 36, 38);
    ctx.bezierCurveTo(36, 48, 28, 53, 20, 53);
    ctx.bezierCurveTo(12, 53, 4, 48, 4, 38);
    ctx.bezierCurveTo(4, 28, 14, 18, 20, 4);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 0, 0, 0, 56, [[0, '#d8f3ff'], [1, '#5cc3f5']]), 4, '#123a55');
    ellipse(ctx, 14, 38, 3.5, 6, 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  });
  add(scene, 'flag', 110, 150, S, (ctx) => {
    roundRect(ctx, 14, 10, 7, 136, 3);
    fillOutlined(ctx, '#8a5a2b', 3.5);
    ctx.beginPath();
    ctx.moveTo(21, 14);
    ctx.bezierCurveTo(50, 4, 70, 26, 104, 14);
    ctx.lineTo(100, 66);
    ctx.bezierCurveTo(70, 78, 50, 56, 21, 66);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 20, 0, 104, 0, [[0, '#ffffff'], [1, '#e5e5e5']]), 3.5);
  });
  add(scene, 'lock', 48, 56, S, (ctx) => {
    ctx.beginPath();
    ctx.arc(24, 22, 12, Math.PI, 0);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#e9e2ef';
    ctx.stroke();
    roundRect(ctx, 8, 22, 32, 28, 6);
    fillOutlined(ctx, '#e9e2ef', 3, '#1a0f1f');
    circle(ctx, 24, 34, 4);
    ctx.fillStyle = '#1a0f1f';
    ctx.fill();
  });
  add(scene, 'shadow', 128, 48, 1, (ctx) => {
    const g = ctx.createRadialGradient(64, 24, 2, 64, 24, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.scale(1, 0.38);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 24 / 0.38, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  add(scene, 'glow', 128, 128, 1, (ctx) => {
    ctx.fillStyle = radial(ctx, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 128, 128);
  });
  add(scene, 'rays', 256, 256, 1, (ctx) => {
    ctx.translate(128, 128);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -128);
      ctx.lineTo(18, -128);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = radial(ctx, 0, 0, 128, [[0, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(-128, -128, 256, 256);
  });
  add(scene, 'hand', 90, 120, S, (ctx) => {
    // pointing hand (tutorial)
    ctx.beginPath();
    ctx.moveTo(34, 60);
    ctx.lineTo(34, 16);
    ctx.quadraticCurveTo(34, 6, 43, 6);
    ctx.quadraticCurveTo(52, 6, 52, 16);
    ctx.lineTo(52, 50);
    ctx.quadraticCurveTo(62, 44, 68, 52);
    ctx.quadraticCurveTo(78, 48, 82, 58);
    ctx.quadraticCurveTo(88, 60, 86, 72);
    ctx.lineTo(82, 94);
    ctx.quadraticCurveTo(78, 112, 60, 114);
    ctx.lineTo(42, 114);
    ctx.quadraticCurveTo(28, 112, 22, 98);
    ctx.lineTo(12, 76);
    ctx.quadraticCurveTo(8, 66, 16, 62);
    ctx.quadraticCurveTo(24, 58, 34, 70);
    ctx.closePath();
    fillOutlined(ctx, '#ffffff', 6, '#1a0f1f');
    ctx.strokeStyle = 'rgba(26,15,31,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(52, 52);
    ctx.lineTo(52, 66);
    ctx.moveTo(68, 54);
    ctx.lineTo(68, 68);
    ctx.stroke();
  });
  add(scene, 'crack', 256, 256, 1, (ctx) => {
    ctx.translate(128, 128);
    const r = rng(5);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + r() * 0.4;
      let x = 0;
      let y = 0;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let k = 0; k < 4; k++) {
        const len = 18 + r() * 22;
        a += (r() - 0.5) * 0.7;
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (const rr of [26, 58]) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const q = rr * (0.85 + r() * 0.3);
        ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
      }
      ctx.stroke();
    }
  });
  add(scene, 'tp_strip', 180, 180, S, (ctx) => {
    // toilet paper draped over the head
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.bezierCurveTo(60, 6, 120, 6, 160, 26);
    ctx.bezierCurveTo(150, 60, 164, 110, 150, 170);
    ctx.lineTo(128, 168);
    ctx.bezierCurveTo(138, 110, 126, 70, 132, 48);
    ctx.bezierCurveTo(110, 38, 70, 40, 48, 50);
    ctx.bezierCurveTo(52, 80, 40, 120, 46, 150);
    ctx.lineTo(24, 150);
    ctx.bezierCurveTo(18, 110, 30, 70, 20, 30);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 0, 0, 180, 0, [[0, '#f1f1ea'], [0.5, '#ffffff'], [1, '#e4e4dc']]), 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 96);
    ctx.lineTo(48, 98);
    ctx.moveTo(134, 104);
    ctx.lineTo(154, 102);
    ctx.moveTo(70, 26);
    ctx.lineTo(74, 44);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  add(scene, 'van', 420, 210, S * 0.8, (ctx) => {
    // delivery van «РОЗВОЗКА», side view facing right
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(ctx, 214, 196, 196, 12);
    ctx.fill();
    // cargo box
    roundRect(ctx, 14, 30, 270, 138, 14);
    fillOutlined(ctx, linear(ctx, 0, 30, 0, 168, [[0, '#ffffff'], [1, '#d7dde4']]), 5);
    // cab
    ctx.beginPath();
    ctx.moveTo(284, 62);
    ctx.lineTo(346, 62);
    ctx.quadraticCurveTo(372, 64, 390, 112);
    ctx.lineTo(404, 124);
    ctx.quadraticCurveTo(410, 168, 396, 168);
    ctx.lineTo(284, 168);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 0, 62, 0, 168, [[0, '#ffffff'], [1, '#d0d7df']]), 5);
    // windshield + driver
    ctx.beginPath();
    ctx.moveTo(300, 74);
    ctx.lineTo(342, 74);
    ctx.quadraticCurveTo(360, 78, 374, 112);
    ctx.lineTo(300, 112);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 300, 74, 374, 112, [[0, '#6fb6e6'], [1, '#2c6f9e']]), 3);
    circle(ctx, 326, 96, 11);
    ctx.fillStyle = 'rgba(20,20,30,0.75)';
    ctx.fill();
    // stripe + lettering
    ctx.fillStyle = '#2f7fe0';
    ctx.fillRect(16, 120, 268, 18);
    ctx.fillRect(284, 128, 118, 10);
    ctx.fillStyle = '#e8323c';
    ctx.fillRect(16, 138, 268, 6);
    ctx.fillStyle = '#1a2a4a';
    ctx.font = '900 34px Unbounded, Rubik, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('РОЗВОЗКА', 150, 82);
    ctx.font = '800 13px Rubik, Arial, sans-serif';
    ctx.fillText('ШВИДКО · ДЕШЕВО · ПІД ЗАМОВЛЕННЯ', 150, 108);
    // headlight + bumper
    roundRect(ctx, 392, 132, 12, 12, 4);
    ctx.fillStyle = '#ffe79a';
    ctx.fill();
    roundRect(ctx, 280, 162, 130, 10, 4);
    ctx.fillStyle = '#4a5360';
    ctx.fill();
    // wheels
    for (const x of [86, 330]) {
      circle(ctx, x, 170, 26);
      fillOutlined(ctx, '#1d1f24', 4);
      circle(ctx, x, 170, 11);
      ctx.fillStyle = '#9aa3ad';
      ctx.fill();
    }
  });
  add(scene, 'phone', 40, 76, S, (ctx) => {
    roundRect(ctx, 3, 3, 34, 70, 8);
    fillOutlined(ctx, '#15171c', 3);
    roundRect(ctx, 7, 10, 26, 52, 4);
    ctx.fillStyle = linear(ctx, 0, 10, 0, 62, [[0, '#3fd07a'], [1, '#1e8a4c']]);
    ctx.fill();
    circle(ctx, 20, 36, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  add(scene, 'print', 120, 200, S, (ctx) => {
    // slipper sole print on the screen
    ctx.beginPath();
    ctx.moveTo(60, 8);
    ctx.bezierCurveTo(98, 8, 104, 50, 100, 92);
    ctx.bezierCurveTo(96, 134, 94, 160, 82, 182);
    ctx.bezierCurveTo(74, 196, 46, 196, 38, 182);
    ctx.bezierCurveTo(26, 160, 24, 134, 20, 92);
    ctx.bezierCurveTo(16, 50, 22, 8, 60, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(60,35,25,0.8)';
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 4;
    for (let y = 26; y < 190; y += 14) {
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.bezierCurveTo(50, y + 8, 70, y - 8, 100, y);
      ctx.stroke();
    }
  });
}

// ------------------------------------------------------------------ Sergii's shaded torso and articulated arms
export const SHIRT = '#27304a';
export const SKIN = '#d6a293';

export const BODY = { w: 520, h: 400, neckX: 260, neckY: 40 };

function body(ctx: Ctx) {
  const { w } = BODY;
  const cx = w / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 60, 26);
    ctx.bezierCurveTo(cx - 113, 28, cx - 160, 40, cx - 190, 69);
    ctx.bezierCurveTo(cx - 214, 92, cx - 226, 138, cx - 232, 172);
    // The abdomen pushes the shirt well past the rib cage above the table —
    // one smooth curve, no notch between chest and belly.
    ctx.bezierCurveTo(cx - 240, 196, cx - 254, 214, cx - 254, 240);
    ctx.bezierCurveTo(cx - 254, 290, cx - 225, 369, cx - 166, 404);
    ctx.lineTo(cx + 166, 404);
    ctx.bezierCurveTo(cx + 225, 369, cx + 254, 290, cx + 254, 240);
    ctx.bezierCurveTo(cx + 254, 214, cx + 240, 196, cx + 232, 172);
    ctx.bezierCurveTo(cx + 226, 138, cx + 214, 92, cx + 190, 69);
    ctx.bezierCurveTo(cx + 160, 40, cx + 113, 28, cx + 60, 26);
    ctx.closePath();
  };
  // soft contact shadow
  ctx.save();
  path();
  ctx.fillStyle = linear(ctx, 0, 20, 0, 404, [[0, '#39445f'], [0.33, '#2b344d'], [0.73, '#242c40'], [1, '#171d2b']]);
  ctx.fill();
  ctx.clip();
  // key light from upper-left, warm rim from the right (string lights / sunset)
  ctx.fillStyle = radial(ctx, cx - 120, 110, 260, [[0, 'rgba(160,175,215,0.20)'], [1, 'rgba(160,175,215,0)']]);
  ctx.fillRect(0, 0, w, 420);
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [
    [0, 'rgba(0,0,0,0.45)'],
    [0.16, 'rgba(0,0,0,0.05)'],
    [0.8, 'rgba(0,0,0,0.12)'],
    [0.93, 'rgba(255,160,90,0.10)'],
    [1, 'rgba(255,170,100,0.35)'],
  ]);
  ctx.fillRect(0, 0, w, 420);
  // Rounded deltoids under the shirt connect the moving sleeves to the chest.
  for (const side of [-1, 1]) {
    ctx.fillStyle = radial(ctx, cx + side * 151, 95, 105, [
      [0, side < 0 ? 'rgba(187,201,235,0.24)' : 'rgba(117,137,181,0.16)'],
      [0.57, 'rgba(105,125,167,0.08)'],
      [1, 'rgba(8,12,25,0)'],
    ]);
    ctx.fillRect(cx + side * 151 - 110, 16, 220, 196);
  }
  // trapezius / shoulder highlight ridges
  ctx.strokeStyle = 'rgba(190,200,235,0.19)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 70, 39);
  ctx.bezierCurveTo(cx - 126, 47, cx - 162, 63, cx - 192, 99);
  ctx.moveTo(cx + 70, 39);
  ctx.bezierCurveTo(cx + 126, 47, cx + 162, 63, cx + 192, 99);
  ctx.stroke();
  // Soft pectoral and belly volumes, lit consistently with the photo head.
  ctx.fillStyle = radial(ctx, cx - 80, 172, 142, [[0, 'rgba(187,203,238,0.17)'], [0.6, 'rgba(133,155,205,0.06)'], [1, 'rgba(170,185,225,0)']]);
  ctx.fillRect(0, 0, w, 420);
  ctx.fillStyle = radial(ctx, cx + 76, 178, 140, [[0, 'rgba(170,185,225,0.11)'], [1, 'rgba(170,185,225,0)']]);
  ctx.fillRect(0, 0, w, 420);
  // The belly is the broadest visible mass, with a top-facing highlight and
  // darker curved sides. It stays visible above the table edge.
  ctx.fillStyle = radial(ctx, cx - 45, 225, 280, [[0, 'rgba(205,219,247,0.42)'], [0.44, 'rgba(154,178,226,0.24)'], [0.78, 'rgba(76,92,141,0.04)'], [1, 'rgba(6,10,25,0)']]);
  ctx.fillRect(0, 0, w, 420);
  ctx.fillStyle = radial(ctx, cx, 242, 260, [[0, 'rgba(13,19,38,0)'], [0.73, 'rgba(13,19,38,0.01)'], [1, 'rgba(6,9,20,0.18)']]);
  ctx.fillRect(0, 0, w, 420);
  // soft shadow under the chest instead of a hard line across the shirt
  ctx.save();
  ctx.translate(cx, 192);
  ctx.scale(1, 0.2);
  ctx.fillStyle = radial(ctx, 0, 0, 210, [[0, 'rgba(8,14,30,0.16)'], [0.7, 'rgba(8,14,30,0.07)'], [1, 'rgba(8,14,30,0)']]);
  ctx.fillRect(-230, -230, 460, 460);
  ctx.restore();
  // fabric folds (soft)
  const fold = (pts: number[], wdt: number, a: number) => {
    ctx.strokeStyle = `rgba(5,8,16,${a})`;
    ctx.lineWidth = wdt;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180,195,235,0.07)';
    ctx.lineWidth = wdt * 0.6;
    ctx.beginPath();
    ctx.moveTo(pts[0] - 4, pts[1] - 5);
    ctx.bezierCurveTo(pts[2] - 4, pts[3] - 5, pts[4] - 4, pts[5] - 5, pts[6] - 4, pts[7] - 5);
    ctx.stroke();
  };
  fold([cx - 185, 142, cx - 152, 181, cx - 130, 194, cx - 102, 199], 5, 0.16);
  fold([cx + 185, 142, cx + 152, 181, cx + 130, 194, cx + 102, 199], 5, 0.16);
  fold([cx - 224, 241, cx - 190, 222, cx - 156, 229, cx - 127, 254], 5, 0.21);
  fold([cx + 224, 241, cx + 190, 222, cx + 156, 229, cx + 127, 254], 5, 0.21);
  fold([cx - 205, 316, cx - 122, 326, cx - 60, 331, cx - 8, 321], 5, 0.18);
  fold([cx + 205, 316, cx + 122, 326, cx + 60, 331, cx + 8, 321], 5, 0.18);
  // knit texture
  const r = rng(99);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(r() * w, 20 + r() * 390, 1.6, 1.6);
  }
  ctx.restore();
  path();
  ctx.strokeStyle = 'rgba(10,14,26,0.72)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // neck hole: back of the collar + shadowed neck
  ellipse(ctx, cx, 34, 66, 24);
  ctx.fillStyle = '#161b2b';
  ctx.fill();
  ellipse(ctx, cx, 30, 52, 26);
  ctx.fillStyle = linear(ctx, 0, 6, 0, 58, [[0, '#b27c6c'], [1, '#5e3a32']]);
  ctx.fill();
}

function collar(ctx: Ctx) {
  // front half of a ribbed crew-neck collar (drawn over the photo neck)
  const cx = 80;
  ctx.beginPath();
  ctx.moveTo(cx - 70, 8);
  ctx.bezierCurveTo(cx - 60, 50, cx + 60, 50, cx + 70, 8);
  ctx.lineTo(cx + 78, 20);
  ctx.bezierCurveTo(cx + 66, 66, cx - 66, 66, cx - 78, 20);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 8, 0, 60, [[0, '#39455f'], [1, '#1f2638']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,10,18,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.4;
  for (let i = -12; i <= 12; i++) {
    const t = (i + 12) / 24;
    const x0 = cx - 70 + t * 140;
    const y0 = 8 + Math.sin(t * Math.PI) * 32;
    const x1 = cx - 78 + t * 156;
    const y1 = 20 + Math.sin(t * Math.PI) * 38;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,210,240,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 72, 12);
  ctx.bezierCurveTo(cx - 60, 52, cx + 60, 52, cx + 72, 12);
  ctx.stroke();
}

/** Arm rig: the texture pivots at the shoulder (px, py); the hand sits `out` units
 * outward and (handY - py) units down, so a fat arm bends around the belly. */
export const ARM = { w: 250, h: 340, px: 95, py: 66, handY: 276, out: 48 };

/** Smooth open path through points (Catmull-Rom → cubic Béziers). */
function spline(ctx: Ctx, pts: [number, number][], move = true) {
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

/**
 * One continuous arm — T-shirt sleeve over a big deltoid, thick upper arm,
 * forearm and a meaty open hand — so nothing looks cut out and pasted on.
 * `side` 1 is the screen-right arm (outward = +x); -1 mirrors the geometry but
 * keeps the lighting in screen space (key light from the upper-left).
 * The sleeve's inner edge is feathered so it melts into the torso's shoulder.
 */
function armPaint(ctx: Ctx, side: 1 | -1, S: number) {
  const { w, h } = ARM;
  const px = side === 1 ? ARM.px : w - ARM.px;
  const X = (u: number) => px + side * u;
  const P = (pts: [number, number][]) => pts.map(([u, y]) => [X(u), y] as [number, number]);
  const xa = Math.min(X(-80), X(104));
  const xb = Math.max(X(-80), X(104));
  const edgeSkin = 'rgba(96,50,40,0.5)';

  // ---- skin: upper arm → elbow → forearm → wrist (outer / inner contours)
  const outer = P([[60, 120], [70, 160], [84, 200], [95, 232], [92, 256], [84, 270]]);
  const inner = P([[-50, 120], [-40, 160], [-18, 204], [0, 232], [8, 256], [14, 270]]);
  const skinPath = () => {
    ctx.beginPath();
    spline(ctx, outer);
    ctx.quadraticCurveTo(X(49), 280, inner[inner.length - 1][0], inner[inner.length - 1][1]);
    spline(ctx, [...inner].reverse(), false);
    ctx.closePath();
  };
  skinPath();
  ctx.fillStyle = linear(ctx, xa, 0, xb, 0, [[0, '#efc1ad'], [0.3, '#dfab97'], [0.62, SKIN], [0.86, '#ad7262'], [1, '#8d584a']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // rounded volume: soft highlight toward the light, shadow on the far side
  ctx.fillStyle = radial(ctx, X(side === 1 ? 14 : 58), 196, 70, [[0, 'rgba(255,228,212,0.30)'], [1, 'rgba(255,228,212,0)']]);
  ctx.fillRect(0, 100, w, 190);
  ctx.fillStyle = linear(ctx, 0, 140, 0, 276, [[0, 'rgba(70,32,24,0.10)'], [0.5, 'rgba(70,32,24,0)'], [1, 'rgba(70,32,24,0.12)']]);
  ctx.fillRect(0, 100, w, 190);
  // soft shadow the sleeve hem casts on the skin
  for (const [lw, a] of [[30, 0.1], [18, 0.12], [8, 0.14]] as const) {
    ctx.strokeStyle = `rgba(60,28,22,${a})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(X(-60), 166);
    ctx.quadraticCurveTo(X(10), 186, X(84), 156);
    ctx.stroke();
  }
  // elbow crease + forearm muscle line
  ctx.strokeStyle = 'rgba(120,64,50,0.22)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(22), 206);
  ctx.quadraticCurveTo(X(36), 212, X(52), 208);
  ctx.moveTo(X(70), 214);
  ctx.bezierCurveTo(X(64), 232, X(66), 248, X(72), 262);
  ctx.stroke();
  const r = rng(side === 1 ? 3 : 4);
  ctx.strokeStyle = 'rgba(90,55,40,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const u = 6 + r() * 80;
    const y = 196 + r() * 66;
    ctx.beginPath();
    ctx.moveTo(X(u), y);
    ctx.lineTo(X(u + 2), y + 5);
    ctx.stroke();
  }
  ctx.restore();
  skinPath();
  ctx.strokeStyle = edgeSkin;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // ---- big open hand, palm to the camera, thumb on the outer side
  const hx = X(49);
  const hy = 284;
  const fingers: [number, number, number][] = [
    [-26, -0.17, 40],
    [-9, -0.05, 46],
    [9, 0.05, 45],
    [26, 0.17, 38],
  ];
  for (const [fx, a, len] of fingers) {
    ctx.save();
    ctx.translate(hx + side * fx, hy + 14);
    ctx.rotate(side * a);
    roundRect(ctx, -8.5, 0, 17, len, 8.5);
    ctx.fillStyle = linear(ctx, -8, 0, 8, 0, [[0, '#ebbba9'], [1, '#b67967']]);
    ctx.fill();
    ctx.strokeStyle = edgeSkin;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(100,50,40,0.3)';
    ctx.beginPath();
    ctx.moveTo(-5, len * 0.45);
    ctx.lineTo(5, len * 0.45);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(hx + side * 38, hy - 8);
  ctx.rotate(-0.78 * side);
  roundRect(ctx, -9.5, 0, 19, 40, 9.5);
  ctx.fillStyle = linear(ctx, -9, 0, 9, 0, [[0, '#e2af9d'], [1, '#ae7261']]);
  ctx.fill();
  ctx.strokeStyle = edgeSkin;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, hx - 38, hy - 36, 76, 64, 26);
  ctx.fillStyle = radial(ctx, hx - 10, hy - 14, 54, [[0, '#f2c5b3'], [0.6, '#d69e8b'], [1, '#ae705e']]);
  ctx.fill();
  ctx.strokeStyle = edgeSkin;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,60,50,0.3)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hx - 24 * side, hy - 8);
  ctx.quadraticCurveTo(hx, hy + 2, hx + 23 * side, hy - 16);
  ctx.moveTo(hx - 21 * side, hy + 9);
  ctx.quadraticCurveTo(hx + 2 * side, hy + 12, hx + 23 * side, hy + 2);
  ctx.stroke();

  // ---- sleeve: a thick tube that grows out of the torso's own shoulder. Its top
  // end fades in from the joint, so there is no cap, disc or cut line at any arm
  // angle — the torso provides the shoulder, the sleeve just emerges from it.
  const cy = ARM.py;
  const { c: sc, ctx: sx } = canvas(w * S, h * S);
  sx.scale(S, S);
  const innerSide = P([[-54, 162], [-58, 122], [-57, 90], [-56, cy], [-50, cy - 30]]);
  const outerSide = P([[50, cy - 30], [56, cy], [60, 90], [68, 116], [75, 140], [78, 154]]);
  const sleevePath = (g: Ctx) => {
    g.beginPath();
    spline(g, innerSide);
    g.quadraticCurveTo(X(0), cy - 44, outerSide[0][0], outerSide[0][1]);
    spline(g, outerSide, false);
    g.quadraticCurveTo(X(12), 182, innerSide[0][0], innerSide[0][1]);
    g.closePath();
  };
  sleevePath(sx);
  // lit like the torso at rest: the screen-left arm catches the key light,
  // the screen-right one is in shade with a warm sunset rim
  sx.fillStyle = side === 1 ? '#2f3851' : '#36405b';
  sx.fill();
  sx.save();
  sx.clip();
  sx.fillStyle = linear(sx, xa, 0, xb, 0,
    side === 1
      ? [[0, 'rgba(205,216,244,0.07)'], [0.4, 'rgba(205,216,244,0.05)'], [0.8, 'rgba(8,12,26,0.18)'], [1, 'rgba(8,12,26,0.34)']]
      : [[0, 'rgba(8,12,26,0.32)'], [0.22, 'rgba(205,216,244,0.1)'], [0.55, 'rgba(205,216,244,0.06)'], [1, 'rgba(8,12,26,0.12)']],
  );
  sx.fillRect(0, 0, w, 200);
  if (side === 1) {
    sx.fillStyle = linear(sx, X(50), 0, X(80), 0, [[0, 'rgba(255,160,90,0)'], [1, 'rgba(255,170,100,0.22)']]);
    sx.fillRect(0, 0, w, 200);
  }
  sx.fillStyle = linear(sx, 0, 104, 0, 182, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(6,9,20,0.22)']]);
  sx.fillRect(0, 0, w, 200);
  // soft pull wrinkles toward the armpit and the knit
  sx.strokeStyle = 'rgba(6,10,22,0.12)';
  sx.lineWidth = 4;
  sx.lineCap = 'round';
  sx.beginPath();
  sx.moveTo(X(-52), 118);
  sx.quadraticCurveTo(X(-32), 128, X(-8), 130);
  sx.moveTo(X(-48), 138);
  sx.quadraticCurveTo(X(-30), 146, X(-6), 148);
  sx.stroke();
  const k = rng(side === 1 ? 41 : 42);
  for (let i = 0; i < 520; i++) {
    sx.fillStyle = k() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    sx.fillRect(X(-80 + k() * 170), k() * 190, 1.6, 1.6);
  }
  // hem: a turned-up band with a soft highlight
  sx.strokeStyle = 'rgba(6,10,22,0.3)';
  sx.lineWidth = 7;
  sx.beginPath();
  sx.moveTo(X(-58), 150);
  sx.quadraticCurveTo(X(12), 170, X(84), 140);
  sx.stroke();
  sx.strokeStyle = 'rgba(190,204,238,0.16)';
  sx.lineWidth = 2.4;
  sx.beginPath();
  sx.moveTo(X(-56), 144);
  sx.quadraticCurveTo(X(12), 163, X(83), 134);
  sx.stroke();
  sx.restore();
  // outline the tube's sides and hem (silhouettes); the top end has none
  sx.beginPath();
  spline(sx, outerSide);
  sx.quadraticCurveTo(X(12), 182, innerSide[0][0], innerSide[0][1]);
  spline(sx, innerSide, false);
  sx.strokeStyle = 'rgba(10,14,28,0.45)';
  sx.lineWidth = 1.6;
  sx.lineJoin = 'round';
  sx.stroke();
  // fade the whole top end in from the joint
  sx.save();
  sx.globalCompositeOperation = 'destination-in';
  sx.fillStyle = linear(sx, 0, cy - 14, 0, cy + 30, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,1)']]);
  sx.fillRect(0, 0, w, h);
  sx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sc, 0, 0);
  ctx.restore();
}

// ------------------------------------------------------------------ colleagues
const CREW = [
  { hair: '#3b2416', shirt: '#2f8f5b', style: 0 },
  { hair: '#e0b25a', shirt: '#e0662b', style: 1 },
  { hair: '#1c1c22', shirt: '#6c4bc2', style: 2 },
  { hair: '#b5501f', shirt: '#7b8794', style: 3 },
  { hair: '#8a8a8a', shirt: '#c43b5b', style: 0 },
  { hair: '#4d3020', shirt: '#2f6fb3', style: 2 },
];
export const CREW_COUNT = CREW.length;

function npcBack(ctx: Ctx, i: number) {
  const c = CREW[i];
  // torso
  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.bezierCurveTo(30, 220, 50, 180, 110, 172);
  ctx.bezierCurveTo(170, 180, 190, 220, 180, 300);
  ctx.closePath();
  fillOutlined(ctx, linear(ctx, 0, 170, 0, 300, [[0, c.shirt], [1, '#1a1a22']]), 5);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(106, 190, 8, 110);
  // neck
  roundRect(ctx, 92, 128, 36, 54, 14);
  fillOutlined(ctx, '#c98f7f', 4);
  // ears
  ellipse(ctx, 58, 96, 9, 15);
  fillOutlined(ctx, '#d6a293', 4);
  ellipse(ctx, 162, 96, 9, 15);
  fillOutlined(ctx, '#d6a293', 4);
  // head back with hair
  ellipse(ctx, 110, 84, 52, 58);
  fillOutlined(ctx, '#d6a293', 5);
  ctx.save();
  ellipse(ctx, 110, 84, 52, 58);
  ctx.clip();
  ctx.fillStyle = c.hair;
  if (c.style === 3) {
    ellipse(ctx, 110, 60, 60, 54);
    ctx.fill();
  } else {
    ctx.fillRect(40, 20, 140, c.style === 2 ? 110 : 96);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ellipse(ctx, 90, 50, 22, 12, -0.4);
  ctx.fill();
  ctx.restore();
  if (c.style === 1) {
    circle(ctx, 110, 30, 20);
    fillOutlined(ctx, c.hair, 4);
  }
  if (c.style === 2) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.arc(80 + k * 12, 60 + (k % 2) * 10, 8, 0, Math.PI);
      ctx.stroke();
    }
  }
}

function npcArm(ctx: Ctx, i: number) {
  const c = CREW[i];
  // raised arm, pivot at bottom (shoulder), pointing up
  roundRect(ctx, 22, 70, 44, 110, 20);
  fillOutlined(ctx, c.shirt, 5);
  roundRect(ctx, 28, 24, 32, 70, 14);
  fillOutlined(ctx, '#d6a293', 4.5);
  circle(ctx, 44, 24, 20);
  fillOutlined(ctx, '#d6a293', 4.5);
}

function peek(ctx: Ctx, i: number) {
  const c = CREW[i % CREW.length];
  // head peeking over the fence, looking at Sergii
  ellipse(ctx, 40, 44, 26, 28);
  fillOutlined(ctx, '#d6a293', 4);
  ctx.save();
  ellipse(ctx, 40, 44, 26, 28);
  ctx.clip();
  ctx.fillStyle = c.hair;
  ctx.fillRect(0, 0, 80, 30);
  ctx.restore();
  const dir = i % 2 === 0 ? 1 : -1;
  for (const ex of [30, 50]) {
    ellipse(ctx, ex, 46, 6, 7.5);
    fillOutlined(ctx, '#fff', 2.5);
    circle(ctx, ex + dir * 2.5, 47, 3);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(34, 60);
  ctx.quadraticCurveTo(40, 64 + (i % 3) * 2, 46, 60);
  ctx.stroke();
  // hands on the fence
  circle(ctx, 14, 74, 9);
  fillOutlined(ctx, '#d6a293', 3.5);
  circle(ctx, 66, 74, 9);
  fillOutlined(ctx, '#d6a293', 3.5);
}

// ------------------------------------------------------------------ background crowd
function crowdGroup(ctx: Ctx, seed: number, n: number, w: number, h: number, spread: number) {
  const r = rng(seed);
  const shirts = ['#5a3a4a', '#3e4f6a', '#4f5e3a', '#6a4a30', '#5a2f35', '#3d5a58', '#56465e'];
  const hairs = ['#1c1410', '#3a2618', '#6a4a2a', '#2a2a2e', '#8a6a40'];
  const people: [number, number, number, number, number][] = [];
  for (let i = 0; i < n; i++) people.push([30 + ((i + r() * 0.8) / n) * (w - 60), 70 + r() * spread, 38 + r() * 10, r(), i]);
  people.sort((a, b) => a[1] - b[1]);
  for (const [x, y, hr, v, i] of people) {
    const shirt = shirts[(i + seed) % shirts.length];
    const skin = v > 0.5 ? '#7a5446' : '#6a4638';
    const hair = hairs[Math.floor(r() * hairs.length)];
    // body
    ctx.beginPath();
    ctx.moveTo(x - hr * 1.9, h);
    ctx.bezierCurveTo(x - hr * 2, y + hr * 1.6, x - hr * 1.2, y + hr * 1.1, x, y + hr * 1.05);
    ctx.bezierCurveTo(x + hr * 1.2, y + hr * 1.1, x + hr * 2, y + hr * 1.6, x + hr * 1.9, h);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, y, 0, h, [[0, shirt], [1, '#1a1216']]);
    ctx.fill();
    // raised arm with a tomato / phone
    if (v > 0.55) {
      const side = v > 0.78 ? 1 : -1;
      ctx.strokeStyle = shirt;
      ctx.lineWidth = hr * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + side * hr * 1.2, y + hr * 1.5);
      ctx.quadraticCurveTo(x + side * hr * 1.9, y + hr * 0.2, x + side * hr * 1.6, y - hr * 0.9);
      ctx.stroke();
      circle(ctx, x + side * hr * 1.6, y - hr * 1.0, hr * 0.3);
      ctx.fillStyle = skin;
      ctx.fill();
      if (v > 0.7) {
        roundRect(ctx, x + side * hr * 1.6 - 11, y - hr * 1.2 - 26, 22, 36, 4);
        ctx.fillStyle = '#10141c';
        ctx.fill();
        roundRect(ctx, x + side * hr * 1.6 - 8, y - hr * 1.2 - 23, 16, 30, 3);
        ctx.fillStyle = 'rgba(190,225,255,0.9)';
        ctx.fill();
      } else {
        circle(ctx, x + side * hr * 1.6, y - hr * 1.45, hr * 0.42);
        ctx.fillStyle = '#d8331f';
        ctx.fill();
        ctx.fillStyle = '#3f9e46';
        ctx.fillRect(x + side * hr * 1.6 - 4, y - hr * 1.9, 8, 6);
      }
    }
    // head + hair
    circle(ctx, x, y, hr);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.save();
    circle(ctx, x, y, hr);
    ctx.clip();
    ctx.fillStyle = hair;
    ellipse(ctx, x, y - hr * 0.55, hr * 1.1, hr * 0.7);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    circle(ctx, x - hr * 0.5, y + hr * 0.3, hr);
    ctx.fill();
    ctx.restore();
    // simple eyes looking at Sergii
    const look = x < w / 2 ? 1 : -1;
    for (const ex of [-0.33, 0.33]) {
      ellipse(ctx, x + ex * hr, y + hr * 0.08, hr * 0.14, hr * 0.17);
      ctx.fillStyle = '#f2ede4';
      ctx.fill();
      circle(ctx, x + ex * hr + look * hr * 0.05, y + hr * 0.1, hr * 0.08);
      ctx.fillStyle = '#16100e';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,170,100,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, hr - 1.5, -1.2, 0.9);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(40,20,30,0.25)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function sign(ctx: Ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, 8, 12, 300, 112, 6);
  ctx.fill();
  ctx.beginPath();
  const r = rng(31);
  ctx.moveTo(4, 6);
  for (let x = 4; x <= 300; x += 12) ctx.lineTo(x, 4 + r() * 5);
  for (let y = 4; y <= 116; y += 12) ctx.lineTo(300 + r() * 4, y);
  for (let x = 300; x >= 4; x -= 12) ctx.lineTo(x, 114 + r() * 5);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 0, 0, 120, [[0, '#d9b387'], [1, '#bf915f']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,55,25,0.25)';
  ctx.lineWidth = 1.5;
  for (let y = 16; y < 110; y += 9) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(296, y + 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(245,240,225,0.8)';
  for (const [x, y, a] of [
    [20, 10, -0.6],
    [284, 12, 0.6],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillRect(-18, -7, 36, 14);
    ctx.restore();
  }
  ctx.restore();
}

function icon(ctx: Ctx, kind: 'gear' | 'trophy' | 'help' | 'back' | 'crown') {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'gear') {
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(50, 50);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      roundRect(ctx, -8, -40, 16, 20, 4);
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 50, 50, 28);
    ctx.fill();
    circle(ctx, 50, 50, 12);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (kind === 'trophy') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(26, 14);
    ctx.lineTo(74, 14);
    ctx.bezierCurveTo(74, 50, 64, 62, 50, 64);
    ctx.bezierCurveTo(36, 62, 26, 50, 26, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(24, 30, 12, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(76, 30, 12, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.fillRect(44, 62, 12, 16);
    roundRect(ctx, 30, 76, 40, 12, 4);
    ctx.fill();
  } else if (kind === 'help') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    circle(ctx, 50, 50, 40);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(50, 38, 13, Math.PI * 1.05, Math.PI * 2.35);
    ctx.lineTo(50, 60);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    circle(ctx, 50, 74, 5.5);
    ctx.fill();
  } else if (kind === 'back') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(78, 50);
    ctx.lineTo(24, 50);
    ctx.moveTo(46, 26);
    ctx.lineTo(22, 50);
    ctx.lineTo(46, 74);
    ctx.stroke();
  } else if (kind === 'crown') {
    ctx.beginPath();
    ctx.moveTo(8, 78);
    ctx.lineTo(8, 30);
    ctx.lineTo(30, 52);
    ctx.lineTo(50, 14);
    ctx.lineTo(70, 52);
    ctx.lineTo(92, 30);
    ctx.lineTo(92, 78);
    ctx.closePath();
    fillOutlined(ctx, linear(ctx, 0, 14, 0, 80, [[0, '#fff3a0'], [0.5, '#ffc93c'], [1, '#c98a00']]), 5, '#3a2600');
    for (const [x, y, c] of [
      [50, 60, '#e8323c'],
      [26, 66, '#2f7fe0'],
      [74, 66, '#2fbf6b'],
    ] as const) {
      circle(ctx, x, y, 6);
      fillOutlined(ctx, c, 2.5, '#3a2600');
    }
    for (const [x, y] of [
      [8, 30],
      [50, 14],
      [92, 30],
    ]) {
      circle(ctx, x, y, 6);
      fillOutlined(ctx, '#fff3a0', 3, '#3a2600');
    }
  }
}

// ------------------------------------------------------------------ public
export function buildTextures(scene: Phaser.Scene) {
  const S = L.TS;
  for (const k of Object.keys(ITEM_PAINTERS) as ItemKind[]) {
    add(scene, 'it_' + k, 100, 100, ITEM_PX / 100, ITEM_PAINTERS[k]);
  }
  let seed = 21;
  for (const k of Object.keys(SPLATS) as SplatKind[]) {
    for (let v = 0; v < 2; v++) add(scene, `sp_${k}_${v}`, 100, 100, 2.56, (ctx) => paintSplat(ctx, SPLATS[k], seed++ * 7 + v * 131));
  }
  particles(scene);
  ui(scene, S);
  add(scene, 'body', BODY.w, BODY.h + 10, S, body);
  add(scene, 'collar', 160, 70, S, collar);
  add(scene, 'arm-r', ARM.w, ARM.h, S, (ctx) => armPaint(ctx, 1, S));
  add(scene, 'arm-l', ARM.w, ARM.h, S, (ctx) => armPaint(ctx, -1, S));
  for (let i = 0; i < CREW.length; i++) {
    add(scene, 'npc' + i, 220, 300, S * 0.8, (ctx) => npcBack(ctx, i));
    add(scene, 'npcarm' + i, 88, 180, S * 0.8, (ctx) => npcArm(ctx, i));
    add(scene, 'peek' + i, 80, 86, S * 0.6, (ctx) => peek(ctx, i));
  }
  add(scene, 'crowd_a', 460, 330, S * 0.55, (ctx) => crowdGroup(ctx, 5, 5, 460, 330, 80));
  add(scene, 'crowd_b', 460, 330, S * 0.55, (ctx) => crowdGroup(ctx, 9, 5, 460, 330, 80));
  add(scene, 'crowd_c', 900, 300, S * 0.5, (ctx) => crowdGroup(ctx, 13, 11, 900, 300, 50));
  add(scene, 'sign', 310, 124, S, sign);
  for (const k of ['gear', 'trophy', 'help', 'back', 'crown'] as const) add(scene, 'ic_' + k, 100, 100, S, (ctx) => icon(ctx, k));
}

/** Round-select thumbnails cut from the real photo (rounded, with per-round mood overlays). */
export function buildThumbs(scene: Phaser.Scene) {
  const face = (k: string) => scene.textures.get(scene.textures.exists(k) ? k : 'sergii-head').getSourceImage() as HTMLImageElement;
  const S = L.TS;
  const make = (key: string, mood: number) => {
    // calm → smug → plain → angry: the real photo expressions, never sunglasses
    const src = face(mood <= 1 ? 'sergii-head-happy' : mood >= 4 ? 'sergii-head-angry' : 'sergii-head');
    if (scene.textures.exists(key)) return;
    const w = 150;
    const h = 130;
    const { c, ctx } = canvas(w * S, h * S);
    ctx.scale(S, S);
    roundRect(ctx, 0, 0, w, h, 18);
    ctx.clip();
    // face crop: from the forehead to the chin
    const sx = 30;
    const sy = 150;
    const sw = 480;
    const sh = 480 * (h / w);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    if (mood >= 5) {
      ctx.fillStyle = 'rgba(255,40,30,0.35)';
      ctx.fillRect(0, 0, w, h);
    }
    if (mood >= 3 && mood !== 6) {
      ctx.save();
      ctx.translate(96, 64);
      ctx.scale(0.42, 0.42);
      paintSplat(ctx, SPLATS.red, 77 + mood);
      ctx.restore();
    }
    if (mood === 6) {
      ctx.save();
      ctx.translate(40, -30);
      ctx.scale(0.7, 0.7);
      icon(ctx, 'crown');
      ctx.restore();
    }
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(0.35, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    scene.textures.addCanvas(key, c);
  };
  for (let i = 1; i <= 5; i++) make('thumb' + i, i);
  make('thumb6', 6);
}
