import { describe, expect, it } from 'vitest';
import { STAGES } from './campaign';
import { KEY_PRIMARY, MAX_STARS, rankKey, totalStars, validNickname } from './ladder';

const day = (n: number) => Date.UTC(2026, 0, 1) + n * 86_400_000;

describe('leaderboard ranking', () => {
  it('sorts by score, then fewer attempts, then earliest', () => {
    const players = [
      { name: 'late', key: rankKey(120, 300, day(10)) },
      { name: 'efficient', key: rankKey(120, 250, day(20)) },
      { name: 'early', key: rankKey(120, 300, day(5)) },
      { name: 'leader', key: rankKey(121, 900, day(99)) },
      { name: 'last', key: rankKey(119, 1, day(0)) },
    ];
    const order = [...players].sort((a, b) => b.key - a.key).map((p) => p.name);
    expect(order).toEqual(['leader', 'efficient', 'early', 'late', 'last']);
  });

  it('keys stay exact integers inside the primary band (rules check this)', () => {
    const k = rankKey(MAX_STARS, 0, day(0));
    expect(Number.isSafeInteger(k)).toBe(true);
    expect(k).toBeGreaterThanOrEqual(MAX_STARS * KEY_PRIMARY);
    expect(k).toBeLessThan((MAX_STARS + 1) * KEY_PRIMARY);
    const worst = rankKey(5, 10 ** 9, day(100_000)); // absurd attempts/time are clamped
    expect(worst).toBeGreaterThanOrEqual(5 * KEY_PRIMARY);
    expect(worst).toBeLessThan(6 * KEY_PRIMARY);
  });

  it('max stars matches the rules (330) and counts every stage', () => {
    expect(MAX_STARS).toBe(330);
    expect(totalStars({ '1-1': { stars: 3, clears: 1 }, '1-1H': { stars: 2, clears: 1 }, '1-X1': { stars: 1, clears: 1 } })).toBe(6);
    expect(STAGES.length).toBe(60);
  });

  it('nicknames: 3–16 letters, digits, spaces, . _ -', () => {
    for (const ok of ['Bruno', 'Knight_42', 'José María', 'a.b-c']) expect(validNickname(ok)).toBe(true);
    for (const bad of ['ab', 'x'.repeat(17), 'hi<script>', '😀😀😀', '   ']) expect(validNickname(bad)).toBe(false);
  });
});
