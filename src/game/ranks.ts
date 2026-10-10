import { DIAG, KNIGHT, ORTH, PIECES } from './pieces';
import type { PieceType } from './types';

export const MAX_LEVEL = 50;
export const RANKS = ['Recruit', 'Sergeant', 'Lieutenant', 'Major', 'Colonel', 'General'];

/** XP needed to go from level `l - 1` to `l`. */
export const levelCost = (l: number) => 5 + 3 * l;

export function levelInfo(xp: number): { level: number; rank: number; into: number; need: number } {
  let level = 0, left = xp;
  while (level < MAX_LEVEL && left >= levelCost(level + 1)) {
    left -= levelCost(level + 1);
    level++;
  }
  return { level, rank: rankOf(level), into: left, need: level >= MAX_LEVEL ? 0 : levelCost(level + 1) };
}

export const rankOf = (level: number) => Math.min(5, Math.floor(level / 10));

/** Extra command a ranked piece costs: proportional to its base cost (pawns never pay extra, a General Queen +5). */
export const rankCommand = (type: PieceType, rank: number) => Math.floor((PIECES[type].command * rank) / 8);

export const commandCost = (type: PieceType, rank = 0) => PIECES[type].command + rankCommand(type, rank);

export interface Perk {
  name: string;
  icon: string;
  /** One plain line for players (shown in the Barracks). */
  desc: string;
  /** Extra jumps (move or capture). */
  leaps?: number[][];
  /** Extra sliding directions. */
  slides?: number[][];
  /** Extra non-capturing steps. */
  quiet?: number[][];
  /** Sliders may jump over one piece and keep going. */
  hop?: boolean;
  bossDmg?: number;
  /** Survives the first capture each battle. */
  shield?: boolean;
  pawnDouble?: boolean;
  pawnCapFwd?: boolean;
  promoEarly?: boolean;
  promoAmazon?: boolean;
}

const DABBABA = ORTH.map(([x, y]) => [x * 2, y * 2]);
const ALFIL = DIAG.map(([x, y]) => [x * 2, y * 2]);
const CAMEL = [[1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1]];

const heavy: Perk = { name: 'Heavy blow', icon: '💥', desc: '+1 damage when it hits a boss.', bossDmg: 1 };
const crushing: Perk = { ...heavy, name: 'Crushing blow', desc: 'Another +1 damage when it hits a boss.' };
const iron: Perk = { name: 'Iron will', icon: '🛡️', desc: 'Survives the first capture each battle: the attacker bounces back.', shield: true };
const vault: Perk = { name: 'Vault', icon: '🦘', desc: 'When sliding, can jump over one piece and keep going.', hop: true };
const knightLeap = (name: string): Perk => ({ name, icon: '♞', desc: 'Can also jump like a Knight (L-shape).', leaps: KNIGHT });
const camel: Perk = { name: 'Camel leap', icon: '🐪', desc: 'Can also make a long L-jump: 3 squares one way, 1 the other.', leaps: CAMEL };
const flankStep: Perk = { name: 'Flank step', icon: '✚', desc: 'Can also step 1 square straight (no longer stuck on one color).', leaps: ORTH };
const cornerStep: Perk = { name: 'Corner step', icon: '✕', desc: 'Can also step 1 square diagonally.', leaps: DIAG };
const longStride: Perk = { name: 'Long stride', icon: '⇈', desc: 'Can also jump exactly 2 squares in a straight line.', leaps: DABBABA };

/** Perk unlocked at Sergeant, Lieutenant, Major, Colonel, General (index 0–4). */
export const PERKS: Record<PieceType, Perk[]> = {
  pawn: [
    { name: 'Side step', icon: '↔', desc: 'Can also step 1 square left or right (without capturing).', quiet: [[1, 0], [-1, 0]] },
    { name: 'Forced march', icon: '⏫', desc: 'Can always move 2 squares forward, not just on its first move.', pawnDouble: true },
    { name: 'Spear thrust', icon: '🗡️', desc: 'Can also capture the piece straight in front of it.', pawnCapFwd: true },
    { name: 'Swift crown', icon: '👑', desc: 'Promotes one row earlier (the second-to-last row).', promoEarly: true },
    { name: 'Amazon crown', icon: '💎', desc: 'Promotes to an Amazon (Queen + Knight) instead of a Queen.', promoAmazon: true },
  ],
  knight: [longStride, heavy, camel, iron, { name: 'Knightrider', icon: '🌀', desc: 'Can repeat its L-jump in the same direction, like a sliding piece.', slides: KNIGHT }],
  bishop: [flankStep, heavy, vault, iron, knightLeap('Cardinal')],
  warden: [
    longStride,
    heavy,
    { name: 'Diagonal leap', icon: '⤢', desc: 'Can also jump exactly 2 squares diagonally.', leaps: ALFIL },
    iron,
    knightLeap('Rider'),
  ],
  rook: [cornerStep, heavy, vault, iron, knightLeap('Marshal')],
  queen: [heavy, vault, iron, crushing, knightLeap('Amazon')],
  cardinal: [flankStep, heavy, vault, iron, camel],
  marshal: [cornerStep, heavy, vault, iron, camel],
  amazon: [heavy, iron, vault, crushing, camel],
};

export interface Profile {
  leaps: number[][];
  slides: number[][];
  quiet: number[][];
  hop: boolean;
  bossDmg: number;
  shield: boolean;
  pawnDouble: boolean;
  pawnCapFwd: boolean;
  promoEarly: boolean;
  promoAmazon: boolean;
}

const cache = new Map<string, Profile>();

/** Movement and abilities of a piece type at a given rank (base piece + unlocked perks). */
export function profile(type: PieceType, rank = 0): Profile {
  const key = `${type}:${rank}`;
  let p = cache.get(key);
  if (p) return p;
  const def = PIECES[type];
  p = {
    leaps: [...def.leaps], slides: [...def.slides], quiet: [], hop: false, bossDmg: 0, shield: false,
    pawnDouble: false, pawnCapFwd: false, promoEarly: false, promoAmazon: false,
  };
  for (const perk of PERKS[type].slice(0, rank)) {
    if (perk.leaps) p.leaps.push(...perk.leaps);
    if (perk.slides) p.slides.push(...perk.slides);
    if (perk.quiet) p.quiet.push(...perk.quiet);
    if (perk.hop) p.hop = true;
    if (perk.bossDmg) p.bossDmg += perk.bossDmg;
    if (perk.shield) p.shield = true;
    if (perk.pawnDouble) p.pawnDouble = true;
    if (perk.pawnCapFwd) p.pawnCapFwd = true;
    if (perk.promoEarly) p.promoEarly = true;
    if (perk.promoAmazon) p.promoAmazon = true;
  }
  // Remove duplicate offsets (e.g. two perks granting the same jump).
  const uniq = (xs: number[][]) => [...new Map(xs.map((v) => [v.join(','), v])).values()];
  p.leaps = uniq(p.leaps);
  p.slides = uniq(p.slides);
  cache.set(key, p);
  return p;
}
