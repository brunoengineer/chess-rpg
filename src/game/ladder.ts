/**
 * Leaderboard scoring. Each board sorts by one number that packs three layers, so Firestore can order it with a
 * plain single-field index (no composite index to set up):
 *
 *   key = primary × 10¹²  +  (99 999 − attempts) × 10⁷  +  (9 999 999 − minutes since 2026-01-01)
 *
 *   ⭐ Stars:  most stars → fewest battles to reach that total → first to get there
 *   🏟️ Arena:  highest level → fewest Arena fights to reach it → first to get there
 *
 * The largest key (330 stars) is ~3.3 × 10¹⁴, well inside exact integer range.
 */
import { STAGES, type StageProgress } from './campaign';

const EPOCH = Date.UTC(2026, 0, 1);
const MAX_ATTEMPTS = 99_999;
const MAX_MINUTES = 9_999_999; // ~19 years
export const KEY_PRIMARY = 1e12;
const KEY_ATTEMPTS = 1e7;

/** Every stage's 3 stars, plus Hard mode for the 10 main stages of each world. */
export const MAX_STARS = STAGES.length * 3 + STAGES.filter((s) => !s.extra).length * 3;
export const MAX_ARENA = 1000;

export function minutesSinceEpoch(t: number): number {
  return Math.min(MAX_MINUTES, Math.max(0, Math.floor((t - EPOCH) / 60_000)));
}

/** Higher is better: primary, then fewer attempts, then earlier. */
export function rankKey(primary: number, attempts: number, at: number): number {
  const a = Math.min(MAX_ATTEMPTS, Math.max(0, Math.floor(attempts)));
  return primary * KEY_PRIMARY + (MAX_ATTEMPTS - a) * KEY_ATTEMPTS + (MAX_MINUTES - minutesSinceEpoch(at));
}

/** Stars from every stage: main, bonus and Hard mode. */
export function totalStars(stages: StageProgress): number {
  return Object.values(stages).reduce((a, p) => a + (p?.stars ?? 0), 0);
}

/** 3–16 letters, digits, spaces, dots, dashes or underscores. */
export const NICKNAME = /^[\p{L}\p{N} _.-]{3,16}$/u;
export const cleanNickname = (s: string) => s.trim().replace(/\s+/g, ' ');
export const validNickname = (s: string) => NICKNAME.test(cleanNickname(s));
