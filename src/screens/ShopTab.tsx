import { useEffect, useState } from 'react';
import { sfx } from '../audio';
import { MoveDiagram } from '../components/MoveDiagram';
import { PieceGlyph } from '../components/Piece';
import { REGIONS, STAGE_BY_ID, isCleared, isPieceUnlocked } from '../game/campaign';
import { CARDS, CARD_ORDER, MAX_CARD_SLOTS, cardSlotCost, type CardId } from '../game/cards';
import { BOARD_SKINS, PIECE_SKINS, skinKey, type Skin } from '../game/cosmetics';
import { MAX_LEADERSHIP, leadershipCost } from '../game/economy';
import { PIECES, PIECE_ORDER, bossDamage } from '../game/pieces';
import { profile } from '../game/ranks';
import type { PieceType } from '../game/types';
import { buyCard, buyCardSlot, buyLeadership, buyPiece, buySkin, equipSkin } from '../state/actions';
import { classRanks, count } from '../state/save';
import { useT } from '../i18n';
import { useStore, type ShopSection } from '../state/store';

function useFlash() {
  const [flash, setFlash] = useState<string | null>(null);
  const bump = (key: string) => {
    sfx.buy();
    setFlash(key);
    setTimeout(() => setFlash(null), 500);
  };
  return { flash, bump };
}

