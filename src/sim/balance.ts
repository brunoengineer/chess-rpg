/**
 * Balance simulator (dev tool, not shipped).
 *
 * 1. `progression()` models a sensible player going through the campaign: first-try wins, typical loot,
 *    and a simple shopping policy (fill leadership with the strongest affordable pieces, then buy leadership).
 * 2. `simulateStage()` plays the stage with a bot standing in for the player, using that expected army.
 *
 * Run: npm run balance  (writes sim-results/*.txt)
 */
import { chooseMove } from '../game/ai';
import { STAGES } from '../game/campaign';
import { autoDeploy } from '../game/deploy';
import { computeResult, leadershipCost, MAX_LEADERSHIP } from '../game/economy';
import { applyMove, cloneBattle, createBattle, enemyPostTurn, enemyPreTurn } from '../game/engine';
import { LETTERS, PIECES, PIECE_ORDER } from '../game/pieces';
import { commandCost, levelInfo } from '../game/ranks';
import type { AiParams, PieceType, StageDef } from '../game/types';

export type Counts = Partial<Record<PieceType, number>>;

/** Pawn screen size for Auto deploy in simulations (env SCREEN, default = the game's). */
const SIM_SCREEN = process.env.SCREEN !== undefined ? Number(process.env.SCREEN) : undefined;

export interface PlayerState {
  coins: number;
  leadership: number;
  army: Counts;
  xp: Counts;
  cleared: Set<string>;
}

export const enemyMaterial = (s: StageDef) =>
  s.layout.join('').split('').reduce((a, ch) => a + (LETTERS[ch] ? PIECES[LETTERS[ch]].value : 0), 0) +
  (s.boss ? 3 + (s.boss.hp ?? 0) * 1.5 : 0);

const ranksOf = (xp: Counts) => Object.fromEntries(PIECE_ORDER.map((t) => [t, levelInfo(xp[t] ?? 0).rank])) as Record<PieceType, number>;

export function deploySlots(s: StageDef): number {
  let rocks = 0;
  s.layout.forEach((row, y) => {
    if (y >= s.h - s.deployRows) rocks += [...row].filter((c) => c === '#').length;
  });
  return s.w * s.deployRows - rocks;
}

/** Strength of the best army that fits `leadership` and `slots` (greedy by value). */
export function deployValue(army: Counts, leadership: number, slots: number, ranks: Record<PieceType, number>): number {
  const pieces = PIECE_ORDER.flatMap((t) => Array<PieceType>(army[t] ?? 0).fill(t)).sort((a, b) => PIECES[b].value - PIECES[a].value);
  let budget = leadership, left = slots, value = 0;
  const copies: Partial<Record<PieceType, number>> = {};
  for (const t of pieces) {
    const c = commandCost(t, ranks[t]);
    if (left === 0) break;
    if (c > budget) continue;
    budget -= c;
    left--;
    // Real players field a mix: extra copies of the same officer add a bit less (pawns are the shield).
    const k = (copies[t] = (copies[t] ?? 0) + 1);
    const diminish = t === 'pawn' ? 1 : Math.pow(0.85, k - 1);
    value += PIECES[t].value * (1 + 0.08 * ranks[t]) * diminish;
  }
  return value;
}

/**
 * Spend coins like a rational player: pick the purchase plan (a piece, leadership, or a piece plus the
 * leadership to field it) that adds the most deployable strength per coin, and take its first step.
 * If even that step isn't affordable, save up.
 */
export function shop(p: PlayerState, slots: number) {
  const ranks = ranksOf(p.xp);
  const unlocked = PIECE_ORDER.filter((t) => !PIECES[t].unlockedBy || p.cleared.has(PIECES[t].unlockedBy!));
  const leadCost = (n: number) => {
    let c = 0;
    for (let i = 0; i < n && p.leadership + i < MAX_LEADERSHIP; i++) c += leadershipCost(p.leadership + i);
    return c;
  };
  for (let guard = 0; guard < 300; guard++) {
    const now = deployValue(p.army, p.leadership, slots, ranks);
    type Plan = { total: number; gain: number; step: number; apply: () => void };
    const plans: Plan[] = [];
    const lead = () => p.leadership++;
    if (p.leadership < MAX_LEADERSHIP) {
      for (const n of [1, 2, 3]) {
        plans.push({ total: leadCost(n), gain: deployValue(p.army, p.leadership + n, slots, ranks) - now, step: leadershipCost(p.leadership), apply: lead });
      }
    }
    for (const t of unlocked) {
      const army = { ...p.army, [t]: (p.army[t] ?? 0) + 1 };
      const buy = () => void (p.army[t] = (p.army[t] ?? 0) + 1);
      for (const n of [0, commandCost(t, ranks[t])]) {
        const gain = deployValue(army, Math.min(MAX_LEADERSHIP, p.leadership + n), slots, ranks) - now;
        // With extra leadership needed, raise leadership first (a piece you cannot field is useless).
        plans.push({ total: PIECES[t].price + leadCost(n), gain, step: n ? leadershipCost(p.leadership) : PIECES[t].price, apply: n ? lead : buy });
      }
    }
    const best = plans.filter((o) => o.gain > 0.01).sort((x, y) => y.gain / y.total - x.gain / x.total)[0];
    if (!best || best.step > p.coins) break; // nothing useful, or saving up
    p.coins -= best.step;
    best.apply();
  }
}

