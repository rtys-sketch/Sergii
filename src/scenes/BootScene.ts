import Phaser from 'phaser';
import { buildTextures, buildThumbs } from '../core/textures';
import { buildBackground } from '../core/background';

function setLoader(pct: number, hint?: string) {
  const bar = document.getElementById('loader-bar');
  if (bar) bar.style.width = `${Math.round(pct)}%`;
  if (hint) {
    const h = document.getElementById('loader-hint');
    if (h) h.textContent = hint;
  }
}

export function hideLoader() {
  const l = document.getElementById('loader');
  if (!l) return;
  l.classList.add('hide');
  setTimeout(() => l.remove(), 600);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    setLoader(45, 'Завантажуємо Сергія…');
    this.load.image('sergii-head', 'assets/sergii-head.webp');
    this.load.image('sergii-head-happy', 'assets/sergii-head-happy.webp');
    this.load.image('sergii-head-angry', 'assets/sergii-head-angry.webp');
    this.load.on('progress', (v: number) => setLoader(45 + v * 30));
  }

  create() {
    setLoader(80, 'Малюємо помідори…');
    // let the browser paint the loader before the heavy canvas work
    requestAnimationFrame(() =>
      setTimeout(() => {
        buildTextures(this);
        setLoader(92, 'Будуємо паркан…');
        buildBackground(this);
        buildThumbs(this);
        setLoader(100, 'Готово!');
        hideLoader();
        this.scene.start('Menu');
      }, 30),
    );
  }
}
