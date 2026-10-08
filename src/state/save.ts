import type { StageProgress } from '../game/campaign';
import type { Battle, PieceType, Placement, StageDef } from '../game/types';

export type Counts = Partial<Record<PieceType, number>>;

export interface Settings {
  showMoves: boolean;
  showEnemyMoves: boolean;
  sound: boolean;
  fastAnim: boolean;
}

export interface ActiveBattle {
  stage: StageDef;
  battle: Battle;
  loot: number;
  captures: number;
}

export interface SaveData {
  v: 1;
  coins: number;
  leadership: number;
  /** Permanent pieces in the barracks. */
  army: Counts;
  /** One-battle mercenaries. */
  mercs: Counts;
  /** Fallen permanent pieces that can be revived. */
  fallen: Counts;
  stages: StageProgress;
  arena: { level: number; best: number };
  /** Last formation per stage id. */
  formations: Record<string, Placement[]>;
  stats: { battles: number; wins: number; losses: number; captures: number; coinsEarned: number; bossesSlain: number };
  settings: Settings;
  active: ActiveBattle | null;
  updatedAt: number;
}

export function defaultSave(): SaveData {
  return {
    v: 1,
    coins: 20,
    leadership: 6,
    army: { pawn: 5 },
    mercs: {},
    fallen: {},
    stages: {},
    arena: { level: 1, best: 0 },
    formations: {},
    stats: { battles: 0, wins: 0, losses: 0, captures: 0, coinsEarned: 0, bossesSlain: 0 },
    settings: { showMoves: true, showEnemyMoves: true, sound: true, fastAnim: false },
    active: null,
    updatedAt: 0,
  };
}

/** Fills missing fields so older saves keep working as the game grows. */
export function normalizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<SaveData>;
  return {
    ...d,
    ...s,
    arena: { ...d.arena, ...s.arena },
    stats: { ...d.stats, ...s.stats },
    settings: { ...d.settings, ...s.settings },
    army: s.army ?? d.army,
    mercs: s.mercs ?? {},
    fallen: s.fallen ?? {},
    stages: s.stages ?? {},
    formations: s.formations ?? {},
    active: s.active ?? null,
    v: 1,
  };
}

export const count = (c: Counts, t: PieceType) => c[t] ?? 0;

export function addCount(c: Counts, t: PieceType, n: number) {
  const v = (c[t] ?? 0) + n;
  if (v > 0) c[t] = v;
  else delete c[t];
}

export function hasProgress(s: SaveData) {
  return s.stats.battles > 0 || s.updatedAt > 0;
}
