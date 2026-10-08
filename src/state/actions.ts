import { ARENA_UNLOCK, REGIONS, isCleared, mainStars, unlocksOf, BOSS_OF, MAIN_STAGES } from '../game/campaign';
import { CARDS, CARD_ORDER, MAX_CARD_SLOTS, cardSlotCost, type CardId } from '../game/cards';
import { BOARD_SKINS, PIECE_SKINS, skinKey } from '../game/cosmetics';
import { leadershipCost, MAX_LEADERSHIP, type BattleResult } from '../game/economy';
import { createBattle } from '../game/engine';
import { PIECES } from '../game/pieces';
import { levelInfo } from '../game/ranks';
import type { PieceType, Placement, StageDef } from '../game/types';
import { addCount, classRanks } from './save';
import { useStore } from './store';

const st = () => useStore.getState();

function spend(price: number): boolean {
  if (st().save.coins < price) {
    st().toast('Not enough coins', '🪙');
    return false;
  }
  return true;
}

export function buyPiece(type: PieceType, merc: boolean) {
  const def = PIECES[type];
  const price = merc ? def.mercPrice : def.price;
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    addCount(merc ? s.mercs : s.army, type, 1);
  });
  return true;
}

export function buyLeadership() {
  const { leadership } = st().save;
  if (leadership >= MAX_LEADERSHIP) return false;
  const price = leadershipCost(leadership);
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    s.leadership += 1;
  });
  return true;
}

export function buyCard(id: CardId) {
  const price = CARDS[id].price;
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    s.cards[id] = (s.cards[id] ?? 0) + 1;
  });
  return true;
}

export function buyCardSlot() {
  const { cardSlots } = st().save;
  if (cardSlots >= MAX_CARD_SLOTS) return false;
  const price = cardSlotCost(cardSlots);
  if (!spend(price)) return false;
  st().update((s) => {
    s.coins -= price;
    s.cardSlots += 1;
  });
  return true;
}

export function buySkin(kind: 'piece' | 'board', id: string) {
  const skin = (kind === 'piece' ? PIECE_SKINS : BOARD_SKINS).find((x) => x.id === id)!;
  if (!spend(skin.price)) return false;
  st().update((s) => {
    s.coins -= skin.price;
    s.cosmetics.owned.push(skinKey(kind, id));
    if (kind === 'piece') s.cosmetics.piece = id;
    else s.cosmetics.board = id;
  });
  return true;
}

export function equipSkin(kind: 'piece' | 'board', id: string) {
  st().update((s) => {
    if (kind === 'piece') s.cosmetics.piece = id;
    else s.cosmetics.board = id;
  });
}

export function startBattle(stage: StageDef, placements: Placement[], loadout: CardId[] = []) {
  st().update((s) => {
    for (const p of placements) addCount(p.temp ? s.mercs : s.army, p.type, -1);
    s.formations[stage.id] = placements;
    // Pre-battle cards are consumed now; in-battle cards only when played.
    const pre = loadout.filter((c) => CARDS[c].pre);
    for (const c of pre) s.cards[c] = Math.max(0, (s.cards[c] ?? 0) - 1);
    s.active = {
      stage,
      battle: createBattle(stage, placements, classRanks(s.xp)),
      loot: 0,
      captures: 0,
      cards: loadout.filter((c) => !CARDS[c].pre),
      lootMult: pre.includes('bounty') ? 2 : undefined,
      insured: pre.includes('insurance') || undefined,
      preCards: pre.length || undefined,
    };
    s.stats.battles++;
  });
  st().setView({ name: 'battle' });
}

export interface LevelUp {
  type: PieceType;
  from: number;
  to: number;
  rankUp: boolean;
}

export interface FinishExtras {
  unlocked: PieceType[];
  cardsUnlocked: CardId[];
  arenaUnlocked: boolean;
  hardUnlocked: boolean;
  levelUps: LevelUp[];
  skinsEarned: string[];
}

/** Applies a finished battle to the save. */
export function finishBattle(stage: StageDef, result: BattleResult, captures: number): FinishExtras {
  const before = st().save;
  const firstClear = result.win && !isCleared(before.stages, stage.id);
  const levelUps: LevelUp[] = [];
  const skinsEarned: string[] = [];
  st().update((s) => {
    s.coins += result.total;
    s.stats.coinsEarned += result.total;
    s.stats.captures += captures;
    if (result.win) s.stats.wins++;
    else s.stats.losses++;
    if (result.win && stage.isBoss) s.stats.bossesSlain++;
    // Owned pieces always come home, even if captured. Mercenaries leave (unless insured and lost).
    const insuredLoss = !result.win && s.active?.insured;
    for (const u of [...result.survivors, ...result.lost]) {
      if (!u.temp) addCount(s.army, u.type, 1);
      else if (insuredLoss) addCount(s.mercs, u.type, 1);
    }
    for (const [t, gain] of Object.entries(result.xp)) {
      const type = t as PieceType;
      const from = levelInfo(s.xp[type] ?? 0).level;
      s.xp[type] = (s.xp[type] ?? 0) + (gain ?? 0);
      const to = levelInfo(s.xp[type]!).level;
      if (to > from) levelUps.push({ type, from, to, rankUp: Math.floor(to / 10) > Math.floor(from / 10) });
    }
    if (stage.isArena) {
      if (result.win) {
        s.arena.best = Math.max(s.arena.best, s.arena.level);
        s.arena.level++;
      }
    } else if (result.win) {
      const prev = s.stages[stage.id] ?? { stars: 0, clears: 0 };
      s.stages[stage.id] = { stars: Math.max(prev.stars, result.stars), clears: prev.clears + 1 };
    }
    // Skins earned by collecting every star of a world.
    for (const skin of PIECE_SKINS) {
      if (!skin.earnedWorld) continue;
      const key = skinKey('piece', skin.id);
      if (!s.cosmetics.owned.includes(key) && mainStars(s.stages, skin.earnedWorld) >= MAIN_STAGES * 3) {
        s.cosmetics.owned.push(key);
        skinsEarned.push(skin.name);
      }
    }
    s.active = null;
  });
  return {
    unlocked: firstClear ? unlocksOf(stage.id) : [],
    cardsUnlocked: firstClear ? CARD_ORDER.filter((c) => CARDS[c].unlockedBy === stage.id) : [],
    arenaUnlocked: firstClear && stage.id === ARENA_UNLOCK,
    hardUnlocked: firstClear && REGIONS.some((r) => BOSS_OF(r.id) === stage.id),
    levelUps,
    skinsEarned,
  };
}

/** A card was played: it leaves the inventory and the battle loadout. */
export function consumeCard(id: CardId) {
  st().update((s) => {
    s.cards[id] = Math.max(0, (s.cards[id] ?? 0) - 1);
    if (s.active?.cards) {
      const i = s.active.cards.indexOf(id);
      if (i >= 0) s.active.cards.splice(i, 1);
    }
  });
}
