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
import type { PendingHirameki } from '@/ui/state/store.js';
import { isCausalLogEntry } from '@/engine/log/causal.js';
import {
  canApplySetCardChoice,
  canApplySetCardReplacement,
} from '@/engine/effect/apply-pick.js';
import {
  toPendingSetCardChoiceSide,
  toPendingSetCardReplacementSide,
} from './set-card-boundary.js';
import {
  readPendingDeckPlaceAuthority,
  readPendingDeckReorderAuthority,
  readPendingEffectChoiceAuthority,
  readPendingEffectOptionalAuthority,
  readPendingEffectPickAuthority,
  readPendingRpsAuthority,
} from '@/engine/effect/runtime-state.js';
import { canApplyPendingPickSelection } from '@/engine/effect/pick-selection.js';

// ---- can-check (前段ガード) ----

function matchesPendingDecision(
  pending: { decisionId: string } | null,
  action: { decisionId: string },
): boolean {
  // Legacy tests may inject both values without an id at runtime. Shipped
  // TypeScript callers cannot construct a decision response without one.
  return pending !== null && pending.decisionId === action.decisionId;
}

function matchesHiramekiCheckpoint(state: GameState, pending: PendingHirameki): boolean {
  if (!pending.actionId
    || !pending.causalCorrelationEventId
    || !pending.actorUid
    || !pending.occurrence) return false;

  const ax = flow.action._getContext(state, pending.actionId);
  if (!ax
    || ax.phase !== 'judge'
    || ax.judgeResolved !== true
    || ax.target.kind !== 'case'
    || ax.target.player !== pending.player
    || ax.byUid !== pending.actorUid
    || ax.byPlayer === pending.player
    || ax.deferredCaseEvidenceGain !== true
    || pending.gainDeferred !== true
    || ax.causalTrace?.tailEventId !== pending.causalCorrelationEventId) {
    return false;
  }

  const occurrence = pending.occurrence;
  if (occurrence.player !== pending.player
    || state.players[occurrence.player].remove[occurrence.removeIndex] !== occurrence.cardId) {
    return false;
  }

  const edge = state.log
    .filter(isCausalLogEntry)
    .find((entry) => entry.eventId === pending.causalCorrelationEventId);
  return flow.actionCase.matchesHiramekiCheckpoint(state, ax, pending)
    && edge !== undefined
    && edge.sessionId === state.causalLog?.sessionId
    && edge.kind === 'zone-move'
    && edge.actor === ax.byPlayer
    && edge.outcome.type === 'move'
    && edge.outcome.from === 'evidence'
    && edge.outcome.to === 'remove'
    && edge.outcome.count === 1;
}

export type ConcedeAuthority = { allowed: boolean };

