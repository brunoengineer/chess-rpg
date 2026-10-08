import { useState } from 'react';
import { sfx } from '../audio';
import { MoveDiagram } from '../components/MoveDiagram';
import { PieceGlyph } from '../components/Piece';
import { STAGE_BY_ID, isPieceUnlocked } from '../game/campaign';
import { MAX_LEADERSHIP, leadershipCost } from '../game/economy';
import { PIECES, PIECE_ORDER, bossDamage } from '../game/pieces';
import type { PieceType } from '../game/types';
import { buyLeadership, buyPiece } from '../state/actions';
import { count } from '../state/save';
import { useStore } from '../state/store';

export function ShopTab() {
  const save = useStore((s) => s.save);
  const [flash, setFlash] = useState<string | null>(null);
  const bump = (key: string) => {
    sfx.buy();
    setFlash(key);
    setTimeout(() => setFlash(null), 500);
  };
  const lCost = leadershipCost(save.leadership);
  const maxed = save.leadership >= MAX_LEADERSHIP;

  return (
    <div className="shop">
      <section className={`panel leadership-card ${flash === 'lead' ? 'flash' : ''}`} title="Command points for deploying pieces">
        <div className="lead-icon">👑</div>
        <div className="lead-body">
          <h3>Leadership <span className="lead-level">{save.leadership}</span></h3>
          <div className="lead-bar">
            <i style={{ width: `${(save.leadership / MAX_LEADERSHIP) * 100}%` }} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={maxed || save.coins < lCost} onClick={() => buyLeadership() && bump('lead')}>
          {maxed ? 'Max' : <>+1 · 🪙 {lCost}</>}
        </button>
      </section>

      <div className="shop-grid">
        {PIECE_ORDER.map((t) => (
          <PieceCard key={t} type={t} flash={flash === t} onBought={() => bump(t)} />
        ))}
      </div>
    </div>
  );
}

function PieceCard({ type, flash, onBought }: { type: PieceType; flash: boolean; onBought: () => void }) {
  const save = useStore((s) => s.save);
  const def = PIECES[type];
  const unlocked = isPieceUnlocked(save.stages, type);
  const req = def.unlockedBy ? STAGE_BY_ID[def.unlockedBy] : null;
  const owned = count(save.army, type);
  const mercs = count(save.mercs, type);
  return (
    <article className={`panel piece-card ${unlocked ? '' : 'locked'} ${flash ? 'flash' : ''}`}>
      <header>
        <PieceGlyph type={type} className="big" />
        <div>
          <h3>{def.name}</h3>
          <div className="chips">
            <span className="chip" title="Command cost">👑 {def.command}</span>
            <span className="chip" title="Boss damage">⚔ {bossDamage(type)}</span>
            {owned > 0 && <span className="chip owned-chip" title="Owned">🛡️ {owned}</span>}
            {mercs > 0 && <span className="chip" title="Mercenaries">⏳ {mercs}</span>}
          </div>
        </div>
      </header>
      <MoveDiagram type={type} />
      {unlocked ? (
        <div className="buy-row">
          <button className="btn btn-primary" disabled={save.coins < def.price} onClick={() => buyPiece(type, false) && onBought()} title="Yours forever">
            Buy · 🪙 {def.price}
          </button>
          <button className="btn btn-ghost" disabled={save.coins < def.mercPrice} onClick={() => buyPiece(type, true) && onBought()} title="One battle only">
            ⏳ Hire · 🪙 {def.mercPrice}
          </button>
        </div>
      ) : (
        <p className="lock-note">🔒 Clear {req?.id}</p>
      )}
    </article>
  );
}
