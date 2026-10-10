import { ARENA_THEME, ARENA_UNLOCK, STAGE_BY_ID, arenaStage, isCleared } from '../game/campaign';
import { LETTERS } from '../game/pieces';
import type { PieceType } from '../game/types';
import { BossFigure } from '../components/BossFigure';
import { PieceGlyph } from '../components/Piece';
import { useT } from '../i18n';
import { useStore } from '../state/store';

export function enemyRoster(layout: string[]): [PieceType, number][] {
  const counts = new Map<PieceType, number>();
  for (const row of layout) for (const ch of row) if (LETTERS[ch]) counts.set(LETTERS[ch], (counts.get(LETTERS[ch]) ?? 0) + 1);
  return [...counts.entries()];
}

export function ArenaTab() {
  const { save, setView } = useStore();
  const t = useT();
  if (!isCleared(save.stages, ARENA_UNLOCK)) {
    return (
      <div className="arena panel locked-panel">
        <div className="big-icon">🏟️</div>
        <h2>{t.region(ARENA_THEME)}</h2>
        <p>🔒 {t.arena.locked} <b>{t.stage(STAGE_BY_ID[ARENA_UNLOCK])}</b></p>
      </div>
    );
  }
  const stage = arenaStage(save.arena.level);
  return (
    <div className="arena">
      <section className="region arena-hero" style={{ background: ARENA_THEME.bg }}>
        <div className="arena-level">
          <small>{t.arena.level}</small>
          <b>{save.arena.level}</b>
        </div>
        <div>
          <h2>{t.stage(stage)}</h2>
          <div className="chips">
            <span className="chip">📐 {stage.w}×{stage.h}</span>
            <span className="chip">🪙 {t.arena.reward(stage.reward, stage.lootMult)}</span>
            <span className="chip">⏱ {t.arena.turns(stage.maxTurns)}</span>
            <span className="chip">🏆 {t.arena.best} {save.arena.best || '—'}</span>
          </div>
          <div className="roster">
            {stage.boss && (
              <span className="roster-item">
                <BossFigure kind={stage.boss.kind} className="inline" /> {t.bossName(stage.boss.kind)}
              </span>
            )}
            {enemyRoster(stage.layout).map(([t, n]) => (
              <span key={t} className="roster-item">
                <PieceGlyph type={t} side="E" /> ×{n}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setView({ name: 'deploy', stage })} disabled={!!save.active}>
            {t.arena.enter}
          </button>
        </div>
      </section>
    </div>
  );
}
