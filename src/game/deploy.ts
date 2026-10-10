import { PIECES, PIECE_ORDER } from './pieces';
import type { PieceType, Placement, StageDef } from './types';

type Counts = Partial<Record<PieceType, number>>;
type TrayItem = { type: PieceType; temp: boolean };
export type Cost = (t: PieceType) => number;

const count = (c: Counts, t: PieceType) => c[t] ?? 0;

/** Free squares in the player's deploy rows, front row (closest to the enemy) first, center-out. */
export function deploySquares(stage: StageDef, occupied: Set<number>): number[][] {
  const rows: number[][] = [];
  for (let y = stage.h - stage.deployRows; y < stage.h; y++) {
    const cols = [...Array(stage.w).keys()].sort((a, b) => Math.abs(a - (stage.w - 1) / 2) - Math.abs(b - (stage.w - 1) / 2));
    rows.push(cols.map((x) => y * stage.w + x).filter((i) => !occupied.has(i)));
  }
  return rows;
}

/** Strongest army that fits leadership and squares: a pawn shield in front, officers behind. */
export function autoDeploy(stage: StageDef, army: Counts, mercs: Counts, leadership: number, blocked: Set<number>, cost: Cost): Placement[] {
  const pool: TrayItem[] = [];
  for (const t of PIECE_ORDER) {
    for (let i = 0; i < count(army, t); i++) pool.push({ type: t, temp: false });
    for (let i = 0; i < count(mercs, t); i++) pool.push({ type: t, temp: true });
  }
  pool.sort((a, b) => PIECES[b.type].value - PIECES[a.type].value || Number(a.temp) - Number(b.temp));
  const rows = deploySquares(stage, blocked);
  let slots = rows.reduce((a, r) => a + r.length, 0);
  // Keep some leadership for a pawn shield in front of the officers.
  const pawns = pool.filter((it) => it.type === 'pawn');
  const shield = Math.min(pawns.length, rows[0]?.length ?? 0, Math.floor((leadership * 0.35) / cost('pawn')), slots);
  let budget = leadership - shield * cost('pawn');
  slots -= shield;
  const chosen: TrayItem[] = pawns.splice(0, shield);
  for (const it of [...pool.filter((it) => it.type !== 'pawn'), ...pawns]) {
    if (slots === 0) break;
    if (cost(it.type) <= budget) {
      chosen.push(it);
      budget -= cost(it.type);
      slots--;
    }
  }
  const take = (order: number[][]) => {
    for (const r of order) if (r.length) return r.shift()!;
    return -1;
  };
  const out: Placement[] = [];
  // Pawns fill the front, officers fill from the back.
  for (const it of [...chosen.filter((c) => c.type === 'pawn'), ...chosen.filter((c) => c.type !== 'pawn')]) {
    const sq = it.type === 'pawn' ? take(rows) : take([...rows].reverse());
    if (sq < 0) break;
    out.push({ ...it, x: sq % stage.w, y: Math.floor(sq / stage.w) });
  }
  return out;
}
