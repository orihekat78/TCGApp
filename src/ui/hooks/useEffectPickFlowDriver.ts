// user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択 driver
//
// 役割:
//   - useGameStateStore.pendingEffectPick を監視
//   - pending.player === 'self' なら EffectPickerModal を開く
//   - ユーザー選択 → dispatch effectPickResolve(pickedUid)
//   - pending.player === 'opp' (AI side だが human-flag 効いた場合 fallback) は
//     先頭採用 (将来 AI policy 経由予定だが MVP では simplistic)

import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from './useEngineDispatch.js';
import { bindPendingDecision } from './useEngineDispatch/types.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import {
  effectivePendingPickRange,
  maximumFeasiblePendingPickSelection,
} from '@/engine/effect/pick-selection.js';

export function useEffectPickFlowDriver(enabled = true): void {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  const pendingChoice = useGameStateStore((s) => s.pendingEffectChoice);
  const pendingOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const pendingChooseIntercept = useGameStateStore((s) => s.pendingChooseIntercept);
  const pendingRepeatOptional = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  useEffect(() => {
    if (!enabled) return;
    if (!pending) return;
    if (!isHumanDecisionOwner(pending.player, spectatorMode)) {
      // AI side の fallback: 先頭候補を選ぶ (将来 chooseAtomTarget 経由予定)
      const feasible = maximumFeasiblePendingPickSelection(pending);
      const range = effectivePendingPickRange(pending);
      const forcedCount = new Set(
        (pending.forcedUids ?? []).filter(uid => pending.candidates.some(candidate => candidate.uid === uid)),
      ).size;
      const selected = feasible.slice(0, Math.max(range.min, forcedCount, feasible.length > 0 ? 1 : 0));
      dispatchEngineAction(bindPendingDecision(pending, {
        type: 'effectPickResolve',
        pickedUid: selected[0] ?? null,
        ...(selected.length > 0 ? { pickedUids: selected } : {}),
      }));
    }
    // self の場合は EffectPickerModal が render + 操作 → dispatch
  }, [enabled, pending, spectatorMode]);
  // BUG-121: human 複数 option choice の AI fallback。pending.player !== 'self' (CPU 所有 /
  // spectator) のとき option 0 を自動選択 (declared choice の AI 経路と同じく現状 default 0)。
  // self の場合は ChoiceResolveModalHost が render + 操作 → choiceResolve dispatch。
  useEffect(() => {
    if (!enabled) return;
    if (!pendingChoice) return;
    if (!isHumanDecisionOwner(pendingChoice.player, spectatorMode)) {
      dispatchEngineAction(bindPendingDecision(pendingChoice, { type: 'choiceResolve', choiceIndex: 0 }));
    }
  }, [enabled, pendingChoice, spectatorMode]);
  // 2026-06-06 タスクC: optional (「〜してもよい」) の AI/spectator fallback。
  // pending.player !== 'self' (CPU 所有 / spectator) のとき「しない」(run:false) を自動選択。
  // 通常 AI 経路は resolve-picks が surface しない (humanChooser=false で skip) ため本 path は防御的。
  // self の場合は EffectOptionalModalHost が render + 操作 → optionalResolve dispatch。
  useEffect(() => {
    if (!enabled) return;
    if (!pendingOptional) return;
    if (!isHumanDecisionOwner(pendingOptional.player, spectatorMode)) {
      dispatchEngineAction(bindPendingDecision(pendingOptional, { type: 'optionalResolve', run: false }));
    }
  }, [enabled, pendingOptional, spectatorMode]);
  useEffect(() => {
    if (!enabled) return;
    if (!pendingChooseIntercept || isHumanDecisionOwner(pendingChooseIntercept.player, spectatorMode)) return;
    const hand = useGameStateStore.getState().gameState?.players[pendingChooseIntercept.player].hand ?? [];
    dispatchEngineAction(bindPendingDecision(
      pendingChooseIntercept,
      { type: 'chooseInterceptResolve', discardIndex: hand.length > 0 ? 0 : null },
    ));
  }, [enabled, pendingChooseIntercept, spectatorMode]);
  useEffect(() => {
    if (!enabled) return;
    if (!pendingRepeatOptional) return;
    if (!isHumanDecisionOwner(pendingRepeatOptional.player, spectatorMode)) {
      dispatchEngineAction(bindPendingDecision(
        pendingRepeatOptional,
        { type: 'repeatOptionalResolve', run: false },
      ));
    }
  }, [enabled, pendingRepeatOptional, spectatorMode]);
}
