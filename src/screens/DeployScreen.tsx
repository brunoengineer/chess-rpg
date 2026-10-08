import { useMemo, useState } from 'react';
import { sfx } from '../audio';
import { Board, type HintKind } from '../components/Board';
import { Insignia, PieceGlyph } from '../components/Piece';
import { BOSSES } from '../game/bosses';
import { ARENA_THEME, REGIONS, isCleared } from '../game/campaign';
import { CARDS, CARD_ORDER, type CardId } from '../game/cards';
import { createBattle, genUnitMoves } from '../game/engine';
import { PIECES, PIECE_ORDER } from '../game/pieces';
import { RANKS, commandCost, levelInfo } from '../game/ranks';
import type { PieceType, Placement, StageDef } from '../game/types';
import { startBattle } from '../state/actions';
import { classRanks, count, type Counts } from '../state/save';
import { useStore } from '../state/store';
import { enemyRoster } from './ArenaTab';

type TrayItem = { type: PieceType; temp: boolean };

export function difficulty(stage: StageDef): number {
  const { depth, blunder } = stage.ai;
  if (depth <= 1) return 1;
  if (depth === 2) return blunder > 0.12 ? 2 : 3;
  return blunder > 0.04 ? 4 : 5;
}

function deploySquares(stage: StageDef, occupied: Set<number>): number[][] {
  // Rows from front (closest to the enemy) to back.
  const rows: number[][] = [];
  for (let y = stage.h - stage.deployRows; y < stage.h; y++) {
    const cols = [...Array(stage.w).keys()].sort((a, b) => Math.abs(a - (stage.w - 1) / 2) - Math.abs(b - (stage.w - 1) / 2));
    rows.push(cols.map((x) => y * stage.w + x).filter((i) => !occupied.has(i)));
  }
  return rows;
}

type Cost = (t: PieceType) => number;

function autoDeploy(stage: StageDef, army: Counts, mercs: Counts, leadership: number, blocked: Set<number>, cost: Cost): Placement[] {
  const pool: TrayItem[] = [];
  for (const t of PIECE_ORDER) {
    for (let i = 0; i < count(army, t); i++) pool.push({ type: t, temp: false });
    for (let i = 0; i < count(mercs, t); i++) pool.push({ type: t, temp: true });
  }
  pool.sort((a, b) => PIECES[b.type].value - PIECES[a.type].value || Number(a.temp) - Number(b.temp));
  const rows = deploySquares(stage, blocked);
  let slots = rows.reduce((a, r) => a + r.length, 0);
  // Keep some leadership for a pawn shield in front of the officers.
  const pawns = pool.filter((it) => it.type === 'pawn');
  const shield = Math.min(pawns.length, rows[0]?.length ?? 0, Math.floor((leadership * 0.35) / cost('pawn')), slots);
  let budget = leadership - shield * cost('pawn');
  slots -= shield;
  const chosen: TrayItem[] = pawns.splice(0, shield);
  for (const it of [...pool.filter((it) => it.type !== 'pawn'), ...pawns]) {
    if (slots === 0) break;
    if (cost(it.type) <= budget) {
      chosen.push(it);
      budget -= cost(it.type);
      slots--;
    }
  }
  const take = (order: number[][]) => {
    for (const r of order) if (r.length) return r.shift()!;
    return -1;
  };
  const out: Placement[] = [];
  // Pawns fill the front, officers fill from the back.
  for (const it of [...chosen.filter((c) => c.type === 'pawn'), ...chosen.filter((c) => c.type !== 'pawn')]) {
    const sq = it.type === 'pawn' ? take(rows) : take([...rows].reverse());
    if (sq < 0) break;
    out.push({ ...it, x: sq % stage.w, y: Math.floor(sq / stage.w) });
  }
  return out;
}

