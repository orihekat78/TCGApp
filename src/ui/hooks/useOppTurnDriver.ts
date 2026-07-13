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
import { stepTurn } from '@/ai/policy.js';
import type { Move } from '@/ai/move-enumerator.js';
import type { GameState } from '@/engine/types/game-state.js';
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
  // BUG-138 (X8): humanPick pause で surface した modal が未解決の間は再入しない
  // (surface 済 = engine queue からは drain 済のため hasPendingHumanPick では検知できない)。
  // ⚠ pendingDeckReveal は含めない — あれは数秒の演出 overlay で、CPU 自身の deck-reveal でも
  // set される (含めると演出中に driver が止まり、再 fire 経路が無く永久 stall — e2e 1試合通しで実証)。
  // 決定 modal は pick / choice / optional の 3 つ (awaitingPick hold 中は pendingEffectPick が同時に立つ)。
  // BUG-136: deckToBottomBound 順序選択 modal (【相手ターン中】deckToBottomBound が human 所有で発火しうる)。
  // mini-wave #5 review B2: pendingDeckPlace も gate (相手ターン中の human 変装 (rules/09 非ターン側可) で
  // B05047 a2 が発火し modal 待ちになる — 漏れると AI driver が await 中に deck を動かし振り分けが部分無効化)。
  if (store.pendingEffectPick || store.pendingEffectChoice || store.pendingEffectOptional || store.pendingEffectRepeatOptional || store.pendingDeckReorder || store.pendingDeckPlace) return;
  if (isDriving) return;
  isDriving = true;
  try {
    // Task4: 1 手だけ進める (stepTurn)。1 手ごとに setGameState + activeCard + oppMoveTick++ し、
    // useEffect が aiSpeedMs 待ち後に再 fire → 次の 1 手。これで CPU の各手が人間ライクに可視化され、
    // 速度スライダー / 一時停止 / 1 ステップ が全手に効く。pauseOnAction で action 手は従来どおり
    // contact FSM (useContactFlowDriver) へ委譲する。
    const step = stepTurn(current, new HeuristicPolicy(), 'opp', { pauseOnAction: true });
    // 中間 state を store にコミット (action 直前 / 通常 move 適用後 / pause 時は不変参照)
    store.setGameState(step.nextState);

    if (step.paused) {
      const m = step.paused.move;
      if (m?.kind === 'actionAgainstChar') {
        store.setActiveCard(m.byUid, 'アクション');
        dispatchEngineAction({ type: 'actionDeclareChar', byUid: m.byUid, targetUid: m.targetUid });
      } else if (m?.kind === 'actionAgainstCase') {
        store.setActiveCard(m.byUid, 'アクション');
        dispatchEngineAction({ type: 'actionDeclareCase', byUid: m.byUid, targetPlayer: m.targetPlayer });
      } else if (step.paused.humanPick) {
        // BUG-138 (X8): CPU ターン中に human 所有の triggered decision (pick / optional / choice)
        // が発火。drainAiEffectPicks は横取りせず温存しているので modal へ転送して停止する。
        // human が解決 → gameState/pending* 更新 → useEffect 再 fire → 続きの手から再開。
        surfacePendingSideChannels();
      }
      // action: activeActionId set → useContactFlowDriver 駆動 → action-end で null → 再 fire。
      return;
    }

    if (!step.done) {
      // 通常の 1 手適用 → アクティブカードを set + tick で次手へ (turn.player は 'opp' のまま)。
      const pa = primaryActiveCard(step.move, current, step.nextState);
      store.setActiveCard(pa.uid, pa.label);
      store.bumpOppMoveTick();
      return;
    }

    // step.done: endTurn / 候補なし / gameResult。アクティブカードをクリアしターン終了処理へ。
    store.setActiveCard(null, null);
    if (step.nextState.gameResult) return; // ゲーム終了確定なら turn 遷移不要

    // endTurn move は flow.endTurn を呼ばない (policy.ts コメント参照)。ここで明示的に呼んで
    // turn.player を 'self' に戻し、ターン終了 listener が積んだ pendingEffects も解消する。
    // useEngineDispatch.endTurn と対称的に resetTurnFlags + startTurn(self) を呼ぶ (Round 2)。
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
    // BUG-090: self auto-phase で 事件編→解決編 になり case a1 が human discard pick を積む場合、
    // dispatchEngineAction と同様に store へ転送しないと modal が出ないため surface する。
    surfacePendingSideChannels();
  } finally {
    isDriving = false;
  }
}

/**
 * Task4: 適用した move の「主役カード」uid + 行動ラベル (SceneArea ぴこんポップ用)。
 * 現場カードに紐づく手 (登場/推理/アクション/宣言) は uid を返し、パートナー系や非現場手は null
 * (盤面更新で結果は見える)。登場手は before/after の opp 現場差分で新規 uid を特定する。
 */
function primaryActiveCard(
  move: Move | null,
  before: GameState,
  after: GameState,
): { uid: string | null; label: string | null } {
  if (!move) return { uid: null, label: null };
  switch (move.kind) {
    case 'reasoning':
      return { uid: move.uid, label: '推理' };
    case 'declaredAbility':
      return { uid: move.uid, label: '宣言能力' };
    case 'handUseCard':
    case 'handUseCardSwitch': {
      const beforeUids = new Set(before.players.opp.scene.map((c) => c.uid));
      const entered = after.players.opp.scene.find((c) => !beforeUids.has(c.uid));
      return { uid: entered?.uid ?? null, label: '登場' };
    }
    case 'partnerAbility':
      return { uid: null, label: 'パートナー能力' };
    case 'startNextHint':
      return { uid: null, label: 'ネクストヒント' };
    case 'assist':
      return { uid: null, label: 'アシスト' };
    case 'solveCase':
      return { uid: null, label: '事件解決' };
    default:
      return { uid: null, label: null };
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
  // BUG-138 (X8): humanPick pause の再開トリガ。surface された決定 modal (pick/choice/optional) が
  // 解決されると dispatchEngineAction が store field を null に戻す → deps 変化で再 fire →
  // driveOppTurn が続きの move から再開する (modal open 中は driveOppTurn 冒頭 guard が return)。
  const pendingEffectPick = useGameStateStore((s) => s.pendingEffectPick);
  const pendingEffectChoice = useGameStateStore((s) => s.pendingEffectChoice);
  const pendingEffectOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const pendingEffectRepeatOptional = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  const pendingDeckReorder = useGameStateStore((s) => s.pendingDeckReorder);
  const pendingDeckPlace = useGameStateStore((s) => s.pendingDeckPlace); // mini-wave #5 review B2
  // Task4: 1手駆動の再 fire トリガ。driveOppTurn が 1 手適用するたび bump され、turn.player が
  // 'opp' のままでも useEffect が再 fire して次の手へ進む (これが無いと 1 手で stall)。
  const oppMoveTick = useGameStateStore((s) => s.oppMoveTick);
  useEffect(() => {
    if (turnPlayer !== 'opp' || activeActionId !== null) return undefined;
    if (pendingEffectPick || pendingEffectChoice || pendingEffectOptional || pendingEffectRepeatOptional || pendingDeckReorder || pendingDeckPlace) return undefined;
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
  }, [turnPlayer, activeActionId, aiSpeedMs, isAiPaused, aiStepCounter, pendingEffectPick, pendingEffectChoice, pendingEffectOptional, pendingEffectRepeatOptional, pendingDeckReorder, pendingDeckPlace, oppMoveTick]);
}
