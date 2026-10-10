import { PIECES, PIECE_ORDER } from './pieces';
import type { PieceType, Placement, StageDef } from './types';

type Counts = Partial<Record<PieceType, number>>;
type TrayItem = { type: PieceType; temp: boolean };
export type Cost = (t: PieceType) => number;

const count = (c: Counts, t: PieceType) => c[t] ?? 0;

/** Pieces that belong in the back row (long-range sliders). Knights, Bishops and Wardens stand just behind the pawns. */
const HEAVY = new Set<PieceType>(['rook', 'queen', 'cardinal', 'marshal', 'amazon']);

/**
 * Share of the front row Auto fills with pawns before anything else, so officers aren't fully exposed.
 * Chosen with the balance simulator (`SCREEN=0|0.5|1 BOTS=casual npm run balance`): no screen and half a row
 * win equally often, a full row of pawns wins less; half a row keeps pawns in play (and earning XP).
 */
export const PAWN_SCREEN = 0.5;

/** Free squares in the player's deploy rows, front row (closest to the enemy) first, center-out. */
export function deploySquares(stage: StageDef, occupied: Set<number>): number[][] {
  const rows: number[][] = [];
  for (let y = stage.h - stage.deployRows; y < stage.h; y++) {
    const cols = [...Array(stage.w).keys()].sort((a, b) => Math.abs(a - (stage.w - 1) / 2) - Math.abs(b - (stage.w - 1) / 2));
    rows.push(cols.map((x) => y * stage.w + x).filter((i) => !occupied.has(i)));
  }
  return rows;
}

export interface AutoOptions {
  /** Rank of each piece class: ranked pieces count as stronger (their perks are real power). */
  rankOf?: (t: PieceType) => number;
  /** Override the pawn screen size (0–1 of the front row); used by the balance simulator. */
  screen?: number;
}

/**
 * Strongest army that fits your leadership and squares:
 * 1. a small pawn screen (half the front row, when you have pawns);
 * 2. the best combination of the rest by total strength (exact search), owned pieces before mercenaries;
 * 3. placement: pawns in front, Knights/Bishops/Wardens behind them, Rooks/Queens/fairy pieces at the back.
 */
export function autoDeploy(
  stage: StageDef,
  army: Counts,
  mercs: Counts,
  leadership: number,
  blocked: Set<number>,
  cost: Cost,
  opts: AutoOptions = {},
): Placement[] {
  const rows = deploySquares(stage, blocked);
  const slots = rows.reduce((a, r) => a + r.length, 0);
  const rankOf = opts.rankOf ?? (() => 0);
  const strength = (it: TrayItem) => PIECES[it.type].value * (1 + 0.08 * rankOf(it.type)) - (it.temp ? 0.01 : 0);

  const pool: TrayItem[] = [];
  for (const t of PIECE_ORDER) {
    for (let i = 0; i < count(army, t); i++) pool.push({ type: t, temp: false });
    for (let i = 0; i < count(mercs, t); i++) pool.push({ type: t, temp: true });
  }

  // 1. Pawn screen (owned pawns first).
  const pawns = pool.filter((it) => it.type === 'pawn').sort((a, b) => Number(a.temp) - Number(b.temp));
  const screenWanted = Math.ceil((rows[0]?.length ?? 0) * (opts.screen ?? PAWN_SCREEN));
  const screen = Math.max(0, Math.min(pawns.length, screenWanted, slots, Math.floor(leadership / cost('pawn'))));
  const chosen: TrayItem[] = pawns.slice(0, screen);
  const rest = [...pawns.slice(screen), ...pool.filter((it) => it.type !== 'pawn')];

  // 2. Exact best combination of the rest: 0/1 knapsack over (leadership, squares).
  const B = leadership - screen * cost('pawn');
  const K = slots - screen;
  if (B > 0 && K > 0 && rest.length) {
    const n = rest.length;
    const w = rest.map((it) => cost(it.type));
    const v = rest.map(strength);
    // best[b][k] = max strength using budget b and k squares; take[i][b][k] records choices for reconstruction.
    let best = Array.from({ length: B + 1 }, () => new Float64Array(K + 1));
    const take: Uint8Array[][] = [];
    for (let i = 0; i < n; i++) {
      const next = best.map((row) => row.slice());
      const ti = Array.from({ length: B + 1 }, () => new Uint8Array(K + 1));
      for (let b = w[i]; b <= B; b++)
        for (let k = 1; k <= K; k++) {
          const cand = best[b - w[i]][k - 1] + v[i];
          if (cand > next[b][k] + 1e-9) {
            next[b][k] = cand;
            ti[b][k] = 1;
          }
        }
      take.push(ti);
      best = next;
    }
    let b = B, k = K;
    for (let i = n - 1; i >= 0; i--) {
      if (take[i][b][k]) {
        chosen.push(rest[i]);
        b -= w[i];
        k -= 1;
      }
    }
  }

  // 3. Placement.
  const pick = (order: number[][]) => {
    for (const r of order) if (r.length) return r.shift()!;
    return -1;
  };
  const front = rows; // front row first
  const back = [...rows].reverse();
  const out: Placement[] = [];
  const place = (it: TrayItem, sq: number) => sq >= 0 && out.push({ ...it, x: sq % stage.w, y: Math.floor(sq / stage.w) });
  const byStrength = (a: TrayItem, c: TrayItem) => strength(c) - strength(a);
  for (const it of chosen.filter((c) => c.type === 'pawn')) place(it, pick(front));
  for (const it of chosen.filter((c) => HEAVY.has(c.type)).sort(byStrength)) place(it, pick(back));
  for (const it of chosen.filter((c) => c.type !== 'pawn' && !HEAVY.has(c.type)).sort(byStrength)) place(it, pick(back));
  return out;
}
