import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useStore } from '../state/store';
import { Modal } from './Modal';
import { BossFigure } from './BossFigure';
import { Insignia, PieceGlyph } from './Piece';


/* ---------------- Visuals ---------------- */

function Journey() {
  return (
    <div className="tut-journey">
      <PieceGlyph type="pawn" />
      <span className="tut-arrow">→</span>
      <PieceGlyph type="knight" />
      <span className="tut-arrow">→</span>
      <PieceGlyph type="queen" />
      <span className="tut-arrow">→</span>
      <BossFigure kind="dragon" className="tut-boss" />
    </div>
  );
}

function DragDemo() {
  return (
    <div className="tut-drag">
      <div className="tut-board">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`tut-cell ${(i + Math.floor(i / 4)) % 2 ? 'dark' : 'light'} ${i >= 8 ? 'deploy' : ''}`}>
            {i === 1 && <PieceGlyph type="pawn" side="E" />}
            {i === 2 && <PieceGlyph type="knight" side="E" />}
          </span>
        ))}
      </div>
      <div className="tut-tray">
        <PieceGlyph type="pawn" />
      </div>
      <span className="tut-ghost">
        <PieceGlyph type="pawn" />
      </span>
      <span className="tut-finger">👆</span>
    </div>
  );
}

function ShopDemo() {
  const t = useT();
  return (
    <div className="tut-row">
      <span className="tut-coins">🪙 120</span>
      <span className="tut-arrow">→</span>
      <span className="tut-item">
        <PieceGlyph type="knight" />
        <small>{t.tutorial.pieces}</small>
      </span>
      <span className="tut-item">
        <span className="tut-emoji">🃏</span>
        <small>{t.tutorial.cards}</small>
      </span>
      <span className="tut-item" data-skin="gold">
        <PieceGlyph type="queen" />
        <small>{t.tutorial.skins}</small>
      </span>
    </div>
  );
}

function BarracksDemo() {
  return (
    <div className="tut-row">
      {(
        [
          ['pawn', '×8', false],
          ['knight', '×2', false],
          ['rook', '×1', false],
          ['bishop', '×1', true],
        ] as const
      ).map(([k, n, temp]) => (
        <span key={k} className="tut-item">
          <PieceGlyph type={k} temp={temp} />
          <small>{n}</small>
        </span>
      ))}
    </div>
  );
}

function RankDemo() {
  const t = useT();
  return (
    <div className="tut-rank">
      <div className="tut-levelup">
        <PieceGlyph type="knight" level={9} />
        <span className="tut-arrow">→</span>
        <PieceGlyph type="knight" level={10} rank={1} />
      </div>
      <div className="tut-insignias">
        {[1, 2, 3, 4, 5].map((r) => (
          <span key={r} title={t.rank(r)}>
            <Insignia rank={r} />
          </span>
        ))}
      </div>
    </div>
  );
}

function StarsDemo() {
  const t = useT();
  const row = (n: number, label: string) => (
    <div className="tut-stars-row">
      <span className="stars">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < n ? 'on' : ''}>★</span>
        ))}
      </span>
      <small>{label}</small>
    </div>
  );
  return (
    <div className="tut-stars">
      {row(3, t.tutorial.lose4)}
      {row(2, t.tutorial.lose2)}
      {row(1, t.tutorial.win)}
    </div>
  );
}

/** One picture per step; titles and text come from the translations (same order). */
const VISUALS: ReactNode[] = [<Journey />, <DragDemo />, <ShopDemo />, <BarracksDemo />, <RankDemo />, <StarsDemo />];

/* ---------------- Modal ---------------- */

export function Tutorial() {
  const { setTutorialOpen, update, save } = useStore();
  const [step, setStep] = useState(0);
  const swipe = useRef<number | null>(null);
  const t = useT();
  const last = step === VISUALS.length - 1;

  const close = () => {
    setTutorialOpen(false);
    if (!save.tutorialSeen) update((s) => void (s.tutorialSeen = true));
  };
  const go = (d: number) => setStep((s) => Math.min(VISUALS.length - 1, Math.max(0, s + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const s = { ...t.tutorial.steps[step], visual: VISUALS[step] };
  return (
    <Modal onClose={close} className="tutorial">
      <div
        className="tut-body"
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > 50) go(e.clientX < swipe.current ? 1 : -1);
          swipe.current = null;
        }}
      >
        <div className="tut-visual" key={step}>
          {s.visual}
        </div>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
      </div>
      <div className="tut-dots">
        {VISUALS.map((_, i) => (
          <button key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} aria-label={t.tutorial.step(i + 1)} />
        ))}
      </div>
      <div className="modal-actions">
        {step > 0 ? (
          <button className="btn btn-ghost" onClick={() => go(-1)}>←</button>
        ) : (
          <button className="btn btn-ghost" onClick={close}>{t.tutorial.skip}</button>
        )}
        <button className="btn btn-primary" onClick={last ? close : () => go(1)}>
          {last ? t.tutorial.play : t.tutorial.next}
        </button>
      </div>
    </Modal>
  );
}
