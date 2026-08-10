import type { GameState } from '@/engine/types';

const replayOwnedStates = new WeakSet<GameState>();

export function markReplayOwnedState(state: GameState): void {
  replayOwnedStates.add(state);
}

export function isReplayOwnedState(state: GameState | null): boolean {
  return state !== null && replayOwnedStates.has(state);
}
