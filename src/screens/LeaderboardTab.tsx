import { useEffect, useState } from 'react';
import { GoogleIcon } from '../components/Chrome';
import { PieceGlyph } from '../components/Piece';
import { cleanNickname, totalStars, validNickname } from '../game/ladder';
import type { PieceType } from '../game/types';
import { firebaseEnabled } from '../state/firebase';
import { entryFromSave, fetchPosition, fetchTop, keyField, removeLadderEntry, syncLadder, type Board, type LadderEntry } from '../state/leaderboard';
import { useStore } from '../state/store';

const CACHE_MS = 3 * 60_000;
const cache = new Map<string, { at: number; top: LadderEntry[]; position: number | null }>();

const BOARDS: { id: Board; icon: string; label: string; rule: string }[] = [
  { id: 'stars', icon: '⭐', label: 'Stars', rule: 'Most stars → fewest battles to reach them → first to get there' },
  { id: 'arena', icon: '🏟️', label: 'Arena', rule: 'Highest level → fewest Arena fights to reach it → first to get there' },
];

const value = (b: Board, e: LadderEntry) => (b === 'stars' ? `★ ${e.stars}` : `Lv ${e.arena}`);
const detail = (b: Board, e: LadderEntry) => (b === 'stars' ? `${e.starsBattles} battles` : `${e.arenaRuns} fights`);
const counts = (b: Board, e: LadderEntry) => (b === 'stars' ? e.stars > 0 : e.arena > 0);
const PODIUM: { place: number; glyph: PieceType }[] = [
  { place: 2, glyph: 'rook' },
  { place: 1, glyph: 'queen' },
  { place: 3, glyph: 'bishop' },
];

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'just now' : `${m} min ago`;
}

