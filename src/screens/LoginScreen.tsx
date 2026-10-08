import { useMemo } from 'react';
import { GoogleIcon } from '../components/Chrome';
import { firebaseEnabled } from '../state/firebase';
import { useStore } from '../state/store';

const FLOATERS = ['♟', '♞', '♝', '♜', '♛', '♚'];

export function LoginScreen() {
  const { signIn, playAsGuest, authError, phase } = useStore();
  const floaters = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        g: FLOATERS[i % FLOATERS.length],
        left: Math.random() * 100,
        delay: -Math.random() * 20,
        dur: 14 + Math.random() * 14,
        size: 1.5 + Math.random() * 3,
      })),
    [],
  );
  return (
    <div className="login">
      <div className="floaters" aria-hidden>
        {floaters.map((f, i) => (
          <span key={i} style={{ left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, fontSize: `${f.size}rem` }}>
            {f.g}&#xFE0E;
          </span>
        ))}
      </div>
      <div className="login-card panel">
        <div className="login-crest">♞&#xFE0E;</div>
        <h1 className="title">Gambit Quest</h1>
        <p className="tagline">From pawns to queens.</p>
        {phase === 'loading' ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <button className="btn btn-google btn-lg" onClick={() => void signIn()} disabled={!firebaseEnabled}>
              <GoogleIcon /> Sign in with Google
            </button>
            {!firebaseEnabled && <p className="muted small">Google sign-in not configured yet.</p>}
            <button className="btn btn-ghost" onClick={playAsGuest}>
              Play as guest
            </button>
          </>
        )}
        {authError && <p className="error">{authError}</p>}
      </div>
    </div>
  );
}
