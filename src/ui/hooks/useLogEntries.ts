// Phase 7 Task 7.13: LogPanel selector hook

import type { LogEntry } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';

const EMPTY: LogEntry[] = [];

/**
 * gameState.log を返す (append 順、古→新)。
 * null 時は EMPTY。
 */
export function useLogEntries(): LogEntry[] {
  return useGameStateStore((s) => s.gameState?.log ?? EMPTY);
}
