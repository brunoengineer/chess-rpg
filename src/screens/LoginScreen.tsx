import { useMemo } from 'react';
import { GoogleIcon } from '../components/Chrome';
import { useT } from '../i18n';
import { firebaseEnabled } from '../state/firebase';
import { useStore } from '../state/store';

const FLOATERS = ['♟', '♞', '♝', '♜', '♛', '♚'];

export function LoginScreen() {
  const { signIn, playAsGuest, authError, phase, lang, setLang } = useStore();
  const t = useT();
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
        <p className="tagline">{t.login.tagline}</p>
        {phase === 'loading' ? (
          <p className="muted">{t.login.loading}</p>
        ) : (
          <>
            <button className="btn btn-google btn-lg" onClick={() => void signIn()} disabled={!firebaseEnabled}>
              <GoogleIcon /> {t.login.signIn}
            </button>
            {!firebaseEnabled && <p className="muted small">{t.login.notConfigured}</p>}
            <button className="btn btn-ghost" onClick={playAsGuest}>
              {t.login.guest}
            </button>
          </>
        )}
        {authError && <p className="error">{authError}</p>}
        <div className="lang-switch small-switch" role="group" aria-label={t.language.label}>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'pt' ? 'active' : ''} onClick={() => setLang('pt')}>Português</button>
        </div>
      </div>
    </div>
  );
}
