import { BOSS_ORDER, BOSSES } from './bosses';
import { PIECES, PIECE_ORDER } from './pieces';
import type { PieceType, StageDef } from './types';

export interface RegionDef {
  id: number;
  name: string;
  subtitle: string;
  icon: string;
  light: string;
  dark: string;
  accent: string;
  bg: string;
}

export const REGIONS: RegionDef[] = [
  { id: 1, name: 'Pawn Meadows', subtitle: 'Where every legend begins', icon: '🌾', light: '#efe8c9', dark: '#86a75f', accent: '#b6d77a', bg: 'linear-gradient(135deg,#2f4a24,#1b2b17)' },
  { id: 2, name: 'Whispering Woods', subtitle: 'Riders in the dark', icon: '🌲', light: '#e3d9b8', dark: '#4f7552', accent: '#7fc48a', bg: 'linear-gradient(135deg,#183326,#0d1d16)' },
  { id: 3, name: 'Cathedral of Ash', subtitle: 'Bishops that never sleep', icon: '⛪', light: '#ddd5ea', dark: '#6e5a92', accent: '#c59bff', bg: 'linear-gradient(135deg,#2c2142,#171127)' },
  { id: 4, name: 'Stone Bastion', subtitle: 'Walls of rooks and iron', icon: '🏯', light: '#d9d6cf', dark: '#6b6f7c', accent: '#d9b37a', bg: 'linear-gradient(135deg,#2b2d35,#17181d)' },
  { id: 5, name: 'Obsidian Throne', subtitle: 'The Dragon Queen awaits', icon: '🐉', light: '#f0d7a8', dark: '#8a3434', accent: '#ff7a59', bg: 'linear-gradient(135deg,#3d1414,#1c0909)' },
];

export const ARENA_THEME: RegionDef = {
  id: 0, name: 'The Endless Arena', subtitle: 'Glory without end', icon: '🏟️', light: '#ead9bd', dark: '#9a6a43', accent: '#ffcf6b', bg: 'linear-gradient(135deg,#3a2614,#1d130a)',
};

const ai = (depth: number, blunder: number, noise = 30, quiesce = false) => ({ depth, blunder, noise, quiesce });

