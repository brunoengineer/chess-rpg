import { BOSSES } from '../game/bosses';
import { PIECES } from '../game/pieces';
import type { BossKind, PieceType, Side } from '../game/types';

interface GlyphProps {
  type: PieceType;
  side?: Side;
  temp?: boolean;
  promoted?: boolean;
  className?: string;
}

/** A chess glyph colored by side, with badges for fairy pieces, mercenaries and promotions. */
export function PieceGlyph({ type, side = 'P', temp, promoted, className = '' }: GlyphProps) {
  const def = PIECES[type];
  return (
    <span className={`glyph side-${side} ${temp ? 'is-temp' : ''} ${className}`}>
      <span className="glyph-main">{def.glyph}</span>
      {def.badge && <span className="glyph-badge">{def.badge}</span>}
      {promoted && <span className="glyph-crown">✦</span>}
      {temp && <span className="glyph-temp" title="Mercenary (one battle)">⏳</span>}
    </span>
  );
}

export function BossToken({ kind, hp, maxHp }: { kind: BossKind; hp: number; maxHp: number }) {
  const def = BOSSES[kind];
  return (
    <span className="boss-token" style={{ ['--aura' as string]: def.aura }}>
      <span className="boss-emoji">{def.emoji}</span>
      <span className="boss-hp">
        {Array.from({ length: maxHp }, (_, i) => (
          <i key={i} className={i < hp ? 'on' : ''} />
        ))}
      </span>
    </span>
  );
}
