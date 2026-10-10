import { describe, expect, it } from 'vitest';
import { STAGE_BY_ID, hardStage, isStageUnlocked, nextStage } from './campaign';
import { cardPlayable, playCard, validSquares } from './cards';
import { battleXp, computeResult } from './economy';
import { applyMove, createBattle, genMoves, genUnitMoves } from './engine';
import { commandCost, levelInfo, profile } from './ranks';
import type { Placement, StageDef } from './types';

const stage = (over: Partial<StageDef> = {}): StageDef => ({
  id: 't', region: 1, name: 't', w: 6, h: 6, deployRows: 2, layout: [],
  ai: { depth: 1, blunder: 0, noise: 0 }, reward: 10, lootMult: 1, maxTurns: 30, ...over,
});
const P = (type: Placement['type'], x: number, y: number): Placement => ({ type, temp: false, x, y });
const sq = (x: number, y: number, w = 6) => y * w + x;

describe('levels and ranks', () => {
  it('levels up along the XP curve and ranks every 10 levels', () => {
    expect(levelInfo(0)).toMatchObject({ level: 0, rank: 0 });
    expect(levelInfo(8)).toMatchObject({ level: 1 });
    const l10 = Array.from({ length: 10 }, (_, i) => 5 + 3 * (i + 1)).reduce((a, b) => a + b);
    expect(levelInfo(l10)).toMatchObject({ level: 10, rank: 1 });
    expect(levelInfo(1e9)).toMatchObject({ level: 50, rank: 5 });
  });

  it('ranked pieces cost more command, in proportion to their base cost', () => {
    expect(commandCost('pawn', 5)).toBe(1);
    expect(commandCost('knight', 0)).toBe(2);
    expect(commandCost('knight', 4)).toBe(3);
    expect(commandCost('queen', 0)).toBe(6);
    expect(commandCost('queen', 5)).toBe(9);
  });

  it('perks add movement: Sergeant knight jumps 2 straight', () => {
    const b = createBattle(stage(), [P('knight', 2, 5)], { knight: 1 });
    expect(genUnitMoves(b, 0).some((m) => m.x === 2 && m.y === 3)).toBe(true);
    const plain = createBattle(stage(), [P('knight', 2, 5)]);
    expect(genUnitMoves(plain, 0).some((m) => m.x === 2 && m.y === 3)).toBe(false);
  });

  it('vault lets a Major rook jump one blocker', () => {
    const b = createBattle(stage({ layout: ['..p...', '......', '..p...'] }), [P('rook', 2, 5)], { rook: 3 });
    const rook = b.units.find((u) => u.side === 'P')!;
    const targets = genUnitMoves(b, rook.id).filter((m) => m.kind === 'capture').map((m) => m.y);
    expect(targets.sort()).toEqual([0, 2]);
  });

  it('Colonel shield blocks the first capture, then breaks', () => {
    let b = createBattle(stage({ layout: ['', '', '', '...r..'] }), [P('knight', 3, 5), P('pawn', 0, 5)], { knight: 4 });
    const knight = b.units.find((u) => u.type === 'knight')!;
    expect(knight.shield).toBe(true);
    b = applyMove(b, genMoves(b, 'P').find((m) => m.u !== knight.id)!);
    const cap = genMoves(b, 'E').find((m) => m.target === knight.id)!;
    b = applyMove(b, cap);
    expect(b.units[knight.id].alive).toBe(true);
    expect(b.units[knight.id].shield).toBe(false);
    expect(b.units[cap.u].y).toBe(3); // attacker bounced back
  });

  it('General pawn promotes to an Amazon, Colonel pawns one row early', () => {
    const b = createBattle(stage({ layout: ['.....p'] }), [P('pawn', 0, 2)], { pawn: 5 });
    const pawn = b.units.find((u) => u.side === 'P')!;
    const m = genUnitMoves(b, pawn.id).find((x) => x.y === 1)!;
    expect(m.promo).toBe(true);
    expect(applyMove(b, m).units[pawn.id].type).toBe('amazon');
  });

  it('enemies get the stage rank', () => {
    expect(STAGE_BY_ID['1-1'].enemyRank).toBe(0);
    expect(STAGE_BY_ID['3-7'].enemyRank).toBe(1);
    expect(STAGE_BY_ID['5-X2'].enemyRank).toBe(4);
    const b = createBattle(STAGE_BY_ID['3-7'], []);
    expect(b.units.every((u) => u.type === 'boss' || u.rank === 1)).toBe(true);
    expect(profile('pawn', 2).pawnDouble).toBe(true);
  });
});