export const STAGES: StageDef[] = [
  // ── Region 1: Pawn Meadows ─────────────────────────────────────────
  { id: '1-1', region: 1, name: 'First Steps', flavor: 'A few farmhands blocking the road. Show them how a pawn marches.',
    w: 5, h: 5, deployRows: 1, layout: ['.ppp.'], ai: ai(1, 0.5, 80), reward: 12, lootMult: 1, maxTurns: 25 },
  { id: '1-2', region: 1, name: 'Village Brawl', flavor: 'The tavern emptied out and everyone wants a fight.',
    w: 5, h: 5, deployRows: 1, layout: ['p.p.p', '.p.p.'], ai: ai(1, 0.35, 60), reward: 15, lootMult: 1, maxTurns: 25 },
  { id: '1-3', region: 1, name: 'The Lone Rider', flavor: 'A knight-errant leads the militia. Watch his L-shaped leaps!',
    w: 5, h: 5, deployRows: 1, layout: ['..n..', 'pp.pp'], ai: ai(1, 0.25, 50), reward: 18, lootMult: 1, maxTurns: 25 },
  { id: '1-4', region: 1, name: 'Hedge Maze', flavor: 'Old stones split the field. Use them as cover.',
    w: 5, h: 5, deployRows: 2, layout: ['.pnp.', 'p...p', '.#.#.'], ai: ai(2, 0.25, 50), reward: 22, lootMult: 1, maxTurns: 30 },
  { id: '1-B', region: 1, name: 'The Iron Golem', flavor: 'An ancient guardian of the meadows stirs. It is slow — but it crushes what it steps on.',
    w: 6, h: 6, deployRows: 2, layout: ['p....p', '......', '.p..p.'], boss: { kind: 'golem', x: 2, y: 0 },
    ai: ai(2, 0.2, 40), reward: 60, lootMult: 1, maxTurns: 40, isBoss: true },

  // ── Region 2: Whispering Woods ─────────────────────────────────────
  { id: '2-1', region: 2, name: 'Forest Ambush', flavor: 'Hoofbeats among the trees.',
    w: 6, h: 6, deployRows: 2, layout: ['.n..n.', 'pp..pp'], ai: ai(2, 0.2, 40), reward: 30, lootMult: 2, maxTurns: 35 },
  { id: '2-2', region: 2, name: 'Thicket', flavor: 'Thorny bushes block the straight paths.',
    w: 6, h: 6, deployRows: 2, layout: ['n.pp.n', '.p..p.', '..#...', '...#..'], ai: ai(2, 0.15, 40), reward: 35, lootMult: 2, maxTurns: 35 },
  { id: '2-3', region: 2, name: "Bishop's Envoy", flavor: 'A cathedral envoy travels with an escort.',
    w: 6, h: 6, deployRows: 2, layout: ['.bnnb.', 'pppppp'], ai: ai(2, 0.1, 35), reward: 40, lootMult: 2, maxTurns: 35 },
  { id: '2-4', region: 2, name: 'Wolf Pack', flavor: 'Four riders hunt as one.',
    w: 6, h: 6, deployRows: 2, layout: ['nn..nn', 'p.pp.p', '......', '..##..'], ai: ai(2, 0.08, 30), reward: 45, lootMult: 2, maxTurns: 35 },
  { id: '2-B', region: 2, name: 'The Shadow Steed', flavor: 'A nightmare horse the size of a cottage. Where it lands, nothing stands.',
    w: 7, h: 7, deployRows: 2, layout: ['n.....n', '.......', 'p.p.p.p'], boss: { kind: 'steed', x: 2, y: 0 },
    ai: ai(2, 0.1, 30), reward: 150, lootMult: 2, maxTurns: 40, isBoss: true },

  // ── Region 3: Cathedral of Ash ─────────────────────────────────────
  { id: '3-1', region: 3, name: 'Acolytes', flavor: 'Robed figures guard the cathedral steps.',
    w: 7, h: 7, deployRows: 2, layout: ['..b.b..', 'ppppppp'], ai: ai(2, 0.08, 30, true), reward: 60, lootMult: 3, maxTurns: 40 },
  { id: '3-2', region: 3, name: 'Stained Glass', flavor: 'Columns of light — and columns of stone.',
    w: 7, h: 7, deployRows: 2, layout: ['b.n.n.b', '.pp.pp.', '.......', '..#.#..'], ai: ai(3, 0.1, 40), reward: 70, lootMult: 3, maxTurns: 40 },
  { id: '3-3', region: 3, name: 'Confessional', flavor: 'The wardens of the cathedral never leave their posts.',
    w: 7, h: 7, deployRows: 2, layout: ['.b.w.b.', 'ppnpnpp'], ai: ai(3, 0.06, 30), reward: 80, lootMult: 3, maxTurns: 40 },
  { id: '3-4', region: 3, name: 'The Choir', flavor: 'Towers flank the altar.',
    w: 7, h: 7, deployRows: 2, layout: ['r.b.b.r', 'ppppppp'], ai: ai(3, 0.05, 25, true), reward: 90, lootMult: 3, maxTurns: 40 },
  { id: '3-B', region: 3, name: 'Archbishop Malakar', flavor: 'The Ash Prophet raises acolytes from the cinders. End his sermon quickly.',
    w: 7, h: 7, deployRows: 2, layout: ['b.....b', '.......', 'ppp.ppp'], boss: { kind: 'malakar', x: 2, y: 0 },
    ai: ai(3, 0.05, 25), reward: 300, lootMult: 3, maxTurns: 45, isBoss: true },

  // ── Region 4: Stone Bastion ────────────────────────────────────────
  { id: '4-1', region: 4, name: 'Outer Wall', flavor: 'Battlements and broken stones.',
    w: 8, h: 8, deployRows: 2, layout: ['r..ww..r', 'pppppppp', '........', '#..##..#'], ai: ai(3, 0.05, 25, true), reward: 110, lootMult: 4, maxTurns: 50 },
  { id: '4-2', region: 4, name: 'Gatehouse', flavor: 'A classic garrison. They know the old rules well.',
    w: 8, h: 8, deployRows: 2, layout: ['rnb..bnr', 'pppppppp'], ai: ai(3, 0.04, 20, true), reward: 125, lootMult: 4, maxTurns: 50 },
  { id: '4-3', region: 4, name: 'Barracks', flavor: 'Wardens drill the recruits day and night.',
    w: 8, h: 8, deployRows: 2, layout: ['rnbwwbnr', 'pppppppp', '........', '..#..#..'], ai: ai(3, 0.03, 20, true), reward: 140, lootMult: 4, maxTurns: 50 },
  { id: '4-4', region: 4, name: 'The Keep', flavor: 'The commander herself takes the field.',
    w: 8, h: 8, deployRows: 2, layout: ['rnbqwbnr', 'pppppppp'], ai: ai(3, 0.03, 15, true), reward: 155, lootMult: 4, maxTurns: 50 },
  { id: '4-B', region: 4, name: 'The Siege Colossus', flavor: 'A walking fortress. When it raises its fists, get away from it!',
    w: 8, h: 8, deployRows: 2, layout: ['rn....nr', '........', '.pp..pp.'], boss: { kind: 'colossus', x: 3, y: 0 },
    ai: ai(3, 0.03, 15), reward: 500, lootMult: 4, maxTurns: 50, isBoss: true },

  // ── Region 5: Obsidian Throne ──────────────────────────────────────
  { id: '5-1', region: 5, name: 'Ashen Steps', flavor: 'Twin queens guard the stairway.',
    w: 8, h: 8, deployRows: 3, layout: ['rnbqqbnr', 'pppppppp'], ai: ai(3, 0.02, 15, true), reward: 190, lootMult: 6, maxTurns: 60 },
  { id: '5-2', region: 5, name: 'Hall of Mirrors', flavor: 'Cardinals glide between obsidian pillars.',
    w: 8, h: 8, deployRows: 3, layout: ['r.cqqc.r', 'pppppppp', '........', '#......#'], ai: ai(3, 0.02, 10, true), reward: 210, lootMult: 6, maxTurns: 60 },
  { id: '5-3', region: 5, name: 'Royal Guard', flavor: 'The marshals of the throne room.',
    w: 8, h: 8, deployRows: 3, layout: ['rmbqqbmr', 'pppppppp', '..w..w..'], ai: ai(3, 0.01, 10, true), reward: 230, lootMult: 6, maxTurns: 60 },
  { id: '5-4', region: 5, name: "Throne's Shadow", flavor: 'An Amazon leads the last line of defense.',
    w: 8, h: 8, deployRows: 3, layout: ['rmcaqcmr', 'pppppppp', 'nn....nn'], ai: ai(3, 0, 10, true), reward: 250, lootMult: 6, maxTurns: 60 },
  { id: '5-B', region: 5, name: 'Vyrmathra, the Dragon Queen', flavor: 'The final throne. Scatter when she inhales — her fire pours down the board.',
    w: 8, h: 8, deployRows: 3, layout: ['qm....mq', '........', 'pppppppp'], boss: { kind: 'dragon', x: 3, y: 0 },
    ai: ai(3, 0, 10), reward: 1000, lootMult: 6, maxTurns: 60, isBoss: true },
];

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const ARENA_UNLOCK = '2-B';

