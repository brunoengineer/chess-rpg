import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report } from './balance';

it('world 5', () => {
  writeFileSync('sim-results/world5.txt', report(5, Number(process.env.GAMES ?? 4)));
}, 3_600_000);
