import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio';
import { Board, type FxItem, type HintKind } from '../components/Board';
import { BossToken, PieceGlyph } from '../components/Piece';
import { Modal } from '../components/Modal';
import { requestAiMove } from '../game/aiClient';
import { BOSSES } from '../game/bosses';
import { ARENA_THEME, REGIONS, arenaStage, isCleared, nextStage } from '../game/campaign';
import { computeResult, lootFromFx, type BattleResult } from '../game/economy';
import { PASS, applyMove, cloneBattle, enemyPostTurn, enemyPreTurn, genMoves, genUnitMoves, material } from '../game/engine';
import { PIECES } from '../game/pieces';
import type { Battle, FxEvent, Move, Outcome, PieceType, StageDef, Unit } from '../game/types';
import { finishBattle } from '../state/actions';
import { useStore } from '../state/store';
import { Stars } from './CampaignTab';

interface Final {
  battle: Battle;
  stage: StageDef;
  result: BattleResult;
  unlocked: PieceType[];
  arenaUnlocked: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fxSeq = 0;

const REASONS: Record<Outcome['reason'], [string, string]> = {
  annihilation: ['', ''],
  boss: ['', ''],
  points: ['On points', 'On points'],
  time: ['On points', 'Out of time'],
  deadlock: ['On points', 'Stalemate'],
  surrender: ['', 'Retreated'],
};

export function BattleScreen() {
  const save = useStore((s) => s.save);
  const setView = useStore((s) => s.setView);
  const update = useStore((s) => s.update);
  const active = save.active;
  const [final, setFinal] = useState<Final | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [shake, setShake] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const busy = useRef(false);

  const battle = final?.battle ?? active?.battle;
  const stage = final?.stage ?? active?.stage;

  useEffect(() => {
    if (!battle) setView({ name: 'hub', tab: 'campaign' });
  }, [battle, setView]);

  const fast = save.settings.fastAnim;

  const commit = useCallback(
    (nb: Battle, loot = 0, captures = 0) =>
      update((s) => {
        if (!s.active) return;
        s.active.battle = nb;
        s.active.loot += loot;
        s.active.captures += captures;
      }),
    [update],
  );

  const playFx = useCallback((events: FxEvent[], st: StageDef) => {
    if (!events.length) return;
    const items: FxItem[] = [];
    let blasted = false;
    for (const e of events) {
      const base = { key: ++fxSeq, x: e.x, y: e.y, size: e.size ?? 1 };
      switch (e.kind) {
        case 'capture':
          items.push({ ...base, kind: 'shatter', unitType: e.unitType, side: e.side });
          if (e.unitType === 'boss') {
            items.push({ ...base, key: ++fxSeq, kind: 'blast', text: '💥' });
            sfx.boom();
          } else {
            sfx.capture();
            if (e.side === 'E') {
              items.push({ ...base, key: ++fxSeq, kind: 'coin', text: `+${PIECES[e.unitType as PieceType].value * st.lootMult}` });
              setTimeout(sfx.coin, 150);
            }
          }
          break;
        case 'hit':
          items.push({ ...base, kind: 'hit', text: `-${e.amount}` });
          items.push({ ...base, key: ++fxSeq, kind: 'coin', text: `+${3 * (e.amount ?? 1) * st.lootMult}` });
          sfx.hit();
          setShake(true);
          setTimeout(() => setShake(false), 350);
          break;
        case 'promote':
          items.push({ ...base, kind: 'promote', text: '👑' });
          sfx.promote();
          break;
        case 'summon':
          items.push({ ...base, kind: 'summon' });
          sfx.summon();
          break;
        case 'quake':
        case 'breath':
          items.push({ ...base, kind: e.kind === 'breath' ? 'fire' : 'blast' });
          if (!blasted) {
            blasted = true;
            sfx.boom();
            setShake(true);
            setTimeout(() => setShake(false), 450);
          }
          break;
      }
    }
    setFx((cur) => [...cur, ...items]);
    const keys = new Set(items.map((i) => i.key));
    setTimeout(() => setFx((cur) => cur.filter((f) => !keys.has(f.key))), 1300);
  }, []);

  const endBattle = useCallback((nb: Battle, outcome: Outcome) => {
    const s = useStore.getState().save;
    if (!s.active) return;
    const st = s.active.stage;
    const ended = { ...nb, over: outcome };
    const result = computeResult(ended, outcome, st, s.active.loot, isCleared(s.stages, st.id));
    const extra = finishBattle(st, result, s.active.captures);
    setFinal({ battle: ended, stage: st, result, ...extra });
    setSelected(null);
    setTimeout(result.win ? sfx.win : sfx.lose, 300);
  }, []);

  /* ---------------- Enemy turn ---------------- */
  useEffect(() => {
    if (!battle || !stage || final || battle.over || busy.current) return;
    if (battle.turn === 'E') {
      busy.current = true;
      setThinking(true);
      void (async () => {
        const still = () => {
          const a = useStore.getState().save.active;
          return a && a.battle.ply === battle.ply ? a : null;
        };
        await sleep(fast ? 200 : 450);
        let b = cloneBattle(battle);
        if (!b.enemyPreDone) {
          const pre: FxEvent[] = [];
          enemyPreTurn(b, pre);
          b.enemyPreDone = true;
          if (!still()) return void (busy.current = false);
          if (pre.length) {
            playFx(pre, stage);
            commit(b);
            if (!b.over) await sleep(fast ? 350 : 650);
          }
          if (b.over) {
            commit(b);
            busy.current = false;
            setThinking(false);
            endBattle(b, b.over);
            return;
          }
        }
        const m = await requestAiMove(b, stage.ai);
        if (!still()) return void ((busy.current = false), setThinking(false));
        const evs: FxEvent[] = [];
        const hadTelegraph = !!b.telegraph;
        b = applyMove(b, m, evs);
        b.enemyPreDone = false;
        enemyPostTurn(b);
        if (m.kind !== 'pass' && !evs.length) sfx.move();
        playFx(evs, stage);
        if (b.telegraph && !hadTelegraph) setTimeout(sfx.warn, 250);
        commit(b);
        busy.current = false;
        setThinking(false);
        if (b.over) setTimeout(() => endBattle(b, b.over!), fast ? 300 : 700);
      })();
    } else if (genMoves(battle, 'P').length === 0) {
      busy.current = true;
      useStore.getState().toast('No moves — pass', '⏸');
      setTimeout(() => {
        busy.current = false;
        const nb = applyMove(battle, PASS);
        commit(nb);
        if (nb.over) endBattle(nb, nb.over);
      }, 900);
    }
  }, [battle, stage, final, fast, commit, playFx, endBattle]);

  if (!battle || !stage) return null;

  const theme = stage.isArena ? ARENA_THEME : REGIONS[stage.region - 1];
  const myTurn = battle.turn === 'P' && !battle.over && !final && !thinking;
  const sel: Unit | null = selected !== null ? battle.units[selected] ?? null : null;
  const selMoves: Move[] = sel && sel.alive && sel.side === 'P' && myTurn ? genUnitMoves(battle, sel.id) : [];

  const hints = new Map<number, HintKind>();
  const showHints = sel?.side === 'P' ? save.settings.showMoves : save.settings.showEnemyMoves;
  if (sel && sel.alive && showHints) {
    const ms = sel.side === 'P' ? selMoves : genUnitMoves(battle, sel.id);
    for (const m of ms) {
      if (m.kind === 'strike') {
        const t = battle.units[m.target!];
        for (let y = t.y; y < t.y + t.size; y++) for (let x = t.x; x < t.x + t.size; x++) hints.set(y * battle.w + x, 'strike');
      } else hints.set(m.y * battle.w + m.x, m.kind === 'move' ? 'move' : 'capture');
    }
  }

  const onCell = (x: number, y: number) => {
    if (final) return;
    const c = battle.grid[y * battle.w + x];
    if (sel && sel.side === 'P' && myTurn) {
      const m = selMoves.find((m) => (m.kind === 'strike' ? c === m.target! + 1 : m.x === x && m.y === y));
      if (m) {
        const evs: FxEvent[] = [];
        const nb = applyMove(battle, m, evs);
        const loot = lootFromFx(evs, stage);
        if (!evs.length) sfx.move();
        playFx(evs, stage);
        setSelected(null);
        commit(nb, loot.coins, loot.captures);
        if (nb.over) setTimeout(() => endBattle(nb, nb.over!), 600);
        return;
      }
    }
    if (c > 0) {
      const u = battle.units[c - 1];
      setSelected(u.id === selected ? null : u.id);
      if (u.side === 'P') sfx.select();
    } else setSelected(null);
  };

  const bosses = battle.units.filter((u) => u.type === 'boss');
  const pMat = material(battle, 'P'), eMat = material(battle, 'E');
  const capturedByMe = battle.units.filter((u) => u.side === 'E' && !u.alive && u.type !== 'boss');
  const myFallen = battle.units.filter((u) => u.side === 'P' && !u.alive);
  const turnNo = Math.min(Math.floor(battle.ply / 2) + 1, stage.maxTurns);
  const turnsLeft = stage.maxTurns - turnNo;
  const loot = final ? final.result.loot : active?.loot ?? 0;

  return (
    <div className="battle screen-split">
      <div className="board-col">
        <div className="screen-head">
          <h2>{stage.name}</h2>
          <div className={`turn-badge ${myTurn ? 'mine' : 'theirs'}`}>
            {battle.over || final ? '—' : myTurn ? 'Your move' : <>Enemy<span className="dots" /></>}
          </div>
        </div>
        <Board
          battle={battle}
          theme={theme}
          selected={selected}
          hints={hints}
          hintTone={sel?.side === 'E' ? 'enemy' : 'player'}
          fx={fx}
          shake={shake}
          dimmed={!myTurn && !final}
          onCell={onCell}
        />
        {battle.telegraph && <div className="telegraph-warning">{battle.telegraph.kind === 'breath' ? '🔥 Fire next turn!' : '⚠ Quake next turn!'}</div>}
      </div>

      <aside className="side-col">
        <section className="panel battle-info">
          <div className="info-row">
            <span className={turnsLeft <= 5 && !final ? 'warn' : ''} title="Turn limit">⏱ {turnNo}/{stage.maxTurns}</span>
            <span className="loot" title="Loot">🪙 {loot}</span>
          </div>
          <div className="strength" title="Army strength">
            <span>{pMat.toFixed(0)}</span>
            <div className="strength-bar">
              <i style={{ width: `${(pMat / Math.max(1, pMat + eMat)) * 100}%` }} />
            </div>
            <span>{eMat.toFixed(0)}</span>
          </div>
          {bosses.map((b) => (
            <div key={b.id} className={`boss-panel ${b.alive ? '' : 'dead'}`} style={{ ['--aura' as string]: BOSSES[b.boss!].aura }}>
              <BossToken kind={b.boss!} hp={b.hp ?? 0} maxHp={b.maxHp ?? 1} />
              <div>
                <b>{BOSSES[b.boss!].name}</b>
                <div className="hp-bar">
                  <i style={{ width: `${((b.hp ?? 0) / (b.maxHp ?? 1)) * 100}%` }} />
                </div>
                <small>
                  ❤️ {b.hp}/{b.maxHp}
                  {b.alive && (b.cd ?? 0) > 0 && ' · 💤'}
                </small>
              </div>
            </div>
          ))}
          {(capturedByMe.length > 0 || myFallen.length > 0) && (
            <div className="captured">
              <div className="glyph-row" title="Captured">
                {capturedByMe.map((u) => <PieceGlyph key={u.id} type={(u.promotedFrom ?? u.type) as PieceType} side="E" />)}
              </div>
              <div className="glyph-row lost-row" title="Lost this battle">
                {myFallen.map((u) => <PieceGlyph key={u.id} type={(u.promotedFrom ?? u.type) as PieceType} temp={u.temp} />)}
              </div>
            </div>
          )}
        </section>

        <div className="battle-actions">
          <button
            className="btn btn-ghost btn-small"
            title="Move hints"
            onClick={() => update((s) => void (s.settings.showMoves = !s.settings.showMoves))}
          >
            {save.settings.showMoves ? '👁' : '🙈'}
          </button>
          {!final && (
            <button className="btn btn-ghost btn-small danger" disabled={thinking} onClick={() => setConfirmSurrender(true)}>
              🏳 Retreat
            </button>
          )}
        </div>
      </aside>

      {confirmSurrender && (
        <Modal onClose={() => setConfirmSurrender(false)}>
          <h2>Retreat?</h2>
          <p className="muted">Counts as a defeat. You keep the loot.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmSurrender(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setConfirmSurrender(false);
                endBattle(battle, { winner: 'E', reason: 'surrender' });
              }}
            >
              Retreat
            </button>
          </div>
        </Modal>
      )}

      {final && <ResultModal final={final} />}
    </div>
  );
}

