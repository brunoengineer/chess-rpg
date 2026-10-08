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
  pawn: { type: 'pawn', name: 'Pawn', glyph: G.pawn, value: 1, command: 1, price: 20, mercPrice: 5, slides: [], leaps: [] },
  knight: { type: 'knight', name: 'Knight', glyph: G.knight, value: 3, command: 3, price: 100, mercPrice: 25, slides: [], leaps: KNIGHT, unlockedBy: '1-4' },
  bishop: { type: 'bishop', name: 'Bishop', glyph: G.bishop, value: 3, command: 3, price: 110, mercPrice: 28, slides: DIAG, leaps: [], unlockedBy: '1-10' },
  warden: { type: 'warden', name: 'Warden', glyph: G.king, value: 3, command: 3, price: 120, mercPrice: 30, slides: [], leaps: [...ORTH, ...DIAG], unlockedBy: '2-5' },
  rook: { type: 'rook', name: 'Rook', glyph: G.rook, value: 5, command: 5, price: 240, mercPrice: 60, slides: ORTH, leaps: [], unlockedBy: '2-10' },
  queen: { type: 'queen', name: 'Queen', glyph: G.queen, value: 9, command: 9, price: 700, mercPrice: 175, slides: [...ORTH, ...DIAG], leaps: [], unlockedBy: '3-10' },
  cardinal: { type: 'cardinal', name: 'Cardinal', glyph: G.bishop, badge: G.knight, value: 7, command: 7, price: 950, mercPrice: 240, slides: DIAG, leaps: KNIGHT, unlockedBy: '4-5' },
  marshal: { type: 'marshal', name: 'Marshal', glyph: G.rook, badge: G.knight, value: 8, command: 8, price: 1150, mercPrice: 290, slides: ORTH, leaps: KNIGHT, unlockedBy: '4-10' },
  amazon: { type: 'amazon', name: 'Amazon', glyph: G.queen, badge: G.knight, value: 12, command: 12, price: 2600, mercPrice: 650, slides: [...ORTH, ...DIAG], leaps: KNIGHT, unlockedBy: '5-6' },
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