export interface ExpectedRow {
  stage: StageDef;
  before: { leadership: number; army: Counts; xp: Counts; coins: number };
}

/** Expected player state before each main stage (and bonus stage) of the campaign. */
export function progression(lootShare = 0.7): ExpectedRow[] {
  const p: PlayerState = { coins: 20, leadership: 6, army: { pawn: 5 }, xp: {}, cleared: new Set() };
  const rows: ExpectedRow[] = [];
  for (const s of STAGES) {
    shop(p, deploySlots(s));
    rows.push({ stage: s, before: { leadership: p.leadership, army: { ...p.army }, xp: { ...p.xp }, coins: p.coins } });
    if (s.extra) continue; // bonus stages don't feed the expected main progression
    const mat = enemyMaterial(s);
    p.coins += s.reward * 2 + Math.round(mat * lootShare * s.lootMult);
    // XP: captures spread over the army by material share, +2 survive, +3 win per piece.
    const armyValue = PIECE_ORDER.reduce((a, t) => a + (p.army[t] ?? 0) * PIECES[t].value, 0) || 1;
    for (const t of PIECE_ORDER) {
      const n = p.army[t] ?? 0;
      if (!n) continue;
      const share = (n * PIECES[t].value) / armyValue;
      p.xp[t] = (p.xp[t] ?? 0) + Math.round((mat * lootShare * share * 3 + n * 5) * s.lootMult);
    }
    p.cleared.add(s.id);
  }
  return rows;
}

