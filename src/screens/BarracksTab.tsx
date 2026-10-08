import { PieceGlyph } from '../components/Piece';
import { CARDS, CARD_ORDER } from '../game/cards';
import { PIECES, PIECE_ORDER } from '../game/pieces';
import { PERKS, RANKS, commandCost, levelInfo } from '../game/ranks';
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
  const classes = PIECE_ORDER.filter((t) => count(save.army, t) > 0 || (save.xp[t] ?? 0) > 0);
  const cards = CARD_ORDER.filter((c) => (save.cards[c] ?? 0) > 0);
  return (
    <div className="barracks">
      <section className="panel">
        <h2>🛡️ Army</h2>
        <div className="class-list">
          {classes.map((t) => {
            const info = levelInfo(save.xp[t] ?? 0);
            return (
              <div key={t} className="class-row">
                <PieceGlyph type={t} className="big" level={info.level} rank={info.rank} />
                <div className="class-body">
                  <div className="class-head">
                    <b>{PIECES[t].name}</b>
                    <span className="muted small">×{count(save.army, t)}</span>
                    <span className="class-rank">{RANKS[info.rank]} · Lv {info.level}</span>
                    <span className="chip" title="Command cost">👑 {commandCost(t, info.rank)}</span>
                  </div>
                  <div className="xp-bar" title={info.need ? `${info.into}/${info.need} XP` : 'Max level'}>
                    <i style={{ width: `${info.need ? (info.into / info.need) * 100 : 100}%` }} />
                  </div>
                  <div className="perks">
                    {PERKS[t].map((p, i) => (
                      <span key={i} className={`perk ${i < info.rank ? 'on' : ''}`} title={`${RANKS[i + 1]}: ${p.name}`}>
                        {p.icon}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>⏳ Mercenaries <small>· one battle</small></h2>
        <ArmyRow counts={save.mercs} temp />
      </section>
      <section className="panel">
        <h2>🃏 Cards</h2>
        {cards.length ? (
          <div className="army-row">
            {cards.map((c) => (
              <div key={c} className="army-slot" title={CARDS[c].desc}>
                <span className="big-icon small-icon">{CARDS[c].icon}</span>
                <b>×{save.cards[c]}</b>
                <small>{CARDS[c].name}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">—</p>
        )}
      </section>
    </div>
  );
}
