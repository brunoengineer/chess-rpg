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

export function CoinPill({ amount }: { amount: number }) {
  return (
    <span className="pill pill-coins" title="Coins">
      <span className="coin-icon">🪙</span>
      <AnimatedNumber value={amount} />
    </span>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'campaign', label: 'Campaign', icon: '🗺️' },
  { id: 'arena', label: 'Arena', icon: '🏟️' },
  { id: 'shop', label: 'Shop', icon: '⚒️' },
  { id: 'barracks', label: 'Barracks', icon: '🛡️' },
];

export function TopBar() {
  const { save, player, view, setView, sync, setSettingsOpen } = useStore();
  const tab = view.name === 'hub' ? view.tab : null;
  const syncIcon = player?.guest ? '💾' : sync === 'saving' ? '⏳' : sync === 'error' ? '⚠️' : '☁️';
  const syncTitle = player?.guest ? 'Guest: saved on this device only' : sync === 'saving' ? 'Saving…' : sync === 'error' ? 'Cloud save failed — will retry on next change' : 'Saved to the cloud';
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'hub', tab: 'campaign' })}>
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
          <CoinPill amount={save.coins} />
          <span className="pill" title="Leadership: command points available to deploy pieces">
            👑 {save.leadership}
          </span>
          <span className="sync" title={syncTitle}>
            {syncIcon}
          </span>
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

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
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
          <small>{player?.guest ? 'Guest — progress is saved on this device only' : 'Signed in with Google — progress synced to the cloud'}</small>
        </div>
      </div>
      {player?.guest && firebaseEnabled && (
        <button className="btn btn-google" onClick={() => void signIn()}>
          <GoogleIcon /> Sign in to save in the cloud
        </button>
      )}
      {authError && <p className="error">{authError}</p>}

      <div className="toggles">
        <Toggle label="Show possible moves" hint="Highlight where the selected piece can go" value={save.settings.showMoves} onChange={set('showMoves')} />
        <Toggle label="Scout enemy moves" hint="Tap an enemy piece to see where it can go" value={save.settings.showEnemyMoves} onChange={set('showEnemyMoves')} />
        <Toggle label="Sound effects" hint="Synthesized blips and booms" value={save.settings.sound} onChange={set('sound')} />
        <Toggle label="Fast animations" hint="Snappier enemy turns" value={save.settings.fastAnim} onChange={set('fastAnim')} />
      </div>

      <div className="stats-grid">
        <div><b>{st.battles}</b><small>Battles</small></div>
        <div><b>{st.wins}</b><small>Victories</small></div>
        <div><b>{st.captures}</b><small>Captures</small></div>
        <div><b>{st.bossesSlain}</b><small>Bosses slain</small></div>
        <div><b>{st.coinsEarned.toLocaleString()}</b><small>Coins earned</small></div>
      </div>

      <div className="settings-actions">
        {!confirmReset ? (
          <button className="btn btn-ghost danger" onClick={() => setConfirmReset(true)}>Reset progress</button>
        ) : (
          <button className="btn btn-danger" onClick={resetProgress}>Really erase everything?</button>
        )}
        <button className="btn btn-ghost" onClick={() => void signOut()}>{player?.guest ? 'Back to title' : 'Sign out'}</button>
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
