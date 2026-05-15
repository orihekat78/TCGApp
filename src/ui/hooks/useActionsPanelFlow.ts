// Phase 8 Task 8.5: ActionsPanel 操作フローのオーケストレーション
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
//
// このファイルは Task 8.1 (useEngineDispatch) + Task 8.3 (useConfirmation) を
// 組み合わせて、ActionsPanel の各ボタンが実行すべき非同期フローを提供する。
//
// Phase 8.5 では endTurn のみ実装。reasoning / action / handUseCard / nextHint /
// partnerAbility / declaredAbility / assist / solveCase は target picker や
// source unit selection を要するため Task 8.6+ で順次実装する。

import { dispatchEngineAction, type DispatchResult } from './useEngineDispatch.js';
import { useConfirmation } from './useConfirmation.js';

type Player = 'self' | 'opp';

/** runEndTurnFlow / その他フローの返り値 */
export type FlowResult =
  | DispatchResult
  | { ok: false; reason: 'cancelled' };

/**
 * ターン終了フロー: 確認モーダル → accept で endTurn dispatch。
 *
 * - reject: { ok:false, reason:'cancelled' } (state 不変)
 * - accept: dispatchEngineAction の結果をそのまま返す
 */
export async function runEndTurnFlow(opts: { player: Player }): Promise<FlowResult> {
  const confirmation = useConfirmation();
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: 'ターン終了',
    body: 'メインフェイズを終了し、相手のターンに移行します。',
    okLabel: 'ターン終了',
    cancelLabel: '戻る',
  });
  if (!accepted) {
    return { ok: false, reason: 'cancelled' };
  }
  return dispatchEngineAction({ type: 'endTurn', player: opts.player });
}
