import { BOSSES } from './bosses';
import { LETTERS, PIECES, bossDamage } from './pieces';
import { profile } from './ranks';
import type { Battle, FxEvent, Move, Outcome, Placement, Side, StageDef, Unit, PieceType } from './types';

export const other = (s: Side): Side => (s === 'P' ? 'E' : 'P');
export const PASS: Move = { u: -1, kind: 'pass', x: 0, y: 0 };

export function unitValue(u: Unit): number {
  if (u.type === 'boss') return 3 + (u.hp ?? 0) * 1.5;
  return PIECES[u.type].value;
}

export function cloneBattle(b: Battle): Battle {
  return {
    ...b,
    units: b.units.map((u) => ({ ...u })),
    grid: b.grid.slice(),
    telegraph: b.telegraph ? { kind: b.telegraph.kind, squares: b.telegraph.squares.slice() } : null,
  };
}

function setFootprint(b: Battle, u: Unit, val: number) {
  for (let y = u.y; y < u.y + u.size; y++)
    for (let x = u.x; x < u.x + u.size; x++) b.grid[y * b.w + x] = val;
}

export function unitAt(b: Battle, x: number, y: number): Unit | null {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return null;
  const c = b.grid[y * b.w + x];
  return c > 0 ? b.units[c - 1] : null;
}

export function addUnit(b: Battle, u: Omit<Unit, 'id' | 'alive' | 'moved'>): Unit {
  const unit: Unit = { ...u, id: b.units.length, alive: true, moved: false };
  if (unit.type !== 'boss' && profile(unit.type, unit.rank ?? 0).shield) unit.shield = true;
  b.units.push(unit);
  setFootprint(b, unit, unit.id + 1);
  return unit;
}

/** Moves a unit to an empty square without spending a turn (card effects). */
export function relocate(b: Battle, id: number, x: number, y: number) {
  const u = b.units[id];
  setFootprint(b, u, 0);
  u.x = x;
  u.y = y;
  setFootprint(b, u, id + 1);
}

export function createBattle(stage: StageDef, placements: Placement[], playerRanks: Partial<Record<PieceType, number>> = {}): Battle {
  const { w, h } = stage;
  const enemyRank = stage.enemyRank ?? 0;
  const b: Battle = {
    w, h, units: [], grid: new Array(w * h).fill(0), turn: 'P', ply: 0,
    maxPly: stage.maxTurns * 2, passes: 0, bossStage: !!stage.boss, enemyTurns: 0,
    telegraph: null, over: null, lastMove: null, enemyRank: enemyRank || undefined,
  };
  stage.layout.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') b.grid[y * w + x] = -1;
      else if (LETTERS[ch]) addUnit(b, { type: LETTERS[ch], side: 'E', x, y, size: 1, rank: enemyRank || undefined });
    });
  });
  if (stage.boss) {
    const def = BOSSES[stage.boss.kind];
    const hp = stage.boss.hp ?? def.hp;
    addUnit(b, { type: 'boss', boss: def.kind, side: 'E', x: stage.boss.x, y: stage.boss.y, size: 2, hp, maxHp: hp, cd: 0 });
  }
  for (const p of placements) {
    if (b.grid[p.y * w + p.x] !== 0) continue;
    addUnit(b, { type: p.type, side: 'P', x: p.x, y: p.y, size: 1, temp: p.temp || undefined, rank: playerRanks[p.type] || undefined });
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* Move generation                                                     */
/* ------------------------------------------------------------------ */

export function genMoves(b: Battle, side: Side): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < b.units.length; i++) {
    const u = b.units[i];
    if (u.alive && u.side === side) genUnitMoves(b, i, out);
  }
  return out;
}

