export type ItemKind = 'tomato' | 'poop' | 'can' | 'egg' | 'slipper' | 'tp' | 'fish' | 'pie' | 'gold' | 'wrench' | 'fridge';

export type SplatKind = 'red' | 'brown' | 'yolk' | 'cream' | 'gold';

export interface ItemDef {
  kind: ItemKind;
  name: string;
  /** diameter in world units at Sergii's plane */
  size: number;
  /** flight speed multiplier (bigger = faster) */
  speed: number;
  /** patience damage in % */
  damage: number;
  points: number;
  splat?: SplatKind;
  /** item bounces off instead of splatting */
  bounce: boolean;
  /** seconds the splat stays on Sergii before fading */
  linger: number;
  spin: number;
  tint: number[];
  bonus?: boolean;
}

export const ITEMS: Record<ItemKind, ItemDef> = {
  tomato: { kind: 'tomato', name: 'Помідор', size: 50, speed: 1.12, damage: 3.4, points: 100, splat: 'red', bounce: false, linger: 1.5, spin: 5, tint: [0xe8291c, 0xff5a3c, 0xb3130c, 0xffd23f] },
  poop: { kind: 'poop', name: 'Какашка', size: 56, speed: 0.84, damage: 4.2, points: 220, splat: 'brown', bounce: false, linger: 3.0, spin: 3.5, tint: [0x6b4220, 0x8a5a2b, 0x4a2c12] },
  can: { kind: 'can', name: 'Банка', size: 56, speed: 1.28, damage: 5.6, points: 160, bounce: true, linger: 0, spin: 9, tint: [0xdfe6ee, 0x4f9bff, 0xffffff] },
  egg: { kind: 'egg', name: 'Яйце', size: 44, speed: 1.1, damage: 3.2, points: 150, splat: 'yolk', bounce: false, linger: 2.0, spin: 6, tint: [0xffc31f, 0xfffbe8, 0xffe38a], bonus: true },
  slipper: { kind: 'slipper', name: 'Тапок', size: 64, speed: 1.05, damage: 5.2, points: 200, bounce: true, linger: 0, spin: 11, tint: [0xc0392b, 0x7a4b3a, 0xffffff], bonus: true },
  tp: { kind: 'tp', name: 'Туалетний папір', size: 54, speed: 0.95, damage: 3.6, points: 180, bounce: true, linger: 2.2, spin: 7, tint: [0xffffff, 0xf2f2ea], bonus: true },
  fish: { kind: 'fish', name: 'Тараня', size: 68, speed: 1.0, damage: 5.0, points: 240, bounce: true, linger: 0, spin: 8, tint: [0xc98b3c, 0xffe0a0, 0x8a5a22], bonus: true },
  pie: { kind: 'pie', name: 'Торт', size: 64, speed: 0.9, damage: 6.4, points: 260, splat: 'cream', bounce: false, linger: 2.6, spin: 2.5, tint: [0xfffaf0, 0xffe7c2, 0xe0a458, 0xd91e36], bonus: true },
  gold: { kind: 'gold', name: 'Золота какашка', size: 60, speed: 0.9, damage: 11, points: 2200, splat: 'gold', bounce: false, linger: 2.4, spin: 4, tint: [0xffd23f, 0xfff3a0, 0xffffff, 0xc98a00], bonus: true },
  // only Sergii throws these
  wrench: { kind: 'wrench', name: 'Ключ', size: 70, speed: 1.2, damage: 5, points: 0, bounce: true, linger: 0, spin: 14, tint: [0xc9d1da, 0xffffff] },
  fridge: { kind: 'fridge', name: 'Холодильник', size: 150, speed: 0.8, damage: 10, points: 0, bounce: true, linger: 0, spin: 3, tint: [0xffffff, 0xdfe6ee] },
};

export const BONUS_KINDS: ItemKind[] = ['egg', 'slipper', 'tp', 'fish', 'pie'];

