import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../audio';
import { Board, type HintKind } from '../components/Board';
import { BossFigure } from '../components/BossFigure';
import { Insignia, PieceGlyph } from '../components/Piece';
import { BOSSES } from '../game/bosses';
import { ARENA_THEME, REGIONS, isCleared } from '../game/campaign';
import { CARDS, CARD_ORDER, type CardId } from '../game/cards';
import { createBattle, reachSquares } from '../game/engine';
import { PIECE_ORDER } from '../game/pieces';
import { commandCost, levelInfo } from '../game/ranks';
import type { PieceType, Placement, StageDef } from '../game/types';
import { autoDeploy, deploySquares, type Cost } from '../game/deploy';
import { tNow, useT } from '../i18n';
import { startBattle } from '../state/actions';
import { classRanks, count, type Counts } from '../state/save';
import { useStore } from '../state/store';

type TrayItem = { type: PieceType; temp: boolean };
type DragSource = { from: 'tray'; item: TrayItem } | { from: 'board'; index: number };
interface DragState {
  src: DragSource;
  pointerId: number;
  x0: number;
  y0: number;
  started: boolean;
}

/** Pixels the pointer must travel before a press becomes a drag (otherwise it's a tap). */
const DRAG_THRESHOLD = 6;

export function difficulty(stage: StageDef): number {
  const { depth, blunder } = stage.ai;
  if (depth <= 1) return 1;
  if (depth === 2) return blunder > 0.12 ? 2 : 3;
  return blunder > 0.04 ? 4 : 5;
}

interface Draft {
  placements: Placement[];
  loadout: CardId[];
}

function readDraft(key: string): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return d && Array.isArray(d.placements) && Array.isArray(d.loadout) ? d : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(key, JSON.stringify(d));
    else sessionStorage.removeItem(key);
  } catch {
    /* storage blocked: drafts just won't survive a refresh */
  }
}

