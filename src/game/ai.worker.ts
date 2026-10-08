import { chooseMove } from './ai';
import type { AiParams, Battle } from './types';

self.onmessage = (e: MessageEvent<{ id: number; battle: Battle; params: AiParams }>) => {
  const { id, battle, params } = e.data;
  self.postMessage({ id, move: chooseMove(battle, params) });
};