/** Things Sergii throws back. */
export type ThrowBackKind = 'can' | 'tomato' | 'slipper' | 'tp';

export interface RoundDef {
  id: number;
  title: string;
  intro: string;
  endTitle: string;
  endLine: string;
  moveSpeed: number;
  moveRange: number;
  pause: [number, number];
  dodge: number;
  catchChance: number;
  attackEvery: [number, number];
  telegraph: number;
  flight: number;
  combo: number;
  items: Partial<Record<ItemKind, number>>;
  bonus: number;
  gold: number;
  crowd: boolean;
  crowdEvery: [number, number];
  events: boolean;
  rageAt: number;
  dmgMul: number;
  back: Partial<Record<ThrowBackKind, number>>;
}

export const ROUNDS: RoundDef[] = [
  {
    id: 1,
    title: 'ЩЕ ТЕРПЛЯТЬ',
    intro: 'Сергій поки нічого не підозрює.',
    endTitle: 'ПЕРШИЙ НЕРВ — ВСЕ',
    endLine: 'Сергій ще терпить. Але вже не дуже.',
    moveSpeed: 22,
    moveRange: 34,
    pause: [1.8, 3.2],
    dodge: 0.04,
    catchChance: 0,
    attackEvery: [10, 13],
    telegraph: 1.7,
    flight: 0.95,
    combo: 1,
    items: { tomato: 86, can: 14 },
    bonus: 0,
    gold: 0,
    crowd: false,
    crowdEvery: [99, 99],
    events: false,
    rageAt: 0,
    dmgMul: 0.6,
    back: { tomato: 1 },
  },
  {
    id: 2,
    title: 'СЕРГІЙ ЩОСЬ ПІДОЗРЮЄ',
    intro: 'Відкрито: какашки. Сергій почав рухатися.',
    endTitle: 'СЕРГІЙ ВСЕ ЗРОЗУМІВ',
    endLine: 'Пішов по валер’янку. Скоро повернеться.',
    moveSpeed: 65,
    moveRange: 95,
    pause: [1.3, 2.6],
    dodge: 0.12,
    catchChance: 0,
    attackEvery: [8, 11],
    telegraph: 1.55,
    flight: 0.9,
    combo: 1,
    items: { tomato: 50, poop: 32, can: 18 },
    bonus: 0,
    gold: 0,
    crowd: false,
    crowdEvery: [99, 99],
    events: true,
    rageAt: 0,
    dmgMul: 0.58,
    back: { tomato: 2, can: 1 },
  },
  {
    id: 3,
    title: 'ОСТАННІЙ НЕРВ',
    intro: 'Обережно з банками. Сергій ловить.',
    endTitle: 'ОСТАННІЙ НЕРВ ЛУСНУВ',
    endLine: 'Хтось, принесіть йому ще одну банку.',
    moveSpeed: 100,
    moveRange: 110,
    pause: [1.0, 2.2],
    dodge: 0.2,
    catchChance: 0.45,
    attackEvery: [7.5, 10],
    telegraph: 1.4,
    flight: 0.85,
    combo: 1,
    items: { tomato: 38, poop: 26, can: 24 },
    bonus: 0.14,
    gold: 0.012,
    crowd: false,
    crowdEvery: [99, 99],
    events: true,
    rageAt: 0,
    dmgMul: 0.6,
    back: { tomato: 2, can: 2, slipper: 1, tp: 1 },
  },
  {
    id: 4,
    title: 'ВСІ ВЖЕ ТУТ',
    intro: 'До гри приєднується колектив.',
    endTitle: 'ЧЕРГА ЗАДОВОЛЕНА',
    endLine: 'Колектив задоволений. Сергій — ні.',
    moveSpeed: 115,
    moveRange: 115,
    pause: [0.9, 2.0],
    dodge: 0.24,
    catchChance: 0.45,
    attackEvery: [7, 9.5],
    telegraph: 1.3,
    flight: 0.82,
    combo: 2,
    items: { tomato: 36, poop: 26, can: 24 },
    bonus: 0.18,
    gold: 0.015,
    crowd: true,
    crowdEvery: [4.5, 7.5],
    events: true,
    rageAt: 0,
    dmgMul: 0.52,
    back: { tomato: 2, can: 2, slipper: 1, tp: 1 },
  },
  {
    id: 5,
    title: 'СЕРГІЙ ПРОТИ ВСІХ',
    intro: 'Фінал. Сергій готовий. Ти — ні.',
    endTitle: 'СЕРГІЙ ПРОГРАВ ВСІМ',
    endLine: 'Дивно. Хто б міг подумати.',
    moveSpeed: 140,
    moveRange: 120,
    pause: [0.7, 1.6],
    dodge: 0.3,
    catchChance: 0.55,
    attackEvery: [6.8, 9],
    telegraph: 1.2,
    flight: 0.78,
    combo: 2,
    items: { tomato: 34, poop: 26, can: 26 },
    bonus: 0.2,
    gold: 0.02,
    crowd: true,
    crowdEvery: [3.8, 6.5],
    events: true,
    rageAt: 20,
    dmgMul: 0.5,
    back: { tomato: 2, can: 3, slipper: 2, tp: 1 },
  },
];