export function genUnitMoves(b: Battle, i: number, out: Move[] = []): Move[] {
  const u = b.units[i];
  if ((u.frozen ?? 0) > 0) return out;
  if (u.type === 'boss') return genBossMoves(b, i, out);
  const { w, h, grid, units } = b;
  const prof = profile(u.type, u.rank ?? 0);
  const struck: number[] = [];
  const isPawn = u.type === 'pawn';
  const dir = u.side === 'P' ? -1 : 1;
  const lastRow = u.side === 'P' ? 0 : h - 1;
  const promoAt = (ty: number) => isPawn && (ty === lastRow || (prof.promoEarly && ty === lastRow - dir));
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;

  const enemyAt = (tx: number, ty: number) => {
    const c = grid[ty * w + tx];
    if (c <= 0) return;
    const t = units[c - 1];
    if (t.side === u.side) return;
    if (t.size > 1) {
      if (!struck.includes(c - 1)) {
        struck.push(c - 1);
        out.push({ u: i, kind: 'strike', x: tx, y: ty, target: c - 1 });
      }
    } else {
      out.push({ u: i, kind: 'capture', x: tx, y: ty, target: c - 1, promo: promoAt(ty) });
    }
  };
  const quiet = (tx: number, ty: number) => {
    if (inB(tx, ty) && grid[ty * w + tx] === 0) out.push({ u: i, kind: 'move', x: tx, y: ty, promo: promoAt(ty) });
  };

  for (const [dx, dy] of prof.quiet) quiet(u.x + dx, u.y + dy);

  if (isPawn) {
    const ny = u.y + dir;
    if (ny < 0 || ny >= h) return out;
    if (grid[ny * w + u.x] === 0) {
      quiet(u.x, ny);
      const ny2 = ny + dir;
      if ((prof.pawnDouble || (!u.moved && h >= 6)) && inB(u.x, ny2)) quiet(u.x, ny2);
    } else if (prof.pawnCapFwd) {
      enemyAt(u.x, ny);
    }
    for (const dx of [-1, 1]) if (inB(u.x + dx, ny)) enemyAt(u.x + dx, ny);
    return out;
  }

  for (const [dx, dy] of prof.leaps) {
    const tx = u.x + dx, ty = u.y + dy;
    if (!inB(tx, ty)) continue;
    if (grid[ty * w + tx] === 0) out.push({ u: i, kind: 'move', x: tx, y: ty });
    else enemyAt(tx, ty);
  }
  for (const [dx, dy] of prof.slides) {
    let tx = u.x + dx, ty = u.y + dy, hopped = false;
    while (inB(tx, ty)) {
      const c = grid[ty * w + tx];
      if (c === 0) {
        out.push({ u: i, kind: 'move', x: tx, y: ty });
      } else {
        enemyAt(tx, ty);
        if (!prof.hop || hopped) break;
        hopped = true;
      }
      tx += dx;
      ty += dy;
    }
  }
  return out;
}

