// Phase 8 完全クローズ Commit 3a: Hirameki driver
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a Hirameki end-to-end
//
// 役割:
//   - useGameStateStore.pendingHirameki を監視
//   - owner === 'self': モーダル open は Playmat 側 host が担当 (ここでは no-op)
//   - owner === 'opp': HeuristicPolicy.chooseHiramekiTrigger 自動判定 → dispatch hiramekiResolve

import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from './useEngineDispatch.js';
import { bindPendingDecision } from './useEngineDispatch/types.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';

export function useHiramekiFlowDriver(): void {
  const pending = useGameStateStore((s) => s.pendingHirameki);
  const gameState = useGameStateStore((s) => s.gameState);

  useEffect(() => {
    if (!pending || !gameState) return;
    if (gameState.gameResult) {
      // 試合終了後は解決せずクリアのみ
      useGameStateStore.getState().setPendingHirameki(null);
      return;
    }
    if (pending.player === 'self') return; // モーダル待ち
    // opp owner: AI 自動判定
    const ai = new HeuristicPolicy();
    const fire = ai.chooseHiramekiTrigger
      ? ai.chooseHiramekiTrigger(gameState, { cardId: pending.cardId, abilityId: pending.abilityId })
      : true;
    dispatchEngineAction(bindPendingDecision(
      pending,
      { type: 'hiramekiResolve', choice: fire ? 'fire' : 'skip' },
    ));
  }, [pending, gameState]);
}
