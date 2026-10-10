import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio';
import { Board, type FxItem, type HintKind } from '../components/Board';
import { BossToken, PieceGlyph } from '../components/Piece';
import { Modal } from '../components/Modal';
import { requestAiMove } from '../game/aiClient';
import { BOSSES } from '../game/bosses';
import { ARENA_THEME, REGIONS, arenaStage, isCleared, nextStage } from '../game/campaign';
import { CARDS, cardPlayable, playCard, validSquares, type CardId } from '../game/cards';
import { computeResult, lootFromFx, type BattleResult } from '../game/economy';
import { PASS, applyMove, cloneBattle, enemyPostTurn, enemyPreTurn, genMoves, genUnitMoves, material, reachSquares } from '../game/engine';
import { PIECES, PIECE_ORDER } from '../game/pieces';
import { levelInfo } from '../game/ranks';
import type { Battle, FxEvent, Move, Outcome, PieceType, StageDef, Unit } from '../game/types';
import { tNow, useT, type T } from '../i18n';
import { consumeCard, finishBattle, type FinishExtras } from '../state/actions';
import { addCount, classRanks, count } from '../state/save';
import { useStore } from '../state/store';
import { Stars } from './CampaignTab';

interface Final extends FinishExtras {
  battle: Battle;
  stage: StageDef;
  result: BattleResult;
}

