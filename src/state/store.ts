import { create } from 'zustand';
import type { StageDef } from '../game/types';
import { firebaseEnabled, loadCloudSave, signInWithGoogle, signOutUser, watchAuth, writeCloudSave } from './firebase';
import { HOME, clearHash, hashToView, initialView, writeHash } from './route';
import { chooseAccountSave, defaultSave, normalizeSave, type SaveData } from './save';

export type Tab = 'campaign' | 'arena' | 'shop' | 'barracks';
export type ShopSection = 'army' | 'cards' | 'style';
/** `section` picks the Shop section; `focus` scrolls to and highlights an item (e.g. 'piece:knight', 'card:freeze'). */
export type View =
  | { name: 'hub'; tab: Tab; section?: ShopSection; focus?: string }
  | { name: 'deploy'; stage: StageDef }
  | { name: 'battle' };

export interface Player {
  uid: string;
  name: string;
  photo?: string | null;
  guest: boolean;
}

export interface Toast {
  id: number;
  text: string;
  icon?: string;
}

interface AppStore {
  phase: 'boot' | 'login' | 'loading' | 'game';
  player: Player | null;
  save: SaveData;
  view: View;
  sync: 'local' | 'saving' | 'saved' | 'error';
  toasts: Toast[];
  settingsOpen: boolean;
  tutorialOpen: boolean;
  authError: string | null;
  /** Worlds currently shown in Hard mode on the map. */
  hardView: Record<number, boolean>;
  toggleHard: (region: number) => void;
  setHardView: (region: number, on: boolean) => void;
  setView: (v: View) => void;
  update: (fn: (s: SaveData) => void) => void;
  toast: (text: string, icon?: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setTutorialOpen: (open: boolean) => void;
  playAsGuest: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetProgress: () => void;
}

const GUEST_FLAG = 'gq-guest';
const localKey = (uid: string) => `gq-save-${uid}`;

function readLocal(uid: string): SaveData | null {
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? normalizeSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(uid: string, s: SaveData) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(s));
  } catch {
    /* storage full or blocked: cloud save still works */
  }
}

/** Renames a local save (kept as a backup, never read again by the game). */
function moveLocal(from: string, to: string) {
  try {
    const raw = localStorage.getItem(localKey(from));
    if (raw) localStorage.setItem(localKey(to), raw);
    localStorage.removeItem(localKey(from));
  } catch {
    /* storage blocked: nothing to move */
  }
}

const HARD_KEY = 'gq-hard-view';
function readHardView(): Record<number, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(HARD_KEY) ?? '{}');
  } catch {
    return {};
  }
}

let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;
let bootImpl: () => void = () => {};

/** Starts listening to Firebase auth (or falls back to guest/login). Call once at startup. */
export const boot = () => bootImpl();

