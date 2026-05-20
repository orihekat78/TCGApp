// Round 4l (B5 観戦モード): self ターンも AI が自動進行する driver
//
// 設計:
//   - spectatorMode === true && turnPlayer === 'self' のとき HeuristicPolicy で playTurn 実行
//   - useOppTurnDriver と対称 (側だけ違う)
//   - module-level isDriving で二重呼出抑止
//   - activeActionId 中は委譲 (useContactFlowDriver が opp 経路と同じく処理)
//
// rules: 05-turn-phases.md (ターン進行は同じ、player 差のみ)

import { produce } from 'immer';
import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { playTurn } from '@/ai/policy.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import * as flow from '@/engine/flow/index.js';
import { mutate as engineMutate } from '@/engine/mutate/index.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import { dispatchEngineAction } from './useEngineDispatch.js';

let isDriving = false;

export function _resetSpectatorDriving(): void {
  isDriving = false;
}

function driveSelfTurn(): void {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  if (current === null) return;
  if (!store.spectatorMode) return;
  if (current.turn.player !== 'self') return;
  if (current.gameResult) return;
  if (store.activeActionId) return;
  if (isDriving) return;
  isDriving = true;
  try {
    const result = playTurn(current, new HeuristicPolicy(), 'self', { pauseOnAction: true });
    store.setGameState(result.finalState);

    if (result.paused) {
      const m = result.paused.move;
      if (m.kind === 'actionAgainstChar') {
        dispatchEngineAction({ type: 'actionDeclareChar', byUid: m.byUid, targetUid: m.targetUid });
      } else if (m.kind === 'actionAgainstCase') {
        dispatchEngineAction({ type: 'actionDeclareCase', byUid: m.byUid, targetPlayer: m.targetPlayer });
      }
      return;
    }

    store.dispatch((s) =>
      produce(s, (draft) => {
        if (draft.gameResult) return;
        if (draft.turn.player !== 'self') return;
        flow.endTurn(draft, 'self');
        runAllUntilEmpty(draft);
        if (draft.gameResult) return;
        engineMutate.flag.resetTurnFlags(draft, 'opp');
        draft.turn.isFirstPlayerFirstTurn = false;
        flow.startTurn(draft, 'opp');
        runAllUntilEmpty(draft);
      }),
    );
  } finally {
    isDriving = false;
  }
}

let spectatorDelayMs = 400;
export function _setSpectatorDriverDelay(ms: number): void {
  spectatorDelayMs = ms;
}

export function useSpectatorTurnDriver(): void {
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const turnPlayer = useGameStateStore((s) => s.gameState?.turn.player ?? null);
  const activeActionId = useGameStateStore((s) => s.activeActionId);
  useEffect(() => {
    if (spectatorMode && turnPlayer === 'self' && activeActionId === null) {
      if (spectatorDelayMs > 0) {
        const id = setTimeout(driveSelfTurn, spectatorDelayMs);
        return () => clearTimeout(id);
      }
      Promise.resolve().then(driveSelfTurn);
    }
    return undefined;
  }, [spectatorMode, turnPlayer, activeActionId]);
}