export function LeaderboardTab() {
  const { save, player, view, setView, update, signIn } = useStore();
  const board: Board = (view.name === 'hub' && view.board) || 'stars';
  const joined = !!player && !player.guest && save.ladder.joined && !!save.ladder.nickname;
  const me = player && joined ? entryFromSave(player.uid, save) : null;
  const myKey = me ? me[keyField(board)] : null;
  const cacheKey = `${board}:${player?.uid ?? '-'}:${myKey ?? '-'}`;

  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; top: LadderEntry[]; position: number | null; at: number }>({
    status: 'loading', top: [], position: null, at: 0,
  });
  const [tick, setTick] = useState(0);
  const [showRule, setShowRule] = useState(false);

  useEffect(() => {
    let alive = true;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS && tick === 0) {
      setState({ status: 'ready', ...hit });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    (async () => {
      try {
        const top = (await fetchTop(board)).filter((e) => counts(board, e));
        const position = me && counts(board, me) ? await fetchPosition(board, myKey!) : null;
        const fresh = { at: Date.now(), top, position };
        cache.set(cacheKey, fresh);
        if (alive) setState({ status: 'ready', ...fresh });
      } catch (e) {
        console.warn('Leaderboard load failed', e);
        if (alive) setState((s) => ({ ...s, status: 'error' }));
      }
    })();
    return () => {
      alive = false;
    };
    // `me` is derived from save; cacheKey captures the parts that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tick]);

  const refresh = () => {
    cache.clear();
    setTick((t) => t + 1);
  };
  const rule = BOARDS.find((b) => b.id === board)!.rule;
  const top3 = state.top.slice(0, 3);
  const rest = state.top.slice(3);
  const meInTop = !!me && state.top.some((e) => e.uid === me.uid);

  return (
    <div className="ladder">
      <nav className="segmented">
        {BOARDS.map((b) => (
          <button key={b.id} className={board === b.id ? 'active' : ''} onClick={() => setView({ name: 'hub', tab: 'ranks', board: b.id })}>
            {b.icon} {b.label}
          </button>
        ))}
      </nav>

      <div className="ladder-bar">
        <button className={`ladder-rule-btn ${showRule ? 'on' : ''}`} onClick={() => setShowRule(!showRule)} aria-label="How ties are broken">
          ⓘ Ties
        </button>
        <span className="muted small">{state.at ? `Updated ${ago(state.at)}` : ''}</span>
        <button className="btn btn-ghost btn-small" onClick={refresh} disabled={state.status === 'loading'} aria-label="Refresh">
          ↻
        </button>
      </div>
      {showRule && <p className="ladder-rule">{rule}</p>}

      <JoinCard
        joined={joined}
        guest={!player || player.guest}
        nickname={save.ladder.nickname}
        onSignIn={() => void signIn()}
        onSave={async (name) => {
          update((s) => {
            s.ladder.joined = true;
            s.ladder.nickname = name;
            // Older saves don't know when their scores were reached: start the clock now.
            if (!s.ladder.starsAt && totalStars(s.stages) > 0) {
              s.ladder.starsAt = Date.now();
              s.ladder.starsBattles = s.stats.battles;
            }
            if (!s.ladder.arenaAt && s.arena.best > 0) {
              s.ladder.arenaAt = Date.now();
              s.ladder.arenaRunsAtBest = s.ladder.arenaRuns;
            }
          });
          if (!(await syncLadder())) useStore.getState().toast("Couldn't save to the leaderboard — try again", '⚠️');
          refresh();
        }}
        onLeave={async () => {
          if (player) await removeLadderEntry(player.uid).catch((e) => console.warn(e));
          update((s) => void (s.ladder.joined = false));
          refresh();
        }}
      />

      {state.status === 'error' && (
        <div className="panel ladder-empty">
          <p>Couldn't load the leaderboard.</p>
          <button className="btn btn-small" onClick={refresh}>Try again</button>
        </div>
      )}

      {state.status === 'loading' && !state.top.length && (
        <div className="ladder-list skeleton">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="ladder-row" />
          ))}
        </div>
      )}

      {state.status !== 'error' && state.status !== 'loading' && !state.top.length && (
        <div className="panel ladder-empty">
          <div className="big-icon">🏆</div>
          <p>No one here yet. Be the first!</p>
        </div>
      )}

      {top3.length > 0 && (
        <div className="podium">
          {PODIUM.map(({ place, glyph }) => {
            const e = top3[place - 1];
            if (!e) return <div key={place} className="podium-slot empty" />;
            return (
              <div key={place} className={`podium-slot p${place} ${e.uid === me?.uid ? 'me' : ''}`}>
                <PieceGlyph type={glyph} className="podium-glyph" />
                <b className="podium-name" title={e.name}>{e.name}</b>
                <span className="podium-value">{value(board, e)}</span>
                <small>{detail(board, e)}</small>
                <div className="podium-step">{place}</div>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="ladder-list">
          {rest.map((e, i) => (
            <Row key={e.uid} pos={i + 4} e={e} board={board} me={e.uid === me?.uid} />
          ))}
        </ol>
      )}

      {me && !meInTop && state.status === 'ready' && (
        <div className="ladder-me">
          {counts(board, me) && state.position ? (
            <Row pos={state.position} e={me} board={board} me />
          ) : (
            <p className="muted small">{board === 'stars' ? 'Win a stage to get on this board.' : 'Win an Arena fight to get on this board.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ pos, e, board, me }: { pos: number; e: LadderEntry; board: Board; me: boolean }) {
  return (
    <li className={`ladder-row ${me ? 'me' : ''}`}>
      <span className="ladder-pos">#{pos.toLocaleString()}</span>
      <span className="ladder-name">
        {e.name}
        {me && <em>You</em>}
      </span>
      <span className="ladder-value">
        {value(board, e)}
        <small>{detail(board, e)}</small>
      </span>
    </li>
  );
}

function JoinCard(props: {
  joined: boolean;
  guest: boolean;
  nickname: string | null;
  onSignIn: () => void;
  onSave: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const ok = validNickname(name);

  if (props.guest) {
    return (
      <div className="panel join-card">
        <p>Sign in to join the leaderboard.</p>
        {firebaseEnabled && (
          <button className="btn btn-google btn-small" onClick={props.onSignIn}>
            <GoogleIcon /> Sign in with Google
          </button>
        )}
      </div>
    );
  }

  if (props.joined && !editing) {
    return (
      <div className="join-status">
        <span className="muted small">
          Playing as <b>{props.nickname}</b>
        </span>
        <button className="btn btn-ghost btn-small" onClick={() => (setName(props.nickname ?? ''), setEditing(true))}>✎ Rename</button>
        <button
          className="btn btn-ghost btn-small danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await props.onLeave();
            setBusy(false);
          }}
        >
          Leave
        </button>
      </div>
    );
  }

  return (
    <form
      className="panel join-card"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        await props.onSave(cleanNickname(name));
        setBusy(false);
        setEditing(false);
      }}
    >
      <b>{props.joined ? 'Change nickname' : 'Join the leaderboard'}</b>
      <div className="join-row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Nickname" aria-label="Nickname" autoComplete="off" />
        <button className="btn btn-primary btn-small" type="submit" disabled={!ok || busy}>
          {props.joined ? 'Save' : 'Join'}
        </button>
        {props.joined && (
          <button className="btn btn-ghost btn-small" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      <small className={name && !ok ? 'error' : 'muted'}>
        {name && !ok ? '3–16 letters, numbers, spaces, . _ -' : 'Only your nickname and scores are shown.'}
      </small>
    </form>
  );
}