export function isAllowed(
  state: GameState,
  action: EngineAction,
  authority?: { concede?: ConcedeAuthority },
): boolean {
  if (state.gameResult !== undefined) return false;
  if (isNewPrimaryAction(action) && hasExclusivePublicActionContext(state)) return false;
  switch (action.type) {
    case 'concede':
      return authority?.concede?.allowed === true;
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
      const ax = flow.action._getContext(state, action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'guard-window') return false;
      if (action.guarderUid === null) return true; // pass はいつでも可
      // Task D E4: アクション対象自身はガード不可 (B09028/B09054 Q&A)
      return flow.guard.canGuard(state, ax.byUid, action.guarderUid, ax.target.kind === 'char' ? ax.target.uid : undefined);
    }
    case 'actionContact': {
      const ax = flow.action._getContext(state, action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'action-1' && ax.phase !== 'action-2' && ax.phase !== 'action-1-redo') return false;
      const currentUid = ax.phase === 'action-2' ? ax.secondUid : ax.firstUid;
      if (!currentUid || ownerOfUid(state, currentUid) !== action.player) return false;
      if (action.choice.kind === 'pass') return true;
      if (action.choice.kind === 'cutin') return flow.contact.canCutIn(state, ax, action.player, action.choice.cardId);
      if (action.choice.kind === 'disguise') return flow.contact.canDisguise(state, ax, action.player, action.choice.cardId);
      return false;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(state, action.actionId);
      if (!ax || hasBlockingResolutionPrompt()) return false;
      switch (ax.phase) {
        case 'leave-resolution':
        case 'contact-pending':
        case 'contact-end':
          return true;
        case 'action-1':
          return ax.firstActed !== undefined;
        case 'action-2':
          return ax.secondActed !== undefined;
        case 'action-1-redo':
          return ax.firstRedoActed !== undefined;
        case 'judge':
          return ax.judgeResolved === true;
        default:
          return false;
      }
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(state, action.actionId);
      return !!ax
        && ax.phase === 'judge'
        && ax.judgeResolved !== true
        && !hasBlockingResolutionPrompt();
    }
    case 'hiramekiResolve': {
      // pendingHirameki が set されているときのみ有効
      const pending = useGameStateStore.getState().pendingHirameki;
      return matchesPendingDecision(pending, action)
        && matchesHiramekiCheckpoint(state, pending!);
    }
    case 'misreadResolve': {
      const pending = useGameStateStore.getState().pendingMisread;
      return matchesPendingDecision(pending, action)
        && _canResolveMisreadPicks(state, pending!, action.picks);
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional が set されているときのみ有効
      return matchesPendingDecision(useGameStateStore.getState().pendingEffectOptional, action)
        && readPendingEffectOptionalAuthority(state) !== null;
    }
    case 'leaveInterceptResolve': {
      const pending = useGameStateStore.getState().pendingLeaveIntercept;
      if (!matchesPendingDecision(pending, action) || pending === null) return false;
      const ax = flow.action._getContext(state, pending.actionId);
      const stateOwned = ax?.pendingLeaveIntercept;
      return ax?.phase === 'judge'
        && stateOwned?.player === pending.player
        && stateOwned.targetUid === pending.targetUid
        && stateOwned.interceptorUid === pending.interceptorUid;
    }
    case 'rpsResolve':
      return matchesPendingDecision(useGameStateStore.getState().pendingRps, action)
        && readPendingRpsAuthority(state) !== null
        && ['rock', 'paper', 'scissors'].includes(action.hand);
    case 'setCardChoiceResolve': {
      const pending = useGameStateStore.getState().pendingSetCardChoice;
      return matchesPendingDecision(pending, action)
        && pending !== null
        && canApplySetCardChoice(toPendingSetCardChoiceSide(pending), action.instanceId);
    }
    case 'setCardReplacementResolve': {
      const pending = useGameStateStore.getState().pendingSetCardReplacement;
      return matchesPendingDecision(pending, action)
        && pending !== null
        && canApplySetCardReplacement(
          state,
          toPendingSetCardReplacementSide(pending),
          action.targetUid,
        );
    }
    case 'chooseInterceptResolve': {
      return matchesPendingDecision(useGameStateStore.getState().pendingChooseIntercept, action);
    }
    case 'repeatOptionalResolve': {
      return matchesPendingDecision(useGameStateStore.getState().pendingEffectRepeatOptional, action);
    }
    case 'deckReorderResolve': {
      // BUG-136: pendingDeckReorder が set されているときのみ有効
      return matchesPendingDecision(useGameStateStore.getState().pendingDeckReorder, action)
        && readPendingDeckReorderAuthority(state) !== null;
    }
    case 'deckPlaceResolve': {
      // mini-wave #5 P2: pendingDeckPlace が set されているときのみ有効
      return matchesPendingDecision(useGameStateStore.getState().pendingDeckPlace, action)
        && readPendingDeckPlaceAuthority(state) !== null;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice が set されているときのみ有効
      const authority = readPendingEffectChoiceAuthority(state);
      return matchesPendingDecision(useGameStateStore.getState().pendingEffectChoice, action)
        && authority !== null
        && Number.isInteger(action.choiceIndex)
        && authority.options.some((option) => option.index === action.choiceIndex);
    }
    case 'effectPickResolve': {
      // BUG-054: pendingEffectPick が set されているときのみ有効
      const authority = readPendingEffectPickAuthority(state);
      return matchesPendingDecision(useGameStateStore.getState().pendingEffectPick, action)
        && authority !== null
        && canApplyPendingPickSelection(
          authority,
          action.pickedUid,
          'pickedUids' in action ? action.pickedUids : undefined,
        );
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

function ownerOfUid(state: GameState, uid: string): 'self' | 'opp' | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  if (state.players.self.scene.some(character => character.uid === uid)) return 'self';
  if (state.players.opp.scene.some(character => character.uid === uid)) return 'opp';
  return null;
}

function hasBlockingResolutionPrompt(): boolean {
  const store = useGameStateStore.getState();
  if (_getResolutionLock().locked) return true;
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

/** Human resolution prompts and action contexts own public dispatch until resolved. */
function hasExclusivePublicActionContext(state: GameState): boolean {
  const store = useGameStateStore.getState();
  if (
    _getResolutionLock().locked
    || store.activeActionId !== null
    || flow.action._hasOpenActionContext(state)
  ) return true;
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
