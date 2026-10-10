import { describe, expect, it } from 'vitest';
import { BOSS_ORDER } from '../game/bosses';
import { STAGES, arenaStage, hardStage } from '../game/campaign';
import { CARD_ORDER } from '../game/cards';
import { BOARD_SKINS, PIECE_SKINS } from '../game/cosmetics';
import { PIECE_ORDER } from '../game/pieces';
import { PERKS } from '../game/ranks';
import { bundle } from './bundles';
import { ARENA_NAMES_PT, BOSSES_PT, CARDS_PT, PERKS_PT, PIECES_PT, SKINS_PT } from './content';

const pt = bundle('pt');
const en = bundle('en');

describe('translations', () => {
  it('every stage has a Portuguese name (main, bonus, hard)', () => {
    for (const s of STAGES) {
      expect(pt.stage(s), s.id).not.toBe(s.name);
      if (!s.extra) expect(pt.stage(hardStage(s))).toBe(pt.stage(s));
    }
    expect(pt.stage(STAGES[0])).toBe('Primeiros Passos');
  });

  it('arena stages translate their generated names and bosses', () => {
    for (let level = 1; level <= 20; level++) {
      const s = arenaStage(level);
      expect(en.stage(s)).toBe(s.name);
      expect(pt.stage(s)).toMatch(new RegExp(`^Arena ${level}: `));
      expect(pt.stage(s)).not.toBe(s.name.replace('Arena 0', '')); // something got translated
    }
    expect(Object.keys(ARENA_NAMES_PT)).toHaveLength(8);
  });

  it('pieces, cards, bosses, perks and skins are all covered', () => {
    for (const t of PIECE_ORDER) expect(PIECES_PT[t]).toBeTruthy();
    for (const c of CARD_ORDER) expect(CARDS_PT[c]?.name && CARDS_PT[c]?.desc).toBeTruthy();
    for (const b of BOSS_ORDER) expect(BOSSES_PT[b]?.name).toBeTruthy();
    for (const t of PIECE_ORDER) for (const perk of PERKS[t]) expect(PERKS_PT[perk.name], perk.name).toBeTruthy();
    for (const s of PIECE_SKINS) expect(SKINS_PT[`piece:${s.id}`], s.id).toBeTruthy();
    for (const s of BOARD_SKINS) expect(SKINS_PT[`board:${s.id}`], s.id).toBeTruthy();
  });

  it('uses the chosen names: Rainha and Guardião', () => {
    expect(pt.piece('queen')).toBe('Rainha');
    expect(pt.piece('warden')).toBe('Guardião');
    expect(pt.rank(1)).toBe('Sargento');
  });

  it('English stays the game data text', () => {
    expect(en.piece('warden')).toBe('Warden');
    expect(en.cardName('smite')).toBe('Smite');
  });
});
