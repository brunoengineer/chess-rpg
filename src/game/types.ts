export type Side = 'P' | 'E'; // Player (bottom, moves up) / Enemy (top, moves down)

export type PieceType =
  | 'pawn'
  | 'knight'
  | 'bishop'
  | 'warden'
  | 'rook'
  | 'cardinal'
  | 'marshal'
  | 'queen'
  | 'amazon';

export type BossKind = 'golem' | 'steed' | 'malakar' | 'colossus' | 'dragon';

export type UnitType = PieceType | 'boss';

export interface Unit {
  /** Equal to the unit's index in `Battle.units`. */
  id: number;
  type: UnitType;
  side: Side;
  x: number;
  y: number;
  alive: boolean;
  moved: boolean;
  /** Footprint edge length: 1 for regular pieces, 2 for bosses. */
  size: number;
  /** Mercenary piece: consumed after the battle. */
  temp?: boolean;
  /** Set when a pawn promoted during this battle (reverts afterwards). */
  promotedFrom?: PieceType;
  boss?: BossKind;
  hp?: number;
  maxHp?: number;
  /** Boss movement cooldown in own turns. */
  cd?: number;
}

export type MoveKind = 'move' | 'capture' | 'strike' | 'pass';

export interface Move {
  /** Unit index, -1 for a pass. */
  u: number;
  kind: MoveKind;
  x: number;
  y: number;
  target?: number;
  /** Units crushed by a boss landing on them. */
  crush?: number[];
  promo?: boolean;
}

export type OutcomeReason = 'annihilation' | 'boss' | 'points' | 'time' | 'deadlock' | 'surrender';

export interface Outcome {
  winner: Side | 'draw';
  reason: OutcomeReason;
}

export interface Telegraph {
  kind: 'quake' | 'breath';
  /** Square indexes (y * w + x) that will be hit at the start of the next enemy turn. */
  squares: number[];
}

export interface Battle {
  w: number;
  h: number;
  units: Unit[];
  /** 0 = empty, -1 = rock, n > 0 = unit index + 1. */
  grid: number[];
  turn: Side;
  ply: number;
  maxPly: number;
  /** Consecutive passes (both sides stuck => deadlock). */
  passes: number;
  bossStage: boolean;
  enemyTurns: number;
  telegraph: Telegraph | null;
  over: Outcome | null;
  lastMove: { fx: number; fy: number; tx: number; ty: number } | null;
  /** Set once the enemy's start-of-turn effects ran, so a reload doesn't replay them. */
  enemyPreDone?: boolean;
}

export type FxKind = 'capture' | 'hit' | 'promote' | 'summon' | 'quake' | 'breath';

/** Visual/audio events produced while applying moves. */
export interface FxEvent {
  kind: FxKind;
  x: number;
  y: number;
  side?: Side;
  unitType?: UnitType;
  boss?: BossKind;
  amount?: number;
  size?: number;
}

export interface Placement {
  type: PieceType;
  temp: boolean;
  x: number;
  y: number;
}

export interface AiParams {
  depth: number;
  /** Probability of playing a random move. */
  blunder: number;
  /** Random noise (centipawns) added to root move scores. */
  noise: number;
  quiesce?: boolean;
}

export interface StageDef {
  id: string;
  region: number;
  name: string;
  w: number;
  h: number;
  deployRows: number;
  /** Rows from the top. '.' empty, '#' rock, letters = enemy pieces (see LETTERS). */
  layout: string[];
  boss?: { kind: BossKind; x: number; y: number; hp?: number };
  ai: AiParams;
  reward: number;
  lootMult: number;
  maxTurns: number;
  isBoss?: boolean;
  isArena?: boolean;
  /** Bonus stage unlocked by stars (1 = almost all stars, 2 = all stars). */
  extra?: 1 | 2;
}
