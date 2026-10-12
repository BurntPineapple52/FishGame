// Persistent progress and settings in localStorage. Every access is guarded:
// private windows and blocked storage fall back to an in-memory copy.

const KEY = 'flop-save-v1';

export interface StageRecord {
  /** Best completion time in seconds. */
  bestTime?: number;
  /** Golden roe ever collected, by index. */
  roe: boolean[];
  completed: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  /** Screen shake strength, 0..1. */
  shake: number;
  /** Disables full-screen flashes and the low-health pulse. */
  reducedFlashes: boolean;
}

export interface SaveData {
  version: 1;
  /** Highest stage index the player may start from the level select. */
  unlocked: number;
  records: Record<string, StageRecord>;
  undeadUnlocked: boolean;
  undeadRecords: Record<string, StageRecord>;
  totalFlies: number;
  deaths: number;
  settings: Settings;
}

function fresh(): SaveData {
  return {
    version: 1,
    unlocked: 1,
    records: {},
    undeadUnlocked: false,
    undeadRecords: {},
    totalFlies: 0,
    deaths: 0,
    settings: { music: 0.7, sfx: 0.8, shake: 1, reducedFlashes: false },
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = fresh();
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } };
  } catch {
    return fresh();
  }
}

export const save = {
  data: load(),

  write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable; progress lives for this session only.
    }
  },

  record(stageId: string, undead: boolean): StageRecord {
    const table = undead ? this.data.undeadRecords : this.data.records;
    return (table[stageId] ??= { roe: [], completed: false });
  },

  /** Store a finished run. Returns which parts were new bests. */
  completeStage(
    stageId: string,
    index: number,
    time: number,
    roe: boolean[],
    undead: boolean,
  ): { newBest: boolean } {
    const rec = this.record(stageId, undead);
    const newBest = rec.bestTime === undefined || time < rec.bestTime;
    if (newBest) rec.bestTime = time;
    rec.roe = roe.map((r, i) => r || !!rec.roe[i]);
    rec.completed = true;
    this.data.unlocked = Math.max(this.data.unlocked, index + 1);
    this.write();
    return { newBest };
  },

  hasProgress(): boolean {
    return this.data.unlocked > 1;
  },

  reset(): void {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  },
};
