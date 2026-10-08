import type { CSSProperties } from 'react';
import type { RegionDef } from '../game/campaign';
import { PIECES } from '../game/pieces';
import type { Battle, PieceType, UnitType } from '../game/types';
import { BossToken, PieceGlyph } from './Piece';

export type HintKind = 'move' | 'capture' | 'strike';

export interface FxItem {
  key: number;
  kind: 'shatter' | 'coin' | 'hit' | 'promote' | 'summon' | 'blast' | 'fire';
  x: number;
  y: number;
  size?: number;
  text?: string;
  unitType?: UnitType;
  side?: 'P' | 'E';
}

interface BoardProps {
  battle: Pick<Battle, 'w' | 'h' | 'grid' | 'units' | 'lastMove' | 'telegraph'>;
  theme: RegionDef;
  selected?: number | null;
  hints?: Map<number, HintKind>;
  hintTone?: 'player' | 'enemy';
  deployZone?: Set<number>;
  fx?: FxItem[];
  shake?: boolean;
  dimmed?: boolean;
  onCell?: (x: number, y: number) => void;
}

export function Board({ battle, theme, selected, hints, hintTone = 'player', deployZone, fx = [], shake, dimmed, onCell }: BoardProps) {
  const { w, h, grid, units, lastMove, telegraph } = battle;
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const tele = new Set(telegraph?.squares ?? []);

  const style = {
    '--w': w,
    '--h': h,
    '--light': theme.light,
    '--dark': theme.dark,
    '--accent': theme.accent,
  } as CSSProperties;

  return (
    <div className={`board-frame ${shake ? 'shake' : ''} ${dimmed ? 'dimmed' : ''}`} style={style}>
      <div className="board" style={{ aspectRatio: `${w} / ${h}` }}>
        {grid.map((c, i) => {
          const x = i % w, y = Math.floor(i / w);
          const dark = (x + y) % 2 === 1;
          const hint = hints?.get(i);
          const isLast = lastMove && ((lastMove.fx === x && lastMove.fy === y) || (lastMove.tx === x && lastMove.ty === y));
          const cls = [
            'cell',
            dark ? 'dark' : 'light',
            c === -1 && 'rock',
            deployZone?.has(i) && 'deploy',
            isLast && 'last',
            tele.has(i) && `tele tele-${telegraph!.kind}`,
            hint && `hint hint-${hint} tone-${hintTone}`,
          ].filter(Boolean).join(' ');
          return (
            <div key={i} className={cls} onClick={() => onCell?.(x, y)}>
              {c === -1 && <span className="rock-stone" />}
              {tele.has(i) && <span className="tele-icon">{telegraph!.kind === 'breath' ? '🔥' : '⚠'}</span>}
            </div>
          );
        })}

        {units.map((u) =>
          !u.alive ? null : (
            <div
              key={u.id}
              className={`unit ${u.id === selected ? 'selected' : ''} ${u.type === 'boss' ? 'is-boss' : ''} side-${u.side}`}
              style={{ left: pct(u.x, w), top: pct(u.y, h), width: pct(u.size, w), height: pct(u.size, h) }}
            >
              {u.type === 'boss' ? (
                <BossToken kind={u.boss!} hp={u.hp ?? 0} maxHp={u.maxHp ?? 1} />
              ) : (
                <PieceGlyph type={u.type as PieceType} side={u.side} temp={u.temp} promoted={!!u.promotedFrom} />
              )}
            </div>
          ),
        )}

        {fx.map((f) => (
          <div
            key={f.key}
            className={`fx fx-${f.kind}`}
            style={{ left: pct(f.x, w), top: pct(f.y, h), width: pct(f.size ?? 1, w), height: pct(f.size ?? 1, h) }}
          >
            {f.kind === 'shatter' && f.unitType && f.unitType !== 'boss' && (
              <span className={`glyph side-${f.side}`}>
                <span className="glyph-main">{PIECES[f.unitType].glyph}</span>
              </span>
            )}
            {f.text && <span className="fx-text">{f.text}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
