import { describe, expect, it } from 'vitest';
import { STAGE_BY_ID } from './campaign';
import { autoDeploy } from './deploy';
import { createBattle } from './engine';
import { PIECES } from './pieces';
import { commandCost } from './ranks';
import type { PieceType, Placement, StageDef } from './types';

const setup = (id: string) => {
  const s: StageDef = STAGE_BY_ID[id];
  const blocked = new Set(createBattle(s, []).grid.flatMap((c, i) => (c !== 0 ? [i] : [])));
  return { s, blocked };
};
const value = (pl: Placement[]) => pl.reduce((a, p) => a + PIECES[p.type].value, 0);
const counts = (pl: Placement[]) => pl.reduce<Record<string, number>>((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});

describe('auto deploy', () => {
  it('fields the strongest army: officers beat extra pawns per leadership point', () => {
    const { s, blocked } = setup('3-5');
    const army = { pawn: 10, knight: 3, bishop: 2, warden: 1, rook: 2 };
    const pl = autoDeploy(s, army, {}, 22, blocked, (t) => commandCost(t));
    expect(pl.reduce((a, p) => a + commandCost(p.type), 0)).toBeLessThanOrEqual(22);
    expect(counts(pl)).toMatchObject({ rook: 2, knight: 3, bishop: 2, warden: 1 }); // nobody strong left on the bench
    expect(value(pl)).toBe(32); // old Auto: 30 (8 pawns, bench kept a Warden and a Bishop)
  });

  it('keeps a pawn screen of about half the front row', () => {
    const { s, blocked } = setup('4-5');
    const pl = autoDeploy(s, { pawn: 12, knight: 4, bishop: 3, rook: 3, queen: 1 }, {}, 30, blocked, (t) => commandCost(t));
    const frontRow = s.h - s.deployRows;
    expect(pl.filter((p) => p.type === 'pawn' && p.y === frontRow).length).toBeGreaterThanOrEqual(4);
    expect(pl.some((p) => p.type === 'queen')).toBe(true);
  });

  it('respects leadership, squares and what you own', () => {
    const { s, blocked } = setup('1-1'); // 5 squares
    const pl = autoDeploy(s, { pawn: 9, knight: 3 }, {}, 6, blocked, (t) => commandCost(t));
    expect(pl.length).toBeLessThanOrEqual(5);
    expect(pl.reduce((a, p) => a + commandCost(p.type), 0)).toBeLessThanOrEqual(6);
    expect(new Set(pl.map((p) => `${p.x},${p.y}`)).size).toBe(pl.length);
  });

  it('uses owned pieces before mercenaries at equal strength', () => {
    const { s, blocked } = setup('4-5');
    const pl = autoDeploy(s, { pawn: 8, rook: 2 }, { rook: 2 }, 14, blocked, (t) => commandCost(t));
    const rooks = pl.filter((p) => p.type === 'rook');
    expect(rooks.filter((r) => !r.temp).length).toBe(2); // both owned rooks go first
  });

  it('counts ranks: a ranked piece is preferred over an unranked one of equal value', () => {
    const { s, blocked } = setup('1-1'); // 5 squares, 1 row: room for only a few officers
    const ranks: Partial<Record<PieceType, number>> = { bishop: 3 };
    const cost = (t: PieceType) => commandCost(t, ranks[t] ?? 0);
    const pl = autoDeploy(s, { knight: 3, bishop: 3 }, {}, 6, blocked, cost, { rankOf: (t) => ranks[t] ?? 0 });
    expect(counts(pl).bishop).toBeGreaterThan(counts(pl).knight ?? 0);
  });

  it('places pawns in front and Rooks/Queens at the back', () => {
    const { s, blocked } = setup('4-5');
    const pl = autoDeploy(s, { pawn: 8, knight: 2, rook: 2, queen: 1 }, {}, 30, blocked, (t) => commandCost(t));
    const front = s.h - s.deployRows, back = s.h - 1;
    expect(pl.filter((p) => p.type === 'pawn').every((p) => p.y === front)).toBe(true);
    expect(pl.filter((p) => p.type === 'rook' || p.type === 'queen').every((p) => p.y === back)).toBe(true);
  });
});