export const ENDLESS: RoundDef = {
  ...ROUNDS[2],
  id: 6,
  title: 'СЕРГІЙ: НЕ ТРЕБА БУЛО',
  intro: 'Нескінченний режим. Швидкість росте.',
  endTitle: 'СЕРГІЙ ВИСТОЯВ',
  endLine: 'Він усе ще тут. І він усе пам’ятає.',
  crowd: true,
  crowdEvery: [4.5, 7.5],
  dmgMul: 0.65,
};

/** Hit captions for head shots (localized «HEADSHOT»). */
export const HEAD_CAPTIONS = ['ПРЯМО В СЕРГІЯ', 'ТОЧНО В ЦІЛЬ', 'ОКУЛЯРИ ВИЖИЛИ', 'ОЙ.', 'В ЛОБ!', 'ПРЯМО В ОКУЛЯРИ'];

export const COMBO_STEPS: { at: number; mult: number; caption: string }[] = [
  { at: 3, mult: 2, caption: 'Сергій нервує' },
  { at: 5, mult: 3, caption: 'Сергій щось підозрює' },
  { at: 10, mult: 5, caption: 'Сергій усе зрозумів' },
  { at: 20, mult: 10, caption: 'СЕРГІЙ, ТІКАЙ' },
  { at: 30, mult: 20, caption: 'ЦЕ ВЖЕ ОСОБИСТЕ' },
];

export function comboMult(combo: number) {
  let m = 1;
  for (const s of COMBO_STEPS) if (combo >= s.at) m = s.mult;
  return m;
}

/** Signature phrases (requested by the team). */
export const SIGNATURE = [
  'Іди на трасу.',
  'Зараз голову об холодильник кину.',
  'Вибий технічку, якщо хочеш жити.',
  'За розвозки вб’ю.',
  'Там ями, не поїду.',
];

