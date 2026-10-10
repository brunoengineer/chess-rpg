import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react';
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
  /** Player class levels, shown on pieces. */
  levels?: Partial<Record<PieceType, number>>;
  /** Squares a card can target right now. */
  targets?: Set<number>;
  onCell?: (x: number, y: number) => void;
  /* Drag & drop (deploy screen) */
  boardRef?: Ref<HTMLDivElement>;
  /** Squares holding a piece that can be dragged. */
  dragHandles?: Set<number>;
  onCellPointerDown?: (x: number, y: number, e: ReactPointerEvent) => void;
  /** Square under the dragged piece, and whether dropping there is allowed. */
  dropTarget?: { sq: number; ok: boolean } | null;
  /** Square whose piece is being dragged (shown faded). */
  draggingFrom?: number | null;
}

export function Board({
  battle, theme, selected, hints, hintTone = 'player', deployZone, fx = [], shake, dimmed, levels, targets, onCell,
  boardRef, dragHandles, onCellPointerDown, dropTarget, draggingFrom,
}: BoardProps) {
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
      <div className="board" ref={boardRef} style={{ aspectRatio: `${w} / ${h}` }}>
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
            targets?.has(i) && 'card-target',
            dragHandles?.has(i) && 'drag-handle',
            dropTarget?.sq === i && (dropTarget.ok ? 'drop-ok' : 'drop-bad'),
          ].filter(Boolean).join(' ');
          return (
            <div
              key={i}
              className={cls}
              onClick={() => onCell?.(x, y)}
              onPointerDown={onCellPointerDown && ((e) => onCellPointerDown(x, y, e))}
            >
              {c === -1 && <span className="rock-stone" />}
              {tele.has(i) && <span className="tele-icon">{telegraph!.kind === 'breath' ? '🔥' : '⚠'}</span>}
            </div>
          );
        })}

        {units.map((u) =>
          !u.alive ? null : (
            <div
              key={u.id}
              className={`unit ${u.id === selected ? 'selected' : ''} ${u.type === 'boss' ? 'is-boss' : ''} side-${u.side} ${
                draggingFrom === u.y * w + u.x ? 'drag-source' : ''
              }`}
              style={{ left: pct(u.x, w), top: pct(u.y, h), width: pct(u.size, w), height: pct(u.size, h) }}
            >
              {u.type === 'boss' ? (
                <BossToken kind={u.boss!} hp={u.hp ?? 0} maxHp={u.maxHp ?? 1} cd={u.cd} />
              ) : (
                <PieceGlyph
                  type={u.type as PieceType}
                  side={u.side}
                  temp={u.temp}
                  promoted={!!u.promotedFrom}
                  rank={u.rank}
                  level={u.side === 'P' ? levels?.[(u.promotedFrom ?? u.type) as PieceType] : undefined}
                  shield={u.shield}
                  frozen={(u.frozen ?? 0) > 0}
                />
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
