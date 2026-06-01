// Phase 8.7b Task: opp ターン自動進行ドライバ
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md (turn flow)
//
// 役割:
//   self.endTurn → store の turn.player が 'opp' に変わる → 本 hook が観測して
//   `policy.playTurn` を呼び、opp の 1 ターンを最後まで進める (engine.flow.endTurn が
//   turn.player を 'self' に戻す)。これにより試合が end-to-end で回る。
//
// 設計:
//   - `playTurn` は pure: `(state, policy, byPlayer) => { moves, finalState }` で
//     新しい state を返す (Immer 内部使用)。store.dispatch にそのまま流せる。
//   - `gameResult !== null` ならスキップ (試合終了後の暴走防止)
//   - module-level `isDriving` で二重呼出 / 再エントリを抑止 (React StrictMode の
//     double-invoke や useEffect 連鎖に対する保険)
//   - useEffect の deps は turn.player のみ。'opp' に変わった瞬間にマイクロタスクで起動
//     (同期 setState → re-render の中で dispatch しないよう保護)

import { produce } from 'immer';
import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { playTurn } from '@/ai/policy.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import * as flow from '@/engine/flow/index.js';
import { mutate as engineMutate } from '@/engine/mutate/index.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import { dispatchEngineAction, surfacePendingSideChannels } from './useEngineDispatch.js';

let isDriving = false;

/** Test 用: 二重呼出ガードをリセット。 */
export function _resetIsDriving(): void {
  isDriving = false;
}

/**
 * opp のターンを最後まで自動で進める。
 * - gameState===null / turn.player!=='opp' / gameResult set → no-op
 * - 既に駆動中なら no-op (再エントリ抑止)
 */
export function driveOppTurn(): void {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  if (current === null) return;
  if (current.turn.player !== 'opp') return;
  if (current.gameResult) return; // null or undefined はどちらも「未決着」扱い
  // Commit 2.5: action 進行中 (useContactFlowDriver が駆動) → 引き継ぎ。
  if (store.activeActionId) return;
  if (isDriving) return;
  isDriving = true;
  try {
    // Commit 2.5: pauseOnAction で action move を検出したら applyMove せず paused 返却。
    // UI 側で actionDeclareChar/Case を dispatch → useContactFlowDriver に委譲する。
    const result = playTurn(current, new HeuristicPolicy(), 'opp', { pauseOnAction: true });
    // 中間 state を store にコミット (action 直前の状態 / または通常 move 適用後の状態)
    store.setGameState(result.finalState);

    if (result.paused) {
      const m = result.paused.move;
      if (m.kind === 'actionAgainstChar') {
        dispatchEngineAction({ type: 'actionDeclareChar', byUid: m.byUid, targetUid: m.targetUid });
      } else if (m.kind === 'actionAgainstCase') {
        dispatchEngineAction({ type: 'actionDeclareCase', byUid: m.byUid, targetPlayer: m.targetPlayer });
      }
      // activeActionId が set される → useContactFlowDriver が駆動 → action-end で
      // activeActionId=null → useOppTurnDriver useEffect が再 fire → 続きの move へ。
      return;
    }

    // 通常終了: playTurn は endTurn move を選んでも flow.endTurn を呼ばない
    // (policy.ts コメント参照)。ここで明示的に呼んで turn.player を 'self' に戻し、
    // ターン終了 listener が積んだ pendingEffects も解消する。
    //
    // Round 2 修正: 旧実装は endTurn(opp) のみで止まり、self の startTurn を呼ばなかった。
    // 結果 self.turn 開始時に (a) auto-phase 未実行 (b) phase='end' のまま (c) ターン終了
    // button 永続 disabled という連鎖バグが発生。useEngineDispatch.endTurn と対称的に
    // resetTurnFlags + startTurn(self) を呼ぶ。
    store.dispatch((s) =>
      produce(s, (draft) => {
        if (draft.gameResult) return;
        if (draft.turn.player !== 'opp') return;
        flow.endTurn(draft, 'opp');
        runAllUntilEmpty(draft);
        if (draft.gameResult) return;
        engineMutate.flag.resetTurnFlags(draft, 'self');
        draft.turn.isFirstPlayerFirstTurn = false;
        flow.startTurn(draft, 'self');
        runAllUntilEmpty(draft);
      }),
    );
    // BUG-090: self の auto-phase (上の startTurn(self)+runAllUntilEmpty) で
    // 事件編→解決編 になり case card a1 (case:to-resolved → discard) が発火すると、
    // human の discard pick が side-channel queue に積まれる。dispatchEngineAction と
    // 同様に store へ転送しないと EffectPickerModal が出ず「何も起きない」ため、ここで surface する。
    surfacePendingSideChannels();
  } finally {
    isDriving = false;
  }
}

/**
 * React hook ラッパ。Playmat 等の root component で 1 度だけ呼ぶ。
 * turn.player が 'opp' に変わったら次マイクロタスクで `driveOppTurn` を実行。
 *
 * マイクロタスク遅延の理由:
 *   - 同期 setState → re-render → useEffect 発火 → 同期 dispatch だと
 *     React の batch 中に setState を呼ぶことになり警告対象
 *   - Promise.resolve().then() で次マイクロタスクに送ると安全
 */
/**
 * opp ターン処理開始までの遅延 (ms)。
 *
 * Phase 8.10a: OppTurnOverlay を視認できる時間を確保するため、playTurn の同期実行を
 * setTimeout で遅らせる。0 にすればテスト互換 + 即時処理。本番は ~400ms。
 *
 * Phase 12-A (user_request #12): module-level の固定値から store.aiSpeedMs 直読に
 * 変更。SpectatorHUD slider 経由でユーザーが任意の速度を選べる。
 * テスト互換のため `_setOppTurnDriverDelay` legacy 関数は残置 (store を更新)。
 */
export function _setOppTurnDriverDelay(ms: number): void {
  useGameStateStore.getState().setAiSpeedMs(ms);
}

// Phase 12-B: step button で消費済みの counter 値を tracker
// useRef だと StrictMode で 2 回 fire するので module-level に置く。
let _lastConsumedStep = 0;

export function useOppTurnDriver(): void {
  const turnPlayer = useGameStateStore((s) => s.gameState?.turn.player ?? null);
  // Commit 2.5: activeActionId 復帰 (action-end) で続きの move を再開するため
  // useEffect deps に追加。set 中は driveOppTurn 内で early return される。
  const activeActionId = useGameStateStore((s) => s.activeActionId);
  const aiSpeedMs = useGameStateStore((s) => s.aiSpeedMs);
  const isAiPaused = useGameStateStore((s) => s.isAiPaused);
  const aiStepCounter = useGameStateStore((s) => s.aiStepCounter);
  useEffect(() => {
    if (turnPlayer !== 'opp' || activeActionId !== null) return undefined;
    // Phase 12-B: paused なら step 要求があった時だけ進む
    if (isAiPaused) {
      if (aiStepCounter <= _lastConsumedStep) return undefined;
      _lastConsumedStep = aiStepCounter;
    }
    if (aiSpeedMs > 0) {
      const id = setTimeout(driveOppTurn, aiSpeedMs);
      return () => clearTimeout(id);
    }
    Promise.resolve().then(driveOppTurn);
    return undefined;
  }, [turnPlayer, activeActionId, aiSpeedMs, isAiPaused, aiStepCounter]);
}
