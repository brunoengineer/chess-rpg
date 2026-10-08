import type { PieceType } from './types';

export const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

export interface PieceDef {
  type: PieceType;
  name: string;
  /** Unicode chess glyph (text presentation). */
  glyph: string;
  /** Small secondary glyph shown on fairy pieces. */
  badge?: string;
  /** Material value: AI evaluation, loot and points. */
  value: number;
  /** Command points needed to deploy. */
  command: number;
  /** Permanent recruit price. */
  price: number;
  /** One-battle mercenary price. */
  mercPrice: number;
  slides: number[][];
  leaps: number[][];
  /** Stage that must be cleared to unlock it in the shop (none = always). */
  unlockedBy?: string;
  desc: string;
}

const T = '︎'; // force text (not emoji) presentation
const G = {
  king: '♚' + T,
  queen: '♛' + T,
  rook: '♜' + T,
  bishop: '♝' + T,
  knight: '♞' + T,
  pawn: '♟' + T,
};

export const PIECES: Record<PieceType, PieceDef> = {
  pawn: {
    type: 'pawn', name: 'Pawn', glyph: G.pawn, value: 1, command: 1, price: 15, mercPrice: 4,
    slides: [], leaps: [],
    desc: 'Marches forward one square (two on its first move on big boards), captures diagonally. Becomes a Queen for the rest of the battle on the last row.',
  },
  knight: {
    type: 'knight', name: 'Knight', glyph: G.knight, value: 3, command: 3, price: 70, mercPrice: 18,
    slides: [], leaps: KNIGHT, unlockedBy: '1-3',
    desc: 'Leaps in an L shape, jumping over anything in the way.',
  },
  bishop: {
    type: 'bishop', name: 'Bishop', glyph: G.bishop, value: 3, command: 3, price: 80, mercPrice: 20,
    slides: DIAG, leaps: [], unlockedBy: '1-B',
    desc: 'Slides any distance diagonally.',
  },
  warden: {
    type: 'warden', name: 'Warden', glyph: G.king, value: 3, command: 3, price: 90, mercPrice: 22,
    slides: [], leaps: [...ORTH, ...DIAG], unlockedBy: '2-2',
    desc: 'A veteran bodyguard. Steps one square in any direction. Not royal: losing it does not lose the game.',
  },
  rook: {
    type: 'rook', name: 'Rook', glyph: G.rook, value: 5, command: 5, price: 170, mercPrice: 42,
    slides: ORTH, leaps: [], unlockedBy: '2-B',
    desc: 'Slides any distance in straight lines. Heavy piece: deals 2 damage to bosses.',
  },
  cardinal: {
    type: 'cardinal', name: 'Cardinal', glyph: G.bishop, badge: G.knight, value: 7, command: 7, price: 650, mercPrice: 160,
    slides: DIAG, leaps: KNIGHT, unlockedBy: '4-2',
    desc: 'Bishop + Knight. Slides diagonally or leaps in an L. Deals 2 damage to bosses.',
  },
  marshal: {
    type: 'marshal', name: 'Marshal', glyph: G.rook, badge: G.knight, value: 8, command: 8, price: 800, mercPrice: 200,
    slides: ORTH, leaps: KNIGHT, unlockedBy: '4-B',
    desc: 'Rook + Knight. Slides in straight lines or leaps in an L. Deals 2 damage to bosses.',
  },
  queen: {
    type: 'queen', name: 'Queen', glyph: G.queen, value: 9, command: 9, price: 480, mercPrice: 120,
    slides: [...ORTH, ...DIAG], leaps: [], unlockedBy: '3-B',
    desc: 'Slides any distance in any direction. Deals 2 damage to bosses.',
  },
  amazon: {
    type: 'amazon', name: 'Amazon', glyph: G.queen, badge: G.knight, value: 12, command: 12, price: 1800, mercPrice: 450,
    slides: [...ORTH, ...DIAG], leaps: KNIGHT, unlockedBy: '5-3',
    desc: 'Queen + Knight. The most powerful piece in the realm. Deals 3 damage to bosses.',
  },
};

export const PIECE_ORDER: PieceType[] = ['pawn', 'knight', 'bishop', 'warden', 'rook', 'queen', 'cardinal', 'marshal', 'amazon'];

/** Layout letters used in stage definitions. */
export const LETTERS: Record<string, PieceType> = {
  p: 'pawn', n: 'knight', b: 'bishop', w: 'warden', r: 'rook',
  q: 'queen', c: 'cardinal', m: 'marshal', a: 'amazon',
};

export function bossDamage(type: PieceType): number {
  const v = PIECES[type].value;
  return v >= 12 ? 3 : v >= 5 ? 2 : 1;
}