function genBossMoves(b: Battle, i: number, out: Move[]): Move[] {
  const u = b.units[i];
  if ((u.cd ?? 0) > 0) return out;
  const def = BOSSES[u.boss!];
  for (const [dx, dy] of def.leaps) {
    const nx = u.x + dx, ny = u.y + dy;
    if (nx < 0 || ny < 0 || nx + u.size > b.w || ny + u.size > b.h) continue;
    let ok = true;
    const crush: number[] = [];
    for (let yy = ny; yy < ny + u.size && ok; yy++) {
      for (let xx = nx; xx < nx + u.size; xx++) {
        const c = b.grid[yy * b.w + xx];
        if (c === 0 || c === i + 1) continue;
        if (c < 0 || b.units[c - 1].side === u.side) { ok = false; break; }
        if (!crush.includes(c - 1)) crush.push(c - 1);
      }
    }
    if (ok) out.push({ u: i, kind: crush.length ? 'capture' : 'move', x: nx, y: ny, crush: crush.length ? crush : undefined });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Applying moves                                                      */
/* ------------------------------------------------------------------ */

export function kill(b: Battle, idx: number, fx?: FxEvent[]) {
  const t = b.units[idx];
  if (!t.alive) return;
  t.alive = false;
  setFootprint(b, t, 0);
  fx?.push({ kind: 'capture', x: t.x, y: t.y, side: t.side, unitType: t.type, boss: t.boss, size: t.size });
}

/** Deals boss damage; kills it at 0 HP. */
export function damage(b: Battle, idx: number, dmg: number, fx?: FxEvent[]) {
  const t = b.units[idx];
  t.hp = Math.max(0, (t.hp ?? 1) - dmg);
  fx?.push({ kind: 'hit', x: t.x, y: t.y, amount: dmg, side: t.side, boss: t.boss, size: t.size });
  if (t.hp <= 0) kill(b, idx, fx);
}

/** Returns a new battle with the move applied. Pass `fx` to collect visual events. */
export function applyMove(b: Battle, m: Move, fx?: FxEvent[]): Battle {
  const nb = cloneBattle(b);
  applyInPlace(nb, m, fx);
  return nb;
}

export function applyInPlace(b: Battle, m: Move, fx?: FxEvent[]) {
  const side = b.turn;
  if (m.kind === 'pass') {
    b.passes++;
  } else {
    b.passes = 0;
    const u = b.units[m.u];
    const fx0 = u.x, fy0 = u.y;
    const target = m.target !== undefined ? b.units[m.target] : null;
    if (m.kind === 'strike') {
      const dmg = bossDamage(u.type as PieceType) + profile(u.type as PieceType, u.rank ?? 0).bossDmg;
      u.xp = (u.xp ?? 0) + dmg * 2;
      damage(b, m.target!, dmg, fx);
    } else if (target?.shield && m.kind === 'capture' && !m.crush) {
      // Shield absorbs the capture: the attacker bounces back.
      target.shield = false;
      fx?.push({ kind: 'block', x: target.x, y: target.y, side: target.side, icon: '🛡️' });
    } else {
      if (target) {
        u.xp = (u.xp ?? 0) + unitValue(target);
        kill(b, m.target!, fx);
      }
      if (m.crush) for (const c of m.crush) kill(b, c, fx);
      setFootprint(b, u, 0);
      u.x = m.x;
      u.y = m.y;
      setFootprint(b, u, u.id + 1);
      if (m.promo && u.type === 'pawn') {
        u.promotedFrom = 'pawn';
        u.type = profile('pawn', u.rank ?? 0).promoAmazon ? 'amazon' : 'queen';
        fx?.push({ kind: 'promote', x: u.x, y: u.y, side: u.side });
      }
    }
    u.moved = true;
    b.lastMove = { fx: fx0, fy: fy0, tx: m.kind === 'move' || m.kind === 'capture' ? u.x : m.x, ty: m.kind === 'move' || m.kind === 'capture' ? u.y : m.y };
  }
  for (const bu of b.units) {
    if (!bu.alive || bu.side !== side) continue;
    // Frozen pieces thaw on their own side's turns.
    if ((bu.frozen ?? 0) > 0) bu.frozen = bu.frozen! - 1;
    // Boss movement cooldowns tick on their side's turns.
    if (bu.type !== 'boss') continue;
    if (bu.id === m.u && m.kind !== 'strike') bu.cd = BOSSES[bu.boss!].moveEvery - 1;
    else if ((bu.cd ?? 0) > 0) bu.cd = bu.cd! - 1;
  }
  b.ply++;
  b.turn = other(side);
  checkOver(b);
}

export function material(b: Battle, side: Side): number {
  let s = 0;
  for (const u of b.units) if (u.alive && u.side === side) s += unitValue(u);
  return s;
}

function byPoints(b: Battle, reason: Outcome['reason']): Outcome {
  const p = material(b, 'P'), e = material(b, 'E');
  return { winner: p > e ? 'P' : p < e ? 'E' : 'draw', reason };
}

export function checkOver(b: Battle) {
  if (b.over) return;
  let p = false, e = false, boss = false;
  for (const u of b.units) {
    if (!u.alive) continue;
    if (u.side === 'P') p = true;
    else { e = true; if (u.type === 'boss') boss = true; }
  }
  if (b.bossStage && !boss) b.over = { winner: 'P', reason: 'boss' };
  else if (!e) b.over = { winner: 'P', reason: 'annihilation' };
  else if (!p) b.over = { winner: 'E', reason: 'annihilation' };
  else if (b.passes >= 2) b.over = b.bossStage ? { winner: 'E', reason: 'deadlock' } : byPoints(b, 'deadlock');
  else if (b.ply >= b.maxPly) b.over = b.bossStage ? { winner: 'E', reason: 'time' } : byPoints(b, 'time');
}

/* ------------------------------------------------------------------ */
/* Boss abilities (real game only — the AI search ignores them)        */
/* ------------------------------------------------------------------ */

/** Start of the enemy turn: resolve pending telegraphed attacks, then summon. Mutates `b`. */
export function enemyPreTurn(b: Battle, fx: FxEvent[], rand = Math.random) {
  b.enemyTurns++;
  if (b.telegraph) {
    for (const sq of b.telegraph.squares) {
      const x = sq % b.w, y = Math.floor(sq / b.w);
      fx.push({ kind: b.telegraph.kind, x, y });
      const c = b.grid[sq];
      if (c > 0 && b.units[c - 1].side === 'P') kill(b, c - 1, fx);
    }
    b.telegraph = null;
  }
  for (const u of [...b.units]) {
    if (!u.alive || u.type !== 'boss' || u.side !== 'E') continue;
    const s = BOSSES[u.boss!].summon;
    if (!s || b.enemyTurns % s.every !== 0) continue;
    const free = ring(b, u).filter((sq) => b.grid[sq] === 0);
    if (!free.length) continue;
    // Prefer squares toward the player.
    free.sort((a, c) => Math.floor(c / b.w) - Math.floor(a / b.w) || rand() - 0.5);
    const sq = free[0];
    const nu = addUnit(b, { type: s.type, side: 'E', x: sq % b.w, y: Math.floor(sq / b.w), size: 1, rank: b.enemyRank });
    fx.push({ kind: 'summon', x: nu.x, y: nu.y, side: 'E', unitType: nu.type });
  }
  checkOver(b);
}

/** End of the enemy turn: bosses may announce a telegraphed attack. Mutates `b`. */
export function enemyPostTurn(b: Battle) {
  if (b.over) return;
  for (const u of b.units) {
    if (!u.alive || u.type !== 'boss') continue;
    const t = BOSSES[u.boss!].telegraph;
    if (!t || b.enemyTurns % t.every !== 0) continue;
    const squares = t.kind === 'quake' ? ring(b, u) : breath(b, u);
    b.telegraph = { kind: t.kind, squares };
  }
}

/** Squares adjacent to a unit's footprint. */
function ring(b: Battle, u: Unit): number[] {
  const out: number[] = [];
  for (let y = u.y - 1; y <= u.y + u.size; y++)
    for (let x = u.x - 1; x <= u.x + u.size; x++) {
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      if (x >= u.x && x < u.x + u.size && y >= u.y && y < u.y + u.size) continue;
      out.push(y * b.w + x);
    }
  return out;
}

/** Fire breath: the boss's columns, four rows toward the player. */
function breath(b: Battle, u: Unit): number[] {
  const out: number[] = [];
  for (let y = u.y + u.size; y < Math.min(b.h, u.y + u.size + 4); y++)
    for (let x = u.x; x < u.x + u.size; x++) if (b.grid[y * b.w + x] !== -1) out.push(y * b.w + x);
  return out;
}
