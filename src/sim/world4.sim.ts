import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report } from './balance';

it('world 4', () => {
  writeFileSync('sim-results/world4.txt', report(4, Number(process.env.GAMES ?? 4)));
}, 3_600_000);
