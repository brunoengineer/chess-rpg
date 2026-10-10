import { describe, expect, it } from 'vitest';
import { STAGE_BY_ID, hardStage } from '../game/campaign';
import { createBattle } from '../game/engine';
import { hashToView, initialView, resolveStage, viewToHash } from './route';
import { defaultSave, type SaveData } from './save';

const progress = (ids: string[]): SaveData => ({
  ...defaultSave(),
  stages: Object.fromEntries(ids.map((id) => [id, { stars: 2, clears: 1 }])),
});
const world1 = Array.from({ length: 10 }, (_, i) => `1-${i + 1}`);
const world2 = Array.from({ length: 10 }, (_, i) => `2-${i + 1}`);

describe('url <-> screen', () => {
  it('round-trips every tab and shop section', () => {
    const save = defaultSave();
    for (const hash of ['#/campaign', '#/arena', '#/barracks', '#/shop', '#/shop/cards', '#/shop/style']) {
      expect(viewToHash(hashToView(hash, save)!)).toBe(hash);
    }
    expect(viewToHash({ name: 'hub', tab: 'shop', section: 'army' })).toBe('#/shop');
  });

  it('restores a deploy screen only for stages you can play', () => {
    expect(hashToView('#/deploy/1-1', defaultSave())).toMatchObject({ name: 'deploy', stage: { id: '1-1' } });
    expect(hashToView('#/deploy/1-5', defaultSave())).toBeNull(); // locked
    expect(hashToView('#/deploy/1-5', progress(['1-1', '1-2', '1-3', '1-4']))).toMatchObject({ stage: { id: '1-5' } });
    expect(hashToView('#/deploy/9-9', defaultSave())).toBeNull();
  });

  it('hard and bonus stages are validated too', () => {
    expect(resolveStage('1-1H', defaultSave())).toBeNull(); // hard mode not open yet
    expect(resolveStage('1-1H', progress(world1))?.hard).toBe(true);
    expect(resolveStage('1-X1H', progress(world1))).toBeNull(); // bonus stages have no hard mode
    expect(resolveStage('1-1HH', progress(world1))).toBeNull();
    expect(resolveStage('1-X1', progress(world1))).toBeNull(); // 20 stars < 27
    expect(viewToHash({ name: 'deploy', stage: hardStage(STAGE_BY_ID['1-3']) })).toBe('#/deploy/1-3H');
  });

  it('arena deploy only for the current arena level', () => {
    const save = { ...progress([...world1, ...world2]), arena: { level: 4, best: 3 } };
    expect(resolveStage('arena-4', save)?.isArena).toBe(true);
    expect(resolveStage('arena-3', save)).toBeNull();
    expect(resolveStage('arena-4', { ...defaultSave(), arena: { level: 4, best: 3 } })).toBeNull(); // arena locked
  });

  it('a battle in progress always wins; #/battle without one goes home', () => {
    const save = defaultSave();
    expect(initialView('#/battle', save)).toEqual({ name: 'hub', tab: 'campaign' });
    const s1 = STAGE_BY_ID['1-1'];
    const inBattle = { ...save, active: { stage: s1, battle: createBattle(s1, []), loot: 0, captures: 0 } };
    expect(initialView('#/shop/cards', inBattle)).toEqual({ name: 'battle' });
    expect(initialView('#/battle', inBattle)).toEqual({ name: 'battle' });
  });

  it('junk never crashes', () => {
    const save = defaultSave();
    for (const hash of ['', '#', '#/', '#/nope', '#/deploy', '#/deploy/%E0%A4%A', '#/shop/nope', '#////']) {
      expect(() => initialView(hash, save)).not.toThrow();
    }
    expect(initialView('#/deploy/%E0%A4%A', save)).toEqual({ name: 'hub', tab: 'campaign' });
    expect(hashToView('#/shop/nope', save)).toEqual({ name: 'hub', tab: 'shop' });
  });
});
