import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report } from './balance';

it('world 2', () => {
  writeFileSync('sim-results/world2.txt', report(2, Number(process.env.GAMES ?? 4)));
}, 3_600_000);
