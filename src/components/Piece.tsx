import { BOSSES } from '../game/bosses';
import { PIECES } from '../game/pieces';
import { RANKS } from '../game/ranks';
import type { BossKind, PieceType, Side } from '../game/types';

interface GlyphProps {
  type: PieceType;
  side?: Side;
  temp?: boolean;
  promoted?: boolean;
  /** Player pieces show "Lv N"; enemies only show their rank insignia. */
  level?: number;
  rank?: number;
  shield?: boolean;
  frozen?: boolean;
  className?: string;
}

/** A chess glyph colored by side (and skin), with badges for fairy pieces, mercenaries, ranks and effects. */
export function PieceGlyph({ type, side = 'P', temp, promoted, level, rank = 0, shield, frozen, className = '' }: GlyphProps) {
  const def = PIECES[type];
  const showTag = (level ?? 0) > 0 || rank > 0;
  return (
    <span className={`glyph side-${side} ${temp ? 'is-temp' : ''} ${frozen ? 'is-frozen' : ''} ${className}`}>
      <span className="glyph-main">{def.glyph}</span>
      {def.badge && <span className="glyph-badge">{def.badge}</span>}
      {promoted && <span className="glyph-crown">✦</span>}
      {temp && <span className="glyph-temp" title="Mercenary">⏳</span>}
      {shield && <span className="glyph-shield" title="Shield">🛡️</span>}
      {frozen && <span className="glyph-frozen">❄️</span>}
      {showTag && (
        <span className="glyph-tag" title={RANKS[rank]}>
          {rank > 0 && <Insignia rank={rank} />}
          {level !== undefined && level > 0 && <span>{level}</span>}
        </span>
      )}
    </span>
  );
}

const STAR = 'M7 0.2 8.18 3.38 11.57 3.52 8.9 5.62 9.82 8.88 7 7 4.18 8.88 5.1 5.62 2.44 3.52 5.82 3.38Z';

/** Small military insignia: chevrons, bar, diamond, star, two stars. */
export function Insignia({ rank }: { rank: number }) {
  const gold = '#ffd36b', silver = '#dfe6f0';
  return (
    <svg className="insignia" viewBox="0 0 14 10" aria-label={RANKS[rank]}>
      {rank === 1 && (
        <g fill="none" stroke={gold} strokeWidth="1.8" strokeLinejoin="round">
          <path d="M2 4.5 7 1.5 12 4.5" />
          <path d="M2 8.5 7 5.5 12 8.5" />
        </g>
      )}
      {rank === 2 && <rect x="5" y="0.5" width="4" height="9" rx="0.8" fill={silver} stroke="#6b7280" strokeWidth="0.6" />}
      {rank === 3 && <path d="M7 0.5 12 5 7 9.5 2 5Z" fill={gold} />}
      {rank === 4 && <path d={STAR} fill={silver} />}
      {rank === 5 && (
        <g fill={gold}>
          <path d={STAR} transform="translate(-1.3 1.5) scale(.7)" />
          <path d={STAR} transform="translate(5.5 1.5) scale(.7)" />
        </g>
      )}
    </svg>
  );
}

export function BossToken({ kind, hp, maxHp, cd }: { kind: BossKind; hp: number; maxHp: number; cd?: number }) {
  const def = BOSSES[kind];
  return (
    <span className={`boss-token ${(cd ?? 0) > 1 ? 'stunned' : ''}`} style={{ ['--aura' as string]: def.aura }}>
      <span className="boss-emoji">{def.emoji}</span>
      <span className="boss-hp">
        {Array.from({ length: maxHp }, (_, i) => (
          <i key={i} className={i < hp ? 'on' : ''} />
        ))}
      </span>
    </span>
  );
}