export const useStore = create<AppStore>((set, get) => {
  const flushCloud = async () => {
    cloudTimer = null;
    const { player, save } = get();
    if (!player || player.guest) return;
    set({ sync: 'saving' });
    try {
      await writeCloudSave(player.uid, save);
      set({ sync: 'saved' });
    } catch (e) {
      console.error('Cloud save failed', e);
      set({ sync: 'error' });
    }
  };

  const persist = (s: SaveData) => {
    const { player } = get();
    if (!player) return;
    writeLocal(player.uid, s);
    if (player.guest) return;
    if (cloudTimer) clearTimeout(cloudTimer);
    set({ sync: 'saving' });
    cloudTimer = setTimeout(flushCloud, 1500);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && cloudTimer) {
        clearTimeout(cloudTimer);
        void flushCloud();
      }
    });
  }

  const enterGame = (player: Player, save: SaveData) => {
    // Restore the screen from the URL (a battle in progress always wins).
    const view = initialView(typeof location !== 'undefined' ? location.hash : '', save);
    set({ player, save, phase: 'game', view });
    writeHash(view, 'replace');
  };

  const loadAccount = async (user: { uid: string; displayName: string | null; photoURL: string | null }) => {
    set({ phase: 'loading', authError: null });
    const player: Player = { uid: user.uid, name: user.displayName ?? 'Commander', photo: user.photoURL, guest: false };
    const local = readLocal(user.uid);
    let cloud: SaveData | null = null;
    let cloudOk = true;
    try {
      const raw = await loadCloudSave(user.uid);
      cloud = raw ? normalizeSave(raw) : null;
    } catch (e) {
      console.error('Cloud load failed', e);
      cloudOk = false;
    }
    const choice = chooseAccountSave(local, cloud, cloudOk, readLocal('guest'));
    if (choice.kind === 'abort') {
      // We can't tell whether this account already has progress in the cloud: starting fresh would
      // overwrite it on the next save, so stop and let the player retry.
      await signOutUser();
      set({ phase: 'login', player: null, authError: "Couldn't load your cloud save. Check your connection and try again." });
      return;
    }
    const save = choice.save;
    // Guest progress moves into this account only once; other new accounts on this browser start fresh.
    if (choice.fromGuest) moveLocal('guest', `guest-moved-to-${user.uid}`);
    enterGame(player, save);
    set({ sync: cloudOk ? 'saved' : 'error' });
    localStorage.removeItem(GUEST_FLAG);
    if (!cloud || save.updatedAt > cloud.updatedAt) persist(save);
  };

  bootImpl = () => {
    // Browser Back/Forward move between screens — but never out of a battle in progress (only Retreat does that).
    window.addEventListener('popstate', () => {
      const { phase, save, view } = get();
      if (phase !== 'game') return;
      if (save.active && view.name === 'battle') return writeHash(view, 'replace');
      const next = hashToView(location.hash, save) ?? HOME;
      set({ view: next });
      writeHash(next, 'replace');
    });
    return watchAuth((user) => {
      if (user) {
        void loadAccount(user);
      } else if (localStorage.getItem(GUEST_FLAG)) {
        get().playAsGuest();
      } else {
        set({ phase: 'login', player: null });
      }
    });
  };

  return {
    phase: 'boot',
    player: null,
    save: defaultSave(),
    view: { name: 'hub', tab: 'campaign' },
    sync: 'local',
    toasts: [],
    settingsOpen: false,
    tutorialOpen: false,
    authError: null,
    hardView: readHardView(),
    toggleHard: (region) => get().setHardView(region, !get().hardView[region]),
    setHardView: (region, on) => {
      const hardView = { ...get().hardView, [region]: on };
      set({ hardView });
      try {
        sessionStorage.setItem(HARD_KEY, JSON.stringify(hardView));
      } catch {
        /* storage blocked: the toggle just won't survive a refresh */
      }
    },

    setView: (view) => {
      set({ view });
      if (get().phase === 'game') writeHash(view, 'push');
    },

    update: (fn) => {
      const s: SaveData = structuredClone(get().save);
      fn(s);
      s.updatedAt = Date.now();
      set({ save: s });
      persist(s);
    },

    toast: (text, icon) => {
      const t = { id: ++toastSeq, text, icon };
      set({ toasts: [...get().toasts, t] });
      setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 2800);
    },

    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setTutorialOpen: (tutorialOpen) => set({ tutorialOpen }),

    playAsGuest: () => {
      localStorage.setItem(GUEST_FLAG, '1');
      enterGame({ uid: 'guest', name: 'Guest', guest: true }, readLocal('guest') ?? defaultSave());
      set({ sync: 'local' });
    },

    signIn: async () => {
      if (!firebaseEnabled) {
        set({ authError: 'Google sign-in is not configured yet. See README → Firebase setup.' });
        return;
      }
      try {
        set({ authError: null });
        await signInWithGoogle();
      } catch (e) {
        set({ authError: (e as Error).message ?? 'Sign-in failed' });
      }
    },

    signOut: async () => {
      if (cloudTimer) {
        clearTimeout(cloudTimer);
        await flushCloud();
      }
      localStorage.removeItem(GUEST_FLAG);
      await signOutUser();
      set({ phase: 'login', player: null, save: defaultSave(), settingsOpen: false });
      clearHash();
    },

    resetProgress: () => {
      const keep = get().save.settings;
      const s = defaultSave();
      s.settings = keep;
      s.updatedAt = Date.now();
      set({ save: s, view: HOME, settingsOpen: false });
      writeHash(HOME, 'replace');
      persist(s);
    },
  };
});
