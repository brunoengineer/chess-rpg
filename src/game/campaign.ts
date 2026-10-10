import { BOSS_ORDER, BOSSES } from './bosses';
import { PIECES, PIECE_ORDER } from './pieces';
import type { AiParams, BossKind, PieceType, StageDef } from './types';

export interface RegionDef {
  id: number;
  name: string;
  icon: string;
  light: string;
  dark: string;
  accent: string;
  bg: string;
}

export const REGIONS: RegionDef[] = [
  { id: 1, name: 'Pawn Meadows', icon: '🌾', light: '#efe8c9', dark: '#86a75f', accent: '#b6d77a', bg: 'linear-gradient(135deg,#2f4a24,#1b2b17)' },
  { id: 2, name: 'Whispering Woods', icon: '🌲', light: '#e3d9b8', dark: '#4f7552', accent: '#7fc48a', bg: 'linear-gradient(135deg,#183326,#0d1d16)' },
  { id: 3, name: 'Cathedral of Ash', icon: '⛪', light: '#ddd5ea', dark: '#6e5a92', accent: '#c59bff', bg: 'linear-gradient(135deg,#2c2142,#171127)' },
  { id: 4, name: 'Stone Bastion', icon: '🏯', light: '#d9d6cf', dark: '#6b6f7c', accent: '#d9b37a', bg: 'linear-gradient(135deg,#2b2d35,#17181d)' },
  { id: 5, name: 'Obsidian Throne', icon: '🐉', light: '#f0d7a8', dark: '#8a3434', accent: '#ff7a59', bg: 'linear-gradient(135deg,#3d1414,#1c0909)' },
];

export const ARENA_THEME: RegionDef = {
  id: 0, name: 'The Endless Arena', icon: '🏟️', light: '#ead9bd', dark: '#9a6a43', accent: '#ffcf6b', bg: 'linear-gradient(135deg,#3a2614,#1d130a)',
};

/** Main stages per world (the last one is the boss). */
export const MAIN_STAGES = 10;
/** Stars (out of 30) needed for the first bonus stage; the second needs all 30. */
export const EXTRA1_STARS = 27;
export const EXTRA2_STARS = MAIN_STAGES * 3;

const ai = (depth: number, blunder: number, noise: number, quiesce = false): AiParams => ({
  depth, blunder: Math.max(0, +blunder.toFixed(3)), noise: Math.max(5, Math.round(noise)), quiesce,
});
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Enemy skill per world; t goes 0 → 1 across the 10 main stages (bonus stages go beyond 1). */
const WORLD_AI: Record<number, (t: number) => AiParams> = {
  1: (t) => ai(t < 0.35 ? 1 : 2, lerp(0.5, 0.15, t), lerp(80, 40, t)),
  2: (t) => ai(2, lerp(0.22, 0.1, t), lerp(45, 30, t)),
  3: (t) => ai(2, lerp(0.18, 0.1, t), lerp(40, 30, t), t > 0.6),
  4: (t) => ai(2, lerp(0.14, 0.08, t), lerp(35, 25, t), t > 0.3),
  5: (t) => ai(2, lerp(0.1, 0.06, t), lerp(30, 20, t), true),
};

/** [first stage reward, step per stage, boss, bonus 1, bonus 2] and loot multiplier. */
const WORLD_ECON: Record<number, { reward: [number, number, number, number, number]; loot: number }> = {
  1: { reward: [10, 2, 60, 80, 120], loot: 1 },
  2: { reward: [28, 3, 150, 200, 300], loot: 2 },
  3: { reward: [55, 5, 300, 400, 550], loot: 3 },
  4: { reward: [105, 8, 500, 650, 900], loot: 4 },
  5: { reward: [180, 10, 1000, 1300, 1800], loot: 6 },
};

const TURNS: Record<number, number> = { 5: 25, 6: 35, 7: 40, 8: 50 };

type Spec = [name: string, size: number, layout: string[], opts?: { dr?: number; boss?: BossKind; hp?: number }];

/**
 * Each world: 9 stages, the boss (10th), then bonus stages X1 and X2.
 * Layout rows go from the top: p n b w r q c m a = enemy pieces, # = rock, . = empty.
 */
