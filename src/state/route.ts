/**
 * URL hash ↔ screen, so a refresh (or Back/Forward) keeps you where you were.
 *   #/campaign  #/arena  #/barracks  #/shop  #/shop/cards  #/shop/style  #/deploy/<stageId>  #/battle
 * Hash routing works on GitHub Pages without server rewrites. Everything read from the URL is validated:
 * a stale or hand-edited hash falls back to a safe screen instead of breaking the game.
 */
import { ARENA_UNLOCK, STAGE_BY_ID, arenaStage, baseId, hardStage, isCleared, isStageUnlocked } from '../game/campaign';
import type { StageDef } from '../game/types';
import type { SaveData } from './save';
import type { ShopSection, Tab, View } from './store';

const TABS: Tab[] = ['campaign', 'arena', 'shop', 'barracks'];
const SECTIONS: ShopSection[] = ['army', 'cards', 'style'];
export const HOME: View = { name: 'hub', tab: 'campaign' };

export function viewToHash(v: View): string {
  switch (v.name) {
    case 'battle':
      return '#/battle';
    case 'deploy':
      return `#/deploy/${encodeURIComponent(v.stage.id)}`;
    case 'hub':
      return v.tab === 'shop' && v.section && v.section !== 'army' ? `#/shop/${v.section}` : `#/${v.tab}`;
  }
}

/** The stage behind a deploy URL, only if this save can actually play it right now. */
export function resolveStage(id: string, save: SaveData): StageDef | null {
  if (id.startsWith('arena-')) {
    const level = save.arena.level;
    return id === `arena-${level}` && isCleared(save.stages, ARENA_UNLOCK) ? arenaStage(level) : null;
  }
  const base = STAGE_BY_ID[baseId(id)];
  if (!base) return null;
  const hard = id !== base.id;
  if (hard && (id !== `${base.id}H` || base.extra)) return null;
  const stage = hard ? hardStage(base) : base;
  return isStageUnlocked(save.stages, stage) ? stage : null;
}

export function hashToView(hash: string, save: SaveData): View | null {
  let parts: string[];
  try {
    parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null; // malformed escape sequence
  }
  const [a, b] = parts;
  if (!a) return null;
  if ((TABS as string[]).includes(a)) {
    if (a === 'shop' && b && (SECTIONS as string[]).includes(b)) return { name: 'hub', tab: 'shop', section: b as ShopSection };
    return { name: 'hub', tab: a as Tab };
  }
  if (a === 'deploy' && b) {
    const stage = resolveStage(b, save);
    return stage ? { name: 'deploy', stage } : null;
  }
  if (a === 'battle') return save.active ? { name: 'battle' } : null;
  return null;
}

/** Screen to show when entering the game: a battle in progress always wins, then the URL, then home. */
export function initialView(hash: string, save: SaveData): View {
  if (save.active) return { name: 'battle' };
  return hashToView(hash, save) ?? HOME;
}

/* ---------------- Browser history (no-ops outside a browser) ---------------- */

const hasWindow = () => typeof window !== 'undefined' && typeof history !== 'undefined';

export function writeHash(v: View, mode: 'push' | 'replace') {
  if (!hasWindow()) return;
  const hash = viewToHash(v);
  if (location.hash === hash) return;
  if (mode === 'push') history.pushState(null, '', hash);
  else history.replaceState(null, '', hash);
}

export function clearHash() {
  if (hasWindow() && location.hash) history.replaceState(null, '', location.pathname + location.search);
}