export function DeployScreen({ stage }: { stage: StageDef }) {
  const { save, setView, player } = useStore();
  const t = useT();
  const ranks = useMemo(() => classRanks(save.xp), [save.xp]);
  const levels = useMemo(() => Object.fromEntries(PIECE_ORDER.map((t) => [t, levelInfo(save.xp[t] ?? 0).level])), [save.xp]);
  const cost: Cost = (t) => commandCost(t, ranks[t] ?? 0);
  const theme = stage.isArena ? ARENA_THEME : REGIONS[stage.region - 1];
  const base = useMemo(() => createBattle(stage, []), [stage]);
  const blocked = useMemo(() => new Set(base.grid.flatMap((c, i) => (c !== 0 ? [i] : []))), [base]);
  const zone = useMemo(() => new Set(deploySquares(stage, blocked).flat()), [stage, blocked]);

  const fits = (pl: Placement[]) => {
    const used: Counts = {}, usedM: Counts = {};
    let cmd = 0;
    return pl.filter((p) => {
      const pool = p.temp ? save.mercs : save.army;
      const u = p.temp ? usedM : used;
      if (!zone.has(p.y * stage.w + p.x) || count(u, p.type) >= count(pool, p.type) || cmd + cost(p.type) > save.leadership) return false;
      u[p.type] = count(u, p.type) + 1;
      cmd += cost(p.type);
      return true;
    });
  };
  const lastFormation = save.formations[stage.id];
  // An unfinished setup survives a refresh or a trip to the Shop (this tab only, re-validated on load).
  const draftKey = `gq-draft-${player?.uid ?? 'guest'}-${stage.id}`;
  const draft = useMemo(() => readDraft(draftKey), [draftKey]);
  const [placements, setPlacements] = useState<Placement[]>(() =>
    draft ? fits(draft.placements) : lastFormation ? fits(lastFormation) : autoDeploy(stage, save.army, save.mercs, save.leadership, blocked, cost, { rankOf: (k) => ranks[k] ?? 0 }),
  );
  const ownedCards = stage.extra ? [] : CARD_ORDER.filter((c) => (save.cards[c] ?? 0) > 0);
  const [loadout, setLoadout] = useState<CardId[]>(() => (draft?.loadout ?? []).filter((c) => ownedCards.includes(c)).slice(0, save.cardSlots));
  useEffect(() => writeDraft(draftKey, { placements, loadout }), [draftKey, placements, loadout]);
  const fight = () => {
    writeDraft(draftKey, null);
    startBattle(stage, placements, loadout);
  };
  const toggleCard = (c: CardId) =>
    setLoadout(loadout.includes(c) ? loadout.filter((x) => x !== c) : loadout.length < save.cardSlots ? [...loadout, c] : loadout);
  const [tray, setTray] = useState<TrayItem | null>(null);
  const [scout, setScout] = useState<number | null>(null);

  const preview = useMemo(() => createBattle(stage, placements, ranks), [stage, placements, ranks]);
  const used = placements.reduce((a, p) => a + cost(p.type), 0);
  const remaining = (it: TrayItem) => count(it.temp ? save.mercs : save.army, it.type) - placements.filter((p) => p.type === it.type && p.temp === it.temp).length;

  const trayItems: TrayItem[] = [];
  for (const t of PIECE_ORDER) {
    if (count(save.army, t)) trayItems.push({ type: t, temp: false });
    if (count(save.mercs, t)) trayItems.push({ type: t, temp: true });
  }

  const hints = new Map<number, HintKind>();
  if (scout !== null && save.settings.showEnemyMoves) {
    for (const [sq, k] of reachSquares(preview, scout)) hints.set(sq, k);
  }

  /* ---------------- Drag & drop ---------------- */
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ type: PieceType; temp: boolean; x: number; y: number; size: number; removing: boolean } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sq: number; ok: boolean } | null>(null);
  const dragFrom = ghost && dragRef.current?.src.from === 'board' ? dragRef.current.src.index : null;

  /** Placements after dropping `src` on square `sq` (null = off the board), or why it can't be dropped there. */
  const planDrop = (src: DragSource, sq: number | null): Placement[] | 'leadership' | null => {
    if (sq === null) return src.from === 'board' ? placements.filter((_, j) => j !== src.index) : null;
    if (!zone.has(sq)) return null;
    const x = sq % stage.w, y = Math.floor(sq / stage.w);
    const o = placements.findIndex((p) => p.x === x && p.y === y);
    if (src.from === 'tray') {
      if (remaining(src.item) <= 0) return null;
      const freed = o >= 0 ? cost(placements[o].type) : 0;
      if (used - freed + cost(src.item.type) > save.leadership) return 'leadership';
      const placed = { ...src.item, x, y };
      return o >= 0 ? placements.map((p, j) => (j === o ? placed : p)) : [...placements, placed];
    }
    const moving = placements[src.index];
    // Move to an empty square, or swap with the piece already there.
    return placements.map((p, j) => (j === src.index ? { ...p, x, y } : j === o ? { ...p, x: moving.x, y: moving.y } : p));
  };

  const cellAt = (cx: number, cy: number): number | null => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return null;
    const x = Math.floor(((cx - r.left) / r.width) * stage.w), y = Math.floor(((cy - r.top) / r.height) * stage.h);
    return x >= 0 && y >= 0 && x < stage.w && y < stage.h ? y * stage.w + x : null;
  };

  const beginDrag = (src: DragSource, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    // The piece stays exactly under the finger/cursor, and drops on the square under it.
    dragRef.current = { src, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false };
  };

  const endDrag = () => {
    dragRef.current = null;
    setGhost(null);
    setDropTarget(null);
    document.body.classList.remove('dragging');
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD) return;
      d.started = true;
      setScout(null);
      document.body.classList.add('dragging');
    }
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    const sq = cellAt(x, y);
    const piece = d.src.from === 'tray' ? d.src.item : placements[d.src.index];
    const size = (boardRef.current?.getBoundingClientRect().width ?? 360) / stage.w;
    setGhost({ type: piece.type, temp: piece.temp, x, y, size, removing: sq === null && d.src.from === 'board' });
    setDropTarget(sq === null ? null : { sq, ok: Array.isArray(planDrop(d.src, sq)) });
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.started) {
      dragRef.current = null; // a tap: the normal click handlers take over
      return;
    }
    // Swallow the click the browser may fire after the drop.
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 300);
    const plan = planDrop(d.src, cellAt(e.clientX, e.clientY));
    if (plan === 'leadership') useStore.getState().toast(tNow().toast.notEnoughLeadership, '👑');
    else if (plan) {
      setPlacements(plan);
      sfx.move();
      if (d.src.from === 'tray' && remaining(d.src.item) <= 1 && tray?.type === d.src.item.type && tray.temp === d.src.item.temp) setTray(null);
    }
    endDrag();
  };

  // Window listeners call the latest handlers (they read current placements).
  const handlers = useRef({ onPointerMove, onPointerUp, endDrag });
  handlers.current = { onPointerMove, onPointerUp, endDrag };
  useEffect(() => {
    const move = (e: PointerEvent) => handlers.current.onPointerMove(e);
    const up = (e: PointerEvent) => handlers.current.onPointerUp(e);
    const cancel = () => handlers.current.endDrag();
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.body.classList.remove('dragging');
    };
  }, []);

  const dragHandles = useMemo(() => new Set(placements.map((p) => p.y * stage.w + p.x)), [placements, stage.w]);
  const onCellPointerDown = (x: number, y: number, e: ReactPointerEvent) => {
    const index = placements.findIndex((p) => p.x === x && p.y === y);
    if (index >= 0) beginDrag({ from: 'board', index }, e);
  };

  const onCell = (x: number, y: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const i = y * stage.w + x;
    const existing = placements.findIndex((p) => p.x === x && p.y === y);
    if (existing >= 0) {
      setPlacements(placements.filter((_, j) => j !== existing));
      sfx.select();
      return;
    }
    const c = preview.grid[i];
    if (c > 0 && preview.units[c - 1].side === 'E') {
      setScout(c - 1);
      return;
    }
    setScout(null);
    if (!zone.has(i) || !tray) return;
    if (remaining(tray) <= 0) return;
    if (used + cost(tray.type) > save.leadership) {
      useStore.getState().toast(tNow().toast.notEnoughLeadership, '👑');
      return;
    }
    setPlacements([...placements, { ...tray, x, y }]);
    sfx.move();
    if (remaining(tray) <= 1) setTray(null);
  };

  const scoutUnit = scout !== null ? preview.units[scout] : null;
  const boss = stage.boss ? BOSSES[stage.boss.kind] : null;
  const firstClear = !stage.isArena && !isCleared(save.stages, stage.id);
  const back = () => setView({ name: 'hub', tab: stage.isArena ? 'arena' : 'campaign' });

  const infoChips = (
    <>
      <span className="chip" title={t.deploy.board}>📐 {stage.w}×{stage.h}</span>
      <span className="chip" title={t.deploy.turnLimit}>⏱ {stage.maxTurns}</span>
      <span className="chip" title={t.deploy.enemySkill}>{'💀'.repeat(difficulty(stage))}</span>
      <span className="chip" title={firstClear ? t.deploy.rewardFirst : t.deploy.reward}>🪙 {stage.reward}{firstClear && <b className="bonus">×2</b>}</span>
      <span className="chip" title={t.deploy.lootMult}>💰 ×{stage.lootMult}</span>
      {stage.hard && <span className="chip hard-chip">{t.deploy.hard}</span>}
      {(stage.enemyRank ?? 0) > 0 && (
        <span className="chip" title={t.deploy.enemyRank}>
          <Insignia rank={stage.enemyRank!} /> {t.rank(stage.enemyRank!)}
        </span>
      )}
      {stage.extra && <span className="chip" title={t.deploy.noCards}>🚫🃏</span>}
    </>
  );
  const scoutChip = scoutUnit && scoutUnit.type !== 'boss' && (
    <span className="chip scout-chip">
      <PieceGlyph type={scoutUnit.type} side="E" rank={scoutUnit.rank} /> {t.piece(scoutUnit.type)}
    </span>
  );

  return (
    <div className="deploy screen-split">
      <div className="board-col">
        <div className="screen-head deploy-head">
          <button className="btn btn-ghost btn-small" onClick={back}>{t.deploy.back}</button>
          <div className="stage-titles">
            <small>{stage.isArena ? t.region(theme) : `${theme.icon} ${t.region(theme)} · ${stage.id}`}</small>
            <h2>{t.stage(stage)}</h2>
          </div>
        </div>
        {/* Mobile: stage info sits between the titles and the board. */}
        <div className="stage-strip only-mobile">
          {infoChips}
          {boss && (
            <span className="chip boss-chip" title={t.bossMove(boss.kind)} style={{ ['--aura' as string]: boss.aura }}>
              <BossFigure kind={boss.kind} className="inline" /> {t.bossName(boss.kind)} · ❤️ {stage.boss!.hp ?? boss.hp}
            </span>
          )}
          {scoutChip}
        </div>
        <Board
          battle={preview}
          theme={theme}
          deployZone={zone}
          hints={hints}
          hintTone="enemy"
          selected={scout}
          levels={levels}
          onCell={onCell}
          boardRef={boardRef}
          dragHandles={dragHandles}
          onCellPointerDown={onCellPointerDown}
          dropTarget={dropTarget}
          draggingFrom={dragFrom !== null && placements[dragFrom] ? placements[dragFrom].y * stage.w + placements[dragFrom].x : null}
        />
      </div>
      {ghost && (
        <div className={`drag-ghost ${ghost.removing ? 'removing' : ''}`} style={{ left: ghost.x, top: ghost.y, fontSize: ghost.size * 0.8 }}>
          <PieceGlyph type={ghost.type} temp={ghost.temp} rank={ranks[ghost.type]} level={levels[ghost.type]} />
        </div>
      )}

      <aside className="side-col">
        <section className="panel briefing only-desktop">
          <div className="chips">{infoChips}</div>
          {boss && (
            <div className="boss-brief" style={{ ['--aura' as string]: boss.aura }}>
              <div className="boss-brief-head">
                <BossFigure kind={boss.kind} className="brief" />
                <div>
                  <b>{t.bossName(boss.kind)}</b>
                  <small>❤️ {stage.boss!.hp ?? boss.hp} · {t.bossMove(boss.kind)}</small>
                </div>
              </div>
            </div>
          )}
          {scoutChip && <div className="chips">{scoutChip}</div>}
        </section>

        <section className="panel tray-panel">
          <div className="command">
            <span title={t.deploy.commandPoints}>👑</span>
            <div className="command-bar">
              <i style={{ width: `${Math.min(100, (used / save.leadership) * 100)}%` }} />
            </div>
            <b>{used}/{save.leadership}</b>
          </div>
          <div className="tray">
            {trayItems.map((it) => {
              const left = remaining(it);
              const active = tray?.type === it.type && tray.temp === it.temp;
              return (
                <button
                  key={`${it.type}-${it.temp}`}
                  className={`tray-item ${active ? 'active' : ''}`}
                  disabled={left <= 0}
                  onPointerDown={(e) => left > 0 && beginDrag({ from: 'tray', item: it }, e)}
                  onClick={() => {
                    if (suppressClick.current) return void (suppressClick.current = false);
                    setTray(active ? null : it);
                    sfx.select();
                  }}
                  title={`${t.piece(it.type)}${it.temp ? ` ${t.deploy.mercenary}` : ''}`}
                >
                  <PieceGlyph type={it.type} temp={it.temp} rank={ranks[it.type]} />
                  <span className="tray-count">×{left}</span>
                  <span className="tray-cmd">👑{cost(it.type)}</span>
                </button>
              );
            })}
          </div>
          <div className="deploy-actions">
            <button className="btn btn-ghost btn-small" onClick={() => setPlacements(autoDeploy(stage, save.army, save.mercs, save.leadership, blocked, cost, { rankOf: (k) => ranks[k] ?? 0 }))}>{t.deploy.auto}</button>
            {lastFormation && <button className="btn btn-ghost btn-small" onClick={() => setPlacements(fits(lastFormation))}>{t.deploy.last}</button>}
            <button className="btn btn-ghost btn-small" onClick={() => setPlacements([])}>{t.deploy.clear}</button>
          </div>
          {ownedCards.length > 0 && (
            <div className="loadout">
              <span className="loadout-label" title={t.deploy.cardsForBattle}>🃏 {loadout.length}/{save.cardSlots}</span>
              {ownedCards.map((c) => (
                <button key={c} className={`loadout-card ${loadout.includes(c) ? 'active' : ''}`} onClick={() => toggleCard(c)} title={`${t.cardName(c)}: ${t.cardDesc(c)}`}>
                  {CARDS[c].icon}
                  <small>×{save.cards[c]}</small>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-lg start-btn" disabled={!placements.length || !!save.active} onClick={fight}>
            {t.deploy.fight}
          </button>
        </section>
      </aside>
    </div>
  );
}