const WORLDS: Record<number, Spec[]> = {
  1: [
    ['First Steps', 5, ['.ppp.'], { dr: 1 }],
    ['Village Brawl', 5, ['p.p.p', '.p.p.'], { dr: 1 }],
    ['Pitchforks', 5, ['ppppp'], { dr: 1 }],
    ['The Lone Rider', 5, ['..n..', 'pp.pp'], { dr: 1 }],
    ['Hedge Maze', 5, ['.pnp.', 'p...p', '.#.#.']],
    ['Twin Riders', 5, ['n...n', '.ppp.']],
    ['Old Mill', 6, ['.pnnp.', 'p....p', '..##..']],
    ['Scarecrows', 6, ['.n..n.', 'pp..pp']],
    ['Bandit Camp', 6, ['.n.b..', 'pp.ppp']],
    ['The Iron Golem', 6, ['p....p', '......', '.p..p.'], { boss: 'golem' }],
    ['Harvest Feud', 6, ['.nb.n.', 'pp..pp']],
    ['Golem Awakened', 6, ['.....n', '......', 'p....p'], { boss: 'golem', hp: 4 }],
  ],
  2: [
    ['Forest Ambush', 6, ['.n..n.', 'pp..pp']],
    ['Thicket', 6, ['n.pp.n', '.p..p.', '..#...', '...#..']],
    ['Fox Den', 6, ['n....n', 'pppppp']],
    ["Bishop's Envoy", 6, ['.b.nb.', 'pp..pp']],
    ['Mossy Stones', 6, ['b.n..b', 'pp..pp', '#....#']],
    ['Wolf Pack', 6, ['n.n..n', 'p.pp.p', '......', '..##..']],
    ['Night Patrol', 7, ['.n.b.n.', 'ppppppp']],
    ["Hunters' Lodge", 7, ['..bwb.n', '.ppppp.', '...#...']],
    ['Ranger Hold', 7, ['nb.w.b.', 'ppppppp', '#.....#']],
    ['The Shadow Steed', 7, ['n.....n', '.......', 'p.p.p.p'], { boss: 'steed' }],
    ['Wild Hunt', 7, ['nnbwb.n', 'ppppppp']],
    ['Steed of Nightmares', 7, ['n.....n', '.......', 'ppppppp'], { boss: 'steed', hp: 7 }],
  ],
  3: [
    ['Acolytes', 7, ['..b.b..', 'ppppppp']],
    ['Candlelight', 7, ['.b.n.b.', 'pp.p.pp', '...#...']],
    ['Stained Glass', 7, ['b.n.n.b', '.pp.pp.', '.......', '..#.#..']],
    ['Confessional', 7, ['.b.w.b.', 'ppnpnpp']],
    ['Bell Tower', 7, ['r.....r', 'ppbpbpp']],
    ['The Crypt', 7, ['.bw.wb.', 'p.ppp.p', '#.....#']],
    ['Cloister', 7, ['nb.r.bn', 'ppppppp']],
    ['The Choir', 7, ['r.b.b.r', 'ppppppp']],
    ['Inquisition', 7, ['r.nwn.r', 'ppppppp']],
    ['Archbishop Malakar', 7, ['b.....b', '.......', 'ppp.ppp'], { boss: 'malakar' }],
    ['High Mass', 7, ['r.bwb.r', 'ppppppp', '...n...']],
    ['Malakar Ascended', 7, ['r.....r', '.......', 'ppppppp'], { boss: 'malakar', hp: 9 }],
  ],
  4: [
    ['Outer Wall', 8, ['r......r', 'pppppppp', '........', '#..##..#']],
    ['Moat Bridge', 8, ['.n.r..n.', 'pppppppp', '........', '###..###']],
    ['Gatehouse', 8, ['.nb..bn.', 'pppppppp']],
    ['Armory', 8, ['r..ww..r', '.pppppp.']],
    ['Barracks', 8, ['r.bw...r', 'pppppppp', '........', '..#..#..']],
    ['Siege Engines', 8, ['r..q...r', '.pppppp.']],
    ['The Keep', 8, ['...qwb.r', 'pppppppp']],
    ['Battlements', 8, ['.n.qw.nr', '.pppppp.']],
    ['Iron Guard', 8, ['r..q.b.r', '.pppppp.']],
    ['The Siege Colossus', 8, ['rn....nr', '........', '.pp..pp.'], { boss: 'colossus' }],
    ['Last Bastion', 8, ['r..qw..r', 'pppppppp']],
    ['Colossus Unchained', 8, ['r......r', '........', 'pppppppp'], { boss: 'colossus', hp: 11 }],
  ],
  5: [
    ['Ashen Steps', 8, ['...q...r', '.pppppp.']],
    ['Ember Gate', 8, ['...c...r', 'pppppppp', '........', '#......#']],
    ['Hall of Mirrors', 8, ['r.c..c.r', 'pppppppp']],
    ['Obsidian Guard', 8, ['.m.q.b..', 'pppppppp']],
    ['Royal Guard', 8, ['...qw..r', 'pppppppp']],
    ['Lava Fields', 8, ['..cq..b.', 'pppppppp', '........', '.#....#.']],
    ['Dragonkin', 8, ['...a...r', 'pppppppp']],
    ["Throne's Shadow", 8, ['.m.a....', 'pppppppp']],
    ['The Last Wall', 8, ['...q...a', 'pppppppp']],
    ['Vyrmathra, the Dragon Queen', 8, ['.n....n.', '........', '.pppppp.'], { boss: 'dragon', hp: 10 }],
    ['Court of Ash', 8, ['a..q.c..', 'pppppppp']],
    ['Eternal Flame', 8, ['q......r', '........', '.pppppp.'], { boss: 'dragon', hp: 13 }],
  ],
};

/** World 1–2 Recruits, then one rank per world (World 5: Majors); bonus stages one rank higher. */
const enemyRankFor = (region: number, _i: number, extra?: number) =>
  Math.min(5, Math.max(0, region - 2) + (extra ? 1 : 0));

