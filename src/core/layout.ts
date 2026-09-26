/**
 * Logical coordinate system: the game is authored for a fixed logical width of
 * 720 units; the logical height follows the real screen aspect (portrait-first).
 * The canvas is rendered at physical device pixels (devicePixelRatio aware) and
 * every camera is zoomed by L.Z so nothing is blurry on Retina screens.
 */
export const L = {
  W: 720,
  H: 1280,
  /** physical px per logical unit */
  Z: 1,
  dpr: 1,
  physW: 720,
  physH: 1280,
  cssW: 360,
  cssH: 640,
  safeTop: 0,
  safeBottom: 0,
  /** texture resolution multiplier for procedurally drawn art */
  TS: 2,
};

const MIN_H = 1180;
const MAX_H = 1600;
const MAX_PIXELS = 3_300_000;

function readSafeArea() {
  const el = document.getElementById('safe-probe');
  if (!el) return { top: 0, bottom: 0 };
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
  };
}

export function computeLayout() {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  let H = Math.min(MAX_H, Math.max(MIN_H, (L.W * vh) / vw));
  let cssW = vw;
  let cssH = (vw * H) / L.W;
  if (cssH > vh + 0.5) {
    cssH = vh;
    cssW = (vh * L.W) / H;
  }
  let dpr = Math.min(window.devicePixelRatio || 1, 3);
  while (cssW * dpr * cssH * dpr > MAX_PIXELS && dpr > 1) dpr -= 0.25;
  const physW = Math.round(cssW * dpr);
  const physH = Math.round(cssH * dpr);
  const Z = physW / L.W;
  H = physH / Z;
  const safe = readSafeArea();
  const toLogical = L.W / cssW;
  const padTop = (vh - cssH) / 2;
  L.H = H;
  L.Z = Z;
  L.dpr = dpr;
  L.physW = physW;
  L.physH = physH;
  L.cssW = cssW;
  L.cssH = cssH;
  L.safeTop = Math.max(0, safe.top - padTop) * toLogical;
  L.safeBottom = Math.max(0, safe.bottom - padTop) * toLogical;
  L.TS = Math.min(2.4, Math.max(1.5, Z));
  return L;
}

/** Scene-level layout helpers (logical units). */
/** Projection scale on Sergii's plane (bigger = closer camera, Sergii fills the frame). */
export const K = 1.45;

export function hudTop() {
  return L.safeTop + 12;
}
/** Centre of the inventory cards. */
export function trayY() {
  return L.H - Math.max(L.safeBottom, 12) - 96;
}
/** Horizon = Sergii's eye level. Keeps the head under the HUD and the table above the tray. */
export function horizonY() {
  const minHy = hudTop() + 196 + 180;
  const maxHy = trayY() - 75 - 440 * K + 60;
  const want = L.H * 0.38 - 50;
  return Math.round(Math.max(Math.min(want, maxHy), Math.min(minHy, maxHy)));
}
