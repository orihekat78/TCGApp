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

export function useEffectPickFlowDriver(): void {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  useEffect(() => {
    if (!pending) return;
    if (pending.player !== 'self') {
      // AI side の fallback: 先頭候補を選ぶ (将来 chooseAtomTarget 経由予定)
      const first = pending.candidates[0]?.uid ?? null;
      dispatchEngineAction({ type: 'effectPickResolve', pickedUid: first });
    }
    // self の場合は EffectPickerModal が render + 操作 → dispatch
  }, [pending]);
}
