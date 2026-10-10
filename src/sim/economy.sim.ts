import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { economyReport, targetsReport } from './balance';

it('economy', () => {
  writeFileSync('sim-results/economy.txt', economyReport());
  writeFileSync('sim-results/targets.txt', targetsReport());
});
