/**
 * Leaderboard data (Firestore collection `leaderboard/{uid}`, rules in firestore.rules).
 * Only signed-in players who opted in with a nickname publish an entry; anyone can read the boards.
 */
import { collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { rankKey, totalStars } from '../game/ladder';
import { firestore } from './firebase';
import type { SaveData } from './save';
import { useStore } from './store';

export type Board = 'stars' | 'arena';

export interface LadderEntry {
  uid: string;
  name: string;
  stars: number;
  starsBattles: number;
  starsKey: number;
  arena: number;
  arenaRuns: number;
  arenaKey: number;
  bosses: number;
}

export const keyField = (b: Board): 'starsKey' | 'arenaKey' => (b === 'stars' ? 'starsKey' : 'arenaKey');

export function entryFromSave(uid: string, save: SaveData): LadderEntry {
  const l = save.ladder;
  const stars = totalStars(save.stages);
  return {
    uid,
    name: l.nickname ?? '',
    stars,
    starsBattles: l.starsBattles,
    starsKey: rankKey(stars, l.starsBattles, l.starsAt),
    arena: save.arena.best,
    arenaRuns: l.arenaRunsAtBest,
    arenaKey: rankKey(save.arena.best, l.arenaRunsAtBest, l.arenaAt),
    bosses: save.stats.bossesSlain,
  };
}

/* ---- Local test mode: on localhost, window.__GQ_FAKE_LADDER__ (an array) replaces Firestore. ---- */
type FakeWindow = Window & { __GQ_FAKE_LADDER__?: LadderEntry[] };
const fake = (): LadderEntry[] | null =>
  typeof window !== 'undefined' && location.hostname === 'localhost' ? (window as FakeWindow).__GQ_FAKE_LADDER__ ?? null : null;

const COL = 'leaderboard';

/** Writes (or refreshes) the signed-in player's entry, if they joined. Returns false if the write failed (never throws). */
export async function syncLadder(): Promise<boolean> {
  const { player, save } = useStore.getState();
  if (!player || player.guest || !save.ladder.joined || !save.ladder.nickname) return true;
  const entry = entryFromSave(player.uid, save);
  const f = fake();
  if (f) {
    const i = f.findIndex((e) => e.uid === entry.uid);
    if (i >= 0) f[i] = entry;
    else f.push(entry);
    return true;
  }
  const db = firestore();
  if (!db) return false;
  const { uid, ...data } = entry;
  try {
    await setDoc(doc(db, COL, uid), { ...data, updatedAt: serverTimestamp() });
    return true;
  } catch (e) {
    console.warn('Leaderboard update failed', e);
    return false;
  }
}

export async function removeLadderEntry(uid: string): Promise<void> {
  const f = fake();
  if (f) {
    const i = f.findIndex((e) => e.uid === uid);
    if (i >= 0) f.splice(i, 1);
    return;
  }
  const db = firestore();
  if (db) await deleteDoc(doc(db, COL, uid));
}

export async function fetchTop(board: Board, n = 50): Promise<LadderEntry[]> {
  const field = keyField(board);
  const f = fake();
  if (f) return [...f].sort((a, b) => b[field] - a[field]).slice(0, n);
  const db = firestore();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COL), orderBy(field, 'desc'), limit(n)));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<LadderEntry, 'uid'>) }));
}

/** 1-based position of a key on a board (players strictly ahead + 1). */
export async function fetchPosition(board: Board, key: number): Promise<number> {
  const field = keyField(board);
  const f = fake();
  if (f) return f.filter((e) => e[field] > key).length + 1;
  const db = firestore();
  if (!db) return 0;
  const snap = await getCountFromServer(query(collection(db, COL), where(field, '>', key)));
  return snap.data().count + 1;
}
