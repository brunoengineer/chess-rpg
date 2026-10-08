import { describe, expect, it } from 'vitest';
import { normalizeSave } from '../state/save';
import { EXTRA1_STARS, REGIONS, STAGES, STAGE_BY_ID, isStageUnlocked, nextStage, type StageProgress } from './campaign';
import { PIECES, PIECE_ORDER } from './pieces';

describe('campaign', () => {
  it('has 10 main stages + 2 bonus stages per world, with the boss 10th', () => {
    for (const r of REGIONS) {
      const ids = STAGES.filter((s) => s.region === r.id).map((s) => s.id);
      expect(ids).toEqual([...Array.from({ length: 10 }, (_, i) => `${r.id}-${i + 1}`), `${r.id}-X1`, `${r.id}-X2`]);
      expect(STAGE_BY_ID[`${r.id}-10`].isBoss).toBe(true);
    }
  });

  it('every piece unlock points at a real stage', () => {
    for (const t of PIECE_ORDER) if (PIECES[t].unlockedBy) expect(STAGE_BY_ID[PIECES[t].unlockedBy!]).toBeDefined();
  });

  it('unlocks main stages in order and the next world after the boss', () => {
    const p: StageProgress = { '1-1': { stars: 1, clears: 1 } };
    expect(isStageUnlocked(p, STAGE_BY_ID['1-2'])).toBe(true);
    expect(isStageUnlocked(p, STAGE_BY_ID['1-3'])).toBe(false);
    expect(isStageUnlocked(p, STAGE_BY_ID['2-1'])).toBe(false);
    expect(isStageUnlocked({ '1-10': { stars: 1, clears: 1 } }, STAGE_BY_ID['2-1'])).toBe(true);
    expect(nextStage(STAGE_BY_ID['1-9'])?.id).toBe('1-10');
    expect(nextStage(STAGE_BY_ID['1-10'])).toBeUndefined();
  });

  it('unlocks bonus stages by stars in that world', () => {
    const withStars = (total: number): StageProgress => {
      const p: StageProgress = {};
      for (let i = 1; i <= 10; i++) {
        const stars = Math.min(3, Math.max(0, total - (i - 1) * 3));
        if (stars) p[`1-${i}`] = { stars, clears: 1 };
      }
      return p;
    };
    expect(isStageUnlocked(withStars(EXTRA1_STARS - 1), STAGE_BY_ID['1-X1'])).toBe(false);
    expect(isStageUnlocked(withStars(EXTRA1_STARS), STAGE_BY_ID['1-X1'])).toBe(true);
    expect(isStageUnlocked(withStars(EXTRA1_STARS), STAGE_BY_ID['1-X2'])).toBe(false);
    expect(isStageUnlocked(withStars(30), STAGE_BY_ID['1-X2'])).toBe(true);
    expect(isStageUnlocked(withStars(30), STAGE_BY_ID['2-X1'])).toBe(false);
  });
});

describe('save migration', () => {
  it('returns fallen pieces to the army and renames old boss stages', () => {
    const s = normalizeSave({ army: { pawn: 3 }, fallen: { pawn: 2, knight: 1 }, stages: { '1-B': { stars: 2, clears: 1 } } });
    expect(s.army).toEqual({ pawn: 5, knight: 1 });
    expect(s.stages['1-10']).toEqual({ stars: 2, clears: 1 });
    expect('fallen' in s).toBe(false);
  });
});
