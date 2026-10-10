import type { CSSProperties } from 'react';
import { BossFigure } from '../components/BossFigure';
import {
  MAIN_STAGES, REGIONS, STAGES, extraStarsNeeded, hardStage, hardStars, isCleared, isHardOpen, isStageUnlocked, mainStars,
} from '../game/campaign';
import type { StageDef } from '../game/types';
import { useStore } from '../state/store';

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>★</span>
      ))}
    </span>
  );
}

function StageNode({ s, current }: { s: StageDef; current: boolean }) {
  const { save, setView } = useStore();
  const open = isStageUnlocked(save.stages, s);
  const p = save.stages[s.id];
  const face = !open ? '🔒' : s.isBoss ? <BossFigure kind={s.boss!.kind} /> : s.extra ? '✦' : s.id.split('-')[1].replace('H', '');
  return (
    <button
      className={`stage-node ${s.isBoss ? 'boss' : ''} ${s.extra ? 'extra' : ''} ${p ? 'cleared' : ''} ${current ? 'current' : ''}`}
      disabled={!open}
      onClick={() => setView({ name: 'deploy', stage: s })}
      title={s.name}
    >
      <span className="node-face">{face}</span>
      <span className="node-label">{open ? s.name : s.extra ? `★ ${extraStarsNeeded(s.extra)}` : ''}</span>
      {p && <Stars n={p.stars} />}
    </button>
  );
}

export function CampaignTab() {
  const { save, setView, hardView, toggleHard } = useStore();
  const progress = save.stages;

  return (
    <div className="campaign">
      {save.active && (
        <button className="resume-banner" onClick={() => setView({ name: 'battle' })}>
          ⚔️ Resume: <b>{save.active.stage.name}</b>
        </button>
      )}
      {REGIONS.map((r) => {
        const all = STAGES.filter((s) => s.region === r.id);
        const hardOpen = isHardOpen(progress, r.id);
        const hard = hardOpen && !!hardView[r.id];
        const main = all.filter((s) => !s.extra).map((s) => (hard ? hardStage(s) : s));
        const extras = hard ? [] : all.filter((s) => s.extra);
        const unlocked = isStageUnlocked(progress, main[0]);
        const prevBoss = STAGES.find((s) => s.region === r.id - 1 && s.isBoss && !s.extra);
        const current = main.find((s) => !isCleared(progress, s.id) && isStageUnlocked(progress, s));
        return (
          <section
            key={r.id}
            className={`region ${unlocked ? '' : 'locked'} ${hard ? 'hard' : ''}`}
            style={{ background: r.bg, ['--accent' as string]: hard ? '#ff6a3d' : r.accent } as CSSProperties}
          >
            <header className="region-head">
              <span className="region-icon">{r.icon}</span>
              <h2>{r.name}</h2>
              {hardOpen && (
                <button className={`hard-toggle ${hard ? 'on' : ''}`} onClick={() => toggleHard(r.id)} title="Hard mode: enemies +2 ranks, double rewards">
                  🔥
                </button>
              )}
              <span className="region-stars">★ {hard ? hardStars(progress, r.id) : mainStars(progress, r.id)}/{MAIN_STAGES * 3}</span>
            </header>
            {unlocked ? (
              <div className="stage-path">
                {main.map((s, i) => (
                  <div key={s.id} className="stage-wrap">
                    {i > 0 && <span className={`path-line ${isStageUnlocked(progress, s) ? 'open' : ''}`} />}
                    <StageNode s={s} current={s.id === current?.id} />
                  </div>
                ))}
                {extras.length > 0 && (
                  <div className="extras">
                    {extras.map((s) => (
                      <StageNode key={s.id} s={s} current={false} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="region-lock">🔒 {prevBoss?.name}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
