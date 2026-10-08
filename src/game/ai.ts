import { PASS, applyMove, genMoves, unitValue } from './engine';
import type { AiParams, Battle, Move, Side } from './types';

const INF = 1e9;
const WIN = 1e6;
const ABORT = Symbol('abort');
const NODE_BUDGET = 150_000;

let nodes = 0;

function evaluate(b: Battle, side: Side): number {
  let s = 0;
  const cx = (b.w - 1) / 2, cy = (b.h - 1) / 2;
  for (const u of b.units) {
    if (!u.alive) continue;
    let v = unitValue(u) * 100;
    if (u.type === 'pawn') {
      const adv = u.side === 'P' ? b.h - 1 - u.y : u.y;
      v += adv * adv * 4;
    } else if (u.type !== 'boss' && u.type !== 'rook') {
      v -= (Math.abs(u.x - cx) + Math.abs(u.y - cy)) * 5;
    }
    s += u.side === side ? v : -v;
  }
  return s;
}

function terminal(b: Battle, side: Side): number {
  const o = b.over!;
  if (o.winner === 'draw') return 0;
  return o.winner === side ? WIN - b.ply : -WIN + b.ply;
}

function moveOrder(b: Battle, m: Move): number {
  let s = 0;
  if (m.target !== undefined) s += unitValue(b.units[m.target]) * 10 - unitValue(b.units[m.u]);
  if (m.crush) for (const c of m.crush) s += unitValue(b.units[c]) * 10;
  if (m.kind === 'strike') s += 40;
  if (m.promo) s += 80;
  return s;
}

function ordered(b: Battle, moves: Move[]): Move[] {
  return moves
    .map((m) => [moveOrder(b, m), m] as const)
    .sort((a, c) => c[0] - a[0])
    .map((x) => x[1]);
}

function negamax(b: Battle, depth: number, alpha: number, beta: number, q: number): number {
  if (++nodes > NODE_BUDGET) throw ABORT;
  const side = b.turn;
  if (b.over) return terminal(b, side);
  if (depth <= 0) return q > 0 ? quiesce(b, alpha, beta, q) : evaluate(b, side);
  const moves = genMoves(b, side);
  if (!moves.length) return -negamax(applyMove(b, PASS), depth - 1, -beta, -alpha, q);
  let best = -INF;
  for (const m of ordered(b, moves)) {
    const sc = -negamax(applyMove(b, m), depth - 1, -beta, -alpha, q);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function quiesce(b: Battle, alpha: number, beta: number, q: number): number {
  if (++nodes > NODE_BUDGET) throw ABORT;
  const side = b.turn;
  if (b.over) return terminal(b, side);
  const stand = evaluate(b, side);
  if (stand >= beta || q === 0) return stand;
  if (stand > alpha) alpha = stand;
  const caps = genMoves(b, side).filter((m) => m.kind === 'capture' || m.kind === 'strike');
  for (const m of ordered(b, caps)) {
    const sc = -quiesce(applyMove(b, m), -beta, -alpha, q - 1);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

/** Picks a move for the side to move. */
export function chooseMove(b: Battle, p: AiParams, rand: () => number = Math.random): Move {
  const moves = genMoves(b, b.turn);
  if (!moves.length) return PASS;
  if (rand() < p.blunder) return moves[Math.floor(rand() * moves.length)];

  nodes = 0;
  let scores: number[] | null = null;
  for (let d = 1; d <= Math.max(1, p.depth); d++) {
    try {
      scores = moves.map((m) => -negamax(applyMove(b, m), d - 1, -INF, INF, p.quiesce ? 3 : 0));
    } catch (e) {
      if (e !== ABORT) throw e;
      break;
    }
  }
  if (!scores) return ordered(b, moves)[0];

  let best = 0, bestScore = -INF;
  scores.forEach((s, i) => {
    // Never let noise hide a forced win or a forced loss.
    const noisy = Math.abs(s) > WIN / 2 ? s : s + (rand() * 2 - 1) * p.noise;
    if (noisy > bestScore) { bestScore = noisy; best = i; }
  });
  return moves[best];
}
