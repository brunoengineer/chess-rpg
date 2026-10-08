import { BOSSES } from '../game/bosses';
import { ARENA_THEME, ARENA_UNLOCK, STAGE_BY_ID, arenaStage, isCleared } from '../game/campaign';
import { LETTERS } from '../game/pieces';
import type { PieceType } from '../game/types';
import { PieceGlyph } from '../components/Piece';
import { useStore } from '../state/store';

export function enemyRoster(layout: string[]): [PieceType, number][] {
  const counts = new Map<PieceType, number>();
  for (const row of layout) for (const ch of row) if (LETTERS[ch]) counts.set(LETTERS[ch], (counts.get(LETTERS[ch]) ?? 0) + 1);
  return [...counts.entries()];
}

export function ArenaTab() {
  const { save, setView } = useStore();
  if (!isCleared(save.stages, ARENA_UNLOCK)) {
    return (
      <div className="arena panel locked-panel">
        <div className="big-icon">🏟️</div>
        <h2>The Endless Arena</h2>
        <p>🔒 Defeat <b>{STAGE_BY_ID[ARENA_UNLOCK].name}</b></p>
      </div>
    );
  }
  const stage = arenaStage(save.arena.level);
  return (
    <div className="arena">
      <section className="region arena-hero" style={{ background: ARENA_THEME.bg }}>
        <div className="arena-level">
          <small>Level</small>
          <b>{save.arena.level}</b>
        </div>
        <div>
          <h2>{stage.name}</h2>
          <div className="chips">
            <span className="chip">📐 {stage.w}×{stage.h}</span>
            <span className="chip">🪙 {stage.reward} + loot ×{stage.lootMult}</span>
            <span className="chip">⏱ {stage.maxTurns} turns</span>
            <span className="chip">🏆 Best: {save.arena.best || '—'}</span>
          </div>
          <div className="roster">
            {stage.boss && <span className="roster-item">{BOSSES[stage.boss.kind].emoji}</span>}
            {enemyRoster(stage.layout).map(([t, n]) => (
              <span key={t} className="roster-item">
                <PieceGlyph type={t} side="E" /> ×{n}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setView({ name: 'deploy', stage })} disabled={!!save.active}>
            Enter the Arena
          </button>
        </div>
      </section>
    </div>
  );
}
