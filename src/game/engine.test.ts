import { describe, expect, it } from 'vitest';
import { chooseMove } from './ai';
import { arenaStage, STAGES } from './campaign';
import { applyMove, createBattle, enemyPostTurn, enemyPreTurn, genMoves, genUnitMoves, reachSquares } from './engine';
import { LETTERS } from './pieces';
import type { Battle, FxEvent, Placement, StageDef } from './types';

const stage = (over: Partial<StageDef>): StageDef => ({
  id: 't', region: 1, name: 't', w: 5, h: 5, deployRows: 1, layout: [],
  ai: { depth: 2, blunder: 0, noise: 0 }, reward: 10, lootMult: 1, maxTurns: 30, ...over,
});

const at = (b: Battle, x: number, y: number) => b.units.find((u) => u.alive && u.x === x && u.y === y);

describe('move generation', () => {
  it('pawns move forward and capture diagonally', () => {
    const b = createBattle(stage({ layout: ['', '', '.p...'] }), [{ type: 'pawn', temp: false, x: 2, y: 3 }]);
    const pawn = at(b, 2, 3)!;
    const moves = genUnitMoves(b, pawn.id);
    expect(moves.map((m) => `${m.kind}:${m.x},${m.y}`).sort()).toEqual(['capture:1,2', 'move:2,2']);
  });

  it('pawns double-step only on boards of 6+ rows', () => {
    const small = createBattle(stage({}), [{ type: 'pawn', temp: false, x: 0, y: 4 }]);
    expect(genUnitMoves(small, 0)).toHaveLength(1);
    const big = createBattle(stage({ w: 6, h: 6 }), [{ type: 'pawn', temp: false, x: 0, y: 5 }]);
    expect(genUnitMoves(big, 0)).toHaveLength(2);
  });

  it('rocks block sliders and leapers cannot land on them', () => {
    const b = createBattle(stage({ layout: ['', '', '..#..'] }), [
      { type: 'rook', temp: false, x: 2, y: 4 },
      { type: 'knight', temp: false, x: 1, y: 4 },
    ]);
    const rook = genUnitMoves(b, 0).filter((m) => m.x === 2);
    expect(rook.map((m) => m.y)).toEqual([3]);
    expect(genUnitMoves(b, 1).some((m) => m.x === 2 && m.y === 2)).toBe(false);
  });

  it('pawn promotes to queen on the last row', () => {
    const b = createBattle(stage({ layout: ['....p'] }), [{ type: 'pawn', temp: false, x: 0, y: 1 }]);
    const pawn = b.units.find((u) => u.side === 'P')!;
    const m = genUnitMoves(b, pawn.id).find((m) => m.y === 0)!;
    expect(m.promo).toBe(true);
    const fx: FxEvent[] = [];
    const nb = applyMove(b, m, fx);
    expect(nb.units[pawn.id].type).toBe('queen');
    expect(nb.units[pawn.id].promotedFrom).toBe('pawn');
    expect(fx.some((e) => e.kind === 'promote')).toBe(true);
  });
});

