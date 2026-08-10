import { useEffect, useRef } from 'react';

import { selectAutonomousDecisionBlocked } from '@/ui/state/autonomousDecisionGate.js';
import { useGameStateStore } from '@/ui/state/store.js';

/** Complete the demo only after its state-owned action and nested decisions finish. */
export function useHiramekiDemoDriver(): void {
  const mode = useGameStateStore((state) => state.hiramekiDemoMode);
  const pendingHirameki = useGameStateStore((state) => state.pendingHirameki);
  const activeActionId = useGameStateStore((state) => state.activeActionId);
  const gameState = useGameStateStore((state) => state.gameState);
  const decisionBlocked = useGameStateStore(selectAutonomousDecisionBlocked);
  const demoActionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'playing') {
      demoActionIdRef.current = null;
      return;
    }

    demoActionIdRef.current ??= pendingHirameki?.actionId ?? activeActionId;
    const demoActionId = demoActionIdRef.current;
    if (demoActionId === null || gameState === null || decisionBlocked) return;
    if (gameState.actionContexts?.[demoActionId] !== undefined) return;

    useGameStateStore.getState().setHiramekiDemoMode('completed');
  }, [activeActionId, decisionBlocked, gameState, mode, pendingHirameki]);
}