describe('hard mode', () => {
  it('opens after the world boss, is sequential, and is tougher and richer', () => {
    const h = hardStage(STAGE_BY_ID['1-1']);
    expect(h.id).toBe('1-1H');
    expect(h.enemyRank).toBe(2);
    expect(h.reward).toBe(STAGE_BY_ID['1-1'].reward * 2);
    expect(isStageUnlocked({}, h)).toBe(false);
    const p = { '1-10': { stars: 1, clears: 1 } };
    expect(isStageUnlocked(p, h)).toBe(true);
    expect(isStageUnlocked(p, hardStage(STAGE_BY_ID['1-2']))).toBe(false);
    expect(nextStage(h)?.id).toBe('1-2H');
  });
});

describe('xp and stars', () => {
  it('awards class XP for captures and caps stars when cards were used', () => {
    let b = createBattle(stage({ layout: ['', '', '', '..p...'] }), [P('knight', 3, 5)]);
    b = applyMove(b, genMoves(b, 'P').find((m) => m.kind === 'capture')!);
    expect(b.over?.winner).toBe('P');
    expect(battleXp(b, stage(), true)).toEqual({ knight: (1 * 3 + 2 + 3) * 1 });
    expect(computeResult(b, b.over!, stage(), 0, false).stars).toBe(3);
    const capped = computeResult(b, b.over!, stage(), 0, false, 1);
    expect(capped.stars).toBe(2);
    expect(capped.cardCapped).toBe(true);
  });
});

describe('cards', () => {
  const base = () => createBattle(stage({ layout: ['..r...', '..p...'] }), [P('pawn', 0, 5), P('knight', 3, 5), P('rook', 5, 5)]);

  it('freeze stops an enemy piece for two of its turns', () => {
    let b = base();
    const rook = b.units.find((u) => u.type === 'rook' && u.side === 'E')!;
    b = playCard(b, 'freeze', [sq(rook.x, rook.y)]).battle;
    expect(b.cardsUsed).toBe(1);
    b = applyMove(b, genMoves(b, 'P')[0]);
    expect(genMoves(b, 'E').some((m) => m.u === rook.id)).toBe(false);
    b = applyMove(b, genMoves(b, 'E')[0]);
    b = applyMove(b, genMoves(b, 'P')[0]);
    expect(genMoves(b, 'E').some((m) => m.u === rook.id)).toBe(false);
    b = applyMove(b, genMoves(b, 'E')[0]);
    b = applyMove(b, genMoves(b, 'P')[0]);
    expect(genMoves(b, 'E').some((m) => m.u === rook.id)).toBe(true);
  });

  it('smite, volley and revive', () => {
    let b = base();
    const pawn = b.units.find((u) => u.type === 'pawn' && u.side === 'E')!;
    const { battle, fx } = playCard(b, 'volley', [sq(2, 3)]);
    expect(battle.units[pawn.id].alive).toBe(false); // first enemy from the bottom in column 2
    expect(fx.some((e) => e.kind === 'capture')).toBe(true);
    b = playCard(b, 'smite', [sq(2, 0)]).battle;
    expect(b.units.find((u) => u.type === 'rook' && u.side === 'E')!.alive).toBe(false);

    expect(cardPlayable(b, 'revive', 2, [])).toBe(false);
    b.units.find((u) => u.type === 'rook' && u.side === 'P')!.alive = false;
    b.grid[sq(5, 5)] = 0;
    expect(cardPlayable(b, 'revive', 2, [])).toBe(true);
    expect(validSquares(b, 'deploy', 2).has(sq(1, 4))).toBe(true);
    b = playCard(b, 'revive', [sq(1, 4)]).battle;
    expect(b.units.find((u) => u.type === 'rook' && u.side === 'P')).toMatchObject({ alive: true, x: 1, y: 4 });
  });

  it('haste steps a piece without spending the turn; swap trades places', () => {
    let b = base();
    b = playCard(b, 'haste', [sq(0, 5), sq(1, 4)]).battle;
    expect(b.turn).toBe('P');
    expect(b.units.find((u) => u.type === 'pawn' && u.side === 'P')).toMatchObject({ x: 1, y: 4 });
    b = playCard(b, 'swap', [sq(3, 5), sq(5, 5)]).battle;
    expect(b.units.find((u) => u.type === 'knight')).toMatchObject({ x: 5, y: 5 });
    expect(b.grid[sq(3, 5)]).toBe(b.units.find((u) => u.type === 'rook' && u.side === 'P')!.id + 1);
  });

  it('reinforcements arrive with their class rank', () => {
    const b = playCard(base(), 'reinforce', [sq(2, 5)], { reinforce: 'bishop', ranks: { bishop: 3 } }).battle;
    expect(b.units.at(-1)).toMatchObject({ type: 'bishop', side: 'P', rank: 3, x: 2, y: 5 });
  });
});
