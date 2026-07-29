// Round 4l (B5 観戦モード): self ターンも AI が自動進行する driver
//
// 設計:
//   - spectatorMode === true && turnPlayer === 'self' のとき HeuristicPolicy で stepTurn を1手ずつ実行
//   - useOppTurnDriver と対称 (側だけ違う)
//   - module-level isDriving で二重呼出抑止
//   - activeActionId 中は委譲 (useContactFlowDriver が opp 経路と同じく処理)
//
// rules: 05-turn-phases.md (ターン進行は同じ、player 差のみ)

import { produce } from 'immer';
import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { stepTurn } from '@/ai/policy.js';
import type { Move } from '@/ai/move-enumerator.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import * as flow from '@/engine/flow/index.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import { dispatchEngineAction, surfacePendingSideChannels } from './useEngineDispatch.js';
import { movePresentationDelay } from './movePresentationDelay.js';
import { primaryActiveCard } from './useOppTurnDriver.js';

let isDriving = false;
let previousMoveKind: Move['kind'] | null = null;

export function _resetSpectatorDriving(): void {
  isDriving = false;
  previousMoveKind = null;
  _lastConsumedStep = 0;
}

function driveSelfTurn(): void {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  if (current === null) return;
  if (!store.spectatorMode) return;
  if (current.turn.player !== 'self') return;
  if (current.gameResult) return;
  if (store.activeActionId) return;
  if (store.pendingDeckReveal || store.pendingPublicHandReveal?.lifetime === 'effect') return;
  if (isDriving) return;
  isDriving = true;
  try {
    const result = stepTurn(current, new HeuristicPolicy(), 'self', { pauseOnAction: true });
    previousMoveKind = result.paused?.move?.kind ?? result.move?.kind ?? null;
    store.setGameState(result.nextState, { preserveRuntime: true });
    surfacePendingSideChannels();
    const surfaced = useGameStateStore.getState();
    if (surfaced.pendingDeckReveal || surfaced.pendingPublicHandReveal?.lifetime === 'effect') return;

    if (result.paused) {
      // BUG-138 (X8): 観戦モードは __humanPlayerSide=null のため humanPick pause は発生しない
      // (move 同梱 pause のみ)。optional chaining は paused 型拡張 (move?: Move) への追従。
      const m = result.paused.move;
      if (m?.kind === 'actionAgainstChar') {
        store.setActiveCard(m.byUid, 'アクション');
        dispatchEngineAction({ type: 'actionDeclareChar', byUid: m.byUid, targetUid: m.targetUid });
      } else if (m?.kind === 'actionAgainstCase') {
        store.setActiveCard(m.byUid, 'アクション');
        dispatchEngineAction({ type: 'actionDeclareCase', byUid: m.byUid, targetPlayer: m.targetPlayer });
      }
      return;
    }

    if (!result.done) {
      const active = primaryActiveCard(result.move, current, result.nextState, 'self');
      store.setActiveCard(active.uid, active.label);
      store.bumpOppMoveTick();
      return;
    }

    store.setActiveCard(null, null);
    previousMoveKind = 'endTurn';
    if (result.nextState.gameResult) return;

    store.dispatch((s) =>
      produce(s, (draft) => {
        if (draft.gameResult) return;
        if (draft.turn.player !== 'self') return;
        flow.endTurn(draft, 'self', { startNextTurn: true });
        runAllUntilEmpty(draft);
      }),
    );
    // BUG-090: useOppTurnDriver と対称。auto-phase 解決で side-channel queue に積まれた
    // pending (deckReveal 演出等) を store へ転送し取り残しを防ぐ。観戦モードは human pick が
    // 出ない (__humanPlayerSide=null) が、全ターンドライバで一貫して surface しておく。
    surfacePendingSideChannels();
  } finally {
    isDriving = false;
  }
}

// Phase 12-A (user_request #12): module-level の固定値から store.aiSpeedMs 直読に変更
export function _setSpectatorDriverDelay(ms: number): void {
  useGameStateStore.getState().setAiSpeedMs(ms);
}

// Phase 12-B: step button で消費済みの counter 値を tracker
let _lastConsumedStep = 0;

export function useSpectatorTurnDriver(): void {
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const turnPlayer = useGameStateStore((s) => s.gameState?.turn.player ?? null);
  const activeActionId = useGameStateStore((s) => s.activeActionId);
  const aiSpeedMs = useGameStateStore((s) => s.aiSpeedMs);
  const isAiPaused = useGameStateStore((s) => s.isAiPaused);
  const aiStepCounter = useGameStateStore((s) => s.aiStepCounter);
  const aiMoveTick = useGameStateStore((s) => s.oppMoveTick);
  const pendingDeckReveal = useGameStateStore((s) => s.pendingDeckReveal);
  const pendingPublicHandReveal = useGameStateStore((s) => s.pendingPublicHandReveal);
  useEffect(() => {
    if (!spectatorMode || turnPlayer !== 'self' || activeActionId !== null || pendingDeckReveal || pendingPublicHandReveal?.lifetime === 'effect') return undefined;
    // Phase 12-B: paused なら step 要求があった時だけ進む
    if (isAiPaused) {
      if (aiStepCounter <= _lastConsumedStep) return undefined;
      _lastConsumedStep = aiStepCounter;
    }
    const delay = isAiPaused ? 0 : movePresentationDelay(previousMoveKind, aiSpeedMs);
    const id = setTimeout(driveSelfTurn, delay);
    return () => clearTimeout(id);
  }, [spectatorMode, turnPlayer, activeActionId, aiSpeedMs, isAiPaused, aiStepCounter, aiMoveTick, pendingDeckReveal, pendingPublicHandReveal]);
}
