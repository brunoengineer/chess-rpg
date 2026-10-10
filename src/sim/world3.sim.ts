import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report } from './balance';

it('world 3', () => {
  writeFileSync(`${process.env.OUT ?? 'sim-results'}/world3.txt`, report(3, Number(process.env.GAMES ?? 4)));
}, 3_600_000);
