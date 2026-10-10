import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report } from './balance';

it('world 1', () => {
  writeFileSync(`${process.env.OUT ?? 'sim-results'}/world1.txt`, report(1, Number(process.env.GAMES ?? 4)));
}, 3_600_000);
