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

export function useEffectPickFlowDriver(): void {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  const pendingChoice = useGameStateStore((s) => s.pendingEffectChoice);
  const pendingOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const pendingChooseIntercept = useGameStateStore((s) => s.pendingChooseIntercept);
  const pendingRepeatOptional = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  useEffect(() => {
    if (!pending) return;
    if (pending.player !== 'self') {
      // AI side の fallback: 先頭候補を選ぶ (将来 chooseAtomTarget 経由予定)
      const first = pending.candidates[0]?.uid ?? null;
      dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: first }));
    }
    // self の場合は EffectPickerModal が render + 操作 → dispatch
  }, [pending]);
  // BUG-121: human 複数 option choice の AI fallback。pending.player !== 'self' (CPU 所有 /
  // spectator) のとき option 0 を自動選択 (declared choice の AI 経路と同じく現状 default 0)。
  // self の場合は ChoiceResolveModalHost が render + 操作 → choiceResolve dispatch。
  useEffect(() => {
    if (!pendingChoice) return;
    if (pendingChoice.player !== 'self') {
      dispatchEngineAction(bindPendingDecision(pendingChoice, { type: 'choiceResolve', choiceIndex: 0 }));
    }
  }, [pendingChoice]);
  // 2026-06-06 タスクC: optional (「〜してもよい」) の AI/spectator fallback。
  // pending.player !== 'self' (CPU 所有 / spectator) のとき「しない」(run:false) を自動選択。
  // 通常 AI 経路は resolve-picks が surface しない (humanChooser=false で skip) ため本 path は防御的。
  // self の場合は EffectOptionalModalHost が render + 操作 → optionalResolve dispatch。
  useEffect(() => {
    if (!pendingOptional) return;
    if (pendingOptional.player !== 'self') {
      dispatchEngineAction(bindPendingDecision(pendingOptional, { type: 'optionalResolve', run: false }));
    }
  }, [pendingOptional]);
  useEffect(() => {
    if (!pendingChooseIntercept || pendingChooseIntercept.player === 'self') return;
    const hand = useGameStateStore.getState().gameState?.players[pendingChooseIntercept.player].hand ?? [];
    dispatchEngineAction(bindPendingDecision(
      pendingChooseIntercept,
      { type: 'chooseInterceptResolve', discardIndex: hand.length > 0 ? 0 : null },
    ));
  }, [pendingChooseIntercept]);
  useEffect(() => {
    if (!pendingRepeatOptional) return;
    if (pendingRepeatOptional.player !== 'self') {
      dispatchEngineAction(bindPendingDecision(
        pendingRepeatOptional,
        { type: 'repeatOptionalResolve', run: false },
      ));
    }
  }, [pendingRepeatOptional]);
}
