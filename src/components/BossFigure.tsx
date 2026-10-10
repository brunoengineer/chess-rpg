import type { ReactElement } from 'react';
import type { BossKind } from '../game/types';

/**
 * Boss silhouettes drawn like the enemy chess pieces: obsidian fill, salmon outline, a piece pedestal.
 * `.glow` parts (eyes, windows, orbs) use the boss's aura color. viewBox 0..100, pedestal at the bottom.
 */
const SHAPES: Record<BossKind, ReactElement> = {
  golem: (
    <>
      <rect className="body" x="33" y="61" width="13" height="17" rx="2" />
      <rect className="body" x="54" y="61" width="13" height="17" rx="2" />
      <rect className="body" x="13" y="37" width="15" height="30" rx="4" />
      <rect className="body" x="72" y="37" width="15" height="30" rx="4" />
      <path className="body" d="M27 35 H73 L68 64 H32 Z" />
      <rect className="body" x="38" y="14" width="24" height="22" rx="4" />
      <rect className="glow" x="42" y="22" width="6" height="4" rx="1" />
      <rect className="glow" x="52" y="22" width="6" height="4" rx="1" />
      <path className="line" d="M50 40 L45 48 L52 52 L47 60" />
      <path className="line" d="M33 44 H40 M60 50 H67" />
    </>
  ),
  steed: (
    <>
      <path className="body" d="M60 20 L66 7 L68 19 L77 10 L77 25 L88 21 L83 33 L92 35 L82 44 L76 40 Z" />
      <path className="body" d="M34 78 L38 61 C27 58 17 50 15 41 C14 34 18 30 25 29 L35 26 L39 11 L46 21 C53 16 63 17 71 26 C81 37 83 56 74 78 Z" />
      <circle className="glow" cx="37" cy="34" r="3.6" />
      <circle className="line" cx="21" cy="39" r="1.6" />
      <path className="line" d="M30 46 C36 48 42 47 46 44" />
    </>
  ),
  malakar: (
    <>
      <rect className="body" x="78" y="16" width="4" height="62" rx="2" />
      <circle className="glow" cx="80" cy="13" r="6" />
      <path className="body" d="M30 78 L36 55 H64 L70 78 Z" />
      <path className="body" d="M50 7 C62 18 68 30 66 42 C64 51 58 56 50 56 C42 56 36 51 34 42 C32 30 38 18 50 7 Z" />
      <path className="line" d="M45 17 L57 31" />
      <circle className="glow" cx="45" cy="44" r="2.2" />
      <circle className="glow" cx="55" cy="44" r="2.2" />
      <path className="line" d="M50 60 V74 M44 66 H56" />
    </>
  ),
  colossus: (
    <>
      <rect className="body" x="32" y="64" width="12" height="14" rx="2" />
      <rect className="body" x="56" y="64" width="12" height="14" rx="2" />
      <rect className="body" x="13" y="32" width="13" height="27" rx="4" />
      <rect className="body" x="74" y="32" width="13" height="27" rx="4" />
      <path className="body" d="M27 14 H36 V21 H44 V14 H56 V21 H64 V14 H73 V66 H27 Z" />
      <rect className="glow" x="36" y="31" width="7" height="9" rx="1" />
      <rect className="glow" x="57" y="31" width="7" height="9" rx="1" />
      <path className="glow dim" d="M43 66 V55 A7 7 0 0 1 57 55 V66 Z" />
      <path className="line" d="M27 46 H73" />
    </>
  ),
  dragon: (
    <>
      <path className="body" d="M58 44 L84 12 L80 31 L95 26 L84 46 L94 50 L66 60 Z" />
      <path className="body" d="M40 78 C38 66 42 58 48 52 L40 51 L26 56 L11 51 L20 45 L13 40 L33 38 L39 30 L34 15 L47 27 L52 13 L58 30 C67 36 70 48 66 58 C63 66 63 72 66 78 Z" />
      <circle className="glow" cx="41" cy="41" r="3" />
      <path className="line" d="M20 51 L23 48 L26 52 L29 49 L32 53" />
      <path className="line" d="M52 60 C55 64 55 70 52 74" />
    </>
  ),
};

export function BossFigure({ kind, className = '' }: { kind: BossKind; className?: string }) {
  return (
    <svg className={`boss-figure ${className}`} viewBox="0 0 100 100" aria-hidden>
      {SHAPES[kind]}
      <rect className="body" x="25" y="77" width="50" height="8" rx="2" />
      <rect className="body" x="17" y="84" width="66" height="9" rx="3" />
    </svg>
  );
}
