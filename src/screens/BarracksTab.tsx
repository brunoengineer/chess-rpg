import { useState } from 'react';
import { Modal } from '../components/Modal';
import { MoveDiagram } from '../components/MoveDiagram';
import { Insignia, PieceGlyph } from '../components/Piece';
import { RankTrack } from '../components/RankTrack';
import { CARDS, CARD_ORDER } from '../game/cards';
import { useT } from '../i18n';
import { PIECE_ORDER, bossDamage } from '../game/pieces';
import { PERKS, commandCost, levelInfo, profile } from '../game/ranks';
import type { PieceType } from '../game/types';
import { count, type Counts } from '../state/save';
import { useStore } from '../state/store';

function ArmyRow({ counts, temp }: { counts: Counts; temp?: boolean }) {
  const tr = useT();
  const types = PIECE_ORDER.filter((t) => count(counts, t) > 0);
  if (!types.length) return <p className="muted">—</p>;
  return (
    <div className="army-row">
      {types.map((t) => (
        <div key={t} className="army-slot">
          <PieceGlyph type={t} temp={temp} className="big" />
          <b>×{count(counts, t)}</b>
          <small>{tr.piece(t)}</small>
        </div>
      ))}
    </div>
  );
}

/** What a piece class can do at each rank: tap a row in the Barracks to open it. */
function AbilitiesModal({ type, onClose }: { type: PieceType; onClose: () => void }) {
  const xp = useStore((s) => s.save.xp[type] ?? 0);
  const t = useT();
  const info = levelInfo(xp);
  const next = info.rank < 5 ? (info.rank + 1) * 10 : null;
  return (
    <Modal onClose={onClose} className="abilities">
      <header className="abilities-head">
        <PieceGlyph type={type} className="big" level={info.level} rank={info.rank} />
        <div>
          <h2>{t.piece(type)}</h2>
          <small>
            {t.rank(info.rank)} · {t.levels.lv(info.level)}
            {next && <> · {t.barracks.nextRank(t.rank(info.rank + 1), next)}</>}
          </small>
        </div>
      </header>
      <RankTrack xp={xp} />
      <div className="chips abilities-stats">
        <span className="chip" title={t.shop.commandCost}>👑 {commandCost(type, info.rank)}</span>
        <span className="chip" title={t.shop.bossDamage}>⚔ {bossDamage(type) + profile(type, info.rank).bossDmg}</span>
      </div>
      <MoveDiagram type={type} rank={info.rank} />
      <ol className="ability-list">
        {PERKS[type].map((perk, i) => {
          const rank = i + 1;
          const on = info.rank >= rank;
          return (
            <li key={i} className={on ? 'on' : ''}>
              <span className="ability-icon">{perk.icon}</span>
              <div>
                <div className="ability-title">
                  <b>{t.perkName(perk)}</b>
                  <span className="ability-rank">
                    <Insignia rank={rank} /> {t.rank(rank)} · {t.levels.lv(rank * 10)}
                  </span>
                </div>
                <small>{t.perkDesc(perk)}</small>
              </div>
              <span className="ability-state">{on ? '✓' : '🔒'}</span>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}

export function BarracksTab() {
  const save = useStore((s) => s.save);
  const [open, setOpen] = useState<PieceType | null>(null);
  const tr = useT();
  const classes = PIECE_ORDER.filter((t) => count(save.army, t) > 0 || (save.xp[t] ?? 0) > 0);
  const cards = CARD_ORDER.filter((c) => (save.cards[c] ?? 0) > 0);
  return (
    <div className="barracks">
      {open && <AbilitiesModal type={open} onClose={() => setOpen(null)} />}
      <section className="panel">
        <h2>{tr.barracks.army}</h2>
        <div className="class-list">
          {classes.map((t) => {
            const info = levelInfo(save.xp[t] ?? 0);
            return (
              <button key={t} className="class-row" onClick={() => setOpen(t)} title={tr.barracks.seeAbilities}>
                <PieceGlyph type={t} className="big" level={info.level} rank={info.rank} />
                <div className="class-body">
                  <div className="class-head">
                    <b>{tr.piece(t)}</b>
                    <span className="muted small">×{count(save.army, t)}</span>
                    <span className="class-rank">{tr.rank(info.rank)} · {tr.levels.lv(info.level)}</span>
                    <span className="chip" title={tr.shop.commandCost}>👑 {commandCost(t, info.rank)}</span>
                  </div>
                  <RankTrack xp={save.xp[t] ?? 0} />
                  <div className="perks">
                    {PERKS[t].map((p, i) => (
                      <span key={i} className={`perk ${i < info.rank ? 'on' : ''}`} title={`${tr.rank(i + 1)}: ${tr.perkName(p)}`}>
                        {p.icon}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="class-more">›</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>{tr.barracks.mercs} <small>{tr.barracks.oneBattle}</small></h2>
        <ArmyRow counts={save.mercs} temp />
      </section>
      <section className="panel">
        <h2>{tr.barracks.cards}</h2>
        {cards.length ? (
          <div className="army-row">
            {cards.map((c) => (
              <div key={c} className="army-slot" title={tr.cardDesc(c)}>
                <span className="big-icon small-icon">{CARDS[c].icon}</span>
                <b>×{save.cards[c]}</b>
                <small>{tr.cardName(c)}</small>
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
