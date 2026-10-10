import { useStore } from '../state/store';
import { bundle, type T } from './bundles';

export type { Lang, T } from './bundles';

/** Text for the current language (re-renders when the player switches). */
export function useT(): T {
  return bundle(useStore((s) => s.lang));
}

/** Text for the current language, outside React (toasts from game actions). */
export const tNow = (): T => bundle(useStore.getState().lang);
