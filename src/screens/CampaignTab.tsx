import type { CSSProperties } from 'react';
import { BOSSES } from '../game/bosses';
import { REGIONS, STAGES, isCleared, isStageUnlocked } from '../game/campaign';
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

export function CampaignTab() {
  const { save, setView } = useStore();
  const progress = save.stages;
  const nextStage = STAGES.find((s) => !isCleared(progress, s.id) && isStageUnlocked(progress, s));

  return (
    <div className="campaign">
      {save.active && (
        <button className="resume-banner" onClick={() => setView({ name: 'battle' })}>
          ⚔️ A battle is in progress — <b>{save.active.stage.name}</b>. Tap to resume.
        </button>
      )}
      {REGIONS.map((r) => {
        const stages = STAGES.filter((s) => s.region === r.id);
        const unlocked = isStageUnlocked(progress, stages[0]);
        const stars = stages.reduce((a, s) => a + (progress[s.id]?.stars ?? 0), 0);
        const prevBoss = STAGES.find((s) => s.region === r.id - 1 && s.isBoss);
        return (
          <section key={r.id} className={`region ${unlocked ? '' : 'locked'}`} style={{ background: r.bg, ['--accent' as string]: r.accent } as CSSProperties}>
            <header className="region-head">
              <span className="region-icon">{r.icon}</span>
              <div>
                <h2>{r.name}</h2>
                <p>{r.subtitle}</p>
              </div>
              <span className="region-stars">★ {stars}/{stages.length * 3}</span>
            </header>
            {unlocked ? (
              <div className="stage-path">
                {stages.map((s, i) => {
                  const open = isStageUnlocked(progress, s);
                  const p = progress[s.id];
                  const current = s.id === nextStage?.id;
                  return (
                    <div key={s.id} className="stage-wrap">
                      {i > 0 && <span className={`path-line ${open ? 'open' : ''}`} />}
                      <button
                        className={`stage-node ${s.isBoss ? 'boss' : ''} ${p ? 'cleared' : ''} ${current ? 'current' : ''}`}
                        disabled={!open}
                        onClick={() => setView({ name: 'deploy', stage: s })}
                        title={s.name}
                      >
                        <span className="node-face">{!open ? '🔒' : s.isBoss ? BOSSES[s.boss!.kind].emoji : s.id.split('-')[1]}</span>
                        <span className="node-label">{s.name}</span>
                        {p && <Stars n={p.stars} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="region-lock">🔒 Defeat <b>{prevBoss?.name}</b> to open the way.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