export interface SimResult {
  wins: number;
  games: number;
  stars: number[];
  lostShare: number[];
  plies: number[];
  reasons: Record<string, number>;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays `games` battles of a stage with the expected army, the player side driven by `bot`. */
export function simulateStage(row: ExpectedRow, bot: AiParams, games: number, seed = 1): SimResult {
  const s = row.stage;
  const ranks = ranksOf(row.before.xp);
  const base = createBattle(s, []);
  const blocked = new Set(base.grid.flatMap((c, i) => (c !== 0 ? [i] : [])));
  const placements = autoDeploy(s, row.before.army, {}, row.before.leadership, blocked, (t) => commandCost(t, ranks[t]), { rankOf: (t) => ranks[t], screen: SIM_SCREEN });
  const res: SimResult = { wins: 0, games, stars: [], lostShare: [], plies: [], reasons: {} };
  const deployed = placements.reduce((a, p) => a + PIECES[p.type].value, 0);
  for (let g = 0; g < games; g++) {
    const rand = mulberry32(seed * 1000 + g);
    let b = createBattle(s, placements, ranks);
    for (let guard = 0; !b.over && guard < 400; guard++) {
      if (b.turn === 'P') {
        b = applyMove(b, chooseMove(b, bot, rand));
      } else {
        b = cloneBattle(b);
        enemyPreTurn(b, [], rand);
        if (b.over) break;
        b = applyMove(b, chooseMove(b, s.ai, rand));
        enemyPostTurn(b);
      }
    }
    const outcome = b.over ?? { winner: 'E' as const, reason: 'time' as const };
    const r = computeResult(b, outcome, s, 0, true);
    if (r.win) res.wins++;
    res.stars.push(r.stars);
    const lost = r.lost.reduce((a, l) => a + PIECES[l.type].value, 0);
    res.lostShare.push(deployed ? lost / deployed : 1);
    res.plies.push(b.ply);
    const key = `${outcome.winner}:${outcome.reason}`;
    res.reasons[key] = (res.reasons[key] ?? 0) + 1;
  }
  return res;
}

/** Bots standing in for human players. */
export const BOTS: Record<string, AiParams> = {
  casual: { depth: 2, blunder: 0.08, noise: 40 },
  good: { depth: 2, blunder: 0, noise: 10, quiesce: true },
};

export function report(world: number, games = 4): string {
  const rows = progression().filter((r) => r.stage.region === world);
  const lines: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);
  lines.push(`World ${world}`);
  lines.push('stage  | L  | army (deployed value)          | enemy | AI       | bot     | win  | ★avg | ★3  | lost% | plies | outcomes');
  for (const row of rows) {
    const s = row.stage;
    const ranks = ranksOf(row.before.xp);
    const base = createBattle(s, []);
    const blocked = new Set(base.grid.flatMap((c, i) => (c !== 0 ? [i] : [])));
    const pl = autoDeploy(s, row.before.army, {}, row.before.leadership, blocked, (t) => commandCost(t, ranks[t]), { rankOf: (t) => ranks[t], screen: SIM_SCREEN });
    const dv = pl.reduce((a, p) => a + PIECES[p.type].value, 0);
    const armyTxt = PIECE_ORDER.filter((t) => pl.some((p) => p.type === t))
      .map((t) => `${pl.filter((p) => p.type === t).length}${t[0]}${ranks[t] ? `r${ranks[t]}` : ''}`)
      .join(' ');
    // env BOTS=casual limits the run to some bots (faster comparisons).
    for (const [name, bot] of Object.entries(BOTS).filter(([n]) => !process.env.BOTS || process.env.BOTS.split(',').includes(n))) {
      const r = simulateStage(row, bot, games, s.region * 100 + s.id.length);
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      lines.push(
        [
          s.id.padEnd(6),
          String(row.before.leadership).padStart(2),
          `${armyTxt} (${dv})`.padEnd(30),
          String(enemyMaterial(s)).padStart(5) + (s.enemyRank ? `r${s.enemyRank}` : '  '),
          `d${s.ai.depth} b${s.ai.blunder}`.padEnd(8),
          name.padEnd(7),
          pct(r.wins / r.games),
          avg(r.stars).toFixed(1).padStart(4),
          pct(r.stars.filter((x) => x === 3).length / r.games),
          pct(avg(r.lostShare)).padStart(5),
          String(Math.round(avg(r.plies))).padStart(5),
          JSON.stringify(r.reasons),
        ].join(' | '),
      );
    }
  }
  return lines.join('\n');
}

/** Economy only (instant): expected army strength vs enemy strength per stage. */
export function economyReport(): string {
  const lines = ['stage | L  | coins | army                     | mine  | enemy | ratio'];
  for (const row of progression()) {
    const s = row.stage;
    const ranks = ranksOf(row.before.xp);
    const mine = deployValue(row.before.army, row.before.leadership, deploySlots(s), ranks);
    const army = PIECE_ORDER.filter((t) => row.before.army[t]).map((t) => `${row.before.army[t]}${t.slice(0, 2)}${ranks[t] ? `r${ranks[t]}` : ''}`).join(' ');
    const enemy = enemyMaterial(s) * (1 + 0.08 * (s.enemyRank ?? 0));
    lines.push(
      [s.id.padEnd(5), String(row.before.leadership).padStart(2), String(row.before.coins).padStart(5), army.padEnd(24), mine.toFixed(1).padStart(5), enemy.toFixed(1).padStart(5), (enemy / Math.max(1, mine)).toFixed(2)].join(' | '),
    );
  }
  return lines.join('\n');
}

/** Target enemy/player strength ratio per stage type (early stages of a world are easier). */
export function targetRatio(s: StageDef): number {
  if (s.extra) return s.extra === 1 ? 1.05 : 1.15;
  if (s.isBoss) return 0.65;
  const i = Number(s.id.split('-')[1]);
  return 0.6 + (0.3 * (i - 1)) / 8;
}

export function targetsReport(): string {
  const lines = ['stage | mine  | enemy | target | delta'];
  for (const row of progression()) {
    const s = row.stage;
    const ranks = ranksOf(row.before.xp);
    const mine = deployValue(row.before.army, row.before.leadership, deploySlots(s), ranks);
    const enemy = enemyMaterial(s) * (1 + 0.08 * (s.enemyRank ?? 0));
    const target = targetRatio(s) * mine;
    lines.push([s.id.padEnd(5), mine.toFixed(1).padStart(5), enemy.toFixed(1).padStart(5), target.toFixed(1).padStart(6), (enemy - target).toFixed(1).padStart(6)].join(' | '));
  }
  return lines.join('\n');
}
