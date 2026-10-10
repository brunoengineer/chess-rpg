import { defineConfig } from 'vitest/config';

// Balance simulations: slow, run on demand with `npm run balance`.
export default defineConfig({
  test: { include: ['src/sim/**/*.sim.ts'], testTimeout: 3_600_000 },
});
