// Phase 7 Task 7.9: EvidenceArea selector hook

import { useGameStateStore } from '@/ui/state/store.js';

/**
 * gameState から証拠枚数と必要証拠数を返す。null 時は { count: 0, required: 7 }。
 */
export function useEvidence(side: 'self' | 'opp'): { count: number; required: number } {
  return useGameStateStore((s) => {
    const player = s.gameState?.players[side];
    return {
      count: player?.evidence.length ?? 0,
      required: player?.case.requiredEvidence ?? 7,
    };
  });
}