export type StageProgress = Record<string, { stars: number; clears: number }>;

export const isCleared = (p: StageProgress, id: string) => (p[id]?.stars ?? 0) > 0;

export function isStageUnlocked(p: StageProgress, stage: StageDef): boolean {
  const i = STAGES.findIndex((s) => s.id === stage.id);
  return i <= 0 || isCleared(p, STAGES[i - 1].id);
}

export function isPieceUnlocked(p: StageProgress, type: PieceType): boolean {
  const req = PIECES[type].unlockedBy;
  return !req || isCleared(p, req);
}

export function unlocksOf(stageId: string): PieceType[] {
  return PIECE_ORDER.filter((t) => PIECES[t].unlockedBy === stageId);
}

/* ------------------------------------------------------------------ */
/* The Endless Arena: deterministic procedurally generated stages      */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARENA_NAMES = ['Gladiators', 'Sand & Steel', 'Crowd Pleasers', 'Blood Moon Bout', 'The Gauntlet', 'Champions', 'Iron Circle', 'Last Stand'];

export function arenaStage(level: number): StageDef {
  const rnd = mulberry32(level * 9973 + 17);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const size = Math.min(8, 6 + Math.floor(level / 4));
  const isBoss = level % 5 === 0;
  const rows = Array.from({ length: 3 }, () => Array<string>(size).fill('.'));

  const pool: string[] = ['n', 'b'];
  if (level >= 3) pool.push('w', 'r');
  if (level >= 6) pool.push('q');
  if (level >= 10) pool.push('c', 'm');
  if (level >= 15) pool.push('a');
  const letterValue: Record<string, number> = { p: 1, n: 3, b: 3, w: 3, r: 5, q: 9, c: 7, m: 8, a: 12 };

  let boss: StageDef['boss'];
  const bx = Math.floor(size / 2) - 1;
  if (isBoss) {
    const kind = BOSS_ORDER[(level / 5 - 1) % BOSS_ORDER.length];
    boss = { kind, x: bx, y: 0, hp: BOSSES[kind].hp + Math.floor(level / 10) * 2 };
  }

  // Pawn line, then officers in the back rank with the remaining budget.
  const pawnRow = isBoss ? 2 : 1;
  const pawns = Math.min(size, 2 + Math.floor(level / 2));
  const cols = [...Array(size).keys()].sort(() => rnd() - 0.5);
  cols.slice(0, pawns).forEach((x) => (rows[pawnRow][x] = 'p'));
  let budget = 3 + level * 2.5;
  const back = [...Array(size).keys()].filter((x) => !(isBoss && (x === bx || x === bx + 1)));
  back.sort(() => rnd() - 0.5);
  for (const x of back) {
    const options = pool.filter((l) => letterValue[l] <= budget);
    if (!options.length) break;
    const l = pick(options);
    rows[0][x] = l;
    budget -= letterValue[l];
  }
  const layout = rows.map((r) => r.join(''));
  // Random rocks in the no-man's land.
  if (rnd() < 0.6) {
    const r = Array<string>(size).fill('.');
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) r[Math.floor(rnd() * size)] = '#';
    while (layout.length < 3) layout.push('.'.repeat(size));
    layout.push(r.join(''));
  }

  return {
    id: `arena-${level}`, region: 0, isArena: true, isBoss,
    name: isBoss ? `Arena ${level}: ${BOSSES[boss!.kind].name}` : `Arena ${level}: ${pick(ARENA_NAMES)}`,
    flavor: isBoss ? 'A champion beast is released into the arena!' : 'The crowd roars. Fresh challengers step onto the sand.',
    w: size, h: size, deployRows: size >= 8 ? 3 : 2, layout, boss,
    ai: ai(level < 2 ? 1 : level < 6 ? 2 : 3, Math.max(0, 0.25 - level * 0.03), Math.max(5, 60 - level * 6), level >= 8),
    reward: 40 + level * 20, lootMult: 1 + Math.floor(level / 3), maxTurns: 40 + size * 2,
  };
}
