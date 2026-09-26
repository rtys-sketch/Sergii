import { fmt } from './util';

export function gameUrl() {
  return location.href.split('#')[0].split('?')[0];
}

export async function shareScore(score: number, endless = false): Promise<'shared' | 'copied' | 'cancel' | 'fail'> {
  const url = gameUrl();
  const text = endless
    ? `Я набрав ${fmt(score)} у режимі «Сергій: не треба було». А ти?`
    : `Я набрав ${fmt(score)} у “Сергій проти всіх”. А ти?`;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: 'Сергій проти всіх', text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancel';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = `${text} ${url}`;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? 'copied' : 'fail';
    } catch {
      return 'fail';
    }
  }
}
