import { chooseMove } from './ai';
import type { AiParams, Battle, Move } from './types';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (m: Move) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; move: Move }>) => {
      pending.get(e.data.id)?.(e.data.move);
      pending.delete(e.data.id);
    };
    return worker;
  } catch {
    return null;
  }
}

/** Runs the AI off the main thread when possible, so animations stay smooth. */
export function requestAiMove(battle: Battle, params: AiParams): Promise<Move> {
  const w = getWorker();
  if (!w) return Promise.resolve(chooseMove(battle, params));
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ id, battle, params });
  });
}
