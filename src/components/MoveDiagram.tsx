import { createBattle, genUnitMoves } from '../game/engine';
import type { PieceType } from '../game/types';
import { PieceGlyph } from './Piece';

const N = 7;
const C = 3;

/** Small grid showing how a piece moves, computed by the real engine. */
export function MoveDiagram({ type }: { type: PieceType }) {
  const marks = new Map<number, 'move' | 'capture'>();
  const b = createBattle(
    { id: 'diagram', region: 0, name: '', w: N, h: N, deployRows: 0, layout: [], ai: { depth: 0, blunder: 0, noise: 0 }, reward: 0, lootMult: 0, maxTurns: 1 },
    [{ type, temp: false, x: C, y: C }],
  );
  for (const m of genUnitMoves(b, 0)) marks.set(m.y * N + m.x, 'move');
  if (type === 'pawn') {
    marks.set((C - 1) * N + C - 1, 'capture');
    marks.set((C - 1) * N + C + 1, 'capture');
  }
  return (
    <div className="move-diagram" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
      {Array.from({ length: N * N }, (_, i) => {
        const x = i % N, y = Math.floor(i / N);
        const mark = marks.get(i);
        return (
          <div key={i} className={`md-cell ${(x + y) % 2 ? 'dark' : 'light'}`}>
            {i === C * N + C ? <PieceGlyph type={type} /> : mark ? <span className={`md-${mark}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}
