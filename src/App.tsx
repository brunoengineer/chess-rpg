import { useEffect } from 'react';
import { SettingsModal, Toasts, TopBar } from './components/Chrome';
import { Tutorial } from './components/Tutorial';
import { ArenaTab } from './screens/ArenaTab';
import { BarracksTab } from './screens/BarracksTab';
import { BattleScreen } from './screens/BattleScreen';
import { CampaignTab } from './screens/CampaignTab';
import { DeployScreen } from './screens/DeployScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ShopTab } from './screens/ShopTab';
import { useStore } from './state/store';

export function App() {
  const phase = useStore((s) => s.phase);
  const view = useStore((s) => s.view);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const cosmetics = useStore((s) => s.save.cosmetics);
  const tutorialOpen = useStore((s) => s.tutorialOpen);
  const tutorialSeen = useStore((s) => s.save.tutorialSeen);

  // First time in the game: show the tutorial once (never on top of a battle in progress).
  useEffect(() => {
    if (phase === 'game' && !tutorialSeen && view.name !== 'battle') useStore.getState().setTutorialOpen(true);
  }, [phase, tutorialSeen, view.name]);

  if (phase === 'boot') {
    return (
      <div className="splash">
        <span className="brand-glyph spin">♞&#xFE0E;</span>
      </div>
    );
  }
  if (phase !== 'game') return <LoginScreen />;

  return (
    <div className="app" data-skin={cosmetics.piece} data-board={cosmetics.board}>
      <TopBar />
      <main className={`main view-${view.name}`}>
        {view.name === 'hub' && view.tab === 'campaign' && <CampaignTab />}
        {view.name === 'hub' && view.tab === 'arena' && <ArenaTab />}
        {view.name === 'hub' && view.tab === 'shop' && <ShopTab />}
        {view.name === 'hub' && view.tab === 'barracks' && <BarracksTab />}
        {view.name === 'deploy' && <DeployScreen key={view.stage.id} stage={view.stage} />}
        {view.name === 'battle' && <BattleScreen />}
      </main>
      {settingsOpen && <SettingsModal />}
      {tutorialOpen && <Tutorial />}
      <Toasts />
    </div>
  );
}
