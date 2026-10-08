import { BOSSES } from './bosses';
import { LETTERS, PIECES, bossDamage } from './pieces';
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

function addUnit(b: Battle, u: Omit<Unit, 'id' | 'alive' | 'moved'>): Unit {
  const unit: Unit = { ...u, id: b.units.length, alive: true, moved: false };
  b.units.push(unit);
  setFootprint(b, unit, unit.id + 1);
  return unit;
}

export function createBattle(stage: StageDef, placements: Placement[]): Battle {
  const { w, h } = stage;
  const b: Battle = {
    w, h, units: [], grid: new Array(w * h).fill(0), turn: 'P', ply: 0,
    maxPly: stage.maxTurns * 2, passes: 0, bossStage: !!stage.boss, enemyTurns: 0,
    telegraph: null, over: null, lastMove: null,
  };
  stage.layout.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') b.grid[y * w + x] = -1;
      else if (LETTERS[ch]) addUnit(b, { type: LETTERS[ch], side: 'E', x, y, size: 1 });
    });
  });
  if (stage.boss) {
    const def = BOSSES[stage.boss.kind];
    const hp = stage.boss.hp ?? def.hp;
    addUnit(b, { type: 'boss', boss: def.kind, side: 'E', x: stage.boss.x, y: stage.boss.y, size: 2, hp, maxHp: hp, cd: 0 });
  }
  for (const p of placements) {
    if (b.grid[p.y * w + p.x] !== 0) continue;
    addUnit(b, { type: p.type, side: 'P', x: p.x, y: p.y, size: 1, temp: p.temp || undefined });
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
  if (u.type === 'boss') return genBossMoves(b, i, out);
  const { w, h, grid, units } = b;
  const struck: number[] = [];
  const lastRow = u.side === 'P' ? 0 : h - 1;
  const isPawn = u.type === 'pawn';

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
      out.push({ u: i, kind: 'capture', x: tx, y: ty, target: c - 1, promo: isPawn && ty === lastRow });
    }
  };
  /** Returns true when the square was empty (sliders may continue). */
  const visit = (tx: number, ty: number) => {
    if (grid[ty * w + tx] === 0) {
      out.push({ u: i, kind: 'move', x: tx, y: ty });
      return true;
    }
    enemyAt(tx, ty);
    return false;
  };

  if (isPawn) {
    const dir = u.side === 'P' ? -1 : 1;
    const ny = u.y + dir;
    if (ny < 0 || ny >= h) return out;
    if (grid[ny * w + u.x] === 0) {
      out.push({ u: i, kind: 'move', x: u.x, y: ny, promo: ny === lastRow });
      const ny2 = ny + dir;
      if (!u.moved && h >= 6 && ny2 >= 0 && ny2 < h && grid[ny2 * w + u.x] === 0)
        out.push({ u: i, kind: 'move', x: u.x, y: ny2, promo: ny2 === lastRow });
    }
    for (const dx of [-1, 1]) {
      const tx = u.x + dx;
      if (tx >= 0 && tx < w) enemyAt(tx, ny);
    }
    return out;
  }

  const def = PIECES[u.type];
  for (const [dx, dy] of def.leaps) {
    const tx = u.x + dx, ty = u.y + dy;
    if (tx >= 0 && ty >= 0 && tx < w && ty < h) visit(tx, ty);
  }
  for (const [dx, dy] of def.slides) {
    let tx = u.x + dx, ty = u.y + dy;
    while (tx >= 0 && ty >= 0 && tx < w && ty < h && visit(tx, ty)) {
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

function kill(b: Battle, idx: number, fx?: FxEvent[]) {
  const t = b.units[idx];
  if (!t.alive) return;
  t.alive = false;
  setFootprint(b, t, 0);
  fx?.push({ kind: 'capture', x: t.x, y: t.y, side: t.side, unitType: t.type, boss: t.boss, size: t.size });
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
    if (m.kind === 'strike') {
      const t = b.units[m.target!];
      const dmg = bossDamage(u.type as PieceType);
      t.hp = Math.max(0, (t.hp ?? 1) - dmg);
      fx?.push({ kind: 'hit', x: t.x, y: t.y, amount: dmg, side: t.side, boss: t.boss, size: t.size });
      if (t.hp <= 0) kill(b, m.target!, fx);
    } else {
      if (m.target !== undefined) kill(b, m.target, fx);
      if (m.crush) for (const c of m.crush) kill(b, c, fx);
      setFootprint(b, u, 0);
      u.x = m.x;
      u.y = m.y;
      setFootprint(b, u, u.id + 1);
      if (m.promo && u.type === 'pawn') {
        u.promotedFrom = 'pawn';
        u.type = 'queen';
        fx?.push({ kind: 'promote', x: u.x, y: u.y, side: u.side });
      }
    }
    u.moved = true;
    b.lastMove = { fx: fx0, fy: fy0, tx: m.kind === 'strike' ? m.x : u.x, ty: m.kind === 'strike' ? m.y : u.y };
  }
  // Boss movement cooldowns tick on their side's turns.
  for (const bu of b.units) {
    if (!bu.alive || bu.type !== 'boss' || bu.side !== side) continue;
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
    const nu = addUnit(b, { type: s.type, side: 'E', x: sq % b.w, y: Math.floor(sq / b.w), size: 1 });
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