export function ShopTab() {
  const t = useT();
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  // The section lives in the view, so links (e.g. "New cards" after a win) can open it directly.
  const section: ShopSection = (view.name === 'hub' && view.section) || 'army';
  const focus = view.name === 'hub' ? view.focus : undefined;
  const setSection = (s: ShopSection) => setView({ name: 'hub', tab: 'shop', section: s });

  // Scroll to and highlight the item a link pointed at.
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector<HTMLElement>(`[data-focus="${focus}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('focus-flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('focus-flash');
  }, [section, focus]);

  return (
    <div className="shop">
      <nav className="segmented">
        {(
          [
            ['army', '♞'],
            ['cards', '🃏'],
            ['style', '🎨'],
          ] as const
        ).map(([id, icon]) => (
          <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
            {icon} {t.shop[id]}
          </button>
        ))}
      </nav>
      {section === 'army' && <ArmySection />}
      {section === 'cards' && <CardsSection />}
      {section === 'style' && <StyleSection />}
    </div>
  );
}

/* ---------------- Army ---------------- */

function ArmySection() {
  const save = useStore((s) => s.save);
  const t = useT();
  const { flash, bump } = useFlash();
  const lCost = leadershipCost(save.leadership);
  const maxed = save.leadership >= MAX_LEADERSHIP;
  return (
    <>
      <section className={`panel leadership-card ${flash === 'lead' ? 'flash' : ''}`} title={t.shop.leadershipTitle}>
        <div className="lead-icon">👑</div>
        <div className="lead-body">
          <h3>{t.shop.leadership} <span className="lead-level">{save.leadership}</span></h3>
          <div className="lead-bar">
            <i style={{ width: `${(save.leadership / MAX_LEADERSHIP) * 100}%` }} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={maxed || save.coins < lCost} onClick={() => buyLeadership() && bump('lead')}>
          {maxed ? t.shop.max : <>+1 · 🪙 {lCost}</>}
        </button>
      </section>
      <div className="shop-grid">
        {PIECE_ORDER.map((t) => (
          <PieceCard key={t} type={t} flash={flash === t} onBought={() => bump(t)} />
        ))}
      </div>
    </>
  );
}

function PieceCard({ type, flash, onBought }: { type: PieceType; flash: boolean; onBought: () => void }) {
  const save = useStore((s) => s.save);
  const t = useT();
  const def = PIECES[type];
  const unlocked = isPieceUnlocked(save.stages, type);
  const req = def.unlockedBy ? STAGE_BY_ID[def.unlockedBy] : null;
  const owned = count(save.army, type);
  const mercs = count(save.mercs, type);
  const rank = classRanks(save.xp)[type] ?? 0;
  return (
    <article className={`panel piece-card ${unlocked ? '' : 'locked'} ${flash ? 'flash' : ''}`} data-focus={`piece:${type}`}>
      <header>
        <PieceGlyph type={type} className="big" />
        <div>
          <h3>{t.piece(type)}</h3>
          <div className="chips">
            <span className="chip" title={t.shop.commandCost}>👑 {def.command}</span>
            <span className="chip" title={t.shop.bossDamage}>⚔ {bossDamage(type) + profile(type, rank).bossDmg}</span>
            {owned > 0 && <span className="chip" title={t.shop.owned}>🛡️ {owned}</span>}
            {mercs > 0 && <span className="chip" title={t.shop.mercs}>⏳ {mercs}</span>}
          </div>
        </div>
      </header>
      <MoveDiagram type={type} rank={rank} />
      {unlocked ? (
        <div className="buy-row">
          <button className="btn btn-primary" disabled={save.coins < def.price} onClick={() => buyPiece(type, false) && onBought()} title={t.shop.yoursForever}>
            <span>{t.shop.buy}</span>
            <small>🪙 {def.price}</small>
          </button>
          <button className="btn btn-ghost" disabled={save.coins < def.mercPrice} onClick={() => buyPiece(type, true) && onBought()} title={t.shop.oneBattle}>
            <span>⏳ {t.shop.hire}</span>
            <small>🪙 {def.mercPrice}</small>
          </button>
        </div>
      ) : (
        <p className="lock-note">🔒 {t.shop.clear(req?.id ?? '')}</p>
      )}
    </article>
  );
}

/* ---------------- Cards ---------------- */

function CardsSection() {
  const save = useStore((s) => s.save);
  const t = useT();
  const { flash, bump } = useFlash();
  const maxed = save.cardSlots >= MAX_CARD_SLOTS;
  const slotPrice = cardSlotCost(save.cardSlots);
  return (
    <>
      <section className={`panel leadership-card ${flash === 'slot' ? 'flash' : ''}`}>
        <div className="lead-icon">🃏</div>
        <div className="lead-body">
          <h3>{t.shop.cardSlots} <span className="lead-level">{save.cardSlots}</span></h3>
          <p className="muted small">{t.shop.cardRules}</p>
        </div>
        <button className="btn btn-primary" disabled={maxed || save.coins < slotPrice} onClick={() => buyCardSlot() && bump('slot')}>
          {maxed ? t.shop.max : <>+1 · 🪙 {slotPrice.toLocaleString()}</>}
        </button>
      </section>
      <div className="card-grid">
        {CARD_ORDER.map((id) => (
          <CardTile key={id} id={id} flash={flash === id} onBought={() => bump(id)} />
        ))}
      </div>
    </>
  );
}

function CardTile({ id, flash, onBought }: { id: CardId; flash: boolean; onBought: () => void }) {
  const save = useStore((s) => s.save);
  const t = useT();
  const def = CARDS[id];
  const unlocked = isCleared(save.stages, def.unlockedBy);
  const owned = save.cards[id] ?? 0;
  return (
    <article className={`game-card ${unlocked ? '' : 'locked'} ${flash ? 'flash' : ''} ${def.pre ? 'pre' : ''}`} data-focus={`card:${id}`}>
      <div className="game-card-icon">{def.icon}</div>
      <b>{t.cardName(id)}</b>
      <small>{t.cardDesc(id)}</small>
      {owned > 0 && <span className="game-card-count">×{owned}</span>}
      {unlocked ? (
        <button className="btn btn-primary btn-small" disabled={save.coins < def.price} onClick={() => buyCard(id) && onBought()}>
          🪙 {def.price}
        </button>
      ) : (
        <span className="lock-note">🔒 {def.unlockedBy}</span>
      )}
    </article>
  );
}

/* ---------------- Style ---------------- */

function StyleSection() {
  const t = useT();
  return (
    <>
      <h3 className="section-title">{t.shop.pieces}</h3>
      <div className="skin-grid">
        {PIECE_SKINS.map((s) => (
          <SkinTile key={s.id} kind="piece" skin={s} />
        ))}
      </div>
      <h3 className="section-title">{t.shop.board}</h3>
      <div className="skin-grid">
        {BOARD_SKINS.map((s) => (
          <SkinTile key={s.id} kind="board" skin={s} />
        ))}
      </div>
    </>
  );
}

function SkinTile({ kind, skin }: { kind: 'piece' | 'board'; skin: Skin }) {
  const save = useStore((s) => s.save);
  const t = useT();
  const owned = skin.price === 0 && !skin.earnedWorld ? true : save.cosmetics.owned.includes(skinKey(kind, skin.id));
  const equipped = (kind === 'piece' ? save.cosmetics.piece : save.cosmetics.board) === skin.id;
  const region = REGIONS.find((r) => r.id === skin.earnedWorld);
  return (
    <article className={`skin-tile ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}`} data-focus={`skin:${kind}:${skin.id}`}>
      {kind === 'piece' ? (
        <div className="skin-preview" data-skin={skin.id}>
          <PieceGlyph type="knight" />
          <PieceGlyph type="queen" />
          <PieceGlyph type="pawn" />
        </div>
      ) : (
        <div className="board-preview" data-board={skin.id} style={{ ['--light' as string]: REGIONS[0].light, ['--dark' as string]: REGIONS[0].dark }}>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={`cell ${(i + Math.floor(i / 4)) % 2 ? 'dark' : 'light'}`} />
          ))}
        </div>
      )}
      <b>{t.skin(kind, skin.id)}</b>
      {equipped ? (
        <span className="equipped-tag">✓</span>
      ) : owned ? (
        <button className="btn btn-ghost btn-small" onClick={() => equipSkin(kind, skin.id)}>{t.shop.use}</button>
      ) : skin.earnedWorld ? (
        <span className="lock-note" title={t.shop.earnedIn(region ? t.region(region) : '')}>★30 {region?.icon}</span>
      ) : (
        <button className="btn btn-primary btn-small" disabled={save.coins < skin.price} onClick={() => buySkin(kind, skin.id) && sfx.buy()}>
          🪙 {skin.price.toLocaleString()}
        </button>
      )}
    </article>
  );
}
