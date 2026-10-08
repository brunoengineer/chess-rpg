import { isCleared, unlocksOf, ARENA_UNLOCK } from '../game/campaign';
import { leadershipCost, MAX_LEADERSHIP, type BattleResult } from '../game/economy';
import { createBattle } from '../game/engine';
import { PIECES } from '../game/pieces';
import type { PieceType, Placement, StageDef } from '../game/types';
import { addCount } from './save';
import { useStore } from './store';

const st = () => useStore.getState();

function spend(price: number): boolean {
  if (st().save.coins < price) {
    st().toast('Not enough coins', '🪙');
    return false;
  }
  return true;
}

export function buyPiece(type: PieceType, merc: boolean) {
  const def = PIECES[type];
  const price = merc ? def.mercPrice : def.price;
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    addCount(merc ? s.mercs : s.army, type, 1);
  });
  return true;
}

export function buyLeadership() {
  const { leadership } = st().save;
  if (leadership >= MAX_LEADERSHIP) return false;
  const price = leadershipCost(leadership);
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    s.leadership += 1;
  });
  return true;
}

export function startBattle(stage: StageDef, placements: Placement[]) {
  st().update((s) => {
    for (const p of placements) addCount(p.temp ? s.mercs : s.army, p.type, -1);
    s.formations[stage.id] = placements;
    s.active = { stage, battle: createBattle(stage, placements), loot: 0, captures: 0 };
    s.stats.battles++;
  });
  st().setView({ name: 'battle' });
}

/** Applies a finished battle to the save. Returns pieces newly unlocked in the shop. */
export function finishBattle(stage: StageDef, result: BattleResult, captures: number): { unlocked: PieceType[]; arenaUnlocked: boolean } {
  const before = st().save.stages;
  const firstClear = result.win && !isCleared(before, stage.id);
  st().update((s) => {
    s.coins += result.total;
    s.stats.coinsEarned += result.total;
    s.stats.captures += captures;
    if (result.win) s.stats.wins++;
    else s.stats.losses++;
    if (result.win && stage.isBoss) s.stats.bossesSlain++;
    // Owned pieces always come home, even if captured. Mercenaries leave.
    for (const u of [...result.survivors, ...result.lost]) if (!u.temp) addCount(s.army, u.type, 1);
    if (stage.isArena) {
      if (result.win) {
        s.arena.best = Math.max(s.arena.best, s.arena.level);
        s.arena.level++;
      }
    } else if (result.win) {
      const prev = s.stages[stage.id] ?? { stars: 0, clears: 0 };
      s.stages[stage.id] = { stars: Math.max(prev.stars, result.stars), clears: prev.clears + 1 };
    }
    s.active = null;
  });
  return {
    unlocked: firstClear ? unlocksOf(stage.id) : [],
    arenaUnlocked: firstClear && stage.id === ARENA_UNLOCK,
  };
}

