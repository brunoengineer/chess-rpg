import { contentFor, type Lang } from './content';
import { en, type Dict } from './en';
import { pt } from './pt';

export type { Lang };
/** Everything a screen needs to render in one language: UI text + game content helpers. */
export type T = Dict & ReturnType<typeof contentFor> & { lang: Lang };

const BUNDLES: Record<Lang, T> = {
  en: { ...en, ...contentFor('en'), lang: 'en' },
  pt: { ...pt, ...contentFor('pt'), lang: 'pt' },
};

export const bundle = (lang: Lang): T => BUNDLES[lang];

const KEY = 'gq-lang';

/** Saved choice, else the browser language (Portuguese browsers start in pt-BR). */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function rememberLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage blocked: the choice lasts this session */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}
