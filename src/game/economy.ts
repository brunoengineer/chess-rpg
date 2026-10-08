import { PIECES } from './pieces';
import type { Battle, FxEvent, Outcome, PieceType, StageDef } from './types';

/** Coins earned for battle events caused by the player (captures, boss hits, promotions). */
export function lootFromFx(fx: FxEvent[], stage: StageDef): { coins: number; captures: number } {
  let coins = 0, captures = 0;
  for (const e of fx) {
    if (e.kind === 'capture' && e.side === 'E') {
      captures++;
      coins += e.unitType === 'boss' ? 0 : PIECES[e.unitType as PieceType].value * stage.lootMult;
    } else if (e.kind === 'hit' && e.side === 'E') {
      coins += 3 * (e.amount ?? 1) * stage.lootMult;
    } else if (e.kind === 'promote' && e.side === 'P') {
      coins += 5 * stage.lootMult;
    }
  }
  return { coins, captures };
}

export interface BattleResult {
  outcome: Outcome;
  win: boolean;
  stars: number;
  loot: number;
  reward: number;
  firstClearBonus: number;
  total: number;
  lost: { type: PieceType; temp: boolean }[];
  survivors: { type: PieceType; temp: boolean }[];
}

export function computeResult(b: Battle, outcome: Outcome, stage: StageDef, loot: number, alreadyCleared: boolean): BattleResult {
  const lost: BattleResult['lost'] = [];
  const survivors: BattleResult['survivors'] = [];
  for (const u of b.units) {
    if (u.side !== 'P' || u.type === 'boss') continue;
    const type = (u.promotedFrom ?? u.type) as PieceType;
    (u.alive ? survivors : lost).push({ type, temp: !!u.temp });
  }
  const win = outcome.winner === 'P';
  let stars = 0;
  if (win) stars = outcome.reason === 'points' || outcome.reason === 'time' || outcome.reason === 'deadlock' ? 1 : lost.length === 0 ? 3 : lost.length <= 1 ? 2 : 1;
  const reward = win ? stage.reward : 0;
  const firstClearBonus = win && !alreadyCleared && !stage.isArena ? stage.reward : 0;
  return { outcome, win, stars, loot, reward, firstClearBonus, total: loot + reward + firstClearBonus, lost, survivors };
}

/** Price to raise leadership from `level` to `level + 1`. */
export const leadershipCost = (level: number) => {
  const k = level - 6;
  return Math.round((15 + 8 * k + 0.4 * k * k) / 5) * 5;
};
export const MAX_LEADERSHIP = 40;