const norm = (s: string) => s.toLowerCase().replace(/[.,!?…’'«»]/g, '').replace(/\s+/g, ' ').trim();
const SIGNATURE_NORM = SIGNATURE.map(norm);

/** True for the team's catchphrases (any case / punctuation). */
export function isSignature(text: string) {
  const t = norm(text);
  return SIGNATURE_NORM.some((s) => t.includes(s));
}

export const LINES = {
  hit: ['Та ну вас…', 'Хто кинув?!', 'Я все бачив.', 'Ще раз.', 'Серйозно?', 'Це вже особисте.', 'Ну все.', 'За розвозки вб’ю.', 'Іди на трасу.', 'Я запам’ятав.'],
  miss: ['Мимо.', 'Мимо.', 'Ха.', 'Іди на трасу.', 'Там ями, не поїду.'],
  miss3: 'Може легкий рівень увімкнеш?',
  miss3easy: 'Навіть на легкому?',
  miss5: 'Телефон протри.',
  caught: 'Дякую.',
  throw: ['Лови!', 'Вибий технічку, якщо хочеш жити.', 'Повертаю.', 'Іди на трасу.', 'Зараз голову об холодильник кину.', 'На!'],
  hitPlayer: ['Бачив?', 'Іди на трасу.', 'Ще хочеш?', 'Один-нуль.', 'За розвозки вб’ю.'],
  dodged: ['Спритний, ага.', 'Ну-ну.', 'Наступного разу.', 'Там ями, не поїду.'],
  rage: ['ЗАРАЗ ГОЛОВУ ОБ ХОЛОДИЛЬНИК КИНУ!', 'ЗА РОЗВОЗКИ ВБ’Ю!', 'ВИБИЙ ТЕХНІЧКУ, ЯКЩО ХОЧЕШ ЖИТИ!', 'НУ ВСЕ!'],
  start: ['Ну і що ви задумали?', 'Вибий технічку, якщо хочеш жити.', 'Я все бачу.', 'Іди на трасу.', 'Серйозно?', 'Там ями, не поїду.'],
  poke: ['Не чіпай.', 'Іди на трасу.', 'Зараз голову об холодильник кину.', 'Вибий технічку, якщо хочеш жити.', 'За розвозки вб’ю.', 'Там ями, не поїду.'],
  belly: 'СИЛА ПУПКА!',
  golden: 'Це… золото?',
  shield: 'Ага. Тепер спробуй.',
  back: 'Я на хвилинку.',
  shoe: 'Хто дав мені тапок? Дякую.',
  mood: ['Зараз голову об холодильник кину.', 'За розвозки вб’ю.'],
  van: 'За розвозки вб’ю.',
  phone: ['Алло?', 'Так… Ні… Іди на трасу.', 'Все, мені ніколи.'],
  tech: 'Вибий технічку, якщо хочеш жити.',
  fridge: 'Зараз голову об холодильник кину!',
  fridgeHit: 'Я ж попереджав.',
  fridgeDodge: 'Добре, що не в голову.',
  lostHeart2: 'Вибий технічку, якщо хочеш жити.',
};

export const EVENTS = {
  can: 'СЕРГІЙ ПІШОВ ЗА БАНКОЮ',
  shield: 'СЕРГІЙ ЗНАЙШОВ ЩИТ',
  rush: 'ПЕРЕРВА ЗАКІНЧИЛАСЯ',
  shoe: 'ХТО ДАВ ЙОМУ ТАПОК?',
  van: 'РОЗВОЗКА ПРИЇХАЛА',
  phone: 'СЕРГІЮ ДЗВОНЯТЬ',
  tech: 'ТЕХНІЧКА!',
  fridge: 'ХОЛОДИЛЬНИК!',
};

/** Fun title for the result screens, picked from the round stats. */
export function funTitle(s: { thrown: number; hits: number; heads: number; bestCombo: number; hitBy: number; dodges: number; catches: number }) {
  const acc = s.thrown ? s.hits / s.thrown : 0;
  if (s.thrown >= 5 && acc < 0.35) return 'Телефон протри';
  if (s.bestCombo >= 20) return 'Серійний метальник';
  if (s.hitBy === 0 && s.dodges >= 2) return 'Невловимий';
  if (acc >= 0.85 && s.thrown >= 10) return 'Снайпер відділу';
  if (s.catches >= 2) return 'Постачальник банок Сергію';
  if (s.heads >= 20) return 'Мисливець за головами';
  if (s.thrown >= 70) return 'Помідорна ферма';
  if (s.hitBy >= 3) return 'Мішень місяця';
  return 'Стажер колективу';
}
