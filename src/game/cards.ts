import { addUnit, checkOver, cloneBattle, damage, kill, relocate } from './engine';
import { PIECES } from './pieces';
import { profile } from './ranks';
import type { Battle, FxEvent, PieceType } from './types';

export type CardId =
  | 'rewind' | 'shield' | 'time' | 'rally' | 'haste' | 'freeze' | 'revive' | 'promote' | 'bounty'
  | 'insurance' | 'reinforce' | 'stun' | 'swap' | 'barricade' | 'double' | 'teleport' | 'volley' | 'smite';

/** What the player must tap, step by step, to play a card. */
export type TargetStep = 'own' | 'ownPawn' | 'enemy' | 'boss' | 'deploy' | 'empty' | 'column' | 'adjacent' | 'half' | 'own2';

export interface CardDef {
  id: CardId;
  name: string;
  icon: string;
  /** Short tooltip. */
  desc: string;
  price: number;
  unlockedBy: string;
  /** Played before the battle starts (from the deploy screen). */
  pre?: boolean;
  steps: TargetStep[];
}

export const CARDS: Record<CardId, CardDef> = {
  rewind: { id: 'rewind', name: 'Rewind', icon: '⏪', desc: 'Undo your last move and the enemy reply', price: 40, unlockedBy: '1-5', steps: [] },
  shield: { id: 'shield', name: 'Shield', icon: '🛡️', desc: 'Your piece blocks the next capture', price: 50, unlockedBy: '1-5', steps: ['own'] },
  time: { id: 'time', name: 'Hourglass', icon: '⌛', desc: '+5 turns', price: 40, unlockedBy: '1-5', steps: [] },
  rally: { id: 'rally', name: 'Rally', icon: '📯', desc: 'All your pawns step forward', price: 60, unlockedBy: '1-10', steps: [] },
  haste: { id: 'haste', name: 'Haste', icon: '💨', desc: 'Step a piece one square, then move', price: 80, unlockedBy: '1-10', steps: ['own', 'adjacent'] },
  freeze: { id: 'freeze', name: 'Freeze', icon: '❄️', desc: 'An enemy piece skips 2 turns', price: 120, unlockedBy: '2-5', steps: ['enemy'] },
  revive: { id: 'revive', name: 'Revive', icon: '✨', desc: 'Your best lost piece returns', price: 150, unlockedBy: '2-5', steps: ['deploy'] },
  promote: { id: 'promote', name: 'Coronation', icon: '👑', desc: 'A pawn promotes now', price: 200, unlockedBy: '2-10', steps: ['ownPawn'] },
  bounty: { id: 'bounty', name: 'Bounty', icon: '💰', desc: 'Double loot this battle', price: 150, unlockedBy: '2-10', pre: true, steps: [] },
  insurance: { id: 'insurance', name: 'Insurance', icon: '📜', desc: 'Lose? Your mercenaries come back', price: 100, unlockedBy: '2-10', pre: true, steps: [] },
  reinforce: { id: 'reinforce', name: 'Reinforcements', icon: '➕', desc: 'Bring a piece from your army', price: 250, unlockedBy: '3-5', steps: ['deploy'] },
  stun: { id: 'stun', name: 'Stun', icon: '💫', desc: 'Boss skips 2 moves, attack cancelled', price: 250, unlockedBy: '3-5', steps: ['boss'] },
  swap: { id: 'swap', name: 'Swap', icon: '🔄', desc: 'Two of your pieces trade places', price: 150, unlockedBy: '3-5', steps: ['own', 'own2'] },
  barricade: { id: 'barricade', name: 'Barricade', icon: '🪨', desc: 'Place a rock', price: 120, unlockedBy: '3-5', steps: ['empty'] },
  double: { id: 'double', name: 'Double Move', icon: '⏩', desc: 'Move again (no capture)', price: 400, unlockedBy: '3-10', steps: [] },
  teleport: { id: 'teleport', name: 'Teleport', icon: '🌀', desc: 'Move a piece anywhere in your half', price: 300, unlockedBy: '4-5', steps: ['own', 'half'] },
  volley: { id: 'volley', name: 'Volley', icon: '🏹', desc: 'First enemy in a column falls (boss: 2 dmg)', price: 500, unlockedBy: '4-5', steps: ['column'] },
  smite: { id: 'smite', name: 'Smite', icon: '⚡', desc: 'Destroy an enemy piece', price: 900, unlockedBy: '4-10', steps: ['enemy'] },
};

