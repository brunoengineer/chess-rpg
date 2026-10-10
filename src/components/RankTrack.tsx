import { MAX_LEVEL, RANKS, levelInfo } from '../game/ranks';
import { Insignia } from './Piece';

/**
 * Promotion path of a piece class: Lv 0 → General (Lv 50), with a marker per rank.
 * Reached ranks are gold, the next one glows; the fill includes progress inside the current level.
 */
export function RankTrack({ xp }: { xp: number }) {
  const info = levelInfo(xp);
  const exact = info.need ? info.level + info.into / info.need : MAX_LEVEL;
  const pct = Math.min(100, (exact / MAX_LEVEL) * 100);
  return (
    <div className="rank-track" title={`Lv ${info.level} / ${MAX_LEVEL}`}>
      <div className="rank-line">
        <i style={{ width: `${pct}%` }} />
      </div>
      {[1, 2, 3, 4, 5].map((rank) => {
        const state = info.rank >= rank ? 'reached' : info.rank + 1 === rank ? 'next' : '';
        return (
          <span key={rank} className={`rank-mark ${state}`} style={{ left: `${rank * 20}%` }} title={`${RANKS[rank]} · Lv ${rank * 10}`}>
            <Insignia rank={rank} />
          </span>
        );
      })}
    </div>
  );
}
