import { describe, expect, it } from 'vitest';
import { chooseAccountSave, defaultSave, type SaveData } from './save';

const save = (coins: number, updatedAt: number, battles = 1): SaveData => ({
  ...defaultSave(),
  coins,
  updatedAt,
  stats: { ...defaultSave().stats, battles },
});

describe('which save an account gets', () => {
  it('uses the newest of the local and cloud copies', () => {
    const local = save(100, 5), cloud = save(200, 9);
    expect(chooseAccountSave(local, cloud, true, null)).toEqual({ kind: 'use', save: cloud, fromGuest: false });
    expect(chooseAccountSave(save(300, 12), cloud, true, null)).toMatchObject({ save: { coins: 300 } });
  });

  it('an account with a cloud save never takes guest progress', () => {
    const guest = save(999, 50);
    expect(chooseAccountSave(null, save(10, 1), true, guest)).toMatchObject({ save: { coins: 10 }, fromGuest: false });
  });

  it('a brand-new account takes guest progress once; the next new account starts fresh', () => {
    const guest = save(500, 7);
    const first = chooseAccountSave(null, null, true, guest);
    expect(first).toEqual({ kind: 'use', save: guest, fromGuest: true });
    // The store then empties the guest slot, so a second new account sees no guest save:
    const second = chooseAccountSave(null, null, true, null);
    expect(second).toMatchObject({ kind: 'use', fromGuest: false, save: { coins: defaultSave().coins } });
  });

  it('ignores an untouched guest save', () => {
    const fresh = defaultSave();
    expect(chooseAccountSave(null, null, true, fresh)).toMatchObject({ fromGuest: false });
  });

  it('refuses to start when the cloud is unreachable and nothing is cached (would overwrite the cloud)', () => {
    expect(chooseAccountSave(null, null, false, save(5, 1))).toEqual({ kind: 'abort' });
  });

  it('works offline from the local copy when there is one', () => {
    const local = save(42, 3);
    expect(chooseAccountSave(local, null, false, null)).toEqual({ kind: 'use', save: local, fromGuest: false });
  });
});
