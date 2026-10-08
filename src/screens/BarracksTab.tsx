import { PieceGlyph } from '../components/Piece';
import { PIECES, PIECE_ORDER } from '../game/pieces';
import { count, type Counts } from '../state/save';
import { useStore } from '../state/store';

function ArmyRow({ counts, temp }: { counts: Counts; temp?: boolean }) {
  const types = PIECE_ORDER.filter((t) => count(counts, t) > 0);
  if (!types.length) return <p className="muted">—</p>;
  return (
    <div className="army-row">
      {types.map((t) => (
        <div key={t} className="army-slot">
          <PieceGlyph type={t} temp={temp} className="big" />
          <b>×{count(counts, t)}</b>
          <small>{PIECES[t].name}</small>
        </div>
      ))}
    </div>
  );
}

export function BarracksTab() {
  const save = useStore((s) => s.save);
  return (
    <div className="barracks">
      <section className="panel">
        <h2>🛡️ Army</h2>
        <ArmyRow counts={save.army} />
      </section>
      <section className="panel">
        <h2>⏳ Mercenaries <small>· one battle</small></h2>
        <ArmyRow counts={save.mercs} temp />
      </section>
    </div>
  );
}
