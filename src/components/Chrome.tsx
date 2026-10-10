import { useEffect, useRef, useState } from 'react';
import { firebaseEnabled } from '../state/firebase';
import type { Settings } from '../state/save';
import { useStore, type Tab } from '../state/store';
import { Modal } from './Modal';

/** Number that counts up/down smoothly when it changes. */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString()}</>;
}

export function CoinPill({ amount, onClick }: { amount: number; onClick?: () => void }) {
  return (
    <button className="pill pill-coins pill-link" title="Coins · open the Shop" onClick={onClick} disabled={!onClick}>
      <span className="coin-icon">🪙</span>
      <AnimatedNumber value={amount} />
    </button>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'campaign', label: 'Campaign', icon: '🗺️' },
  { id: 'arena', label: 'Arena', icon: '🏟️' },
  { id: 'shop', label: 'Shop', icon: '⚒️' },
  { id: 'barracks', label: 'Barracks', icon: '🛡️' },
];

export function TopBar() {
  const { save, player, view, setView, sync, setSettingsOpen, setTutorialOpen } = useStore();
  const tab = view.name === 'hub' ? view.tab : null;
  // Coins and leadership open the Shop (not mid-battle, so a stray tap can't pull you out of a fight).
  const toShop = view.name === 'battle' ? undefined : () => setView({ name: 'hub', tab: 'shop' });
  const syncIcon = player?.guest ? '💾' : sync === 'saving' ? '⏳' : sync === 'error' ? '⚠️' : '☁️';
  const syncTitle = player?.guest ? 'Guest: saved on this device only' : sync === 'saving' ? 'Saving…' : sync === 'error' ? 'Cloud save failed — will retry on next change' : 'Saved to the cloud';
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'hub', tab: 'campaign' })} disabled={view.name === 'battle'}>
          <span className="brand-glyph">♞&#xFE0E;</span>
          <span className="brand-name">Gambit Quest</span>
        </button>
        {tab && (
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setView({ name: 'hub', tab: t.id })}>
                <span className="tab-icon">{t.icon}</span>
                <span className="tab-label">{t.label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="topbar-right">
          <CoinPill amount={save.coins} onClick={toShop} />
          <button className="pill pill-link" title="Leadership · upgrade it in the Shop" onClick={toShop} disabled={!toShop}>
            👑 {save.leadership}
          </button>
          <span className="sync" title={syncTitle}>
            {syncIcon}
          </span>
          <button className="help-btn" onClick={() => setTutorialOpen(true)} title="How to play" aria-label="How to play">
            ?
          </button>
          <button className="avatar" onClick={() => setSettingsOpen(true)} title="Settings">
            {player?.photo ? <img src={player.photo} alt="" referrerPolicy="no-referrer" /> : <span>⚙️</span>}
          </button>
        </div>
      </header>
      {tab && (
        <nav className="bottom-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setView({ name: 'hub', tab: t.id })}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.icon && <span>{t.icon}</span>} {t.text}
        </div>
      ))}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" />
    </label>
  );
}

export function SettingsModal() {
  const { save, update, player, signIn, signOut, resetProgress, setSettingsOpen, authError } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (k: keyof Settings) => (v: boolean) => update((s) => void (s.settings[k] = v));
  const st = save.stats;
  return (
    <Modal onClose={() => setSettingsOpen(false)} className="settings">
      <h2>Settings</h2>
      <div className="account">
        {player?.photo && <img src={player.photo} alt="" referrerPolicy="no-referrer" />}
        <div>
          <strong>{player?.name}</strong>
          <small>{player?.guest ? '💾 This device only' : '☁️ Cloud save'}</small>
        </div>
      </div>
      {player?.guest && firebaseEnabled && (
        <button className="btn btn-google" onClick={() => void signIn()}>
          <GoogleIcon /> Sign in with Google
        </button>
      )}
      {authError && <p className="error">{authError}</p>}

      <div className="toggles">
        <Toggle label="Move hints" value={save.settings.showMoves} onChange={set('showMoves')} />
        <Toggle label="Enemy move hints" value={save.settings.showEnemyMoves} onChange={set('showEnemyMoves')} />
        <Toggle label="Sound" value={save.settings.sound} onChange={set('sound')} />
        <Toggle label="Fast animations" value={save.settings.fastAnim} onChange={set('fastAnim')} />
      </div>

      <div className="stats-grid">
        <div><b>{st.battles}</b><small>Battles</small></div>
        <div><b>{st.wins}</b><small>Victories</small></div>
        <div><b>{st.captures}</b><small>Captures</small></div>
        <div><b>{st.bossesSlain}</b><small>Bosses</small></div>
        <div><b>{st.coinsEarned.toLocaleString()}</b><small>Coins</small></div>
      </div>

      <div className="settings-actions">
        {!confirmReset ? (
          <button className="btn btn-ghost danger" onClick={() => setConfirmReset(true)}>Reset</button>
        ) : (
          <button className="btn btn-danger" onClick={resetProgress}>Erase all?</button>
        )}
        <button className="btn btn-ghost" onClick={() => void signOut()}>{player?.guest ? 'Exit' : 'Sign out'}</button>
      </div>
    </Modal>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
