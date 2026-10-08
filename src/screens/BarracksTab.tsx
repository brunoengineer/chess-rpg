import { sfx } from '../audio';
import { PieceGlyph } from '../components/Piece';
import { reviveCost } from '../game/economy';
import { PIECES, PIECE_ORDER } from '../game/pieces';
import { revivePiece } from '../state/actions';
import { count, type Counts } from '../state/save';
import { useStore } from '../state/store';

function ArmyRow({ counts, temp }: { counts: Counts; temp?: boolean }) {
  const types = PIECE_ORDER.filter((t) => count(counts, t) > 0);
  if (!types.length) return <p className="muted">Nobody here yet.</p>;
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
  const fallen = PIECE_ORDER.filter((t) => count(save.fallen, t) > 0);
  const totalCommand = PIECE_ORDER.reduce((a, t) => a + count(save.army, t) * PIECES[t].command, 0);
  return (
    <div className="barracks">
      <section className="panel">
        <h2>🛡️ Your Army</h2>
        <p className="muted">
          Permanent pieces. They come home after every battle — unless they fall. Total command: {totalCommand} · Leadership: {save.leadership}
        </p>
        <ArmyRow counts={save.army} />
      </section>
      <section className="panel">
        <h2>⏳ Mercenaries</h2>
        <p className="muted">Hired swords: cheap, but they leave after one battle (win or lose).</p>
        <ArmyRow counts={save.mercs} temp />
      </section>
      <section className="panel graveyard">
        <h2>🪦 The Fallen</h2>
        <p className="muted">Permanent pieces lost in battle. The healers can bring them back for half their price.</p>
        {fallen.length === 0 ? (
          <p className="muted">No one has fallen. Yet.</p>
        ) : (
          <div className="army-row">
            {fallen.map((t) => (
              <div key={t} className="army-slot fallen">
                <PieceGlyph type={t} className="big" />
                <b>×{count(save.fallen, t)}</b>
                <button className="btn btn-small" disabled={save.coins < reviveCost(t)} onClick={() => revivePiece(t) && sfx.buy()}>
                  ✨ 🪙 {reviveCost(t)}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
