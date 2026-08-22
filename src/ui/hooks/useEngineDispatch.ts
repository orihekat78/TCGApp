// Phase 8 Task 8.1: UI → engine action ディスパッチ基盤
//
// rules: 05-turn-phases.md (メインフェイズ), 11-reasoning.md, 12-next-hint.md,
//        21-declared-ability-cost.md
//
// 設計:
//   - 骨格 (engine) は変更しない。本ファイルは UI 層の seam として
//     engine.flow.* (canX + 実行関数) を呼び分け、結果を Zustand store に反映する。
//   - engine actions は in-place mutator (void 戻り) のため、Immer の `produce` で
//     wrap して Zustand に新参照を渡す。これにより構造的共有 + change detection が両立。
//   - 各 action 種別ごとに canX 判定を hook 層でも前段ガードし、UI で
//     friendly な DispatchResult を返す (engine の throw は engine-error として包む)。

import { produce } from 'immer';
import * as flow from '@/engine/flow/index.js';
import { mutate } from '@/engine/mutate/index.js';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve/index.js';
import { applyChooseInterceptOrder, applyChooseInterceptResponse, applyDeckPlaceAndContinuation, applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation, applyChoiceAndContinuation, applyOptionalAndContinuation, applyRepeatOptionalAndContinuation, applyRpsAndContinuation, applySetCardChoiceAndContinuation, applySetCardReplacementDetailed } from '@/engine/effect/apply-pick.js';
import { useGameStateStore } from '@/ui/state/store.js';
import type { GameState } from '@/engine/types/game-state.js';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
// Round 4j-fix (BUG-034): `@/engine` 経由で取得し vite dev mode の module duplication 回避
import { _drainPendingHirameki, _drainPendingMisread, _peekPendingHirameki, _markPendingHiramekiGainDeferred } from '@/engine';
import { _drainPendingEffectPickSide, _drainPendingEffectChoiceSide, _drainPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { _drainPendingChooseInterceptSide, _drainPendingEffectRepeatOptionalSide, _drainPendingRpsSide, _drainPendingSetCardChoiceSide, _drainPendingSetCardReplacementSide } from '@/engine/effect/pending-state.js';
import { _drainPendingDeckRevealSide, _peekPendingDeckRevealSide, _drainPendingPublicHandRevealSide, _peekPendingPublicHandRevealSide, _drainPendingDeckReorderSide, _drainPendingDeckPlaceSide, _drainPendingContactStartAxId } from '@/engine/effect/atom-handlers';
import {
  cancelPendingEffectPickByPublicRevealToken,
  readPendingDeckPlaceAuthority,
  readPendingDeckReorderAuthority,
  readPendingEffectChoiceAuthority,
  readPendingEffectOptionalAuthority,
  readPendingEffectPickAuthority,
  readPendingMisreadAuthority,
  readPendingRpsAuthority,
  rebindPendingRuntimeStateOwner,
  restorePendingRuntimeState,
  snapshotPendingRuntimeState,
} from '@/engine/effect/runtime-state.js';
import type {
  PendingEffectChoiceSide,
  PendingEffectOptionalSide,
  PendingEffectPickSide,
  PendingRpsSide,
} from '@/engine/effect/pending-state.js';
import type {
  PendingDeckPlaceSide,
  PendingDeckReorderSide,
} from '@/engine/effect/atom-handlers/_shared.js';
import { effectivePendingPickRange } from '@/engine/effect/pick-selection.js';
import {
  hasLinkedPublicHandRevealDecision as hasLinkedPublicHandRevealDecisionFromStore,
  surfacePendingSideChannels as surfacePendingSideChannelsFromStore,
  surfacePublicHandReveal as surfacePublicHandRevealFromStore,
} from '@/ui/state/surface-pending.js';
import { isAllowed } from './useEngineDispatch/can-check.js';
import { _resolveDeferredMisread } from '@/engine/flow/main/reasoning.js';
import type { PendingMisreadAuthority } from '@/engine/types/misread.js';
import type { EngineAction, DispatchResult } from './useEngineDispatch/types.js';
import { isReplayOwnedState } from '@/ui/services/replayOwnership';
import {
  currentMatchSessionToken,
  isCurrentMatchSession,
  isMatchSessionActive,
} from '@/ui/services/matchSession';
import { getRegisteredHumanDecisionSide } from '@/ui/services/humanDecisionOwner';
import {
  areStoreRollbackParticipantsCurrent,
  checkpointStoreRollbackParticipants,
  rollbackStoreRollbackParticipants,
  runStoreRollbackPublication,
  StoreRollbackHandledError,
  storeRollbackCause,
} from '@/ui/services/storeTransaction';
import {
  toPendingSetCardChoiceSide,
  toPendingSetCardReplacementSide,
} from './useEngineDispatch/set-card-boundary.js';
// Phase 3d: public 型 (ContactChoice/EngineAction/DispatchResult) は types.ts を barrel 再 export し importer 不変。
export type { ContactChoice, EngineAction, DispatchResult } from './useEngineDispatch/types.js';
export { bindPendingDecision } from './useEngineDispatch/types.js';

class RejectedDecisionError extends Error {}

/**
 * Phase 8 完全クローズ Commit 2: actionDeclareChar/Case 直後に
 * `flow.action.declare()` が返した ActionContext.id を runEngineAction から
 * dispatchEngineAction へ伝える側チャネル (produce 境界を越えるため必要)。
 * 各 dispatch 開始時に null リセット → declare 時にセット → produce 完了後に
 * dispatchEngineAction が store.setActiveActionId へ転送して null に戻す。
 */
let _justDeclaredAxId: string | null = null;

function sameCardMultiset(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  for (const cardId of left) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  for (const cardId of right) {
    const count = counts.get(cardId) ?? 0;
    if (count === 0) return false;
    if (count === 1) counts.delete(cardId); else counts.set(cardId, count - 1);
  }
  return counts.size === 0;
}

function hasLinkedPublicHandRevealDecision(token: string): boolean {
  return hasLinkedPublicHandRevealDecisionFromStore(
    useGameStateStore.getState,
    token,
  );
}

function surfacePublicHandReveal(
  reveal: NonNullable<ReturnType<typeof _drainPendingPublicHandRevealSide>>,
): void {
  surfacePublicHandRevealFromStore(useGameStateStore.getState, reveal);
}

// BUG-109: resolveCardIdFromPickUid + pick build/continuation 実行は engine の
// apply-pick.ts (applyPickAndContinuation) へ移設し human/AI で共有 (重複排除)。


// ---- engine 呼出 (draft 上で in-place mutation) ----

function runEngineAction(
  draft: GameState,
  action: EngineAction,
  authorities: {
    effectPick: PendingEffectPickSide | null;
    effectChoice: PendingEffectChoiceSide | null;
    effectOptional: PendingEffectOptionalSide | null;
    rps: PendingRpsSide | null;
    deckReorder: PendingDeckReorderSide | null;
    deckPlace: PendingDeckPlaceSide | null;
    misread: PendingMisreadAuthority | null;
  },
): void {
  switch (action.type) {
    case 'reasoning':
      flow.doReasoning(draft, action.uid);
      return;
    case 'concede':
      flow.action.abortForTerminal(
        draft,
        action.player === 'self' ? 'opp' : 'self',
        'concede',
      );
      return;
    case 'handUseCard':
      flow.handUseCard(draft, action.player, action.cardId);
      return;
    case 'handUseCardSwitch':
      // rules/20 §スイッチ: engine.flow.handUseCard の 5 番目引数 switchRemoveUid を渡す
      flow.handUseCard(draft, action.player, action.cardId, undefined, action.removeUid);
      return;
    case 'nextHint':
      flow.runNextHint(draft, action.player, action.optionalCardId);
      return;
    case 'partnerAbility':
      // Phase 2c (BUG-116 構造解消): cost+ctx 構築 + pay は engine 側 helper に一元化
      // (旧: action.cost && action.ctx が両方渡されたときのみ pay → 渡し忘れで silent skip)。
      flow.activatePartnerAbility(draft, action.player, action.abilId, action.costParams);
      return;
    case 'declaredAbility':
      // BUG-085 の costPaid/dyn 伝播は activateDeclaredAbility 内で維持される。
      flow.activateDeclaredAbility(draft, action.uid, action.abilId, action.costParams, {
        setCardId: action.setCardId,
        setCardInstanceId: action.setCardInstanceId,
        abilityOrigin: action.abilityOrigin,
        abilityIndex: action.abilityIndex,
      });
      return;
    case 'assist':
      // flow.assist 未提供のため mutate を直叩き (src/ai/policy.ts:117 と同じ)
      mutate.partner.assist(draft, action.player);
      return;
    case 'solveCase':
      // flow.solveCase 未提供のため mutate を直叩き (src/ai/policy.ts:126 と同じ)
      mutate.partner.solveCase(draft, action.player);
      return;
    case 'actionAgainstChar': {
      // Phase 8.7c: ガード判定を HeuristicPolicy に委譲。共通ヘルパで policy.applyMove と
      // 同一シーケンスを共有 (将来カットイン/変装追加時もここを 1 箇所変更で OK)。
      resolveActionAgainstChar(draft, action.byUid, action.targetUid, new HeuristicPolicy());
      return;
    }
    case 'actionAgainstCase':
      // BUG-144 follow-up: この bundled 経路は **hirameki demo** (App.tsx: opp→self の case アクションで
      // evidence 除去→相手[=self]の【ヒラメキ】発火) と e2e 専用。ここで防御側を auto-guard すると evidence が
      // 除去されず demo / e2e が壊れる (8 hirameki spec 回帰) ため passGuard 固定のまま据え置く。
      // 実ゲームの防御ガード窓は別経路で対応済: ①人間/CPU の case アクションは per-step
      // (useActionsPanelFlow → actionDeclareCase) + useContactFlowDriver が guard-window を解決
      // (opp 防御側は HeuristicPolicy、self は GuardPickerModal)。②AI-vs-AI gameplay は policy.applyMove
      // (resolveActionAgainstCase に defenderPolicy を渡す) で解決 — BUG-144 本体はそちら。
      resolveActionAgainstCase(draft, action.byUid, action.targetPlayer);
      return;
    // Phase 8 完全クローズ Commit 2: per-step action dispatch
    case 'actionDeclareChar': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'char', uid: action.targetUid });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionDeclareCase': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'case', player: action.targetPlayer });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionGuard': {
      const ax = flow.action._getContext(draft, action.actionId);
      if (!ax) return;
      if (action.guarderUid === null) {
        flow.action.passGuard(draft, ax);
      } else {
        flow.action.tryGuard(draft, ax, action.guarderUid);
      }
      return;
    }
    case 'actionContact': {
      const ax = flow.action._getContext(draft, action.actionId);
      if (!ax) return;
      if (action.choice.kind === 'cutin') {
        flow.contact.cutIn(draft, ax, action.player, action.choice.cardId);
      } else if (action.choice.kind === 'disguise') {
        flow.contact.disguise(draft, ax, action.player, action.choice.cardId);
      } else {
        flow.contact.pass(draft, ax, action.player);
      }
      const acted = action.choice.kind !== 'pass';
      if (ax.phase === 'action-1') ax.firstActed = acted;
      else if (ax.phase === 'action-2') ax.secondActed = acted;
      else ax.firstRedoActed = acted;
      return;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(draft, action.actionId);
      if (!ax) return;
      flow.action.advance(draft, ax);
      return;
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(draft, action.actionId);
      if (!ax) return;
      // user_request 20260522_01 #8 fix: case target でも guard 成立した場合は
      // 証拠変動なし — contact AP 判定で攻撃キャラ or ガードキャラのリムーブ
      // のみ行う (rules/07 + rules/10: 証拠操作は「ガードされなかった場合」のみ)。
      if (ax.target.kind === 'case' && !ax.guardUid) {
        // rules/10: 相手証拠リムーブ + 自証拠獲得 (unguarded のみ)
        flow.actionCase.removeOpponentEvidenceTop(draft, ax);
        // mega-wave W6 step7 (2026-07-04, row70): 直前の emit でヒラメキが queue された場合のみ
        // gain を defer する (fire/skip 決定後に hiramekiResolve が実行)。「相手はこのアクションに
        // よって証拠を得られない」ヒラメキ (B02088/B03126) が fire された場合に、既に走った gain を
        // 巻き戻せないため — Q&A: fire なら依存 trigger (evidence:gain) ごと不発が要件。
        // ヒラメキ無しの fast path は従来通り即時 gain (挙動不変)。
        if (_peekPendingHirameki()) {
          _markPendingHiramekiGainDeferred();
          ax.deferredCaseEvidenceGain = true;
        } else {
          flow.actionCase.gainSelfEvidence(draft, ax);
        }
        ax.judgeResolved = true;
      } else {
        // char target OR case target + guard 成立 → contact AP 判定
        flow.action.snapshotAP(draft, ax);
        const result = flow.contact.judge(draft, ax);
        if (result.deferred && result.pendingLeaveIntercept) {
          ax.pendingLeaveIntercept = result.pendingLeaveIntercept;
        } else {
          ax.judgeResolved = true;
        }
      }
      return;
    }
    case 'leaveInterceptResolve': {
      const pending = useGameStateStore.getState().pendingLeaveIntercept;
      if (!pending) return;
      const ax = flow.action._getContext(draft, pending.actionId);
      const stateOwnedPending = ax?.pendingLeaveIntercept;
      if (!ax?.apSnapshot || !stateOwnedPending) return;
      if (!flow.contact.canResolveLeaveIntercept(draft, ax, action.accept)) {
        throw new RejectedDecisionError();
      }
      flow.contact.resolveLeaveIntercept(draft, ax, action.accept);
      return;
    }
    case 'hiramekiResolve': {
      const pending = useGameStateStore.getState().pendingHirameki;
      if (!pending) return;
      const actionContext = pending.actionId
        ? flow.action._getContext(draft, pending.actionId)
        : undefined;
      const aiPolicy = new HeuristicPolicy();
      const hiramekiHumanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      const isHumanHirameki = hiramekiHumanSide !== null && pending.player === hiramekiHumanSide;
      flow.actionCase.resolveHiramekiDecision(
        draft,
        actionContext,
        pending,
        action.choice,
        {
          chooseAtomTarget: isHumanHirameki ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
          runtimeAtomTargetPolicyKey: isHumanHirameki ? undefined : 'heuristic',
          humanChooser: isHumanHirameki,
          switchRemoveUid: 'switchRemoveUid' in action ? action.switchRemoveUid : undefined,
        },
      );
      // The ActionContext remains open while the queued Hirameki effect resolves.
      // Its contact-end transition performs any deferred case evidence gain, so a
      // suppression effect lands before the gain and the causal trace closes once.
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'misreadResolve': {
      const pending = authorities.misread;
      if (!pending) throw new RejectedDecisionError();
      _resolveDeferredMisread(draft, pending, action.picks);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'setEffectOrder': {
      // entry を直接 mutate (isAllowed で entry 存在 + owner 一致は確認済)
      const entry = draft.pendingEffects.find((e) => e.id === action.entryId);
      if (!entry) return;
      const entries = pendingOwnerOrderGroup(draft, action.player);
      const from = entries.findIndex((e) => e.id === entry.id);
      if (from < 0) return;
      const target = Math.max(0, Math.min(action.order, entries.length - 1));
      const [moved] = entries.splice(from, 1);
      if (!moved) return;
      entries.splice(target, 0, moved);
      entries.forEach((e, index) => { e.ownerChosenOrder = index; });
      return;
    }
    case 'resolveEffectOrder': {
      const group = pendingOwnerOrderGroup(draft, action.player);
      for (const [order, entry] of group.entries()) {
        entry.ownerChosenOrder = order;
        entry.ownerOrderConfirmed = true;
      }
      return;
    }
    case 'effectPickResolve': {
      // user_request 20260522_01 #2/#6 BUG-054 + BUG-065:
      // pendingEffectPick の atomArgs を pattern により置換して queue + run
      //   Pattern A (uid='$pick'): uid → picked、target → drop
      //   Pattern B (uid 不在):    target → [cardId of picked candidate]
      const pending = authorities.effectPick;
      if (!pending) return;
      if (action.pickedUid === null) {
        if (effectivePendingPickRange(pending).min > 0) {
          throw new Error(`${pending.atomVerb}: below-minimum selection`);
        }
        // BUG-132 GAP-1: skipResolvesAtom 付き pending (deckRevealUntil chooseMatch) の decline は
        // 「0枚選択」を atom 解決として実行し、remainder (デッキ下移動等の必須 step) を続行する
        // (rules/15 「〜まで」=0枚可)。破棄してしまうと全 reveal がデッキ上に残る。
        if (pending.skipResolvesAtom === true) {
          applyPickSkipAndContinuation(draft, pending);
          return;
        }
        // BUG-111 #2 (2026-06-16) / family (nest, 2026-06-22): continuation があれば head の kind で gate しつつ
        //   実行する (applyPickSkipAndContinuation 内で分岐)。
        //   - sequence-origin head: 末尾 step (mandatory) を実行 (rules/15 sequence の各 step は独立。
        //     「〜してもよい」は「〜する」を gate しない) + outer。
        //   - chain-origin head: head.remainder は「そうした場合」gate で drop (rules/25) するが、外側 (outer)
        //     sequence の remainder (例 B06033 sceneEnter) は実行する (nest)。outer 無しの standalone chain は no-op。
        //   declined head atom は再実行しない (runDeclinedAtom=false): declined 0-pick=何もしない、head bind は
        //   unbound で後続 conditional が not-matched で正しく skip。choice/optional の末尾は runEffect 経路では
        //   human surface しない既知 gap (B09056 DEFER 根拠)。
        if ((pending as { continuation?: unknown }).continuation) {
          applyPickSkipAndContinuation(draft, pending, false);
          return;
        }
        // continuation 無しの任意効果 → 純粋 skip。
        // BUG-111: continuation は pending 本体に同梱されるため pending 破棄で対の continuation も drop。
        // クリアは produce 後の post-dispatch drain で行う (return のみ)
        return;
      }
      // BUG-109: resolved atom の build (Pattern A/B) + continuation (BUG-107 の保存 ctx 共有) は
      // engine 共通 helper applyPickAndContinuation に集約 (AI drain drainAiEffectPicks と同実体)。
      // resolveCardIdFromPickUid の state は draft (produce 内最新) を渡す。
      applyPickAndContinuation(
        draft,
        pending,
        action.pickedUid,
        'pickedUids' in action ? action.pickedUids : undefined,
        'switchRemoveUid' in action ? action.switchRemoveUid : undefined,
        'switchRemoveUids' in action ? action.switchRemoveUids : undefined,
      );
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice を choiceIndex で解決。元 effect を readDef から復元し
      // choiceIndex 付きで再 walk → 選択 option 内の $pick (option2 sceneToHand 等) は
      // __pendingEffectPickQueue へ再 push され既存 effectPickResolve 経路で連鎖消化される。
      const pendingC = authorities.effectChoice;
      if (!pendingC) return;
      applyChoiceAndContinuation(draft, pendingC, action.choiceIndex, 'switchRemoveUid' in action ? action.switchRemoveUid : undefined);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional を run(boolean) で解決。run=true なら内部 effect を
      // 再 walk して実行 (内部 $pick は __pendingEffectPickQueue へ再 push)、run=false なら skip。
      const pendingO = authorities.effectOptional;
      if (!pendingO) return;
      applyOptionalAndContinuation(draft, pendingO, action.run);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'rpsResolve': {
      const pending = authorities.rps;
      if (!pending) return;
      applyRpsAndContinuation(draft, pending, action.hand);
      return;
    }
    case 'setCardChoiceResolve': {
      const pending = useGameStateStore.getState().pendingSetCardChoice;
      if (!pending) return;
      if (!applySetCardChoiceAndContinuation(draft, toPendingSetCardChoiceSide(pending), action.instanceId)) {
        throw new RejectedDecisionError();
      }
      return;
    }
    case 'setCardReplacementResolve': {
      const pending = useGameStateStore.getState().pendingSetCardReplacement;
      if (!pending) return;
      if (!applySetCardReplacementDetailed(draft, toPendingSetCardReplacementSide(pending), action.targetUid).applied) {
        throw new RejectedDecisionError();
      }
      return;
    }
    case 'chooseInterceptResolve': {
      const pending = useGameStateStore.getState().pendingChooseIntercept;
      if (!pending) return;
      applyChooseInterceptResponse(draft, pending, action.discardIndex);
      return;
    }
    case 'chooseInterceptOrderResolve': {
      const pending = useGameStateStore.getState().pendingChooseIntercept;
      if (!pending) return;
      applyChooseInterceptOrder(
        draft,
        pending,
        action.protectorUid,
        action.targetUid,
        action.setCardInstanceId,
        action.abilityOrigin,
        action.abilityIndex,
      );
      return;
    }
    case 'repeatOptionalResolve': {
      const pending = useGameStateStore.getState().pendingEffectRepeatOptional;
      if (!pending) return;
      applyRepeatOptionalAndContinuation(draft, pending, action.run);
      return;
    }
    case 'deckReorderResolve': {
      const pendingR = authorities.deckReorder;
      if (!pendingR) return;
      applyDeckReorderAndContinuation(draft, pendingR, action.order);
      return;
    }
    case 'deckPlaceResolve': {
      // The engine-owned helper validates the decision and exact occurrences
      // before mutation, then resumes the saved effect authority.
      const pendingP = authorities.deckPlace;
      if (!pendingP) return;
      if (!applyDeckPlaceAndContinuation(draft, pendingP, action.top, action.bottom)) {
        throw new RejectedDecisionError();
      }
      return;
    }
    case 'endTurn': {
      // The serialized turn continuation owns cleanup, transfer, and next-turn
      // startup. If a human decision pauses an end trigger, a later resolution
      // dispatch resumes the same boundary without starting the next turn early.
      flow.endTurn(draft, action.player, { startNextTurn: true });
      runAllUntilEmpty(draft);
      return;
    }
    // refactor 3e: EngineAction の case 追加漏れを compile-time 検出 (noImplicitReturns 不在ゆえ
    // member 脱落が silent fall-through する)。24 個の discriminant tag を全網羅で現状到達不能。
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return;
    }
  }
}

// ---- public API ----

/**
 * BUG-090: dispatchEngineAction 以外で human(self) の effect を runAllUntilEmpty で
 * 解決する経路 (ターンドライバ等) 向けに、engine 側 globalThis 側チャネルへ積まれた
 * pending pick / hirameki / misread / deckReveal を Zustand store に転送する。
 *
 * 背景: human の auto-phase (driveOppTurn の flow.startTurn(self)+runAllUntilEmpty) で
 *   事件編→解決編 になり case card a1 (case:to-resolved → discard) が発火すると、
 *   discard pick が __pendingEffectPickQueue に積まれる。dispatchEngineAction は produce 後に
 *   各 side-channel を drain → store.set しているが、ターンドライバ側ではこの転送が無く
 *   pick が取り残されて EffectPickerModal が出ない (= 「何も起きない」) バグだった。
 *
 * dispatchEngineAction の post-produce 同期と異なり action 種別が無いため、
 * 「新規 pending があれば先頭を set」(非 null のみ) の共通動作のみ行う。
 * effectPickResolve 等の「queue 空なら null クリア」特殊処理は dispatchEngineAction 専用。
 */
export function surfacePendingSideChannels(): void {
  const store = useGameStateStore.getState();
  if (store.gameState?.gameResult !== undefined) {
    // Terminal UI cannot revive decisions. A completed reveal is presentation,
    // though, and remains FIFO-visible even when the last engine transition won.
    if (store.pendingDeckReveal === null && _peekPendingDeckRevealSide()?.awaitingPick !== true) {
      const reveal = _drainPendingDeckRevealSide();
      if (reveal) store.setPendingDeckReveal(reveal);
    }
    if (store.pendingPublicHandReveal === null
      && _peekPendingPublicHandRevealSide()?.lifetime === 'presentation') {
      const reveal = _drainPendingPublicHandRevealSide();
      if (reveal) store.setPendingPublicHandReveal(reveal);
    }
    return;
  }
  surfacePendingSideChannelsFromStore(useGameStateStore.getState);
}

/**
 * Pure dispatcher. React の外からも (テスト等) 呼べる。
 *
 *   const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
 *   if (!result.ok) showError(result.reason);
 *
 * - gameState === null  → { ok:false, reason:'no-state' }
 * - canX === false       → { ok:false, reason:'not-allowed' }
 * - engine が throw      → { ok:false, reason:'engine-error', detail }
 * - 成功時                → store の gameState を Immer 経由で新参照に更新し { ok:true }
 */
export function dispatchEngineAction(action: EngineAction): DispatchResult {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  const publicHandRevealBefore = store.pendingPublicHandReveal;
  const pendingPickBefore = store.pendingEffectPick;
  const actionPublicHandRevealTokenBefore =
    action.type === 'effectPickResolve' ? pendingPickBefore?.publicHandRevealToken
    : action.type === 'choiceResolve' ? store.pendingEffectChoice?.publicHandRevealToken
    : action.type === 'optionalResolve' ? store.pendingEffectOptional?.publicHandRevealToken
    : action.type === 'chooseInterceptResolve' && store.pendingChooseIntercept?.kind !== 'order'
      ? store.pendingChooseIntercept?.publicHandRevealToken
    : undefined;
  if (current === null) return { ok: false, reason: 'no-state' };
  if (isReplayOwnedState(current)) return { ok: false, reason: 'not-allowed' };
  const concedeAuthority = action.type === 'concede'
    ? {
        allowed: current.gameResult === undefined
          && isMatchSessionActive()
          && currentMatchSessionToken() === action.sessionToken
          && isCurrentMatchSession(action.sessionToken)
          && !store.spectatorMode
          && getRegisteredHumanDecisionSide(store.spectatorMode) === action.player,
      }
    : undefined;
  const authorities = {
    effectPick: action.type === 'effectPickResolve'
      ? readPendingEffectPickAuthority(current)
      : null,
    effectChoice: action.type === 'choiceResolve'
      ? readPendingEffectChoiceAuthority(current)
      : null,
    effectOptional: action.type === 'optionalResolve'
      ? readPendingEffectOptionalAuthority(current)
      : null,
    rps: action.type === 'rpsResolve'
      ? readPendingRpsAuthority(current)
      : null,
    deckReorder: action.type === 'deckReorderResolve'
      ? readPendingDeckReorderAuthority(current)
      : null,
    deckPlace: action.type === 'deckPlaceResolve'
      ? readPendingDeckPlaceAuthority(current)
      : null,
    misread: action.type === 'misreadResolve'
      ? readPendingMisreadAuthority(current)
      : null,
  };
  if (action.type === 'effectPickResolve'
    && publicHandRevealBefore?.lifetime === 'effect'
    && pendingPickBefore?.publicHandRevealToken === publicHandRevealBefore.resolutionToken
    && publicHandRevealBefore.handSnapshot !== undefined
    && !sameCardMultiset(current.players[publicHandRevealBefore.owner].hand, publicHandRevealBefore.handSnapshot)) {
    // Serialized/stale UI may not apply a selection against a different hand.
    // Drop the exact resolver-owned decision by its stable token, then commit
    // that cancellation before clearing the public projections.
    let cancelled = false;
    const committed = store.dispatch((state) => produce(state, (draft) => {
      cancelled = cancelPendingEffectPickByPublicRevealToken(
        draft,
        publicHandRevealBefore.resolutionToken,
      );
    }));
    if (!committed || !cancelled) return { ok: false, reason: 'not-allowed' };
    const committedState = useGameStateStore.getState().gameState;
    if (committedState) rebindPendingRuntimeStateOwner(committedState);
    store.setPendingPublicHandReveal(null);
    store.setPendingEffectPick(null);
    surfacePendingSideChannels();
    return { ok: false, reason: 'not-allowed' };
  }
  if (action.type === 'effectPickResolve' && authorities.effectPick === null) {
    return { ok: false, reason: 'not-allowed' };
  }
  if (!isAllowed(current, action, {
    concede: concedeAuthority,
    misread: authorities.misread,
  })) return { ok: false, reason: 'not-allowed' };

  if (action.type === 'concede') {
    const pendingRuntimeBefore = snapshotPendingRuntimeState();
    const participantCheckpoints = checkpointStoreRollbackParticipants();
    try {
      const terminal = produce(current, (draft) => {
        runEngineAction(draft, action, authorities);
        runAllUntilEmpty(draft, {
          preserveCompletedPresentationsOnTerminalEntry: true,
        });
      });
      const latestStore = useGameStateStore.getState();
      const authorityStillCurrent = latestStore.gameState === current
        && latestStore.spectatorMode === store.spectatorMode
        && current.gameResult === undefined
        && isMatchSessionActive()
        && currentMatchSessionToken() === action.sessionToken
        && isCurrentMatchSession(action.sessionToken)
        && getRegisteredHumanDecisionSide(latestStore.spectatorMode) === action.player
        && !isReplayOwnedState(current);
      if (!authorityStillCurrent) {
        if (areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(pendingRuntimeBefore);
        }
        return { ok: false, reason: 'not-allowed' };
      }
      if (!latestStore.commitTerminalState(terminal)) {
        if (areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(pendingRuntimeBefore);
        }
        return { ok: false, reason: 'not-allowed' };
      }
      return { ok: true };
    } catch (error) {
      if (error instanceof StoreRollbackHandledError) {
        if (useGameStateStore.getState() === store
          && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(pendingRuntimeBefore);
        }
      } else {
        const authorityCurrent = rollbackStoreRollbackParticipants(participantCheckpoints);
        if (authorityCurrent && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(pendingRuntimeBefore);
        }
      }
      const cause = storeRollbackCause(error);
      return {
        ok: false,
        reason: 'engine-error',
        detail: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }

  _justDeclaredAxId = null;
  const pendingRuntimeBefore = snapshotPendingRuntimeState();
  const participantCheckpoints = checkpointStoreRollbackParticipants();
  try {
    const committed = store.dispatch((state) =>
      produce(state, (draft) => {
        runEngineAction(draft, action, authorities);
        // Phase 5 listener が pendingEffects に積んだ effect を解決する。
        // AI orchestrator (src/ai/policy.ts) と同じ運用パターン。
        runAllUntilEmpty(draft);
      }),
    );
    if (!committed) {
      throw new Error('presentation commit rejected');
    }
    if (useGameStateStore.getState().gameState?.gameResult !== undefined) {
      _justDeclaredAxId = null;
      return { ok: true };
    }
    // Commit 2: declareChar/Case 直後は ActionContext.id を store.activeActionId にセット
    // BUG-249: owner ordering is stored inside GameState, but the opponent-turn
    // driver subscribes to its explicit wake-up tick and side channels. Wake it
    // after the human confirms while the CPU still owns the turn.
    if (action.type === 'resolveEffectOrder'
      && useGameStateStore.getState().gameState?.turn.player === 'opp') {
      store.bumpOppMoveTick();
    }
    if (_justDeclaredAxId) {
      store.setActiveActionId(_justDeclaredAxId);
      _justDeclaredAxId = null;
    }
    if (action.type === 'actionJudge') {
      const committed = useGameStateStore.getState().gameState;
      const ax = committed ? flow.action._getContext(committed, action.actionId) : undefined;
      if (ax?.pendingLeaveIntercept) {
        store.setPendingLeaveIntercept({ ...ax.pendingLeaveIntercept, actionId: ax.id });
      }
    }
    // mega-wave W6 step9 (row65): 効果内 startContact が生成した ax を driver に渡す。
    // _justDeclaredAxId と違い「どの EngineAction type から呼ばれたか」を問わない汎用 drain
    // (宣言能力起動・カットイン解決・chain 内 startContact も同じ穴を通る) — effect 内から
    // 新規 ActionContext が生まれる唯一の合流点。useContactFlowDriver は activeActionId →
    // _getContext → phase 汎用処理なので無改造で 'action-1' 以降を駆動できる。
    const contactStartAxId = _drainPendingContactStartAxId();
    if (contactStartAxId) {
      store.setActiveActionId(contactStartAxId);
    }
    const committedAfterAction = useGameStateStore.getState().gameState;
    const activeActionId = useGameStateStore.getState().activeActionId;
    if (activeActionId
      && committedAfterAction
      && !flow.action._getContext(committedAfterAction, activeActionId)) {
      store.setActiveActionId(null);
    }
    // Commit 3a: evidence:remove-by-action listener が側チャネルにセットしていれば
    // Zustand pendingHirameki に転送。
    const hiramekiSide = _drainPendingHirameki();
    if (hiramekiSide) {
      store.setPendingHirameki(hiramekiSide);
    }
    // hiramekiResolve dispatch 後は pendingHirameki をクリア
    if (action.type === 'hiramekiResolve') {
      store.setPendingHirameki(null);
    }
    // Commit 3b: reasoning:before-add listener が human defender ケースで側チャネル set した分
    const misreadSide = _drainPendingMisread();
    if (misreadSide) {
      store.setPendingMisread(misreadSide);
    }
    if (action.type === 'misreadResolve') {
      store.setPendingMisread(null);
    }
    // user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択
    // BUG-078 fix: queue 化対応。effectPickResolve 時は「次の pending を drain して set」
    // (queue が空なら null)。他 action では「新規 pending があれば先頭を set」。
    const effectPickSide = _drainPendingEffectPickSide();
    if (action.type === 'effectPickResolve') {
      // resolve で current pending を消化したので次の queue 先頭を反映 (or 空なら null)
      store.setPendingEffectPick(effectPickSide);
    } else if (effectPickSide) {
      store.setPendingEffectPick(effectPickSide);
    }
    // BUG-121: human 複数 option choice の side-channel drain (effectPickSide と同 clear セマンティクス)
    const effectChoiceSide = _drainPendingEffectChoiceSide();
    if (action.type === 'choiceResolve') {
      // resolve で current pending choice を消化 → 次の choice (通常 null) を反映
      store.setPendingEffectChoice(effectChoiceSide);
    } else if (effectChoiceSide) {
      store.setPendingEffectChoice(effectChoiceSide);
    }
    // 2026-06-06 タスクC: optional 決定の side-channel drain (choice と同 clear セマンティクス)
    const effectOptionalSide = _drainPendingEffectOptionalSide();
    if (action.type === 'optionalResolve') {
      // resolve で current pending optional を消化 → 次 (通常 null) を反映
      store.setPendingEffectOptional(effectOptionalSide);
    } else if (effectOptionalSide) {
      store.setPendingEffectOptional(effectOptionalSide);
    }
    const rpsSide = _drainPendingRpsSide();
    if (action.type === 'rpsResolve') {
      store.setPendingRps(rpsSide);
    } else if (rpsSide) {
      store.setPendingRps(rpsSide);
    }
    const setCardChoiceSide = _drainPendingSetCardChoiceSide();
    if (action.type === 'setCardChoiceResolve') {
      store.setPendingSetCardChoice(setCardChoiceSide);
    } else if (setCardChoiceSide) {
      store.setPendingSetCardChoice(setCardChoiceSide);
    }
    const setCardReplacementSide = _drainPendingSetCardReplacementSide();
    if (action.type === 'setCardReplacementResolve') {
      store.setPendingSetCardReplacement(setCardReplacementSide);
    } else if (setCardReplacementSide) {
      store.setPendingSetCardReplacement(setCardReplacementSide);
    }
    const chooseInterceptSide = _drainPendingChooseInterceptSide();
    if (action.type === 'chooseInterceptResolve' || action.type === 'chooseInterceptOrderResolve') {
      store.setPendingChooseIntercept(chooseInterceptSide);
    } else if (chooseInterceptSide) {
      store.setPendingChooseIntercept(chooseInterceptSide);
    }
    if (action.type === 'leaveInterceptResolve') {
      store.setPendingLeaveIntercept(null);
    }
    const repeatOptionalSide = _drainPendingEffectRepeatOptionalSide();
    if (action.type === 'repeatOptionalResolve') {
      store.setPendingEffectRepeatOptional(repeatOptionalSide);
    } else if (repeatOptionalSide) {
      store.setPendingEffectRepeatOptional(repeatOptionalSide);
    }
    // user_request 20260522_01 #12 BUG-061: deckRevealUntil 演出側チャネル drain
    const visibleReveal = useGameStateStore.getState().pendingDeckReveal;
    if (action.type === 'effectPickResolve' && visibleReveal?.awaitingPick === true) {
      store.setPendingDeckReveal(null);
    }
    if (useGameStateStore.getState().pendingDeckReveal === null) {
      const deckRevealSide = _drainPendingDeckRevealSide();
      if (deckRevealSide) store.setPendingDeckReveal(deckRevealSide);
    }
    if (publicHandRevealBefore?.lifetime === 'effect'
      && actionPublicHandRevealTokenBefore === publicHandRevealBefore.resolutionToken
      && !hasLinkedPublicHandRevealDecision(publicHandRevealBefore.resolutionToken)) {
      store.setPendingPublicHandReveal(null);
    }
    if (useGameStateStore.getState().pendingPublicHandReveal === null) {
      const publicHandRevealSide = _drainPendingPublicHandRevealSide();
      if (publicHandRevealSide) surfacePublicHandReveal(publicHandRevealSide);
    }
    // BUG-136: deckToBottomBound 順序選択チャネル drain。deckReorderResolve は解決で消化 → 次 (通常 null)。
    const deckReorderSide = _drainPendingDeckReorderSide();
    if (action.type === 'deckReorderResolve') {
      store.setPendingDeckReorder(deckReorderSide);
    } else if (deckReorderSide) {
      store.setPendingDeckReorder(deckReorderSide);
    }
    // mini-wave #5 P2: deckPlaceSplitBound 振り分けチャネル drain (deckReorder と同 clear セマンティクス)。
    const deckPlaceSide = _drainPendingDeckPlaceSide();
    if (action.type === 'deckPlaceResolve') {
      store.setPendingDeckPlace(deckPlaceSide);
    } else if (deckPlaceSide) {
      store.setPendingDeckPlace(deckPlaceSide);
    }
    return { ok: true };
  } catch (e) {
    _justDeclaredAxId = null;
    if (e instanceof StoreRollbackHandledError) {
      if (useGameStateStore.getState() === store
        && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
        restorePendingRuntimeState(pendingRuntimeBefore);
      }
    } else {
      const authorityCurrent = rollbackStoreRollbackParticipants(participantCheckpoints);
      if (authorityCurrent) {
        try {
          if (useGameStateStore.getState() !== store) {
            runStoreRollbackPublication(store, () => useGameStateStore.setState(store, true));
          }
        } catch {
          // Zustand installs the exact snapshot before notifying subscribers.
          // Preserve the original dispatch or post-publication error.
        }
        if (useGameStateStore.getState() === store
          && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(pendingRuntimeBefore);
        }
      }
    }
    const cause = storeRollbackCause(e);
    if (cause instanceof RejectedDecisionError) {
      return { ok: false, reason: 'not-allowed' };
    }
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, reason: 'engine-error', detail };
  }
}

/**
 * React hook 形ラッパ。UI component から
 *   const { dispatch } = useEngineDispatch();
 * で利用する。`dispatchEngineAction` は module-level の安定参照なので
 * useCallback は不要。
 */
export function useEngineDispatch(): { dispatch: typeof dispatchEngineAction } {
  return { dispatch: dispatchEngineAction };
}
