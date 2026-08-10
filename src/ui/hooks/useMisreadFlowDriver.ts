// Phase 5 advance UI — Misread driver
//
// rules: 13-keywords.md §ミスリード
// spec: .claude/specs/phase-9-h-performance.md (Phase 9 ロードマップ A 内)
//
// 役割:
//   - useGameStateStore.pendingMisread を監視
//   - reasoningPlayer === 'opp' (AI 推理 / 人間 defender): モーダル待ち (no-op)
//   - reasoningPlayer === 'self' (人間 推理 / AI defender): HeuristicPolicy.chooseMisreadTriggers
//     で picks 自動判定 → dispatch misreadResolve
//
// useHiramekiFlowDriver と同型。AI 強度は HeuristicPolicy 既定 (greedy LP→0 戦術)。

import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from './useEngineDispatch.js';
import { bindPendingDecision } from './useEngineDispatch/types.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { getHumanDecisionSide } from '@/ui/services/humanDecisionOwner.js';

export function useMisreadFlowDriver(enabled = true): void {
  const pending = useGameStateStore((s) => s.pendingMisread);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);

  useEffect(() => {
    if (!enabled) return;
    if (!pending || !gameState) return;
    if (gameState.gameResult) {
      // 試合終了後は解決せずクリアのみ
      useGameStateStore.getState().setPendingMisread(null);
      return;
    }
    const humanPlayer = getHumanDecisionSide(spectatorMode);
    if (humanPlayer === pending.player) return;
    // 人間推理 / AI defender: HeuristicPolicy 自動判定
    const ai = new HeuristicPolicy();
    const picks = ai.chooseMisreadTriggers
      ? ai.chooseMisreadTriggers(gameState, pending.reasoningUid, pending.candidates)
      : []; // フォールバック: 全スキップ
    dispatchEngineAction(bindPendingDecision(pending, { type: 'misreadResolve', picks }));
  }, [enabled, pending, gameState, spectatorMode]);
}