function buildWorld(region: number, specs: Spec[]): StageDef[] {
  const econ = WORLD_ECON[region];
  const [base, step, bossReward, x1, x2] = econ.reward;
  return specs.map(([name, size, layout, opts = {}], i) => {
    const n = i + 1;
    const extra = n > MAIN_STAGES ? ((n - MAIN_STAGES) as 1 | 2) : undefined;
    const isBoss = !!opts.boss;
    const t = extra ? 1 + 0.15 * extra : i / (MAIN_STAGES - 1);
    return {
      id: extra ? `${region}-X${extra}` : `${region}-${n}`,
      region,
      name,
      w: size,
      h: size,
      deployRows: opts.dr ?? (region === 5 ? 3 : 2),
      layout,
      boss: opts.boss ? { kind: opts.boss, x: Math.floor(size / 2) - 1, y: 0, hp: opts.hp } : undefined,
      ai: WORLD_AI[region](t),
      reward: extra === 1 ? x1 : extra === 2 ? x2 : n === MAIN_STAGES ? bossReward : base + step * i,
      lootMult: econ.loot,
      maxTurns: TURNS[size] + (region === 5 ? 10 : 0) + (isBoss || extra ? 10 : 0),
      isBoss,
      extra,
      // Enemies gain ranks as the campaign goes on (bonus stages one rank higher).
      enemyRank: enemyRankFor(region, i, extra),
    };
  });
}

export const STAGES: StageDef[] = REGIONS.flatMap((r) => buildWorld(r.id, WORLDS[r.id]));
const MAIN = STAGES.filter((s) => !s.extra);

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const ARENA_UNLOCK = '2-10';

export type StageProgress = Record<string, { stars: number; clears: number }>;

export const isCleared = (p: StageProgress, id: string) => (p[id]?.stars ?? 0) > 0;

/** Stars earned in a world's 10 main stages. */
export function mainStars(p: StageProgress, region: number): number {
  return MAIN.filter((s) => s.region === region).reduce((a, s) => a + (p[s.id]?.stars ?? 0), 0);
}

export const extraStarsNeeded = (extra: 1 | 2) => (extra === 1 ? EXTRA1_STARS : EXTRA2_STARS);

/* ---------------- Hard mode ---------------- */

/** Hard mode opens for a world once its boss is beaten. */
export const BOSS_OF = (region: number) => `${region}-${MAIN_STAGES}`;
export const isHardOpen = (p: StageProgress, region: number) => isCleared(p, BOSS_OF(region));

/** Hard variant of a main stage: enemies +2 ranks, sharper AI, double reward and loot. */
export function hardStage(stage: StageDef): StageDef {
  return {
    ...stage,
    id: `${stage.id}H`,
    hard: true,
    enemyRank: Math.min(5, (stage.enemyRank ?? 0) + 2),
    // Hard mode is the only place the AI searches 3 moves deep.
    ai: { ...stage.ai, depth: stage.region >= 2 ? 3 : 2, blunder: stage.ai.blunder / 2, noise: Math.max(5, stage.ai.noise / 2), quiesce: true },
    reward: stage.reward * 2,
    lootMult: stage.lootMult * 2,
  };
}

export const baseId = (id: string) => id.replace(/H$/, '');

/** Stars earned in a world's 10 hard stages. */
export function hardStars(p: StageProgress, region: number): number {
  return MAIN.filter((s) => s.region === region).reduce((a, s) => a + (p[`${s.id}H`]?.stars ?? 0), 0);
}

export function isStageUnlocked(p: StageProgress, stage: StageDef): boolean {
  if (stage.extra) return mainStars(p, stage.region) >= extraStarsNeeded(stage.extra);
  const i = MAIN.findIndex((s) => s.id === baseId(stage.id));
  if (stage.hard) {
    if (!isHardOpen(p, stage.region)) return false;
    const prev = MAIN[i - 1];
    return !prev || prev.region !== stage.region || isCleared(p, `${prev.id}H`);
  }
  return i <= 0 || isCleared(p, MAIN[i - 1].id);
}

/** The stage after this one in the same world (and same mode), if any. */
export function nextStage(stage: StageDef): StageDef | undefined {
  if (stage.extra || stage.isArena) return undefined;
  const i = MAIN.findIndex((s) => s.id === baseId(stage.id));
  const next = MAIN[i + 1];
  if (next?.region !== stage.region) return undefined;
  return stage.hard ? hardStage(next) : next;
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
    layout.push(r.join(''));
  }

  return {
    id: `arena-${level}`, region: 0, isArena: true, isBoss,
    name: isBoss ? `Arena ${level}: ${BOSSES[boss!.kind].name}` : `Arena ${level}: ${pick(ARENA_NAMES)}`,
    w: size, h: size, deployRows: size >= 8 ? 3 : 2, layout, boss,
    ai: ai(level < 2 ? 1 : level < 6 ? 2 : 3, 0.25 - level * 0.03, 60 - level * 6, level >= 8),
    reward: 40 + level * 20, lootMult: 1 + Math.floor(level / 3), maxTurns: 40 + size * 2,
    enemyRank: Math.min(5, Math.floor(level / 5)),
  };
}
