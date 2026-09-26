export type Difficulty = 'easy' | 'normal';

export interface SaveData {
  v: 1;
  played: boolean;
  tutorialDone: boolean;
  dodgeTutorialDone: boolean;
  unlockedRound: number;
  completed: boolean;
  secretUnlocked: boolean;
  highScore: number;
  endlessHigh: number;
  bestCombo: number;
  sound: boolean;
  music: boolean;
  difficulty: Difficulty;
  runs: number;
}

const KEY = 'sergii-proty-vsikh.v1';

const DEFAULTS: SaveData = {
  v: 1,
  played: false,
  tutorialDone: false,
  dodgeTutorialDone: false,
  unlockedRound: 1,
  completed: false,
  secretUnlocked: false,
  highScore: 0,
  endlessHigh: 0,
  bestCombo: 0,
  sound: true,
  music: true,
  difficulty: 'normal',
  runs: 0,
};

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, v: 1 };
  } catch {
    return { ...DEFAULTS };
  }
}

export const save: SaveData = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota — the game still works without persistence */
  }
}

export function resetProgress() {
  Object.assign(save, { ...DEFAULTS, sound: save.sound, music: save.music, difficulty: save.difficulty });
  persist();
}