function ResultModal({ final }: { final: Final }) {
  const { setView, save } = useStore();
  const { result, stage, unlocked, arenaUnlocked } = final;
  const { outcome } = result;
  const title = result.win ? 'Victory!' : outcome.winner === 'draw' ? 'Draw' : 'Defeat';
  const reason = REASONS[outcome.reason][result.win ? 0 : 1];
  const next = result.win ? nextStage(stage) : undefined;
  const home = () => setView({ name: 'hub', tab: stage.isArena ? 'arena' : 'campaign' });
  const retry = () => setView({ name: 'deploy', stage: stage.isArena ? arenaStage(save.arena.level) : stage });

  return (
    <Modal className={`result ${result.win ? 'win' : 'lose'}`}>
      <h1 className="result-title">{title}</h1>
      {reason && <p className="result-reason">{reason}</p>}
      {result.win && <Stars n={result.stars} />}
      <div className="breakdown">
        <div><span>Loot</span><b>🪙 {result.loot}</b></div>
        {result.reward > 0 && <div><span>Reward</span><b>🪙 {result.reward}</b></div>}
        {result.firstClearBonus > 0 && <div className="bonus"><span>First win</span><b>🪙 {result.firstClearBonus}</b></div>}
        <div className="total"><span>Total</span><b>🪙 {result.total}</b></div>
      </div>
      {unlocked.map((t) => (
        <button key={t} className="unlock" onClick={() => setView({ name: 'hub', tab: 'shop' })}>
          <PieceGlyph type={t} className="big" />
          <b>New: {PIECES[t].name}</b>
        </button>
      ))}
      {arenaUnlocked && (
        <button className="unlock" onClick={() => setView({ name: 'hub', tab: 'arena' })}>
          <span className="big-icon">🏟️</span>
          <b>New: Arena</b>
        </button>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={home}>🏠 Home</button>
        <button className="btn btn-ghost" onClick={retry}>↺ {result.win ? 'Replay' : 'Retry'}</button>
        {next ? (
          <button className="btn btn-primary" onClick={() => setView({ name: 'deploy', stage: next })}>Next →</button>
        ) : stage.isArena && result.win ? (
          <button className="btn btn-primary" onClick={retry}>Next level →</button>
        ) : null}
      </div>
    </Modal>
  );
}
