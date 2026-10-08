import type { CSSProperties } from 'react';
import { BOSSES } from '../game/bosses';
import { MAIN_STAGES, REGIONS, STAGES, extraStarsNeeded, isCleared, isStageUnlocked, mainStars } from '../game/campaign';
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
  const face = !open ? '🔒' : s.extra ? (s.isBoss ? BOSSES[s.boss!.kind].emoji : '✦') : s.isBoss ? BOSSES[s.boss!.kind].emoji : s.id.split('-')[1];
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
  const { save, setView } = useStore();
  const progress = save.stages;
  const nextStage = STAGES.find((s) => !s.extra && !isCleared(progress, s.id) && isStageUnlocked(progress, s));

  return (
    <div className="campaign">
      {save.active && (
        <button className="resume-banner" onClick={() => setView({ name: 'battle' })}>
          ⚔️ Resume: <b>{save.active.stage.name}</b>
        </button>
      )}
      {REGIONS.map((r) => {
        const stages = STAGES.filter((s) => s.region === r.id);
        const main = stages.filter((s) => !s.extra);
        const extras = stages.filter((s) => s.extra);
        const unlocked = isStageUnlocked(progress, main[0]);
        const prevBoss = STAGES.find((s) => s.region === r.id - 1 && s.isBoss && !s.extra);
        return (
          <section key={r.id} className={`region ${unlocked ? '' : 'locked'}`} style={{ background: r.bg, ['--accent' as string]: r.accent } as CSSProperties}>
            <header className="region-head">
              <span className="region-icon">{r.icon}</span>
              <h2>{r.name}</h2>
              <span className="region-stars">★ {mainStars(progress, r.id)}/{MAIN_STAGES * 3}</span>
            </header>
            {unlocked ? (
              <div className="stage-path">
                {main.map((s, i) => (
                  <div key={s.id} className="stage-wrap">
                    {i > 0 && <span className={`path-line ${isStageUnlocked(progress, s) ? 'open' : ''}`} />}
                    <StageNode s={s} current={s.id === nextStage?.id} />
                  </div>
                ))}
                <div className="extras">
                  {extras.map((s) => (
                    <StageNode key={s.id} s={s} current={false} />
                  ))}
                </div>
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
