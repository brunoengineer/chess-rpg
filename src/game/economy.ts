import { PIECES } from './pieces';
import type { Battle, FxEvent, Outcome, PieceType, StageDef } from './types';

/** Coins earned for battle events caused by the player (captures, boss hits, promotions). */
export function lootFromFx(fx: FxEvent[], stage: StageDef, mult = 1): { coins: number; captures: number } {
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
  return { coins: coins * mult, captures };
}

/** Max share of your deployed army's value you can lose and still get ★★★ / ★★. */
export const STAR3_LOSS = 0.25;
export const STAR2_LOSS = 0.5;

export interface BattleResult {
  outcome: Outcome;
  win: boolean;
  stars: number;
  /** Stars were capped because cards were used. */
  cardCapped: boolean;
  loot: number;
  reward: number;
  firstClearBonus: number;
  total: number;
  lost: { type: PieceType; temp: boolean }[];
  survivors: { type: PieceType; temp: boolean }[];
  /** XP earned per piece class. */
  xp: Partial<Record<PieceType, number>>;
}

/** Class XP: captures and boss hits (tracked on units), +2 for surviving, +3 each on a win; scaled by the stage. */
export function battleXp(b: Battle, stage: StageDef, win: boolean): Partial<Record<PieceType, number>> {
  const out: Partial<Record<PieceType, number>> = {};
  for (const u of b.units) {
    if (u.side !== 'P' || u.type === 'boss') continue;
    const cls = (u.promotedFrom ?? u.type) as PieceType;
    const xp = ((u.xp ?? 0) * 3 + (u.alive ? 2 : 0) + (win ? 3 : 0)) * stage.lootMult;
    out[cls] = (out[cls] ?? 0) + xp;
  }
  return out;
}

export function computeResult(
  b: Battle,
  outcome: Outcome,
  stage: StageDef,
  loot: number,
  alreadyCleared: boolean,
  cardsUsed = 0,
): BattleResult {
  const lost: BattleResult['lost'] = [];
  const survivors: BattleResult['survivors'] = [];
  for (const u of b.units) {
    if (u.side !== 'P' || u.type === 'boss') continue;
    const type = (u.promotedFrom ?? u.type) as PieceType;
    (u.alive ? survivors : lost).push({ type, temp: !!u.temp });
  }
  const win = outcome.winner === 'P';
  // Stars depend on the share of your army's value you lost (pawns are cheap, queens are not).
  const value = (l: { type: PieceType }) => PIECES[l.type].value;
  const deployedValue = [...lost, ...survivors].reduce((a, l) => a + value(l), 0) || 1;
  const lostShare = lost.reduce((a, l) => a + value(l), 0) / deployedValue;
  let stars = 0;
  if (win) {
    if (outcome.reason === 'points' || outcome.reason === 'time' || outcome.reason === 'deadlock') stars = 1;
    else stars = lostShare <= STAR3_LOSS ? 3 : lostShare <= STAR2_LOSS ? 2 : 1;
  }
  const cardCapped = cardsUsed > 0 && stars > 2;
  if (cardsUsed > 0) stars = Math.min(stars, 2);
  const reward = win ? stage.reward : 0;
  const firstClearBonus = win && !alreadyCleared && !stage.isArena ? stage.reward : 0;
  return {
    outcome, win, stars, cardCapped, loot, reward, firstClearBonus, total: loot + reward + firstClearBonus, lost, survivors,
    xp: battleXp(b, stage, win),
  };
}

/** Price to raise leadership from `level` to `level + 1`. */
export const leadershipCost = (level: number) => {
  const k = level - 6;
  return Math.round((15 + 8 * k + 0.4 * k * k) / 5) * 5;
};
export const MAX_LEADERSHIP = 50;