describe('bosses', () => {
  const bossStage = stage({ w: 6, h: 6, boss: { kind: 'golem', x: 2, y: 0, hp: 2 } });

  it('attacking a boss strikes it and the attacker stays in place', () => {
    const b = createBattle(bossStage, [{ type: 'rook', temp: false, x: 2, y: 5 }]);
    const rook = b.units.find((u) => u.side === 'P')!;
    const strikes = genUnitMoves(b, rook.id).filter((m) => m.kind === 'strike');
    expect(strikes).toHaveLength(1);
    const nb = applyMove(b, strikes[0]);
    expect(nb.units[rook.id].y).toBe(5);
    expect(nb.over).toEqual({ winner: 'P', reason: 'boss' }); // rook deals 2 damage
  });

  it('a boss crushes pieces under its new footprint and then rests', () => {
    let b = createBattle(bossStage, [
      { type: 'pawn', temp: false, x: 2, y: 2 },
      { type: 'pawn', temp: false, x: 3, y: 2 },
      { type: 'pawn', temp: false, x: 0, y: 5 },
    ]);
    b = applyMove(b, genMoves(b, 'P').find((m) => m.x === 0)!);
    const down = genMoves(b, 'E').find((m) => m.y === 1 && m.x === 2)!;
    expect(down.crush).toHaveLength(2);
    b = applyMove(b, down);
    expect(b.units.filter((u) => u.side === 'P' && u.alive)).toHaveLength(1);
    expect(b.units.find((u) => u.type === 'boss')!.cd).toBe(1);
  });

  it('boss hints cover the whole 2x2 landing area, show crushes, and work while it rests', () => {
    // Golem at (2,0) moves 1 square orthogonally: can land at (1,0), (3,0) or (2,1).
    const b = createBattle(bossStage, [{ type: 'pawn', temp: false, x: 2, y: 2 }]);
    const boss = b.units.find((u) => u.type === 'boss')!;
    const sq = (x: number, y: number) => y * 6 + x;
    const hints = reachSquares(b, boss.id);
    expect(hints.get(sq(1, 0))).toBe('move'); // left landing, left column
    expect(hints.get(sq(4, 1))).toBe('move'); // right landing, right column
    expect(hints.get(sq(2, 2))).toBe('capture'); // landing one row down crushes the pawn
    expect(hints.get(sq(3, 2))).toBe('move');
    expect(hints.has(sq(2, 0))).toBe(false); // its own squares aren't destinations
    boss.cd = 1; // resting
    expect(reachSquares(b, boss.id).get(sq(2, 2))).toBe('capture');
  });

  it('telegraphed quake destroys adjacent player pieces next enemy turn', () => {
    const s = stage({ w: 6, h: 6, boss: { kind: 'colossus', x: 2, y: 0 } });
    const b = createBattle(s, [{ type: 'pawn', temp: false, x: 1, y: 2 }, { type: 'pawn', temp: false, x: 5, y: 5 }]);
    b.enemyTurns = 2;
    enemyPreTurn(b, []); // turn 3
    enemyPostTurn(b);
    expect(b.telegraph?.kind).toBe('quake');
    const fx: FxEvent[] = [];
    enemyPreTurn(b, fx);
    expect(at(b, 1, 2)).toBeUndefined();
    expect(at(b, 5, 5)).toBeDefined();
  });
});

describe('AI', () => {
  it('takes a free queen', () => {
    const b = createBattle(stage({ layout: ['..r..'] }), [{ type: 'queen', temp: false, x: 2, y: 3 }, { type: 'pawn', temp: false, x: 0, y: 4 }]);
    b.turn = 'E';
    const m = chooseMove(b, { depth: 2, blunder: 0, noise: 0 });
    expect(m.kind).toBe('capture');
  });

  it('finishes a full game between two AIs', () => {
    const s = STAGES.find((x) => x.id === '2-3')!;
    const placements: Placement[] = [...'pppppp'].map((_, x) => ({ type: 'pawn' as const, temp: false, x, y: 4 }));
    placements.push({ type: 'knight', temp: false, x: 1, y: 5 }, { type: 'bishop', temp: false, x: 2, y: 5 });
    let b = createBattle(s, placements);
    let guard = 0;
    while (!b.over && guard++ < 200) b = applyMove(b, chooseMove(b, { depth: 2, blunder: 0.1, noise: 20 }));
    expect(b.over).not.toBeNull();
  });
});

describe('stage data', () => {
  const all = [...STAGES, ...Array.from({ length: 25 }, (_, i) => arenaStage(i + 1))];
  it.each(all.map((s) => [s.id, s] as const))('%s is well-formed', (_, s) => {
    expect(s.layout.length + s.deployRows).toBeLessThanOrEqual(s.h);
    for (const row of s.layout) {
      expect(row.length).toBe(s.w);
      for (const ch of row) expect(ch === '.' || ch === '#' || ch in LETTERS).toBe(true);
    }
    if (s.boss) {
      const { x, y } = s.boss;
      expect(x + 2).toBeLessThanOrEqual(s.w);
      for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 2; xx++) expect(s.layout[yy]?.[xx] ?? '.').toBe('.');
    }
    const b = createBattle(s, []);
    expect(b.units.filter((u) => u.side === 'E').length).toBeGreaterThan(0);
  });
});