export const CARD_ORDER: CardId[] = [
  'rewind', 'shield', 'time', 'rally', 'haste', 'freeze', 'revive', 'promote', 'bounty',
  'insurance', 'reinforce', 'stun', 'swap', 'barricade', 'double', 'teleport', 'volley', 'smite',
];

export const MAX_CARD_SLOTS = 4;
/** Price to go from `slots` to `slots + 1`. */
export const cardSlotCost = (slots: number) => (slots <= 2 ? 1500 : 5000);

/** Squares (y * w + x) the player may tap for a targeting step. `first` is the square chosen in step 1. */
export function validSquares(b: Battle, step: TargetStep, deployRows: number, first?: number): Set<number> {
  const out = new Set<number>();
  const { w, h, grid, units } = b;
  const unitOn = (sq: number) => (grid[sq] > 0 ? units[grid[sq] - 1] : null);
  for (let sq = 0; sq < w * h; sq++) {
    const u = unitOn(sq);
    const y = Math.floor(sq / w), x = sq % w;
    switch (step) {
      case 'own':
        if (u?.side === 'P' && u.type !== 'boss') out.add(sq);
        break;
      case 'own2':
        if (u?.side === 'P' && u.type !== 'boss' && sq !== first) out.add(sq);
        break;
      case 'ownPawn':
        if (u?.side === 'P' && u.type === 'pawn') out.add(sq);
        break;
      case 'enemy':
        if (u?.side === 'E' && u.type !== 'boss') out.add(sq);
        break;
      case 'boss':
        if (u?.type === 'boss') out.add(sq);
        break;
      case 'deploy':
        if (grid[sq] === 0 && y >= h - deployRows) out.add(sq);
        break;
      case 'empty':
        if (grid[sq] === 0) out.add(sq);
        break;
      case 'half':
        if (grid[sq] === 0 && y >= Math.floor(h / 2)) out.add(sq);
        break;
      case 'adjacent': {
        if (first === undefined || grid[sq] !== 0) break;
        const fx = first % w, fy = Math.floor(first / w);
        if (Math.max(Math.abs(fx - x), Math.abs(fy - y)) === 1) out.add(sq);
        break;
      }
      case 'column':
        if (units.some((t) => t.alive && t.side === 'E' && x >= t.x && x < t.x + t.size)) out.add(sq);
        break;
    }
  }
  return out;
}

/** Whether a card can be played right now at all. */
export function cardPlayable(b: Battle, id: CardId, deployRows: number, reserve: PieceType[]): boolean {
  const def = CARDS[id];
  if (def.pre) return false;
  if (id === 'revive' && !b.units.some((u) => u.side === 'P' && !u.alive)) return false;
  if (id === 'reinforce' && !reserve.length) return false;
  if (id === 'double' && b.bonusMove) return false;
  if (id === 'rally' && !b.units.some((u) => u.alive && u.side === 'P' && u.type === 'pawn')) return false;
  if (!def.steps.length) return true;
  return validSquares(b, def.steps[0], deployRows).size > 0;
}

/**
 * Plays a card (except Rewind, handled by the battle screen). `squares` holds one square per targeting step.
 * Returns the new battle and visual events.
 */
