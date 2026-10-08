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

/** Extra command points a ranked piece costs (+1 every two ranks). */
export const rankCommand = (rank: number) => Math.floor(rank / 2);

export const commandCost = (type: PieceType, rank = 0) => PIECES[type].command + rankCommand(rank);

export interface Perk {
  name: string;
  icon: string;
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

const heavy: Perk = { name: 'Heavy blow', icon: '💥', bossDmg: 1 };
const iron: Perk = { name: 'Iron will', icon: '🛡️', shield: true };
const vault: Perk = { name: 'Vault', icon: '🦘', hop: true };

/** Perk unlocked at Sergeant, Lieutenant, Major, Colonel, General (index 0–4). */
export const PERKS: Record<PieceType, Perk[]> = {
  pawn: [
    { name: 'Side step', icon: '↔', quiet: [[1, 0], [-1, 0]] },
    { name: 'Forced march', icon: '⏫', pawnDouble: true },
    { name: 'Spear thrust', icon: '🗡️', pawnCapFwd: true },
    { name: 'Swift crown', icon: '👑', promoEarly: true },
    { name: 'Amazon crown', icon: '💎', promoAmazon: true },
  ],
  knight: [
    { name: 'Long stride', icon: '⇈', leaps: DABBABA },
    heavy,
    { name: 'Camel leap', icon: '🐪', leaps: CAMEL },
    iron,
    { name: 'Knightrider', icon: '🌀', slides: KNIGHT },
  ],
  bishop: [
    { name: 'Flank step', icon: '✚', leaps: ORTH },
    heavy,
    vault,
    iron,
    { name: 'Cardinal', icon: '♞', leaps: KNIGHT },
  ],
  warden: [
    { name: 'Long stride', icon: '⇈', leaps: DABBABA },
    heavy,
    { name: 'Diagonal leap', icon: '⤢', leaps: ALFIL },
    iron,
    { name: 'Rider', icon: '♞', leaps: KNIGHT },
  ],
  rook: [
    { name: 'Corner step', icon: '✕', leaps: DIAG },
    heavy,
    vault,
    iron,
    { name: 'Marshal', icon: '♞', leaps: KNIGHT },
  ],
  queen: [heavy, vault, iron, { ...heavy, name: 'Crushing blow' }, { name: 'Amazon', icon: '♞', leaps: KNIGHT }],
  cardinal: [{ name: 'Flank step', icon: '✚', leaps: ORTH }, heavy, vault, iron, { name: 'Camel leap', icon: '🐪', leaps: CAMEL }],
  marshal: [{ name: 'Corner step', icon: '✕', leaps: DIAG }, heavy, vault, iron, { name: 'Camel leap', icon: '🐪', leaps: CAMEL }],
  amazon: [heavy, iron, vault, { ...heavy, name: 'Crushing blow' }, { name: 'Camel leap', icon: '🐪', leaps: CAMEL }],
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
