import type { CSSProperties } from 'react';
import { BossFigure } from '../components/BossFigure';
import {
  MAIN_STAGES, REGIONS, STAGES, extraStarsNeeded, hardStage, hardStars, isCleared, isHardOpen, isStageUnlocked, mainStars,
} from '../game/campaign';
import type { StageDef } from '../game/types';
import { useT } from '../i18n';
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
  const t = useT();
  const open = isStageUnlocked(save.stages, s);
  const p = save.stages[s.id];
  const face = !open ? '🔒' : s.isBoss ? <BossFigure kind={s.boss!.kind} /> : s.extra ? '✦' : s.id.split('-')[1].replace('H', '');
  return (
    <button
      className={`stage-node ${s.isBoss ? 'boss' : ''} ${s.extra ? 'extra' : ''} ${p ? 'cleared' : ''} ${current ? 'current' : ''}`}
      disabled={!open}
      onClick={() => setView({ name: 'deploy', stage: s })}
      title={t.stage(s)}
    >
      <span className="node-face">{face}</span>
      <span className="node-label">{open ? t.stage(s) : s.extra ? `★ ${extraStarsNeeded(s.extra)}` : ''}</span>
      {p && <Stars n={p.stars} />}
    </button>
  );
}

export function CampaignTab() {
  const { save, setView, hardView, toggleHard } = useStore();
  const t = useT();
  const progress = save.stages;

  return (
    <div className="campaign">
      {save.active && (
        <button className="resume-banner" onClick={() => setView({ name: 'battle' })}>
          ⚔️ {t.campaign.resume} <b>{t.stage(save.active.stage)}</b>
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
              <h2>{t.region(r)}</h2>
              {hardOpen && (
                <button className={`hard-toggle ${hard ? 'on' : ''}`} onClick={() => toggleHard(r.id)} title={t.campaign.hardTitle}>
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
              <p className="region-lock">🔒 {prevBoss && t.stage(prevBoss)}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
