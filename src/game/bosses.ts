import { DIAG, KNIGHT, ORTH } from './pieces';
import type { BossKind, PieceType } from './types';

export interface BossDef {
  kind: BossKind;
  name: string;
  title: string;
  emoji: string;
  hp: number;
  /** Footprint jumps (the whole 2x2 body moves by these offsets). */
  leaps: number[][];
  /** Moves at most once every N enemy turns. */
  moveEvery: number;
  summon?: { every: number; type: PieceType };
  telegraph?: { every: number; kind: 'quake' | 'breath' };
  moveText: string;
  aura: string;
}

const scale = (dirs: number[][], n: number) => dirs.map(([x, y]) => [x * n, y * n]);

export const BOSSES: Record<BossKind, BossDef> = {
  golem: {
    kind: 'golem', name: 'Iron Golem', title: 'Guardian of the Meadows', emoji: '🗿', hp: 3,
    leaps: ORTH, moveEvery: 2,
    moveText: 'Lumbers one square orthogonally every other turn, crushing anything beneath it.',
    aura: '#8fb3c9',
  },
  steed: {
    kind: 'steed', name: 'Shadow Steed', title: 'Nightmare of the Woods', emoji: '🐎', hp: 5,
    leaps: KNIGHT, moveEvery: 2,
    moveText: 'Leaps in an L shape every other turn, trampling everything where it lands.',
    aura: '#7b5cff',
  },
  malakar: {
    kind: 'malakar', name: 'Archbishop Malakar', title: 'The Ash Prophet', emoji: '🧙', hp: 7,
    leaps: [...DIAG, ...scale(DIAG, 2)], moveEvery: 1,
    summon: { every: 3, type: 'pawn' },
    moveText: 'Glides 1–2 squares diagonally. Raises an acolyte pawn every 3 turns.',
    aura: '#c45cff',
  },
  colossus: {
    kind: 'colossus', name: 'Siege Colossus', title: 'Walker of the Bastion', emoji: '🏰', hp: 9,
    leaps: [...ORTH, ...scale(ORTH, 2)], moveEvery: 2,
    telegraph: { every: 3, kind: 'quake' },
    moveText: 'Strides 1–2 squares in straight lines every other turn. Every 3 turns it raises its fists: next turn the ground around it QUAKES.',
    aura: '#d9a35b',
  },
  dragon: {
    kind: 'dragon', name: 'Vyrmathra', title: 'The Dragon Queen', emoji: '🐉', hp: 12,
    leaps: [...ORTH, ...DIAG, ...KNIGHT], moveEvery: 1,
    summon: { every: 5, type: 'knight' },
    telegraph: { every: 4, kind: 'breath' },
    moveText: 'Flies one square in any direction or leaps in an L. Every 4 turns she inhales: next turn FIRE pours down her columns. Calls a knight every 5 turns.',
    aura: '#ff5a3c',
  },
};

export const BOSS_ORDER: BossKind[] = ['golem', 'steed', 'malakar', 'colossus', 'dragon'];
