import './style.css';
import '@fontsource/unbounded/cyrillic-900.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-800.css';
import Phaser from 'phaser';
import { L, computeLayout } from './core/layout';
import { installAudioUnlock } from './core/audio';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { RoundsScene } from './scenes/RoundsScene';
import { EndlessScene } from './scenes/EndlessScene';

function setLoader(pct: number, hint?: string) {
  const bar = document.getElementById('loader-bar');
  if (bar) bar.style.width = `${pct}%`;
  if (hint) {
    const h = document.getElementById('loader-hint');
    if (h) h.textContent = hint;
  }
}

function blockBrowserGestures() {
  const prevent = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', prevent, { passive: false } as AddEventListenerOptions);
  document.addEventListener('gesturechange', prevent, { passive: false } as AddEventListenerOptions);
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);
  document.addEventListener(
    'touchmove',
    (e) => {
      if ((e as TouchEvent).touches.length > 1 || e.target instanceof HTMLCanvasElement || e.target === document.body) e.preventDefault();
    },
    { passive: false },
  );
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

async function loadFonts() {
  const fonts = (document as any).fonts as FontFaceSet | undefined;
  if (!fonts) return;
  const sample = 'СЕРГІЙ проти всіх ЇїЄєҐґ 0123 AZ';
  const jobs = [
    fonts.load(`900 48px Unbounded`, sample),
    fonts.load(`700 24px Rubik`, sample),
    fonts.load(`800 24px Rubik`, sample),
  ];
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 3500))]);
}

async function boot() {
  setLoader(12, 'Завантажуємо терпіння…');
  blockBrowserGestures();
  installAudioUnlock();
  await loadFonts();
  setLoader(35, 'Будимо Сергія…');
  computeLayout();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: L.physW,
    height: L.physH,
    backgroundColor: '#1a1020',
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / L.dpr },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    audio: { noAudio: true },
    input: { activePointers: 3, touch: { capture: true } },
    banner: false,
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, MenuScene, RoundsScene, EndlessScene, GameScene, HudScene],
  });
  (window as any).__game = game;

  let pending = 0;
  const onResize = () => {
    clearTimeout(pending);
    pending = window.setTimeout(() => {
      const prev = { w: L.physW, h: L.physH, st: L.safeTop, sb: L.safeBottom };
      computeLayout();
      if (prev.w === L.physW && prev.h === L.physH && prev.st === L.safeTop && prev.sb === L.safeBottom) return;
      game.scale.resize(L.physW, L.physH);
      game.scale.setZoom(1 / L.dpr);
      game.events.emit('layout');
    }, 180);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
    if (document.readyState === 'complete') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
