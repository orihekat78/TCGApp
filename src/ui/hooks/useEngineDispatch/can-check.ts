// useEngineDispatch/can-check.ts — Phase 3d 分割 (isAllowed 前段ガード, body 無改変移送, 2026-06-22)
import * as flow from '@/engine/flow/index.js';
import { game as readGame } from '@/engine/read/game.js';
import { useGameStateStore } from '@/ui/state/store.js';
import { _getResolutionLock } from '@/engine/event/registry.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { EngineAction } from './types.js';
import { canEndTurnByContract } from '../useActionsPanelFlow/end-turn-contract.js';
import { _canResolveMisreadPicks } from '@/engine/listeners/misread.js';
import { pendingOwnerOrderGroup } from '@/engine/resolve/stack.js';

// ---- can-check (前段ガード) ----

export function isAllowed(state: GameState, action: EngineAction): boolean {
  if (isNewPrimaryAction(action) && hasExclusivePublicActionContext()) return false;
  switch (action.type) {
    case 'reasoning':
      return flow.canReason(state, action.uid);
    case 'handUseCard':
      return flow.canHandUseCard(state, action.player, action.cardId);
    case 'handUseCardSwitch':
      return flow.canHandUseCardSwitch(state, action.player, action.cardId);
    case 'nextHint':
      return flow.canStartNextHint(state, action.player);
    case 'partnerAbility':
      return flow.canPartnerAbility(state, action.player, action.abilId);
    case 'declaredAbility':
      return flow.canActivateDeclaredAbility(state, action.uid, action.abilId, action.costParams);
    case 'assist':
      return readGame.canPartnerAssist(state, action.player);
    case 'solveCase':
      return readGame.canPartnerSolveCase(state, action.player);
    case 'actionAgainstChar':
      return flow.canActionAgainstChar(state, action.byUid, action.targetUid);
    case 'actionAgainstCase':
      return flow.canActionAgainstCase(state, action.byUid, action.targetPlayer);
    // Phase 8 完全クローズ Commit 2: per-step action dispatch can-check
    case 'actionDeclareChar':
      return flow.canActionAgainstChar(state, action.byUid, action.targetUid);
    case 'actionDeclareCase':
      return flow.canActionAgainstCase(state, action.byUid, action.targetPlayer);
    case 'actionGuard': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'guard-window') return false;
      if (action.guarderUid === null) return true; // pass はいつでも可
      // Task D E4: アクション対象自身はガード不可 (B09028/B09054 Q&A)
      return flow.guard.canGuard(state, ax.byUid, action.guarderUid, ax.target.kind === 'char' ? ax.target.uid : undefined);
    }
    case 'actionContact': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'action-1' && ax.phase !== 'action-2' && ax.phase !== 'action-1-redo') return false;
      if (action.choice.kind === 'pass') return true;
      if (action.choice.kind === 'cutin') return flow.contact.canCutIn(state, ax, action.player, action.choice.cardId);
      if (action.choice.kind === 'disguise') return flow.contact.canDisguise(state, ax, action.player, action.choice.cardId);
      return false;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(action.actionId);
      return !!ax && ax.phase !== 'action-end';
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(action.actionId);
      return !!ax && ax.phase === 'judge';
    }
    case 'hiramekiResolve': {
      // pendingHirameki が set されているときのみ有効
      return useGameStateStore.getState().pendingHirameki !== null;
    }
    case 'misreadResolve': {
      const pending = useGameStateStore.getState().pendingMisread;
      return pending !== null && _canResolveMisreadPicks(state, pending, action.picks);
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectOptional !== null;
    }
    case 'leaveInterceptResolve':
      return useGameStateStore.getState().pendingLeaveIntercept !== null;
    case 'rpsResolve':
      return useGameStateStore.getState().pendingRps !== null;
    case 'setCardChoiceResolve':
      return useGameStateStore.getState().pendingSetCardChoice !== null;
    case 'setCardReplacementResolve':
      return useGameStateStore.getState().pendingSetCardReplacement !== null;
    case 'chooseInterceptResolve': {
      return useGameStateStore.getState().pendingChooseIntercept !== null;
    }
    case 'repeatOptionalResolve': {
      return useGameStateStore.getState().pendingEffectRepeatOptional !== null;
    }
    case 'deckReorderResolve': {
      // BUG-136: pendingDeckReorder が set されているときのみ有効
      return useGameStateStore.getState().pendingDeckReorder !== null;
    }
    case 'deckPlaceResolve': {
      // mini-wave #5 P2: pendingDeckPlace が set されているときのみ有効
      return useGameStateStore.getState().pendingDeckPlace !== null;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectChoice !== null;
    }
    case 'effectPickResolve': {
      // BUG-054: pendingEffectPick が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectPick !== null;
    }
    case 'setEffectOrder': {
      // resolution lock 中は禁止
      const lock = _getResolutionLock();
      if (lock.locked) return false;
      // entry が存在 + owner が action.player と一致する場合のみ
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== action.player) return false;
      const group = pendingOwnerOrderGroup(state, human);
      return group.some((entry) => entry.id === action.entryId);
    }
    case 'resolveEffectOrder': {
      const lock = _getResolutionLock();
      if (lock.locked) return false;
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== action.player) return false;
      const group = pendingOwnerOrderGroup(state, human);
      return group.length >= 2
        && group.length === action.entryIds.length
        && group.every((entry, index) => entry.id === action.entryIds[index]);
    }
    case 'endTurn': {
      return canEndTurnByContract(state, action.player);
    }
    // refactor 3e: 同上。isAllowed は dispatchEngineAction の try 外で呼ばれるため throw 不可
    // (uncaught 化で挙動破壊)。現状の falsy fall-through と等価な return false に固定。到達不能。
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return false;
    }
  }
}

/** Human resolution prompts and action contexts own public dispatch until resolved. */
function hasExclusivePublicActionContext(): boolean {
  const store = useGameStateStore.getState();
  if (_getResolutionLock().locked || store.activeActionId !== null) return true;
  return store.pendingHirameki !== null
    || store.pendingMisread !== null
    || store.pendingEffectPick !== null
    || store.pendingEffectChoice !== null
    || store.pendingEffectOptional !== null
    || store.pendingChooseIntercept !== null
    || store.pendingLeaveIntercept !== null
    || store.pendingRps !== null
    || store.pendingSetCardChoice !== null
    || store.pendingSetCardReplacement !== null
    || store.pendingEffectRepeatOptional !== null
    || store.pendingDeckReveal !== null
    || store.pendingDeckReorder !== null
    || store.pendingDeckPlace !== null;
}

/** These actions initiate a fresh turn action; resolution actions remain allowed. */
function isNewPrimaryAction(action: EngineAction): boolean {
  switch (action.type) {
    case 'reasoning':
    case 'handUseCard':
    case 'handUseCardSwitch':
    case 'nextHint':
    case 'partnerAbility':
    case 'declaredAbility':
    case 'assist':
    case 'solveCase':
    case 'actionAgainstChar':
    case 'actionAgainstCase':
    case 'actionDeclareChar':
    case 'actionDeclareCase':
    case 'endTurn':
      return true;
    default:
      return false;
  }
}