export function playCard(
  battle: Battle,
  id: CardId,
  squares: number[],
  opts: { reinforce?: PieceType; ranks?: Partial<Record<PieceType, number>> } = {},
): { battle: Battle; fx: FxEvent[] } {
  const b = cloneBattle(battle);
  const fx: FxEvent[] = [];
  const at = (sq: number) => ({ x: sq % b.w, y: Math.floor(sq / b.w) });
  const unitOn = (sq: number) => b.units[b.grid[sq] - 1];
  const [s1, s2] = squares;

  switch (id) {
    case 'shield': {
      const u = unitOn(s1);
      u.shield = true;
      fx.push({ kind: 'block', ...at(s1), side: 'P', icon: '🛡️' });
      break;
    }
    case 'time':
      b.maxPly += 10;
      break;
    case 'rally': {
      const pawns = b.units.filter((u) => u.alive && u.side === 'P' && u.type === 'pawn').sort((a, c) => a.y - c.y);
      for (const p of pawns) {
        if (p.y > 0 && b.grid[(p.y - 1) * b.w + p.x] === 0) {
          relocate(b, p.id, p.x, p.y - 1);
          if (p.y === 0) promote(b, p.id, fx);
        }
      }
      break;
    }
    case 'haste':
    case 'teleport': {
      const u = unitOn(s1);
      const to = at(s2);
      relocate(b, u.id, to.x, to.y);
      fx.push({ kind: 'summon', ...to, side: 'P' });
      break;
    }
    case 'swap': {
      const a = unitOn(s1), c = unitOn(s2);
      const pa = at(s1), pc = at(s2);
      b.grid[s1] = 0;
      b.grid[s2] = 0;
      a.x = pc.x; a.y = pc.y; c.x = pa.x; c.y = pa.y;
      b.grid[s2] = a.id + 1;
      b.grid[s1] = c.id + 1;
      fx.push({ kind: 'summon', ...pa, side: 'P' }, { kind: 'summon', ...pc, side: 'P' });
      break;
    }
    case 'freeze': {
      unitOn(s1).frozen = 2;
      fx.push({ kind: 'block', ...at(s1), side: 'E', icon: '❄️' });
      break;
    }
    case 'revive': {
      const lost = b.units
        .filter((u) => u.side === 'P' && !u.alive)
        .sort((a, c) => PIECES[(c.promotedFrom ?? c.type) as PieceType].value - PIECES[(a.promotedFrom ?? a.type) as PieceType].value)[0];
      const to = at(s1);
      if (lost.promotedFrom) {
        lost.type = lost.promotedFrom;
        lost.promotedFrom = undefined;
      }
      lost.alive = true;
      lost.x = to.x;
      lost.y = to.y;
      b.grid[s1] = lost.id + 1;
      fx.push({ kind: 'summon', ...to, side: 'P' });
      break;
    }
    case 'promote':
      promote(b, unitOn(s1).id, fx);
      break;
    case 'reinforce': {
      const type = opts.reinforce!;
      const to = at(s1);
      addUnit(b, { type, side: 'P', ...to, size: 1, rank: opts.ranks?.[type] || undefined });
      fx.push({ kind: 'summon', ...to, side: 'P' });
      break;
    }
    case 'stun': {
      const boss = unitOn(s1);
      boss.cd = (boss.cd ?? 0) + 2;
      b.telegraph = null;
      fx.push({ kind: 'block', x: boss.x, y: boss.y, side: 'E', size: boss.size, icon: '💫' });
      break;
    }
    case 'barricade':
      b.grid[s1] = -1;
      break;
    case 'double':
      b.bonusMove = true;
      break;
    case 'volley': {
      const x = s1 % b.w;
      for (let y = b.h - 1; y >= 0; y--) {
        const c = b.grid[y * b.w + x];
        if (c <= 0) continue;
        const t = b.units[c - 1];
        if (t.side !== 'E') continue;
        if (t.type === 'boss') damage(b, t.id, 2, fx);
        else kill(b, t.id, fx);
        break;
      }
      break;
    }
    case 'smite':
      kill(b, unitOn(s1).id, fx);
      break;
    default:
      break;
  }
  b.cardsUsed = (b.cardsUsed ?? 0) + 1;
  b.cardPly = b.ply;
  checkOver(b);
  return { battle: b, fx };
}

function promote(b: Battle, id: number, fx: FxEvent[]) {
  const u = b.units[id];
  u.promotedFrom = 'pawn';
  u.type = profile('pawn', u.rank ?? 0).promoAmazon ? 'amazon' : 'queen';
  fx.push({ kind: 'promote', x: u.x, y: u.y, side: 'P' });
}