export function DeployScreen({ stage }: { stage: StageDef }) {
  const { save, setView } = useStore();
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
  const [placements, setPlacements] = useState<Placement[]>(() =>
    lastFormation ? fits(lastFormation) : autoDeploy(stage, save.army, save.mercs, save.leadership, blocked, cost),
  );
  const ownedCards = stage.extra ? [] : CARD_ORDER.filter((c) => (save.cards[c] ?? 0) > 0);
  const [loadout, setLoadout] = useState<CardId[]>([]);
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
    for (const m of genUnitMoves(preview, scout)) hints.set(m.y * stage.w + m.x, m.kind === 'move' ? 'move' : 'capture');
  }

  const onCell = (x: number, y: number) => {
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
      useStore.getState().toast('Not enough leadership', '👑');
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

  return (
    <div className="deploy screen-split">
      <div className="board-col">
        <div className="screen-head">
          <button className="btn btn-ghost btn-small" onClick={back}>← Back</button>
          <div>
            <small>{stage.isArena ? theme.name : `${theme.icon} ${theme.name} · ${stage.id}`}</small>
            <h2>{stage.name}</h2>
          </div>
        </div>
        <Board battle={preview} theme={theme} deployZone={zone} hints={hints} hintTone="enemy" selected={scout} levels={levels} onCell={onCell} />
      </div>

      <aside className="side-col">
        <section className="panel briefing">
          <div className="chips">
            <span className="chip">📐 {stage.w}×{stage.h}</span>
            <span className="chip">⏱ {stage.maxTurns} turns</span>
            <span className="chip" title="Enemy skill">{'💀'.repeat(difficulty(stage))}</span>
            <span className="chip" title={firstClear ? 'Doubled on first win' : 'Reward'}>🪙 {stage.reward}{firstClear && <b className="bonus">×2</b>}</span>
            <span className="chip" title="Loot multiplier">💰 ×{stage.lootMult}</span>
            {stage.hard && <span className="chip hard-chip">🔥 Hard</span>}
            {(stage.enemyRank ?? 0) > 0 && (
              <span className="chip" title="Enemy rank">
                <Insignia rank={stage.enemyRank!} /> {RANKS[stage.enemyRank!]}
              </span>
            )}
            {stage.extra && <span className="chip" title="No cards on bonus stages">🚫🃏</span>}
          </div>
          <div className="roster">
            {boss && <span className="roster-item">{boss.emoji} {boss.name}</span>}
            {enemyRoster(stage.layout).map(([t, n]) => (
              <span key={t} className="roster-item">
                <PieceGlyph type={t} side="E" /> ×{n}
              </span>
            ))}
          </div>
          {boss && (
            <div className="boss-brief" style={{ ['--aura' as string]: boss.aura }}>
              <div className="boss-brief-head">
                <span className="boss-brief-emoji">{boss.emoji}</span>
                <div>
                  <b>{boss.name}</b>
                  <small>❤️ {stage.boss!.hp ?? boss.hp} · {boss.moveText}</small>
                </div>
              </div>
            </div>
          )}
          {scoutUnit && scoutUnit.type !== 'boss' && (
            <div className="scout">
              <PieceGlyph type={scoutUnit.type} side="E" rank={scoutUnit.rank} className="big" />
              <b>{PIECES[scoutUnit.type].name}</b>
            </div>
          )}
        </section>

        <section className="panel tray-panel">
          <div className="command">
            <span title="Command points">👑</span>
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
                  onClick={() => { setTray(active ? null : it); sfx.select(); }}
                  title={`${PIECES[it.type].name}${it.temp ? ' (mercenary)' : ''}`}
                >
                  <PieceGlyph type={it.type} temp={it.temp} rank={ranks[it.type]} />
                  <span className="tray-count">×{left}</span>
                  <span className="tray-cmd">👑{cost(it.type)}</span>
                </button>
              );
            })}
          </div>
          <div className="deploy-actions">
            <button className="btn btn-ghost btn-small" onClick={() => setPlacements(autoDeploy(stage, save.army, save.mercs, save.leadership, blocked, cost))}>✨ Auto</button>
            {lastFormation && <button className="btn btn-ghost btn-small" onClick={() => setPlacements(fits(lastFormation))}>↺ Last</button>}
            <button className="btn btn-ghost btn-small" onClick={() => setPlacements([])}>Clear</button>
          </div>
          {ownedCards.length > 0 && (
            <div className="loadout">
              <span className="loadout-label" title="Cards for this battle">🃏 {loadout.length}/{save.cardSlots}</span>
              {ownedCards.map((c) => (
                <button key={c} className={`loadout-card ${loadout.includes(c) ? 'active' : ''}`} onClick={() => toggleCard(c)} title={`${CARDS[c].name}: ${CARDS[c].desc}`}>
                  {CARDS[c].icon}
                  <small>×{save.cards[c]}</small>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-lg start-btn" disabled={!placements.length || !!save.active} onClick={() => startBattle(stage, placements, loadout)}>
            ⚔️ Fight
          </button>
        </section>
      </aside>
    </div>
  );
}