interface Targeting {
  id: CardId;
  picks: number[];
  reinforce?: PieceType;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fxSeq = 0;

/** Subtitle under Victory/Defeat: [when you won, when you didn't]. */
const reasons = (t: T): Record<Outcome['reason'], [string, string]> => ({
  annihilation: ['', ''],
  boss: ['', ''],
  points: [t.result.onPoints, t.result.onPoints],
  time: [t.result.onPoints, t.result.outOfTime],
  deadlock: [t.result.onPoints, t.result.stalemate],
  surrender: ['', t.result.retreated],
});

export function BattleScreen() {
  const save = useStore((s) => s.save);
  const t = useT();
  const setView = useStore((s) => s.setView);
  const update = useStore((s) => s.update);
  const active = save.active;
  const [final, setFinal] = useState<Final | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [shake, setShake] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const busy = useRef(false);

  const battle = final?.battle ?? active?.battle;
  const stage = final?.stage ?? active?.stage;
  const levels = useMemo(() => Object.fromEntries(PIECE_ORDER.map((t) => [t, levelInfo(save.xp[t] ?? 0).level])), [save.xp]);

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
        case 'block':
          items.push({ ...base, kind: 'promote', text: e.icon ?? '🛡️' });
          sfx.select();
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
    const cardsUsed = (nb.cardsUsed ?? 0) + (s.active.preCards ?? 0);
    const result = computeResult(ended, outcome, st, s.active.loot, isCleared(s.stages, st.id), cardsUsed);
    const extra = finishBattle(st, result, s.active.captures);
    setFinal({ battle: ended, stage: st, result, ...extra });
    setSelected(null);
    setTargeting(null);
    setTimeout(result.win ? sfx.win : sfx.lose, 300);
  }, []);

  /* ---------------- Enemy turn (and forced passes) ---------------- */
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
    } else if (battle.quietOnly && !genMoves(battle, 'P').some((m) => m.kind === 'move')) {
      // Double Move bonus with nothing to do: hand the turn over.
      commit({ ...battle, quietOnly: false, turn: 'E' });
    } else if (genMoves(battle, 'P').length === 0) {
      busy.current = true;
      useStore.getState().toast(tNow().toast.noMoves, '⏸');
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
  const selMoves: Move[] =
    sel && sel.alive && sel.side === 'P' && myTurn && !targeting
      ? genUnitMoves(battle, sel.id).filter((m) => !battle.quietOnly || m.kind === 'move')
      : [];

  /* ---------------- Cards ---------------- */
  const loadout = active?.cards ?? [];
  const reserve = PIECE_ORDER.filter((t) => count(save.army, t) > 0);
  const cardTurnFree = myTurn && battle.cardPly !== battle.ply && !battle.quietOnly;
  const canPlay = (id: CardId) =>
    cardTurnFree && (id === 'rewind' ? !!active?.undo : cardPlayable(battle, id, stage.deployRows, reserve));
  const step = targeting && (targeting.id !== 'reinforce' || targeting.reinforce) ? CARDS[targeting.id].steps[targeting.picks.length] : undefined;
  const targets = step ? validSquares(battle, step, stage.deployRows, targeting!.picks[0]) : undefined;

  const resolveCard = (id: CardId, squares: number[], reinforce?: PieceType) => {
    const { battle: nb, fx: evs } = playCard(battle, id, squares, { reinforce, ranks: classRanks(save.xp) });
    const loot = lootFromFx(evs, stage, active?.lootMult ?? 1);
    playFx(evs, stage);
    commit(nb, loot.coins, loot.captures);
    consumeCard(id);
    if (reinforce) update((s) => addCount(s.army, reinforce, -1));
    setTargeting(null);
    setSelected(null);
    if (nb.over) setTimeout(() => endBattle(nb, nb.over!), 600);
  };

  const startCard = (id: CardId) => {
    if (!canPlay(id)) return;
    sfx.select();
    if (id === 'rewind') {
      const undo = active!.undo!;
      const restored = { ...undo.battle, cardsUsed: (battle.cardsUsed ?? 0) + 1, cardPly: undo.battle.ply };
      update((s) => {
        if (!s.active) return;
        s.active.battle = restored;
        s.active.loot = undo.loot;
        s.active.captures = undo.captures;
        s.active.undo = null;
      });
      consumeCard(id);
      setSelected(null);
      return;
    }
    if (!CARDS[id].steps.length) return resolveCard(id, []);
    setTargeting({ id, picks: [] });
    setSelected(null);
  };

  /* ---------------- Hints ---------------- */
  const hints = new Map<number, HintKind>();
  const showHints = sel?.side === 'P' ? save.settings.showMoves : save.settings.showEnemyMoves;
  if (sel && sel.alive && showHints && !targeting) {
    if (sel.side === 'E') for (const [sq, k] of reachSquares(battle, sel.id)) hints.set(sq, k);
    else for (const m of selMoves) {
      if (m.kind === 'strike') {
        const t = battle.units[m.target!];
        for (let y = t.y; y < t.y + t.size; y++) for (let x = t.x; x < t.x + t.size; x++) hints.set(y * battle.w + x, 'strike');
      } else hints.set(m.y * battle.w + m.x, m.kind === 'move' ? 'move' : 'capture');
    }
  }

  const onCell = (x: number, y: number) => {
    if (final) return;
    const sq = y * battle.w + x;
    const c = battle.grid[sq];

    if (targeting) {
      if (!targets?.has(sq)) return;
      const picks = [...targeting.picks, sq];
      if (picks.length >= CARDS[targeting.id].steps.length) resolveCard(targeting.id, picks, targeting.reinforce);
      else setTargeting({ ...targeting, picks });
      sfx.select();
      return;
    }

    if (sel && sel.side === 'P' && myTurn) {
      const m = selMoves.find((m) => (m.kind === 'strike' ? c === m.target! + 1 : m.x === x && m.y === y));
      if (m) {
        const evs: FxEvent[] = [];
        let nb = applyMove(battle, m, evs);
        if (!nb.over && battle.bonusMove) nb = { ...nb, turn: 'P', bonusMove: false, quietOnly: true };
        else if (battle.quietOnly) nb = { ...nb, quietOnly: false };
        const loot = lootFromFx(evs, stage, active?.lootMult ?? 1);
        if (!evs.length) sfx.move();
        playFx(evs, stage);
        setSelected(null);
        const before = { battle, loot: active!.loot, captures: active!.captures };
        update((s) => {
          if (!s.active) return;
          if (!battle.quietOnly) s.active.undo = before;
          s.active.battle = nb;
          s.active.loot += loot.coins;
          s.active.captures += loot.captures;
        });
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
  const turnNo = Math.min(Math.floor(battle.ply / 2) + 1, Math.ceil(battle.maxPly / 2));
  const maxTurns = Math.ceil(battle.maxPly / 2);
  const turnsLeft = maxTurns - turnNo;
  const loot = final ? final.result.loot : active?.loot ?? 0;
  const cardCounts = [...new Set(loadout)].map((id) => [id, loadout.filter((c) => c === id).length] as const);

  return (
    <div className="battle screen-split">
      <div className="board-col">
        <div className="screen-head">
          <h2>
            {stage.hard && '🔥 '}
            {t.stage(stage)}
          </h2>
          <div className={`turn-badge ${myTurn ? 'mine' : 'theirs'}`}>
            {battle.over || final ? '—' : myTurn ? (battle.quietOnly ? t.battle.bonusMove : t.battle.yourMove) : <>{t.battle.enemy}<span className="dots" /></>}
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
          levels={levels}
          targets={targets}
          onCell={onCell}
        />
        {targeting && (
          <div className="targeting">
            <span>
              {CARDS[targeting.id].icon} {t.cardName(targeting.id)}
            </span>
            {targeting.id === 'reinforce' && !targeting.reinforce && (
              <span className="reserve">
                {reserve.map((k) => (
                  <button key={k} onClick={() => setTargeting({ ...targeting, reinforce: k })} title={t.piece(k)}>
                    <PieceGlyph type={k} />
                    <small>×{count(save.army, k)}</small>
                  </button>
                ))}
              </span>
            )}
            <button className="btn btn-ghost btn-small" onClick={() => setTargeting(null)}>✕</button>
          </div>
        )}
        {battle.telegraph && <div className="telegraph-warning">{battle.telegraph.kind === 'breath' ? t.battle.fire : t.battle.quake}</div>}
      </div>

      <aside className="side-col">
        {cardCounts.length > 0 && !final && (
          <section className="card-bar">
            {cardCounts.map(([id, n]) => (
              <button
                key={id}
                className={`card-btn ${targeting?.id === id ? 'active' : ''}`}
                disabled={!canPlay(id)}
                onClick={() => (targeting?.id === id ? setTargeting(null) : startCard(id))}
                title={`${t.cardName(id)}: ${t.cardDesc(id)}`}
              >
                <span>{CARDS[id].icon}</span>
                {n > 1 && <small>×{n}</small>}
              </button>
            ))}
          </section>
        )}
        <section className="panel battle-info">
          <div className="info-row">
            <span className={turnsLeft <= 5 && !final ? 'warn' : ''} title={t.battle.turnLimit}>⏱ {turnNo}/{maxTurns}</span>
            {(battle.cardsUsed ?? 0) + (active?.preCards ?? 0) > 0 && <span className="muted small" title={t.battle.cardsUsed}>🃏 ★★</span>}
            <span className="loot" title={t.battle.loot}>🪙 {loot}{(active?.lootMult ?? 1) > 1 && ' ×2'}</span>
          </div>
          <div className="strength" title={t.battle.strength}>
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
                <b>{t.bossName(b.boss!)}</b>
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
              <div className="glyph-row" title={t.battle.captured}>
                {capturedByMe.map((u) => <PieceGlyph key={u.id} type={(u.promotedFrom ?? u.type) as PieceType} side="E" />)}
              </div>
              <div className="glyph-row lost-row" title={t.battle.lost}>
                {myFallen.map((u) => <PieceGlyph key={u.id} type={(u.promotedFrom ?? u.type) as PieceType} temp={u.temp} />)}
              </div>
            </div>
          )}
        </section>

        <div className="battle-actions">
          <button className="btn btn-ghost btn-small" title={t.battle.moveHints} onClick={() => update((s) => void (s.settings.showMoves = !s.settings.showMoves))}>
            {save.settings.showMoves ? '👁' : '🙈'}
          </button>
          {!final && (
            <button className="btn btn-ghost btn-small danger" disabled={thinking} onClick={() => setConfirmSurrender(true)}>
              {t.battle.retreat}
            </button>
          )}
        </div>
      </aside>

      {confirmSurrender && (
        <Modal onClose={() => setConfirmSurrender(false)}>
          <h2>{t.battle.retreatQ}</h2>
          <p className="muted">{t.battle.retreatInfo}</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmSurrender(false)}>{t.battle.cancel}</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setConfirmSurrender(false);
                endBattle(battle, { winner: 'E', reason: 'surrender' });
              }}
            >
              {t.battle.retreatBtn}
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
  const t = useT();
  const { result, stage, unlocked, cardsUnlocked, arenaUnlocked, hardUnlocked, levelUps, skinsEarned } = final;
  const { outcome } = result;
  const title = result.win ? t.result.victory : outcome.winner === 'draw' ? t.result.draw : t.result.defeat;
  const reason = reasons(t)[outcome.reason][result.win ? 0 : 1];
  const next = result.win ? nextStage(stage) : undefined;
  const home = () => setView({ name: 'hub', tab: stage.isArena ? 'arena' : 'campaign' });
  const retry = () => setView({ name: 'deploy', stage: stage.isArena ? arenaStage(save.arena.level) : stage });
  const xpTypes = PIECE_ORDER.filter((t) => result.xp[t]);

  return (
    <Modal className={`result ${result.win ? 'win' : 'lose'}`}>
      <h1 className="result-title">{title}</h1>
      {reason && <p className="result-reason">{reason}</p>}
      {result.win && <Stars n={result.stars} />}
      {result.cardCapped && <p className="muted small">{t.result.cardCap}</p>}
      <div className="breakdown">
        <div><span>{t.result.loot}</span><b>🪙 {result.loot}</b></div>
        {result.reward > 0 && <div><span>{t.result.reward}</span><b>🪙 {result.reward}</b></div>}
        {result.firstClearBonus > 0 && <div className="bonus"><span>{t.result.firstWin}</span><b>🪙 {result.firstClearBonus}</b></div>}
        <div className="total"><span>{t.result.total}</span><b>🪙 {result.total}</b></div>
      </div>
      {xpTypes.length > 0 && (
        <div className="xp-gains">
          {xpTypes.map((k) => {
            const up = levelUps.find((l) => l.type === k);
            return (
              <span key={k} className={`xp-gain ${up ? 'up' : ''} ${up?.rankUp ? 'rank-up' : ''}`} title={up?.rankUp ? t.rank(Math.floor(up.to / 10)) : undefined}>
                <PieceGlyph type={k} level={up?.to ?? levelInfo(save.xp[k] ?? 0).level} rank={levelInfo(save.xp[k] ?? 0).rank} />
                <small>{t.result.xp(result.xp[k] ?? 0)}</small>
                {up?.rankUp && <b>{t.rank(Math.floor(up.to / 10))}!</b>}
              </span>
            );
          })}
        </div>
      )}
      {unlocked.map((k) => (
        <button key={k} className="unlock" onClick={() => setView({ name: 'hub', tab: 'shop', section: 'army', focus: `piece:${k}` })}>
          <PieceGlyph type={k} className="big" />
          <b>{t.result.newItem(t.piece(k))}</b>
        </button>
      ))}
      {cardsUnlocked.length > 0 && (
        <button className="unlock" onClick={() => setView({ name: 'hub', tab: 'shop', section: 'cards', focus: `card:${cardsUnlocked[0]}` })}>
          <span className="big-icon">{cardsUnlocked.map((c) => CARDS[c].icon).join(' ')}</span>
          <b>{t.result.newCards}</b>
        </button>
      )}
      {hardUnlocked && (
        <button
          className="unlock"
          onClick={() => {
            // Open the campaign with this world already switched to Hard mode.
            useStore.getState().setHardView(stage.region, true);
            home();
          }}
        >
          <span className="big-icon">🔥</span>
          <b>{t.result.newHard}</b>
        </button>
      )}
      {skinsEarned.map((id) => (
        <button key={id} className="unlock" onClick={() => setView({ name: 'hub', tab: 'shop', section: 'style', focus: `skin:piece:${id}` })}>
          <span className="big-icon">🎨</span>
          <b>{t.result.newSkin(t.skin('piece', id))}</b>
        </button>
      ))}
      {arenaUnlocked && (
        <button className="unlock" onClick={() => setView({ name: 'hub', tab: 'arena' })}>
          <span className="big-icon">🏟️</span>
          <b>{t.result.newArena}</b>
        </button>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={home}>{t.result.home}</button>
        <button className="btn btn-ghost" onClick={retry}>{result.win ? t.result.replay : t.result.retry}</button>
        {next ? (
          <button className="btn btn-primary" onClick={() => setView({ name: 'deploy', stage: next })}>{t.result.next}</button>
        ) : stage.isArena && result.win ? (
          <button className="btn btn-primary" onClick={retry}>{t.result.nextLevel}</button>
        ) : null}
      </div>
    </Modal>
  );
}
