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
      <section className={`panel leadership-card ${flash === 'lead' ? 'flash' : ''}`}>
        <div className="lead-icon">👑</div>
        <div className="lead-body">
          <h3>Leadership <span className="lead-level">{save.leadership}</span></h3>
          <p>Command points you can spend when deploying an army. Each piece costs its command value (Pawn 1, Knight 3, Rook 5, Queen 9…).</p>
          <div className="lead-bar">
            <i style={{ width: `${(save.leadership / MAX_LEADERSHIP) * 100}%` }} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={maxed || save.coins < lCost} onClick={() => buyLeadership() && bump('lead')}>
          {maxed ? 'Maxed' : <>+1 for 🪙 {lCost}</>}
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
  return (
    <article className={`panel piece-card ${unlocked ? '' : 'locked'} ${flash ? 'flash' : ''}`}>
      <header>
        <PieceGlyph type={type} className="big" />
        <div>
          <h3>{def.name}</h3>
          <div className="chips">
            <span className="chip" title="Command points to deploy">👑 {def.command}</span>
            <span className="chip" title="Material value (loot when captured)">💎 {def.value}</span>
            <span className="chip" title="Damage dealt to bosses">⚔ {bossDamage(type)}</span>
          </div>
        </div>
      </header>
      <MoveDiagram type={type} />
      <p className="piece-desc">{def.desc}</p>
      {unlocked ? (
        <>
          <p className="owned">
            Owned: <b>{count(save.army, type)}</b> {count(save.mercs, type) > 0 && <>· Mercs: <b>{count(save.mercs, type)}</b></>}
            {count(save.fallen, type) > 0 && <> · Fallen: <b>{count(save.fallen, type)}</b></>}
          </p>
          <div className="buy-row">
            <button className="btn btn-primary" disabled={save.coins < def.price} onClick={() => buyPiece(type, false) && onBought()}>
              Recruit <span>🪙 {def.price}</span>
            </button>
            <button className="btn btn-ghost" disabled={save.coins < def.mercPrice} onClick={() => buyPiece(type, true) && onBought()} title="Fights in one battle only, then leaves">
              ⏳ Hire <span>🪙 {def.mercPrice}</span>
            </button>
          </div>
        </>
      ) : (
        <p className="lock-note">🔒 Clear <b>{req?.id} · {req?.name}</b> to unlock</p>
      )}
    </article>
  );
}
