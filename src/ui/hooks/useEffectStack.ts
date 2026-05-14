// Phase 7 Task 7.14: EffectStackPanel selector hook

import type { EffectStackEntry } from '@/engine/types/effect-stack.js';
import { useGameStateStore } from '@/ui/state/store.js';

const EMPTY: EffectStackEntry[] = [];

/**
 * gameState.pendingEffects を返す。null 時は EMPTY。
 */
export function useEffectStack(): EffectStackEntry[] {
  return useGameStateStore((s) => s.gameState?.pendingEffects ?? EMPTY);
}
