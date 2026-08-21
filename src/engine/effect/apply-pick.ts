// engine.effect.apply-pick — pending effect-pick の解決 + continuation 実行を一箇所に集約。
//
// rules: 15-abilities-effects.md (効果解決順) / 21-declared-ability-cost.md
// spec: BUG-054/065 (pattern A/B substitute) / BUG-107 (continuation の bind 共有) / BUG-109 (AI drain)
//
// 設計:
//   - `applyPickAndContinuation` は「pick 解決した atom を build → 中断中 sequence/chain の保存 ctx で
//     runEffect 実行 → continuation remainder を同一 ctx で実行」を行う。human (useEngineDispatch.
//     effectPickResolve) と AI (drainAiEffectPicks) の **共通実体**。store / skip / 候補選択は呼出側。
//   - `drainAiEffectPicks` は __pendingEffectPickQueue を heuristic で順次解決する (CPU 経路には
//     human modal が無いため、PA 短縮形 atom の pick が drain されず no-op になる BUG-109 を解消)。

import type { CausalEffectTrace, GameState, Effect, EffectCtx, Candidate, Condition, RemoveResult } from '../types/index.js';
import type { PendingEffectPickSide, PendingEffectChoiceSide, PendingEffectOptionalSide, ContinuationFrame } from './resolve-picks.js';
import { resolveEffectPicks, rememberedRuntimeAtomTargetPolicy, _takePendingChoiceResume, _takePendingChoiceBindings, _takePendingOptionalResume, _takePendingOptionalBindings, _takePendingOptionalCostPaid } from './resolve-picks.js';
import { findChooseIntercept } from './consult-choose-intercept.js';
import { bindingKeysReadByCondition } from '../cond/binding-keys.js';
import {
  isSceneEnterSwitchPickArgs,
  isValidSceneEnterSwitchPickAuthority,
  resolveSceneEnterSwitchPickArgs,
  withContinuationSceneEnterSwitchChoice,
  withSceneEnterSwitchChoice,
} from './scene-switch.js';
import { sceneCap } from '../read/scene-cap.js';
import {
  bindEffectCausalTrace,
  cloneCausalEffectTrace,
  completeEffectCausalTrace,
  markEffectCausalAwaitingResume,
  recordEffectCausalDecision,
  recordEffectCausalOperation,
  restoreEffectCausalTrace,
  withStructuredCausalResolution,
} from '../log/effect-causal.js';

type Player = 'self' | 'opp';

function resumedEntryExtras(source: {
  triggerBatch?: number;
  ownerChosenOrder?: number;
  ownerOrderConfirmed?: boolean;
  declaredBatch?: number | string;
  causalTrace?: CausalEffectTrace;
}) {
  return {
    resumesCurrentEffect: true as const,
    ...(source.triggerBatch !== undefined ? { triggerBatch: source.triggerBatch } : {}),
    ...(source.ownerChosenOrder !== undefined ? { ownerChosenOrder: source.ownerChosenOrder } : {}),
    ...(source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: source.ownerOrderConfirmed } : {}),
    ...(source.declaredBatch !== undefined ? { declaredBatch: source.declaredBatch } : {}),
    ...(source.causalTrace ? { causalTrace: cloneCausalEffectTrace(source.causalTrace) } : {}),
  };
}

function resumedEntrySource(
  source: {
    uid?: string;
    cardId: string;
    abilityId: string;
    area?: EffectCtx['source']['area'];
    resolutionKind?: EffectCtx['source']['resolutionKind'];
  },
  player: Player,
) {
  return {
    player,
    ...(source.uid !== undefined ? { uid: source.uid } : {}),
    cardId: source.cardId,
    abilityId: source.abilityId,
    ...(source.area ? { area: source.area } : {}),
    ...(source.resolutionKind ? { resolutionKind: source.resolutionKind } : {}),
  };
}

import { run as runEffect } from './resolver.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';
import { cardOccurrenceUid, cardOccurrenceWitness, isLiveCardOccurrenceWitness } from '../target/card-occurrence.js';
import {
  advanceDeckEpochAndRebaseBindings,
  deckOccurrenceRelocations,
  isLiveDeckWindowAuthority,
} from './deck-occurrence-authority.js';
import {
  consumePersistedDeckDecisionAuthority,
  consumePersistedEffectPickAuthority,
} from './runtime-state.js';
import { mutate } from '../mutate/index.js';
import {
  canAdvanceLeaveInterceptReplacement,
  advanceLeaveInterceptReplacement,
  advanceLeaveInterceptReplacementAfterResume,
  finalizeLeaveInterceptReplacement,
} from '../flow/contact.js';
import {
  _takePendingChooseInterceptResume,
  _peekPendingChooseInterceptResume,
  _takePendingEffectRepeatOptionalResume,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectRepeatOptionalSide,
  _peekPendingEffectChoiceSide,
  _peekPendingEffectPickSide,
  _peekPendingEffectOptionalSide,
  _peekPendingEffectRepeatOptionalSide,
  _takePendingChoiceContinuation,
  _takePendingOptionalContinuation,
  pushPendingChooseInterceptSide,
  type PendingChooseInterceptSide,
  type PendingEffectRepeatOptionalSide,
  type PendingRpsSide,
  type RpsHand,
  _takePendingRpsResume,
  _peekPendingRpsResume,
  _peekPendingRpsSide,
  pushPendingRpsSide,
  setPendingRpsResume,
  appendPendingRpsContinuation,
  setPendingChoiceContinuation,
  appendPendingOptionalContinuation,
  setPendingEffectRepeatOptionalContinuation,
  getPendingChoiceResume,
  _takePendingSetCardChoiceResume,
  _peekPendingSetCardChoiceSide,
  _peekPendingSetCardChoiceResume,
  _peekPendingSetCardReplacementSide,
  _peekPendingSetCardReplacementContinuation,
  _peekPendingSetCardReplacementGuard,
  _restorePendingSetCardReplacementSide,
  _takePendingSetCardReplacementContinuation,
  _takePendingSetCardReplacementGuard,
  appendPendingSetCardChoiceContinuation,
  setPendingSetCardReplacementContinuation,
  type PendingSetCardChoiceSide,
  type PendingSetCardReplacementSide,
} from './pending-state.js';

function consumeQueuedPick(state: GameState, pending: PendingEffectPickSide): void {
  consumePersistedEffectPickAuthority(state, pending);
  if (_peekPendingEffectPickSide() === pending) _drainPendingEffectPickSide();
}

function consumeQueuedChoice(pending: PendingEffectChoiceSide): void {
  if (_peekPendingEffectChoiceSide() === pending) _drainPendingEffectChoiceSide();
}

function consumeQueuedOptional(pending: PendingEffectOptionalSide): void {
  if (_peekPendingEffectOptionalSide() === pending) _drainPendingEffectOptionalSide();
}

function consumeQueuedRepeatOptional(pending: PendingEffectRepeatOptionalSide): void {
  if (_peekPendingEffectRepeatOptionalSide() === pending) _drainPendingEffectRepeatOptionalSide();
}

function isLiveDeckRevealWindow(state: GameState, pending: PendingEffectPickSide): boolean {
  if (pending.atomVerb !== 'deckRevealUntil') return true;
  const args = pending.atomArgs as Record<string, unknown>;
  const player = args.__windowPlayer ?? pending.player;
  return (player === 'self' || player === 'opp')
    && isLiveDeckWindowAuthority(state, player, args);
}
import { hand } from '../mutate/hand.js';
import { char as charMutator } from '../mutate/char.js';
import { scene as sceneMutator } from '../mutate/scene.js';
import {
  _attachPendingDeckPlaceContinuation,
  _attachPendingDeckReorderContinuation,
  _peekPendingDeckPlaceSide,
  _peekPendingDeckReorderSide,
  resolveBindRef,
  type PendingDeckPlaceSide,
  type PendingDeckReorderSide,
} from './atom-handlers/_shared.js';

export function applyRepeatOptionalAndContinuation(state: GameState, pending: PendingEffectRepeatOptionalSide, run: boolean): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const resume = _takePendingEffectRepeatOptionalResume();
  if (!resume) return;
  consumeQueuedRepeatOptional(pending);
  const decisionTrace = restoreEffectCausalTrace(resume.ctx, pending.source.causalTrace);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  const next: Effect[] = run
    ? [resume.body, ...(resume.remaining > 1 ? [{ kind: 'repeatOptional', max: resume.remaining - 1, body: resume.body } as Effect] : []), ...resume.remainder]
    : resume.remainder;
  const effect: Effect = { kind: 'sequence', steps: next };
  withStructuredCausalResolution(state, () => {
    const pendingBeforeResolve = snapshotContinuationPending();
    const resolved = resolveEffectPicks(state, effect, resume.ctx, { humanChooser: true, byPlayer: resume.ctx.source.player, source: { cardId: resume.ctx.source.cardId ?? '', abilityId: resume.ctx.source.abilityId ?? '' } });
    if (resume.continuation) {
      runContinuationChain(state, {
        remainder: [resolved], ctx: resume.ctx, kind: 'sequence', outer: resume.continuation,
      }, decisionTrace, pendingBeforeResolve);
    } else {
      runEffect(state, resolved, resume.ctx);
      runAllUntilEmpty(state);
    }
  }, decisionTrace);
  completeEffectCausalTrace(state, decisionTrace, resume.ctx.source.player);
}
import { pendingOwnerOrderGroup, runAllUntilEmpty as runAllUntilEmptyCore } from '../resolve/index.js';

function runAllUntilEmpty(state: GameState): void {
  runAllUntilEmptyCore(state, { preserveCompletedPresentationsOnTerminalEntry: true });
}

/** A serialized or stale decision must not resume after the match is over. */
function stopIfGameAlreadyEnded(state: GameState): boolean {
  if (state.gameResult === undefined) return false;
  runAllUntilEmptyCore(state);
  return true;
}
import { event } from '../event/index.js';
import { def } from '../read/def.js';
import { eventUseAllowed } from '../flow/main/hand-use-card.js';
import { evalCond } from '../cond/eval.js';
import {
  canonicalPendingPickSelection,
  effectivePendingPickRange,
  findPendingPickCandidate,
  maximumFeasiblePendingPickSelection,
  pendingPickSelectionViolation,
} from './pick-selection.js';

/** Resolve the human half of a dedicated rock-paper-scissors decision. */
export function applyRpsAndContinuation(state: GameState, pending: PendingRpsSide, handChoice: RpsHand): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const hands: RpsHand[] = ['rock', 'paper', 'scissors'];
  if (!hands.includes(handChoice)) {
    throw new Error(`rpsResolve: invalid RPS hand ${String(handChoice)}`);
  }
  const available = _peekPendingRpsResume();
  if (!available || available.effect.kind !== 'rps') return;
  const resume = _takePendingRpsResume();
  if (!resume || resume.effect.kind !== 'rps') return;
  const ctx: EffectCtx = {
    source: { cardId: pending.source.cardId, uid: pending.source.uid, abilityId: pending.source.abilityId, player: pending.ownerPlayer, area: pending.source.area ?? 'scene', ...(pending.source.resolutionKind ? { resolutionKind: pending.source.resolutionKind } : {}), ...(pending.source.triggerBatch !== undefined ? { triggerBatch: pending.source.triggerBatch } : {}), ...(pending.source.ownerChosenOrder !== undefined ? { ownerChosenOrder: pending.source.ownerChosenOrder } : {}), ...(pending.source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: pending.source.ownerOrderConfirmed } : {}), ...(pending.source.declaredBatch !== undefined ? { declaredBatch: pending.source.declaredBatch } : {}) },
    bindings: resume.bindings as EffectCtx['bindings'],
  };
  const decisionTrace = restoreEffectCausalTrace(ctx, pending.source.causalTrace);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  const wins = (a: RpsHand, b: RpsHand): boolean =>
    (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
  const ownerHand = pending.ownerPlayer === pending.player ? handChoice : pending.aiHand;
  const otherHand = pending.ownerPlayer === pending.player ? pending.aiHand : handChoice;
  if (ownerHand === otherHand) {
    const aiHand = hands[Math.floor(Math.random() * hands.length)]!;
    markEffectCausalAwaitingResume(decisionTrace);
    pushPendingRpsSide({
      ...pending,
      aiHand,
      source: {
        ...pending.source,
        ...(decisionTrace ? { causalTrace: cloneCausalEffectTrace(decisionTrace) } : {}),
      },
    });
    setPendingRpsResume(resume.effect, resume.bindings);
    if (resume.continuation) appendPendingRpsContinuation(resume.continuation);
    return;
  }
  const branch = wins(ownerHand, otherHand) ? resume.effect.win : resume.effect.lose;
  withStructuredCausalResolution(state, () => {
    const pendingBeforeResolve = snapshotContinuationPending();
    const resolved = resolveEffectPicks(state, branch, ctx, {
      byPlayer: pending.ownerPlayer,
      humanChooser: pending.player === pending.ownerPlayer,
      humanPlayer: pending.player,
      source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
    });
    if (resume.continuation) {
      runContinuationChain(state, {
        remainder: [resolved], ctx, kind: 'sequence', outer: resume.continuation,
      }, decisionTrace, pendingBeforeResolve);
      return;
    }
    runEffect(state, resolved, ctx);
    runAllUntilEmpty(state);
  }, decisionTrace);
  completeEffectCausalTrace(state, decisionTrace, ctx.source.player);
}

/** Resolve an opaque set-card occurrence selection and expose it as face-up evidence. */
export function canApplySetCardChoice(pending: PendingSetCardChoiceSide, instanceId: string): boolean {
  const resume = _peekPendingSetCardChoiceResume();
  return resume !== null
    && matchesSetCardChoiceGuard(resume.guard, pending)
    && resume.guard!.entries.some((entry) => entry.instanceId === instanceId);
}

export function applySetCardChoiceAndContinuation(state: GameState, pending: PendingSetCardChoiceSide, instanceId: string): boolean {
  if (stopIfGameAlreadyEnded(state)) return false;
  // Never consume before validating the UI payload. Once a live decision has
  // become stale, consume it as a no-op so its enclosing sequence/chain gets
  // the same continuation semantics as an uninterrupted failed effect.
  const resume = _peekPendingSetCardChoiceResume();
  if (!resume || !canApplySetCardChoice(pending, instanceId)) return false;
  const canonical = resume.guard!;
  const resumeCtx: EffectCtx = {
    source: {
      cardId: canonical.source.cardId,
      uid: canonical.source.uid,
      abilityId: canonical.source.abilityId,
      player: canonical.player,
      area: canonical.source.area ?? 'scene',
      ...(canonical.source.resolutionKind ? { resolutionKind: canonical.source.resolutionKind } : {}),
      ...(canonical.source.triggerBatch !== undefined ? { triggerBatch: canonical.source.triggerBatch } : {}),
      ...(canonical.source.ownerChosenOrder !== undefined ? { ownerChosenOrder: canonical.source.ownerChosenOrder } : {}),
      ...(canonical.source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: canonical.source.ownerOrderConfirmed } : {}),
      ...(canonical.source.declaredBatch !== undefined ? { declaredBatch: canonical.source.declaredBatch } : {}),
    },
    bindings: resume.bindings as EffectCtx['bindings'],
  };
  if (resume.effect.kind === 'moveSetCard' && canonical.destination && canonical.face) {
    if (canonical.face !== resume.effect.face) return false;
    const expectedHostUid = resolveBindRef(resume.effect.hostUid, resumeCtx);
    const expectedDestination = resume.effect.destination.area === 'scene'
      ? { area: 'scene' as const, hostUid: resolveBindRef(resume.effect.destination.hostUid, resumeCtx) }
      : resume.effect.destination;
    if (expectedHostUid !== canonical.hostUid || expectedDestination.area !== canonical.destination.area) return false;
    if (expectedDestination.area === 'scene') {
      if (canonical.destination.area !== 'scene' || typeof expectedDestination.hostUid !== 'string' || expectedDestination.hostUid !== canonical.destination.hostUid) return false;
    }
    if (expectedDestination.area === 'evidence') {
      if (canonical.destination.area !== 'evidence' || expectedDestination.faceUp !== canonical.destination.faceUp) return false;
    }
  }
  const consumed = _takePendingSetCardChoiceResume();
  if (!consumed) return false;
  const causalCtx = consumed.continuation?.ctx ?? resumeCtx;
  const decisionTrace = restoreEffectCausalTrace(causalCtx, canonical.source.causalTrace);
  recordEffectCausalDecision(state, decisionTrace, canonical.player);
  let applied = false;
  withStructuredCausalResolution(state, () => {
    if (consumed.effect.kind === 'setCardToEvidence') {
      const moved = charMutator.takeOneSetCard(state, canonical.hostUid, instanceId);
      if (moved) {
        state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: true, origin: { turn: state.turn.number, via: 'effect', sourceCardId: canonical.source.cardId } });
        advanceIndexedZoneEpoch(state, moved.player, 'evidence');
        applied = true;
      }
    } else if (consumed.effect.kind === 'moveSetCard' && canonical.destination && canonical.face) {
      const moved = charMutator.moveOneSetCard(state, canonical.hostUid, instanceId, canonical.face, canonical.destination);
      if (moved) {
        if (canonical.destination.area === 'evidence') {
          state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: canonical.destination.faceUp, origin: { turn: state.turn.number, via: 'effect', sourceCardId: canonical.source.cardId } });
          advanceIndexedZoneEpoch(state, moved.player, 'evidence');
        } else if (canonical.destination.area === 'hand') {
          state.players[moved.player].hand.push(moved.cardId);
        }
        applied = true;
      }
    }
    if (!applied && consumed.continuation?.kind === 'chain') {
      consumed.continuation.ctx.dyn ??= {};
      consumed.continuation.ctx.dyn.chainStepNoApply = true;
    }
    if (consumed.continuation) runContinuationChain(state, consumed.continuation, decisionTrace);
    else runAllUntilEmpty(state);
  }, decisionTrace);
  completeEffectCausalTrace(
    state,
    decisionTrace,
    causalCtx.source.player,
    applied ? 'summary' : 'fizzle',
    { type: 'state', state: applied ? 'success' : 'fizzled' },
  );
  return true;
}

/** UI state is untrusted after serialization; only the resolver snapshot can authorize an instance. */
function matchesSetCardChoiceGuard(guard: PendingSetCardChoiceSide | undefined, pending: PendingSetCardChoiceSide): boolean {
  if (guard === undefined) return false;
  const { decisionId: _decisionId, ...enginePending } = pending as PendingSetCardChoiceSide & {
    decisionId?: string;
  };
  return JSON.stringify(guard) === JSON.stringify(enginePending);
}

/** Resolve the optional pre-removal replacement of one exact set-card occurrence. */
export function canApplySetCardReplacement(
  state: GameState,
  pending: PendingSetCardReplacementSide,
  toUid: string | null,
): boolean {
  const guard = _peekPendingSetCardReplacementGuard();
  if (!guard || !matchesSetCardReplacementGuard(guard, pending)) return false;
  return charMutator.canResolveSetCardRemovalReplacement(state, guard, toUid);
}

function matchesSetCardReplacementGuard(
  guard: PendingSetCardReplacementSide,
  pending: PendingSetCardReplacementSide,
): boolean {
  const project = (value: PendingSetCardReplacementSide) => ({
    player: value.player,
    fromUid: value.fromUid,
    setCardInstanceId: value.setCardInstanceId,
    candidates: value.candidates,
    source: value.source,
  });
  const projected = {
    player: guard.player,
    fromUid: guard.fromUid,
    setCardInstanceId: guard.setCardInstanceId,
    candidates: guard.candidates,
    source: guard.source,
  };
  return JSON.stringify(projected) === JSON.stringify(project(pending));
}

export type ApplySetCardReplacementResult = {
  applied: boolean;
  contactActionId?: string;
  contactFinalized?: boolean;
};

/** Apply one replacement and report any engine-owned contact continuation. */
export function applySetCardReplacementDetailed(
  state: GameState,
  pending: PendingSetCardReplacementSide,
  toUid: string | null,
): ApplySetCardReplacementResult {
  if (stopIfGameAlreadyEnded(state) || !canApplySetCardReplacement(state, pending, toUid)) return { applied: false };
  const prospectiveGuard = _peekPendingSetCardReplacementGuard();
  if (!prospectiveGuard || !canAdvanceLeaveInterceptReplacement(state, prospectiveGuard)) return { applied: false };
  const guard = _takePendingSetCardReplacementGuard();
  if (!guard) return { applied: false };
  const applied = charMutator.resolveSetCardRemovalReplacement(state, guard, toUid);
  if (!applied) {
    _restorePendingSetCardReplacementSide(null, guard);
    return { applied: false };
  }
  // The contact owns stage admission; a guardian stage can advance only after
  // the resumed removal reports that the guardian actually left.
  const contact = advanceLeaveInterceptReplacement(state, guard);
  const finishContact = (targetRemoval: RemoveResult | null = null): ApplySetCardReplacementResult => ({
    applied: true,
    ...(contact ? { contactActionId: contact.actionId } : {}),
    ...(contact && targetRemoval !== null
      ? { contactFinalized: finalizeLeaveInterceptReplacement(state, contact.actionId, targetRemoval) }
      : {}),
  });
  const continuation = _takePendingSetCardReplacementContinuation();
  if (guard.resume?.kind === 'scene-remove' && continuation) {
    // Persistence breaks the original shared-ctx object identity between the
    // paused atom and its enclosing chain. Re-link only the chain-gate dyn so
    // a resumed no-op still suppresses that chain tail after JSON hydration.
    if (continuation.outer?.kind === 'chain') {
      const sharedDyn = {
        ...(continuation.outer.ctx.dyn ?? {}),
        ...(continuation.ctx.dyn ?? {}),
      };
      continuation.ctx.dyn = sharedDyn;
      continuation.outer.ctx.dyn = sharedDyn;
    }
    const resumeAtom: Effect = {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        uid: guard.fromUid,
        cause: guard.resume.cause,
        ...(guard.resume.byUid ? { byUid: guard.resume.byUid } : {}),
        ...(guard.resume.leaveInterceptDecision
          ? { leaveInterceptDecision: guard.resume.leaveInterceptDecision }
          : {}),
        ...(guard.resume.afterSceneRemove
          ? { afterSceneRemove: guard.resume.afterSceneRemove }
          : {}),
        skipSetCardReplacementInstanceIds: [guard.setCardInstanceId],
      },
    };
    const afterSceneRemove = guard.resume.afterSceneRemove;
    const outer = afterSceneRemove
      ? {
          remainder: [{
            kind: 'atom' as const,
            verb: 'sceneRemove' as const,
            args: {
              uid: afterSceneRemove.uid,
              cause: afterSceneRemove.cause,
              ...(afterSceneRemove.byUid ? { byUid: afterSceneRemove.byUid } : {}),
              ...(afterSceneRemove.leaveInterceptDecision
                ? { leaveInterceptDecision: afterSceneRemove.leaveInterceptDecision }
                : {}),
            },
          }],
          ctx: continuation.ctx,
          kind: 'sequence' as const,
          outer: continuation.outer,
        }
      : continuation.outer;
    runContinuationChain(state, {
      remainder: [resumeAtom],
      ctx: continuation.ctx,
      kind: 'sequence',
      outer,
    });
    return finishContact();
  }
  const replacementBeforeResume = _peekPendingSetCardReplacementSide();
  let targetRemoval: RemoveResult | null = null;
  if (guard.resume) {
    switch (guard.resume.kind) {
      case 'scene-remove':
        {
          const resumed = sceneMutator.removeToRemove(state, guard.fromUid, guard.resume.cause, guard.resume.byUid, {
          byPlayer: guard.resume.byPlayer,
          leaveInterceptDecision: guard.resume.leaveInterceptDecision,
          afterSceneRemove: guard.resume.afterSceneRemove,
          skipSetCardReplacementInstanceIds: [guard.setCardInstanceId],
          });
          if (contact?.stage === 'interceptor-cost') {
            advanceLeaveInterceptReplacementAfterResume(state, contact.actionId, resumed);
          }
          // Direct mutation callers have no effect-chain outer frame. Preserve
          // the guardian-cost continuation explicitly in that path too.
          const after = guard.resume.afterSceneRemove;
          if (after && !resumed.deferred && !resumed.prevented && resumed.removed.cardId !== '') {
            targetRemoval = sceneMutator.removeToRemove(state, after.uid, after.cause, after.byUid, {
              byPlayer: after.byPlayer,
              leaveInterceptDecision: after.leaveInterceptDecision,
            });
          }
          if (contact?.stage === 'target-leave') targetRemoval = resumed;
        }
        break;
      case 'scene-to-deck':
        sceneMutator.toDeck(state, guard.fromUid, guard.resume.pos);
        break;
      case 'scene-to-hand':
        sceneMutator.toHand(state, guard.fromUid);
        break;
      case 'scene-to-evidence':
        sceneMutator.toEvidence(state, guard.fromUid, guard.resume.faceUp, guard.resume.sourceCardId);
        break;
      case 'scene-to-stack':
        sceneMutator.toStack(state, guard.fromUid, guard.resume.hostUid);
        break;
    }
  }
  const replacementAfterResume = _peekPendingSetCardReplacementSide();
  // A completed target removal settles the contact synchronously. contact:judge
  // listeners must enter the queue before this resolver drains it, otherwise a
  // direct public replacement leaves those observers behind (or observes an
  // unresolved contact).
  const contactResult = finishContact(targetRemoval);
  if (continuation && replacementAfterResume && replacementAfterResume !== replacementBeforeResume) {
    setPendingSetCardReplacementContinuation(continuation);
    runAllUntilEmpty(state);
    return contactResult;
  }
  if (continuation) runContinuationChain(state, continuation.outer);
  else runAllUntilEmpty(state);
  return contactResult;
}

/** Compatibility API for existing engine callers. */
export function applySetCardReplacement(
  state: GameState,
  pending: PendingSetCardReplacementSide,
  toUid: string | null,
): boolean {
  return applySetCardReplacementDetailed(state, pending, toUid).applied;
}

/**
 * pick uid → cardId 逆引き。`evidence:side:idx` / `cardId#idx` / snapshot fallback に対応。
 * (旧 useEngineDispatch ローカル。BUG-109 で engine 側へ移し human/AI 共有。)
 * Pattern A (uid='$pick' / scene char uid) は本関数を呼ばない経路。
 */
export function resolveCardIdFromPickUid(
  uid: string,
  state: GameState | null,
  pending: { candidates: ReadonlyArray<{ uid: string; cardId: string }> },
): string | null {
  const pendingCandidate = pending.candidates.find((c) => c.uid === uid);
  if (pendingCandidate) return pendingCandidate.cardId;
  if (!state) {
    return null;
  }
  const ev = uid.match(/^evidence:(self|opp):(\d+)$/);
  if (ev) {
    const side = ev[1] as 'self' | 'opp';
    const idx = parseInt(ev[2]!, 10);
    return state.players[side]?.evidence?.[idx]?.cardId ?? null;
  }
  const ch = uid.match(/^([^#]+)#\d+$/);
  if (ch) return ch[1] ?? null;
  return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
}

/**
 * A human may leave an effect-use picker open while its authorization changes
 * (for example, a FILE/evidence state update or an event-use prohibition).
 * Such a pick must close without running either the selected atom or its
 * continuation.  An explicit zero pick is deliberately excluded: that is the
 * printed "up to" choice and `useEventFromHand` owns its chain-gate behavior.
 */
function isStaleEffectEventUsePick(
  state: GameState,
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
): boolean {
  if (pending.atomVerb !== 'useEventFromHand') return false;
  const uids = pickedUids ?? [pickedUid];
  if (uids.length === 0) return false;
  if (state.turnState[pending.player].eventUseBanned) return true;

  const wanted = new Map<string, number>();
  for (const uid of uids) {
    const cardId = resolveCardIdFromPickUid(uid, state, pending);
    if (!cardId || def.card(cardId)?.kind !== 'event') return true;
    wanted.set(cardId, (wanted.get(cardId) ?? 0) + 1);
  }
  const inHand = new Map<string, number>();
  for (const cardId of state.players[pending.player].hand) {
    inHand.set(cardId, (inHand.get(cardId) ?? 0) + 1);
  }
  return [...wanted].some(([cardId, count]) =>
    (inHand.get(cardId) ?? 0) < count || !eventUseAllowed(state, pending.player, cardId));
}

/**
 * BUG-111 family (continuation-nest, 2026-06-22): continuation frame 連鎖 (head → outer) を順に実行する。
 * 各 frame の remainder を保存 ctx で runEffect → runAllUntilEmpty。
 * ある frame の remainder 実行中に **再 pause** (新 pick enqueue) したら、残りの outer frames を
 * その新 pick に引き継いで停止する (外側 remainder は新 pick の解決時に実行される)。
 * 単一 frame (outer 無し) は従来の「remainder を 1 回 runEffect + runAllUntilEmpty」と byte 互換。
 */
function conditionReadsBinding(condition: Condition): boolean {
  return bindingKeysReadByCondition(condition).length > 0;
}

/**
 * Pre-walk leaves a conditional raw while a preceding pick has not produced
 * its binding. Only that shape needs a continuation-boundary re-walk; doing
 * it for every Pattern-B remainder mutates its original target query.
 */
function hasBindingDependentConditional(effect: Effect): boolean {
  switch (effect.kind) {
    case 'conditional':
      return conditionReadsBinding(effect.if)
        || hasBindingDependentConditional(effect.then)
        || (effect.else !== undefined && hasBindingDependentConditional(effect.else));
    case 'sequence':
    case 'parallel':
    case 'chain':
      return effect.steps.some(hasBindingDependentConditional);
    case 'choice':
      return effect.options.some(hasBindingDependentConditional);
    case 'optional':
      return hasBindingDependentConditional(effect.effect);
    case 'forEach':
      return hasBindingDependentConditional(effect.do);
    case 'repeatOptional':
      return hasBindingDependentConditional(effect.body);
    case 'replace':
      return hasBindingDependentConditional(effect.with);
    default:
      return false;
  }
}

/**
 * A Pattern-A atom kept in a continuation is still unresolved.  Calling the
 * runtime atom directly cannot replace `$pick`; it must cross the pick walker
 * again so the next human decision is surfaced.
 */
function hasUnresolvedPatternAPick(effect: Effect): boolean {
  switch (effect.kind) {
    case 'atom': {
      const args = effect.args as { uid?: unknown; target?: { kind?: unknown } };
      return args.uid === '$pick' && args.target?.kind === 'pick';
    }
    case 'sequence':
    case 'parallel':
    case 'chain':
      return effect.steps.some(hasUnresolvedPatternAPick);
    case 'choice':
      return effect.options.some(hasUnresolvedPatternAPick);
    case 'optional':
      return hasUnresolvedPatternAPick(effect.effect)
        || (effect.else !== undefined && hasUnresolvedPatternAPick(effect.else));
    case 'conditional':
      return hasUnresolvedPatternAPick(effect.then)
        || (effect.else !== undefined && hasUnresolvedPatternAPick(effect.else));
    case 'forEach':
      return hasUnresolvedPatternAPick(effect.do);
    case 'repeatOptional':
      return hasUnresolvedPatternAPick(effect.body);
    case 'replace':
      return hasUnresolvedPatternAPick(effect.with);
    default:
      return false;
  }
}

/**
 * A choice/optional behind a runtime pick was deliberately left raw to keep
 * printed decision order. It must cross the pre-walk when its continuation
 * starts; resolver.run() would otherwise take its legacy default branch.
 */
function hasDeferredPrewalkDecision(effect: Effect): boolean {
  switch (effect.kind) {
    case 'choice':
    case 'optional':
    case 'traitChoice':
    case 'repeatOptional':
      return true;
    case 'sequence':
    case 'parallel':
    case 'chain':
      return effect.steps.some(hasDeferredPrewalkDecision);
    case 'conditional':
      return hasDeferredPrewalkDecision(effect.then)
        || (effect.else !== undefined && hasDeferredPrewalkDecision(effect.else));
    case 'forEach':
      return hasDeferredPrewalkDecision(effect.do);
    case 'replace':
      return hasDeferredPrewalkDecision(effect.with);
    default:
      return false;
  }
}

function peelDeferredDecision(
  state: GameState,
  effect: Effect,
  ctx: EffectCtx,
  outer: ContinuationFrame | undefined,
  resumedChain = false,
): { effect: Effect; next: ContinuationFrame | undefined } {
  if (effect.kind === 'conditional') {
    const branch = evalCond(state, effect.if, ctx) ? effect.then : effect.else;
    if (branch && hasDeferredPrewalkDecision(branch)) {
      // The condition is evaluated at the continuation boundary, after the
      // preceding pick has populated its live bindings. Descend only into the
      // branch resolver.run would take; the other branch must never surface UI.
      return peelDeferredDecision(state, branch, ctx, outer, false);
    }
    return { effect, next: outer };
  }
  if ((effect.kind === 'sequence' || effect.kind === 'parallel' || effect.kind === 'chain')
    && effect.steps.length > 0
    && hasDeferredPrewalkDecision(effect)) {
    if (effect.kind === 'chain' && !resumedChain) {
      // Entering a new chain resets the previous sequence step's no-apply
      // signal, matching resolver.run(chain). A resumed chain tail preserves it.
      (ctx.dyn ??= {}).chainStepNoApply = false;
    }
    const rest = effect.steps.slice(1);
    const kind = effect.kind === 'chain' ? 'chain' : 'sequence';
    const next: ContinuationFrame | undefined = rest.length > 0
      ? { remainder: rest, ctx, kind, outer }
      : outer;
    return peelDeferredDecision(state, effect.steps[0]!, ctx, next, false);
  }
  return { effect, next: outer };
}

function appendDecisionContinuation(
  kind: 'choice' | 'optional' | 'repeatOptional',
  continuation: ContinuationFrame | undefined,
): void {
  if (!continuation) return;
  if (kind === 'choice') {
    setPendingChoiceContinuation(continuation);
    return;
  }
  if (kind === 'optional') {
    appendPendingOptionalContinuation(continuation);
    return;
  }
  setPendingEffectRepeatOptionalContinuation(continuation);
}

type ContinuationPendingBaseline = {
  pickQueueLength: number;
  reorder: ReturnType<typeof _peekPendingDeckReorderSide>;
  place: ReturnType<typeof _peekPendingDeckPlaceSide>;
  choice: ReturnType<typeof _peekPendingEffectChoiceSide>;
  rps: ReturnType<typeof _peekPendingRpsSide>;
  setCard: ReturnType<typeof _peekPendingSetCardChoiceSide>;
  setCardReplacement: ReturnType<typeof _peekPendingSetCardReplacementSide>;
  optional: ReturnType<typeof _peekPendingEffectOptionalSide>;
  repeat: ReturnType<typeof _peekPendingEffectRepeatOptionalSide>;
};

function snapshotContinuationPending(): ContinuationPendingBaseline {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  return {
    pickQueueLength: g.__pendingEffectPickQueue?.length ?? 0,
    reorder: _peekPendingDeckReorderSide(),
    place: _peekPendingDeckPlaceSide(),
    choice: _peekPendingEffectChoiceSide(),
    rps: _peekPendingRpsSide(),
    setCard: _peekPendingSetCardChoiceSide(),
    setCardReplacement: _peekPendingSetCardReplacementSide(),
    optional: _peekPendingEffectOptionalSide(),
    repeat: _peekPendingEffectRepeatOptionalSide(),
  };
}

function runContinuationChain(
  state: GameState,
  head: ContinuationFrame | undefined,
  decisionTrace?: CausalEffectTrace,
  initialBaseline?: ContinuationPendingBaseline,
): void {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  if (decisionTrace !== undefined) {
    for (let frame = head; frame; frame = frame.outer) {
      bindEffectCausalTrace(frame.ctx, decisionTrace);
    }
  }
  let f: ContinuationFrame | undefined = head;
  let pendingBaseline = initialBaseline;
  while (f) {
    // A human-resolved atom is executed outside resolver's `chain` loop.  If
    // it was a no-op, preserve the chain gate before running the saved tail.
    // Outer sequence frames still continue; an outer chain sees the same gate
    // and stops as it would during uninterrupted resolution.
    if (f.kind === 'chain' && f.ctx.dyn?.chainStepNoApply === true) {
      f = f.outer;
      continue;
    }
    const before = pendingBaseline ?? snapshotContinuationPending();
    pendingBaseline = undefined;
    const qBefore = before.pickQueueLength;
    const reorderBefore = before.reorder;
    const placeBefore = before.place;
    const choiceBefore = before.choice;
    const rpsBefore = before.rps;
    const setCardBefore = before.setCard;
    const setCardReplacementBefore = before.setCardReplacement;
    const optionalBefore = before.optional;
    const repeatBefore = before.repeat;
    let nextFrame = f.outer;
    let remainderEffect: Effect = f.remainder.length === 1
      ? f.remainder[0]!
      : { kind: f.kind, steps: f.remainder };
    // resolveEffectPicks intentionally treats chain as opaque. Peel any nested
    // sequence/chain wrapper one step at a time until its decision can surface,
    // retaining every remainder as an actual frame with its original gate/ctx.
    if (hasDeferredPrewalkDecision(remainderEffect)) {
      const peeled = peelDeferredDecision(state, remainderEffect, f.ctx, f.outer, f.kind === 'chain');
      remainderEffect = peeled.effect;
      nextFrame = peeled.next;
    }
    // A preceding picked atom can create a binding which selects a later
    // conditional branch. Re-walk only this deferred shape: a blanket
    // re-walk changes already-resolved Pattern-B target queries (B06025).
    let resolvedRemainder = remainderEffect;
    if (hasBindingDependentConditional(remainderEffect)
      || hasUnresolvedPatternAPick(remainderEffect)
      || hasDeferredPrewalkDecision(remainderEffect)) {
      const byPlayer = f.ctx.source.player;
      const runtimeDyn = f.ctx.dyn as Record<string, unknown> | undefined;
      const knownOwner = runtimeDyn?.['runtimePickOwnerKnown'] === true;
      const rememberedHuman = runtimeDyn?.['runtimeHumanPlayer'];
      const humanSide: Player | null = rememberedHuman === 'self' || rememberedHuman === 'opp'
        ? rememberedHuman
        : null;
      resolvedRemainder = resolveEffectPicks(state, remainderEffect, f.ctx, {
        byPlayer,
        chooseAtomTarget: rememberedRuntimeAtomTargetPolicy(f.ctx),
        humanChooser: knownOwner ? humanSide === byPlayer : true,
        ...(knownOwner ? { humanPlayer: humanSide } : {}),
        source: { cardId: f.ctx.source.cardId ?? '', abilityId: f.ctx.source.abilityId ?? '' },
      });
    }
    runEffect(state, resolvedRemainder as never, f.ctx);
    const qAfter = g.__pendingEffectPickQueue?.length ?? 0;
    const reorderAfter = _peekPendingDeckReorderSide();
    const placeAfter = _peekPendingDeckPlaceSide();
    const choiceAfter = _peekPendingEffectChoiceSide();
    const rpsAfter = _peekPendingRpsSide();
    const setCardAfter = _peekPendingSetCardChoiceSide();
    const setCardReplacementAfter = _peekPendingSetCardReplacementSide();
    const optionalAfter = _peekPendingEffectOptionalSide();
    const repeatAfter = _peekPendingEffectRepeatOptionalSide();
    if (reorderAfter && reorderAfter !== reorderBefore) {
      if (nextFrame) _attachPendingDeckReorderContinuation(nextFrame, true);
      return;
    }
    if (placeAfter && placeAfter !== placeBefore) {
      if (nextFrame) _attachPendingDeckPlaceContinuation(nextFrame, true);
      return;
    }
    if (qAfter > qBefore) {
      // remainder 自身が再 pause → 残り outer frames を新 pick (queue[qBefore]) の continuation 末尾に append。
      // (resolver が intra-frame remainder を既に同梱していれば、その outer 末尾に連結される。)
      const firstNew = g.__pendingEffectPickQueue?.[qBefore];
      if (firstNew) {
        const tail = nextFrame ?? { remainder: [], ctx: f.ctx, kind: 'sequence' as const };
        if (!firstNew.continuation) firstNew.continuation = tail;
        else { let t = firstNew.continuation; while (t.outer) t = t.outer; t.outer = tail; }
      }
      return;
    }
    if (choiceAfter && choiceAfter !== choiceBefore) {
      appendDecisionContinuation('choice', nextFrame);
      return;
    }
    if (rpsAfter && rpsAfter !== rpsBefore) {
      if (nextFrame) appendPendingRpsContinuation(nextFrame);
      delete (f.ctx.dyn as Record<string, unknown> | undefined)?.['rpsPending'];
      return;
    }
    if (optionalAfter && optionalAfter !== optionalBefore) {
      appendDecisionContinuation('optional', nextFrame);
      return;
    }
    if (repeatAfter && repeatAfter !== repeatBefore) {
      appendDecisionContinuation('repeatOptional', nextFrame);
      return;
    }
    if (setCardAfter && setCardAfter !== setCardBefore) {
      if (nextFrame) appendPendingSetCardChoiceContinuation(nextFrame);
      delete (f.ctx.dyn as Record<string, unknown> | undefined)?.['setCardChoicePending'];
      return;
    }
    if (setCardReplacementAfter && setCardReplacementAfter !== setCardReplacementBefore) {
      setPendingSetCardReplacementContinuation({
        remainder: [],
        ctx: f.ctx,
        kind: 'sequence',
        ...(nextFrame ? { outer: nextFrame } : {}),
      });
      return;
    }
    f = nextFrame;
  }
  // Observer effects queued by a carrier or remainder resolve only after the
  // original effect has completed every continuation frame.
  runAllUntilEmpty(state);
}

/** Human dispatch is untrusted. Enforce the same multi-pick constraints as UI and AI. */
function validatePendingPick(
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
): { pickedUid: string; pickedUids?: string[] } {
  const uids = canonicalPendingPickSelection(pending, pickedUids ?? [pickedUid]);
  const canonicalPrimary = findPendingPickCandidate(pending, pickedUid)?.uid;
  if (uids === null || canonicalPrimary === undefined) {
    throw new Error('effectPickResolve: unknown candidate uid');
  }
  const range = effectivePendingPickRange(pending);
  if (!uids.includes(canonicalPrimary)) throw new Error('effectPickResolve: pickedUid is absent from pickedUids');
  const violation = pendingPickSelectionViolation(pending, uids);
  if (violation) throw new Error(`effectPickResolve: ${violation}`);
  if (uids.length < range.min) {
    throw new Error(`effectPickResolve: picked count ${uids.length} is below-minimum ${range.min}`);
  }
  if (uids.length > range.max) {
    throw new Error(`effectPickResolve: picked count ${uids.length} exceeds ${range.max}`);
  }
  return {
    pickedUid: canonicalPrimary,
    ...(pickedUids !== undefined ? { pickedUids: uids } : {}),
  };
}

function tallyCardIds(ids: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

function assertSameCardMultiset(expected: readonly string[], actual: readonly string[]): void {
  if (actual.length !== expected.length) throw new Error('deckReorderResolve: wrong card count');
  const e = tallyCardIds(expected);
  const a = tallyCardIds(actual);
  if (e.size !== a.size) throw new Error('deckReorderResolve: card multiset mismatch');
  for (const [id, count] of e) {
    if (a.get(id) !== count) throw new Error('deckReorderResolve: card multiset mismatch');
  }
}

function hasSameCardMultiset(expected: readonly string[], actual: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const e = tallyCardIds(expected);
  const a = tallyCardIds(actual);
  if (e.size !== a.size) return false;
  for (const [id, count] of e) {
    if (a.get(id) !== count) return false;
  }
  return true;
}

function advanceDeckDecisionEpochAndRebaseContexts(
  state: GameState,
  pendingCtx: EffectCtx,
  continuation: ContinuationFrame | undefined,
  player: Player,
  occurrences: readonly { cardId: string; index: number }[],
  placements: readonly { cardId: string; index: number }[],
  insertedBeforeSurvivors = 0,
): void {
  const additionalContexts: EffectCtx[] = [];
  for (let frame = continuation; frame; frame = frame.outer) {
    additionalContexts.push(frame.ctx);
  }
  advanceDeckEpochAndRebaseBindings(
    state,
    pendingCtx,
    player,
    occurrences.map(occurrence => occurrence.index),
    {
      insertedBeforeSurvivors,
      relocatedOccurrences: deckOccurrenceRelocations(occurrences, placements),
      additionalContexts,
    },
  );
}

/** Confirm a human deck-bottom order, then resume the saved effect continuation. */
export function applyDeckReorderAndContinuation(
  state: GameState,
  pending: PendingDeckReorderSide,
  order: readonly string[],
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  assertSameCardMultiset(pending.cardIds, order);
  const deck = state.players[pending.player].deck;

  // Validate the untrusted response and current deck before emitting a causal decision.
  if (!pending.deckSnapshot || !pending.occurrences || !pending.ctx
    || typeof pending.occurrenceWitness !== 'string'
    || !isLiveCardOccurrenceWitness(state, pending.player, 'deck', pending.occurrenceWitness)) {
    throw new Error('deckReorderResolve: stale deck occurrence authority');
  }
  const occurrences = pending.occurrences;
  const pendingCtx = pending.ctx;
  if (deck.length !== pending.deckSnapshot.length
    || deck.some((cardId, index) => cardId !== pending.deckSnapshot![index])) {
    throw new Error('deckReorderResolve: stale deck snapshot');
  }
  if (occurrences.length !== pending.cardIds.length) {
    throw new Error('deckReorderResolve: stale occurrence count');
  }
  const indexes = new Set<number>();
  for (const occurrence of occurrences) {
    if (!Number.isInteger(occurrence.index)
      || occurrence.index < 0
      || occurrence.index >= deck.length
      || indexes.has(occurrence.index)
      || deck[occurrence.index] !== occurrence.cardId) {
      throw new Error('deckReorderResolve: stale or duplicate occurrence');
    }
    indexes.add(occurrence.index);
  }

  const causalCtx = pending.continuation?.ctx ?? pending.ctx;
  const storedTrace = pending.ctx?.causal?.trace ?? pending.continuation?.ctx.causal?.trace;
  const decisionTrace = causalCtx ? restoreEffectCausalTrace(causalCtx, storedTrace) : undefined;
  consumePersistedDeckDecisionAuthority(state, '__pendingDeckReorderSide', pending);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  withStructuredCausalResolution(state, () => {
    for (const occurrence of [...occurrences].sort((a, b) => b.index - a.index)) {
      deck.splice(occurrence.index, 1);
    }
    deck.push(...order);
    const firstPlacedIndex = deck.length - order.length;
    advanceDeckDecisionEpochAndRebaseContexts(
      state,
      pendingCtx,
      pending.continuation,
      pending.player,
      occurrences,
      order.map((cardId, offset) => ({ cardId, index: firstPlacedIndex + offset })),
    );
    if (pending.continuation) runContinuationChain(state, pending.continuation, decisionTrace);
    else runAllUntilEmpty(state);
  }, decisionTrace);
  completeEffectCausalTrace(state, decisionTrace, causalCtx?.source.player ?? pending.player);
}

/** Confirm a human top/bottom split, then resume the same effect authority. */
export function applyDeckPlaceAndContinuation(
  state: GameState,
  pending: PendingDeckPlaceSide,
  top: readonly string[],
  bottom: readonly string[],
): boolean {
  if (stopIfGameAlreadyEnded(state)) return false;
  if (!hasSameCardMultiset(pending.cardIds, [...top, ...bottom])) return false;
  if (!pending.deckSnapshot || !pending.occurrences || !pending.ctx
    || typeof pending.occurrenceWitness !== 'string'
    || !isLiveCardOccurrenceWitness(state, pending.player, 'deck', pending.occurrenceWitness)) return false;

  const deck = state.players[pending.player].deck;
  if (deck.length !== pending.deckSnapshot.length
    || deck.some((cardId, index) => cardId !== pending.deckSnapshot![index])) return false;
  if (pending.occurrences.length !== pending.cardIds.length
    || !hasSameCardMultiset(pending.cardIds, pending.occurrences.map((entry) => entry.cardId))) return false;

  const indexes = new Set<number>();
  for (const occurrence of pending.occurrences) {
    if (!Number.isInteger(occurrence.index)
      || occurrence.index < 0
      || occurrence.index >= deck.length
      || indexes.has(occurrence.index)
      || deck[occurrence.index] !== occurrence.cardId) return false;
    indexes.add(occurrence.index);
  }

  const causalCtx = pending.continuation?.ctx ?? pending.ctx;
  const storedTrace = pending.ctx.causal?.trace ?? pending.continuation?.ctx.causal?.trace;
  const decisionTrace = restoreEffectCausalTrace(causalCtx, storedTrace);
  consumePersistedDeckDecisionAuthority(state, '__pendingDeckPlaceSide', pending);
  recordEffectCausalDecision(state, decisionTrace, pending.ownerPlayer);
  withStructuredCausalResolution(state, () => {
    for (const occurrence of [...pending.occurrences!].sort((a, b) => b.index - a.index)) {
      deck.splice(occurrence.index, 1);
    }
    deck.unshift(...top);
    deck.push(...bottom);
    const bottomStart = deck.length - bottom.length;
    advanceDeckDecisionEpochAndRebaseContexts(
      state,
      pending.ctx,
      pending.continuation,
      pending.player,
      pending.occurrences,
      [
        ...top.map((cardId, index) => ({ cardId, index })),
        ...bottom.map((cardId, offset) => ({ cardId, index: bottomStart + offset })),
      ],
      top.length,
    );
    if (pending.continuation) runContinuationChain(state, pending.continuation, decisionTrace);
    else runAllUntilEmpty(state);
  }, decisionTrace);
  completeEffectCausalTrace(state, decisionTrace, causalCtx.source.player);
  return true;
}

/**
 * pending pick を pickedUid(s) で解決し、保存された sequence/chain continuation があれば
 * **同一 ctx** で remainder を実行する (BUG-107: bind を step 間で共有)。
 * 呼出側は skip (pickedUid=null) を事前処理し、queue から該当 pending を取り除いておくこと。
 */
export function applyPickAndContinuation(
  state: GameState,
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
  switchRemoveUid?: string,
  switchRemoveUids?: string[],
  skipChooseIntercept = false,
  causalDecisionAlreadyRecorded = false,
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const canonical = validatePendingPick(pending, pickedUid, pickedUids);
  pickedUid = canonical.pickedUid;
  pickedUids = canonical.pickedUids;
  const interceptCtx = pending.continuation?.ctx ?? {
    source: {
      cardId: pending.source.cardId,
      uid: (pending.source as { uid?: string }).uid ?? '',
      abilityId: pending.source.abilityId,
      player: pending.player,
      area: pending.source.area ?? 'scene',
      ...(pending.source.resolutionKind ? { resolutionKind: pending.source.resolutionKind } : {}),
    },
    bindings: {},
  };
  const sceneEnterSwitchPick = isSceneEnterSwitchPickArgs(pending.atomArgs);
  if (sceneEnterSwitchPick
    && !isValidSceneEnterSwitchPickAuthority(
      pending.atomArgs,
      pending.player,
      pending.ownerPlayer,
      interceptCtx.source.player,
    )) {
    throw new Error('sceneEnter switch pick: invalid authority');
  }
  // Stacked-card candidates are identities, not card IDs. Revalidate their host
  // before any intercept is consumed or any causal decision is committed.
  let resolvedStackHostUid: string | undefined;
  if (pending.atomVerb === 'stackedCardPick') {
    const args = pending.atomArgs as { hostUid?: unknown; min?: unknown; max?: unknown };
    const hostUid = resolveBindRef(args.hostUid, interceptCtx);
    if (typeof hostUid !== 'string' || typeof args.min !== 'number' || typeof args.max !== 'number'
      || charMutator.selectStackedCardEntries(state, hostUid, pickedUids ?? [pickedUid], args.min, args.max) === null) {
      throw new Error('stackedCardPick: stale, duplicate, or below-minimum selection');
    }
    resolvedStackHostUid = hostUid;
  }
  let decisionTrace = restoreEffectCausalTrace(
    interceptCtx,
    pending.source.causalTrace ?? interceptCtx.causal?.trace,
  );
  const commitDecision = (): void => {
    if (!causalDecisionAlreadyRecorded) recordEffectCausalDecision(state, decisionTrace, pending.player);
  };
  if (!isLiveDeckRevealWindow(state, pending)) {
    consumeQueuedPick(state, pending);
    commitDecision();
    mutate.log.append(state, {
      ts: Date.now(), player: pending.player, turn: state.turn.number,
      action: 'effect:pick', result: 'stale-selection',
    });
    completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
    return;
  }
  const selectedIndexedOccurrencesAreLive = (pickedUids ?? [pickedUid]).every((uid) => {
    const candidate = findPendingPickCandidate(pending, uid);
    if (!candidate || (candidate.area !== 'deck' && candidate.area !== 'evidence' && candidate.area !== 'remove')) {
      return candidate !== undefined;
    }
    const index = candidate.index;
    if (typeof index !== 'number' || !Number.isInteger(index)
      || !isLiveCardOccurrenceWitness(state, candidate.player, candidate.area, candidate.occurrenceWitness)) return false;
    return candidate.area === 'evidence'
      ? state.players[candidate.player].evidence[index]?.cardId === candidate.cardId
      : candidate.area === 'deck'
        ? state.players[candidate.player].deck[index] === candidate.cardId
        : state.players[candidate.player].remove[index] === candidate.cardId;
  });
  if (!selectedIndexedOccurrencesAreLive) {
    // Resolve only the stale decision.  Never let a replacement occurrence
    // reach choose-intercept, atom execution, or a paused continuation.
    consumeQueuedPick(state, pending);
    commitDecision();
    mutate.log.append(state, {
      ts: Date.now(), player: pending.player, turn: state.turn.number,
      action: 'effect:pick', result: 'stale-selection',
    });
    completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
    return;
  }
  if (isStaleEffectEventUsePick(state, pending, pickedUid, pickedUids)) {
    // Consume only the stale UI decision.  In particular, do not create
    // bindings, logs, hooks, queued atoms, or continuation-side effects.
    consumeQueuedPick(state, pending);
    commitDecision();
    completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
    return;
  }
  // A hand card selected for effect-based entry can leave hand while the
  // decision is open. Do not let the stale candidate create a character from
  // an area it no longer occupies.
  if (pending.atomVerb === 'sceneEnter') {
    const selected = findPendingPickCandidate(pending, pickedUid);
    if (selected?.kind === 'card' && selected.area === 'hand'
      && !state.players[selected.player].hand.includes(selected.cardId)) {
    consumeQueuedPick(state, pending);
      commitDecision();
      completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
      return;
    }
  }
  if (sceneEnterSwitchPick) {
    const selected = findPendingPickCandidate(pending, pickedUid);
    const isLiveVictim = selected?.kind === 'char'
      && selected.player === pending.player
      && state.players[pending.player].scene.some((card) => card.uid === selected.uid)
      && state.players[pending.player].scene.length >= sceneCap(state, pending.player);
    if (!isLiveVictim) {
      consumeQueuedPick(state, pending);
      commitDecision();
      mutate.log.append(state, {
        ts: Date.now(), player: pending.player, turn: state.turn.number,
        action: 'effect:pick', result: 'stale-selection',
      });
      completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
      return;
    }
  }
  if (pending.atomVerb === 'charRemoveSetCard') {
    const selected = (pickedUids ?? [pickedUid]).map(uid => findPendingPickCandidate(pending, uid));
    const allCurrent = selected.every(candidate => {
      if (!candidate?.hostUid || !candidate.setCardInstanceId) return false;
      const host = state.players[candidate.player].scene.find(char => char.uid === candidate.hostUid);
      const entry = host?.setCards.find(card => card.instanceId === candidate.setCardInstanceId);
      return entry !== undefined
        && ((pending.atomArgs as { faceDownOnly?: boolean }).faceDownOnly !== true || !entry.faceUp);
    });
    if (!allCurrent) {
    consumeQueuedPick(state, pending);
      commitDecision();
      completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
      return;
    }
  }
    consumeQueuedPick(state, pending);
  commitDecision();
  if (!skipChooseIntercept && !sceneEnterSwitchPick) {
    for (const uid of pickedUids ?? [pickedUid]) {
      const intercept = findChooseIntercept(state, uid, interceptCtx);
      if (intercept.kind === 'cancel') {
        completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'cancel', { type: 'state', state: 'negated' });
        return;
      }
      if (intercept.kind === 'discard-or-cancel') {
        markEffectCausalAwaitingResume(decisionTrace);
        const resumedPending: PendingEffectPickSide = decisionTrace
          ? {
            ...pending,
            source: { ...pending.source, causalTrace: cloneCausalEffectTrace(decisionTrace) },
          }
          : pending;
        pushPendingChooseInterceptSide(
          {
            player: intercept.responder,
            ...(pending.publicHandRevealToken ? { publicHandRevealToken: pending.publicHandRevealToken } : {}),
            protector: { uid: intercept.protectorUid, cardId: intercept.protectorCardId, abilityId: intercept.abilityId },
            targetUid: uid,
          },
          { pending: resumedPending, pickedUid, pickedUids, switchRemoveUid, switchRemoveUids },
        );
        return;
      }
    }
  }
  // ---- resolved atom を build (Pattern A: uid='$pick' → uid 置換 / Pattern B: cardId(s)/target 置換) ----
  const pendingArgs = pending.atomArgs as { uid?: unknown };
  const isPatternA = pendingArgs.uid === '$pick';
  // mega-wave W6 step6 (2026-07-04, r79/B08014): human+AI 共有継続経路の MR 選択タグ —
  // resolve-picks.ts substituteAtomPick (AI 同期 walk) と対称実装 (BUG-158 型 両経路罠)。
  // source card = MR の時のみ、解決済み現場キャラ uid を `_mrSelectCharUids` として args に同梱
  // (turnEffects 書込は resolver.ts atom dispatch 前 guard)。非 MR は完全素通し。
  const w6IsMrSource = def.isMR(pending.source.cardId);
  const w6CharUidsOf = (uids: string[]): string[] =>
    uids.filter(u => state.players.self.scene.some(c => c.uid === u) || state.players.opp.scene.some(c => c.uid === u));
  const w6TagMr = (a: Record<string, unknown>, uids: string[]): Record<string, unknown> => {
    if (!w6IsMrSource) return a;
    const charUids = w6CharUidsOf(uids);
    return charUids.length > 0 ? { ...a, _mrSelectCharUids: charUids } : a;
  };
  let resolvedAtom: Effect;
  if (isPatternA) {
    const restoredSwitchArgs = sceneEnterSwitchPick
      ? resolveSceneEnterSwitchPickArgs(pending.atomArgs, pickedUid)
      : null;
    if (sceneEnterSwitchPick) {
      if (restoredSwitchArgs === null) {
        completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
        return;
      }
      resolvedAtom = { kind: 'atom', verb: 'sceneEnter', args: restoredSwitchArgs };
    } else {
      const { target: _omit, ...restArgs } = pending.atomArgs;
      void _omit;
      // engine-extension #3 (2026-06-05): multi-target Pattern A
      // pickedUids が複数なら各 uid に atom を per-char 適用する sequence にまとめる。
      // 単一なら従来通り (sequence wrap せずに atom のまま runEffect / event.queue)。
      const uids = (pickedUids && pickedUids.length > 1) ? pickedUids : [pickedUid];
      const setCardSelections = pending.atomVerb === 'charRemoveSetCard'
        ? uids.map(uid => findPendingPickCandidate(pending, uid))
        : [];
      if (setCardSelections.length > 0 && setCardSelections.every(candidate => candidate?.hostUid && candidate.setCardInstanceId)) {
        const atoms: Effect[] = setCardSelections.map(candidate => ({
          kind: 'atom' as const,
          verb: pending.atomVerb as never,
          args: {
            ...restArgs,
            uid: candidate!.hostUid,
            setCardInstanceId: candidate!.setCardInstanceId,
          },
        }));
        resolvedAtom = atoms.length === 1 ? atoms[0]! : { kind: 'sequence', steps: atoms };
      } else if (uids.length === 1) {
        resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: w6TagMr({ ...restArgs, uid: uids[0]! }, [uids[0]!]) };
      } else {
        const atoms: Effect[] = uids.map((u) => ({
          kind: 'atom' as const,
          verb: pending.atomVerb as never,
          args: w6TagMr({ ...restArgs, uid: u }, [u]),
        }));
        resolvedAtom = { kind: 'sequence', steps: atoms };
      }
    }
  } else {
    const resolvedCardId = resolveCardIdFromPickUid(pickedUid, state, pending);
    if (!resolvedCardId) {
      completeEffectCausalTrace(state, decisionTrace, interceptCtx.source.player, 'fizzle', { type: 'state', state: 'fizzled' });
      return;
    }
    const hasCardIdBind = (pending.atomArgs as { cardId?: unknown }).cardId === '$pick.cardId';
    const hasCardIdsBind = (pending.atomArgs as { cardIds?: unknown }).cardIds === '$pick.cardIds';
    const hasOccurrenceBind = (pending.atomArgs as { occurrence?: unknown }).occurrence === '$pick';
    const hasInstanceIdsBind = (pending.atomArgs as { selectedInstanceIds?: unknown }).selectedInstanceIds === '$pick.uids';
    const allUids: string[] = pickedUids ?? [pickedUid];
    const allCardIds: string[] = allUids
      .map((u) => resolveCardIdFromPickUid(u, state, pending))
      .filter((c): c is string => typeof c === 'string');
    // Deck candidate uid carries the selected occurrence as `${cardId}#${index}`.
    // Preserve it because card IDs alone cannot distinguish duplicate copies.
    const selectedCandidates = allUids.map((uid) => findPendingPickCandidate(pending, uid));
    const selectedDeckIndexes = allUids.map((uid, position) => {
      const candidateIndex = selectedCandidates[position]?.index;
      if (typeof candidateIndex === 'number') return candidateIndex;
      const legacy = /#(\d+)$/.exec(uid);
      return legacy ? Number(legacy[1]) : undefined;
    });
    const selectedCardOccurrences = selectedCandidates.flatMap((candidate) => {
      if (candidate?.kind === 'card'
        && typeof candidate.index === 'number'
        && typeof candidate.area === 'string') {
        return [{
          uid: cardOccurrenceUid(candidate.player, candidate.area, candidate.cardId, candidate.index),
          cardId: candidate.cardId,
          area: candidate.area,
          player: candidate.player,
          index: candidate.index,
          ...(candidate.occurrenceWitness === undefined ? {} : { occurrenceWitness: candidate.occurrenceWitness }),
        }];
      }
      if (candidate?.kind === 'evidence' && typeof candidate.index === 'number') {
        const cardId = state.players[candidate.player].evidence[candidate.index]?.cardId;
        return cardId === undefined ? [] : [{
          uid: `evidence:${candidate.player}:${candidate.index}`,
          cardId,
          area: 'evidence' as const,
          player: candidate.player,
          index: candidate.index,
          occurrenceWitness: candidate.occurrenceWitness
            ?? cardOccurrenceWitness(state, candidate.player, 'evidence'),
        }];
      }
      return [];
    });
    const selectedOccurrencePart = selectedCardOccurrences.length === allUids.length
      ? { selectedCardOccurrences }
      : {};
    // Scene candidates are character-shaped, but an invoked card ability needs
    // the same physical occurrence contract as evidence/remove candidates.
    const selectedOccurrence = selectedCandidates.length === 1 && selectedCandidates[0]
      ? selectedCandidates[0]!.kind === 'char'
        ? { ...selectedCandidates[0], area: 'scene' as const }
        : selectedCandidates[0]
      : undefined;
    // switch-on-effect-enter: sceneEnter が現場満杯のとき UI が収集した switch 退場 uid を
    // 解決済 atom args に載せる (handler が switchEnter する)。他 atom には影響しない (未指定なら付かない)。
    // cluster14: multi-card sceneEnter は switchRemoveUids[] (plural, overflow 枚数ぶん) を優先。
    //   順序維持 (plural→singular→{}) で単一 sceneEnter (switchRemoveUid) path は byte 不変。
    const switchPart = (switchRemoveUids && switchRemoveUids.length > 0)
      ? { switchRemoveUids }
      : switchRemoveUid ? { switchRemoveUid } : {};
    const newArgs: Record<string, unknown> = hasCardIdsBind
      ? { ...pending.atomArgs, cardIds: allCardIds, selectedDeckIndexes, ...selectedOccurrencePart, ...switchPart } // target は元の pick query を保持
      : hasCardIdBind
        ? { ...pending.atomArgs, cardId: resolvedCardId, selectedCardIndex: selectedDeckIndexes[0], ...selectedOccurrencePart, ...switchPart } // target は元の pick query を保持
        // BUG-165 (wave-10 2026-07-02): 旧 target:[resolvedCardId] は pickedUids (nMax>1 の複数選択、
        // UI Playmat multi-select / AI chooseAiPick が渡す) を握り潰し先頭 1枚に collapse していた
        // (B04005「手札を2枚リムーブする」が全経路 1枚しか落ちない / handReveal ★未対応(3) の bind 1枚問題)。
        // allCardIds = pickedUids ?? [pickedUid] の解決済全件 → n:1 は [resolvedCardId] と byte 同一。
        : hasOccurrenceBind && selectedOccurrence
          ? { ...pending.atomArgs, occurrence: selectedOccurrence, ...selectedOccurrencePart, ...switchPart }
        : {
          ...pending.atomArgs,
          target: allCardIds,
          selectedCardIndex: selectedDeckIndexes[0],
          selectedDeckIndexes,
          ...selectedOccurrencePart,
          ...switchPart,
        }; // 従来 pattern (handAddFromRemove 等)
    // W6 step6 (r79): Pattern B でも現場キャラ uid が選ばれた場合はタグ (scene 照合で char-kind 判別)
    if (hasInstanceIdsBind) newArgs.selectedInstanceIds = allUids;
    if (resolvedStackHostUid !== undefined) newArgs.hostUid = resolvedStackHostUid;
    resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: w6TagMr(newArgs, allUids) };
  }

  // ---- continuation (中断中 sequence/chain の残り step) を保存 ctx で実行 ----
  // BUG-111: continuation は pick 本体 (pending.continuation) に同梱されている (別 FIFO peek を廃止)。
  // これにより continuation を持たない pick が他 pick の continuation を誤消費する desync を排除。
  const chainCont = pending.continuation && pending.atomVerb !== 'sceneEnter'
    ? withContinuationSceneEnterSwitchChoice(pending.continuation, switchRemoveUid)
    : pending.continuation;
  if (chainCont) {
    decisionTrace = restoreEffectCausalTrace(chainCont.ctx, decisionTrace);
    // BUG-107: resolved atom と remainder を同一保存 ctx で runEffect → plain bindings を共有
    // (event.queue 経由は entry.bindings が Immer draft に取り込まれ bind が消えるため不可)。
    withStructuredCausalResolution(state, () => {
      // The selected atom can itself open a human decision. Wrap it so the
      // continuation boundary snapshots before that atom and pauses the saved
      // tail behind the newly-created decision.
      runContinuationChain(state, {
        remainder: [resolvedAtom],
        ctx: chainCont.ctx,
        kind: 'sequence',
        outer: chainCont,
      }, decisionTrace);
    // BUG-111 #2: multi-step remainder の wrap は origin kind で行う (sequence は chain-gate を持たない)。
    // BUG-111 family (nest): head → outer の順に frame 連鎖を実行 (再 pause は新 pick へ引継ぎ)。
    }, decisionTrace);
    completeEffectCausalTrace(state, decisionTrace, chainCont.ctx.source.player);
  } else {
    event.queue(
      state,
      resolvedAtom as never,
      // BUG-175: source.player は能力所有者 (chooser を渡すと相対 arg が二重反転 — B04058
      // 「相手は手札を1枚リムーブする」で self 手札を discard する誤り)。ownerPlayer 不在の
      // 旧 pending は player と同値 (chooser==owner) のため fallback で byte 等価。
      resumedEntrySource(pending.source, pending.ownerPlayer ?? pending.player),
      'effect:pick-resolved',
      { picked: pickedUid, source: pending.source },
      undefined,
      resumedEntryExtras({ ...pending.source, causalTrace: decisionTrace }),
    );
    runAllUntilEmpty(state);
  }
}

/** Resolve the dedicated discard-or-cancel response. Not discarding cancels the selected effect. */
export function applyChooseInterceptResponse(
  state: GameState,
  pending: PendingChooseInterceptSide,
  discardIndex: number | null,
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const resume = _peekPendingChooseInterceptResume();
  if (!resume) return;
  const cards = state.players[pending.player].hand;
  if (resume.guard && !sameChooseInterceptSide(resume.guard, pending)) {
    throw new Error('chooseIntercept: stale response');
  }
  if (discardIndex !== null
    && (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= cards.length)) {
    throw new Error('chooseIntercept: invalid discard occurrence');
  }
  const consumed = _takePendingChooseInterceptResume();
  if (!consumed) return;
  const causalCtx = consumed.pending.continuation?.ctx ?? {
    source: {
      cardId: consumed.pending.source.cardId,
      uid: consumed.pending.source.uid ?? '',
      abilityId: consumed.pending.source.abilityId,
      player: consumed.pending.ownerPlayer ?? consumed.pending.player,
      area: consumed.pending.source.area ?? 'scene',
      ...(consumed.pending.source.resolutionKind ? { resolutionKind: consumed.pending.source.resolutionKind } : {}),
    },
    bindings: {},
  };
  const decisionTrace = restoreEffectCausalTrace(causalCtx, consumed.pending.source.causalTrace ?? causalCtx.causal?.trace);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  if (discardIndex === null) {
    completeEffectCausalTrace(state, decisionTrace, causalCtx.source.player, 'cancel', { type: 'state', state: 'negated' });
    return;
  }
  const cardId = cards[discardIndex]!;
  withStructuredCausalResolution(state, () => {
    hand.discardToRemove(state, pending.player, [cardId], { byPlayer: pending.player });
    recordEffectCausalOperation(state, causalCtx, {
      actor: pending.player,
      kind: 'discard',
      source: { kind: 'zone', side: pending.player, zone: 'hand' },
      targets: [{ kind: 'zone', side: pending.player, zone: 'remove' }],
      outcome: { type: 'move', from: 'hand', to: 'remove', count: 1 },
    });
    const resumedPending: PendingEffectPickSide = decisionTrace
      ? { ...consumed.pending, source: { ...consumed.pending.source, causalTrace: cloneCausalEffectTrace(decisionTrace) } }
      : consumed.pending;
    applyPickAndContinuation(
      state,
      resumedPending,
      consumed.pickedUid,
      consumed.pickedUids,
      consumed.switchRemoveUid,
      consumed.switchRemoveUids,
      true,
      true,
    );
  }, decisionTrace);
}

function sameChooseInterceptSide(left: PendingChooseInterceptSide, right: PendingChooseInterceptSide): boolean {
  return left.player === right.player
    && left.targetUid === right.targetUid
    && left.publicHandRevealToken === right.publicHandRevealToken
    && left.protector.uid === right.protector.uid
    && left.protector.cardId === right.protector.cardId
    && left.protector.abilityId === right.protector.abilityId;
}

/**
 * BUG-132 GAP-1 (2026-06-12): skipResolvesAtom 付き pending の decline (pickedUid=null) 解決。
 * 通常 skip (pending 破棄 = continuation も drop) と異なり、「0枚選択」を atom の解決として実行し、
 * 残り step (デッキ下移動等の必須 step) を continuation で続行する (rules/15 「〜まで」=0枚可、
 * B08020 公式Q&A「加えないことは可能」— 加えなければ全 reveal が「残り」としてデッキ下へ)。
 * atom 側は args.__declined===true を見て空解決 ($matched=[] 等) を bind する。
 */
export function applyPickSkipAndContinuation(
  state: GameState,
  pending: PendingEffectPickSide,
  runDeclinedAtom = true,
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  if (pending.nMin > 0) {
    throw new Error(`${pending.atomVerb}: below-minimum selection`);
  }
  const head = pending.continuation;
  let decisionTrace = cloneCausalEffectTrace(pending.source.causalTrace);
  if (!isLiveDeckRevealWindow(state, pending)) {
    consumeQueuedPick(state, pending);
    recordEffectCausalDecision(state, decisionTrace, pending.player);
    mutate.log.append(state, {
      ts: Date.now(), player: pending.player, turn: state.turn.number,
      action: 'effect:pick', result: 'stale-selection',
    });
    completeEffectCausalTrace(state, decisionTrace, pending.ownerPlayer ?? pending.player, 'fizzle', { type: 'state', state: 'fizzled' });
    return;
  }
    consumeQueuedPick(state, pending);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  if (head) decisionTrace = restoreEffectCausalTrace(head.ctx, decisionTrace);
  // BUG-111 #2 (2026-06-16): runDeclinedAtom で declined head atom を再実行するか分岐する。
  //   - true (deckRevealUntil skipResolvesAtom): atom を __declined で再実行 (公開カードのデッキ下移動等、
  //     atom 側の必須 0枚解決を行う)。従来の唯一の挙動。
  //   - false (sequence-origin / chain-origin decline): declined 0-pick = 何もしない (rules/15) ため head atom を
  //     再実行せず remainder のみ実行する。単数 sceneEnter の __declined 未対応による pick 再 push を回避する。
  //     head の bind は unbound のままで、後続 conditional は boundMatchesFilter not-matched で正しく skip する。
  if (runDeclinedAtom) {
    const resolvedAtom: Effect = {
      kind: 'atom',
      verb: pending.atomVerb as never,
      args: { ...pending.atomArgs, __declined: true },
    };
    if (head) {
      // applyPickAndContinuation と同一の保存 ctx 共有 (BUG-107) — 空 bind が remainder から見える
      withStructuredCausalResolution(state, () => {
        runEffect(state, resolvedAtom as never, head.ctx);
        runAllUntilEmpty(state);
      }, decisionTrace);
    } else {
      event.queue(
        state,
        resolvedAtom as never,
        // BUG-175: decline 経路も同一座標系 (所有者) で再実行する
        resumedEntrySource(pending.source, pending.ownerPlayer ?? pending.player),
        'effect:pick-resolved',
        { picked: null, source: pending.source },
        undefined,
        resumedEntryExtras({ ...pending.source, causalTrace: decisionTrace }),
      );
      runAllUntilEmpty(state);
      return;
    }
    // deckRevealUntil: head.remainder (デッキ下移動等の必須 step) + outer を実行 (head から連鎖)。
    withStructuredCausalResolution(state, () => runContinuationChain(state, head, decisionTrace), decisionTrace);
    completeEffectCausalTrace(state, decisionTrace, head.ctx.source.player);
    return;
  }
  // runDeclinedAtom === false: 「〜してもよい」decline。
  //   - sequence-origin head: head.remainder は独立 step (mandatory) → 実行 (rules/15) + outer。
  //   - chain-origin head: head.remainder は「そうした場合」gate → skip。BUG-111 family (nest) では
  //     outer (= 外側 sequence の remainder。例 B06033 sceneEnter) のみ実行する (rules/25 gate は内側のみ)。
  if (!head) {
    completeEffectCausalTrace(state, decisionTrace, pending.ownerPlayer ?? pending.player);
    return;
  }
  if (head.kind === 'sequence') {
    withStructuredCausalResolution(state, () => runContinuationChain(state, head, decisionTrace), decisionTrace);
  } else {
    withStructuredCausalResolution(state, () => runContinuationChain(state, head.outer, decisionTrace), decisionTrace);
  }
  completeEffectCausalTrace(state, decisionTrace, head.ctx.source.player);
}

/**
 * BUG-121: pending choice を choiceIndex で解決し、選択 option を再開する。
 * applyPickAndContinuation の choice 版。再開すべき effect は resolve-picks の engine holder
 * (__pendingEffectChoiceResume) から取り出す:
 *   - top-level choice (B06007): holder = choice 効果そのもの → unwrap で選択 option が返る。
 *   - sequence 内 choice: holder = {sequence:[choice, ...remainder]} → option + remainder のみ実行
 *     (pre-choice step は初回 runtime で実行済のため二重実行しない)。
 * choiceIndex 付きで resolveEffectPicks 再 walk → choice unwrap。選択 option 内に $pick
 * (例 B06007 option2 sceneToHand 短縮形) があれば humanChooser walk で __pendingEffectPickQueue に
 * 再 push され、既存 effectPickResolve 経路で連鎖消化される。
 */
export function applyChoiceAndContinuation(
  state: GameState,
  pending: PendingEffectChoiceSide,
  choiceIndex: number,
  switchRemoveUid?: string,
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  if (!Number.isInteger(choiceIndex) || !pending.options.some(option => option.index === choiceIndex)) {
    throw new Error(`effect.run: choice index ${choiceIndex} out of range`);
  }
  if (getPendingChoiceResume() === null) return;
  const resumeEffect = _takePendingChoiceResume();
  if (!resumeEffect) return;
  consumeQueuedChoice(pending);
  const continuation = _takePendingChoiceContinuation();
  // BUG-114: choice surface 時の bindings (cutin の $contact.* 等) を resume ctx へ復元。
  const resumeBindings = _takePendingChoiceBindings() ?? {};
  const sourcePlayer = continuation?.ctx.source.player ?? pending.sourcePlayer ?? pending.player;
  // 再 walk 用 ctx (triggered.ts の resolveCtx と同 shape の plain object、Immer draft 非由来)。
  // source.uid は option1 (charGrantKeyword uid:'$self') の $self 解決 + event.queue source に使用。
  const ctx: EffectCtx = continuation?.ctx ?? {
    source: {
      cardId: pending.source.cardId,
      uid: pending.source.uid,
      abilityId: pending.source.abilityId,
      player: sourcePlayer,
      area: pending.source.area ?? 'scene',
      ...(pending.source.resolutionKind ? { resolutionKind: pending.source.resolutionKind } : {}),
    },
    bindings: resumeBindings as EffectCtx['bindings'],
    dyn: { choiceIndex },
  };
  if (continuation) {
    Object.assign(ctx.bindings as Record<string, unknown>, resumeBindings);
    (ctx.dyn ??= {}).choiceIndex = choiceIndex;
  }
  if (pending.publicHandRevealToken) {
    (ctx.causal ??= {}).publicHandRevealToken = pending.publicHandRevealToken;
  }
  const decisionTrace = restoreEffectCausalTrace(ctx, pending.source.causalTrace);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  const pendingBeforeResolve = snapshotContinuationPending();
  const resolved = withSceneEnterSwitchChoice(resolveEffectPicks(state, resumeEffect, ctx, {
    byPlayer: pending.player,
    humanChooser: true,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  }), switchRemoveUid);
  if (continuation) {
    withStructuredCausalResolution(state, () => runContinuationChain(state, {
      remainder: [resolved], ctx, kind: 'sequence', outer: continuation,
    }, decisionTrace, pendingBeforeResolve), decisionTrace);
    completeEffectCausalTrace(state, decisionTrace, ctx.source.player);
    return;
  }
  event.queue(
    state,
    resolved as never,
    resumedEntrySource(pending.source, sourcePlayer),
    'effect:choice-resolved',
    { choiceIndex, source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId } },
    // BUG-114: 復元した contact bindings を queue の bindings 引数 (6th) に渡し、entry → runtime ctx.bindings
    // へ伝達する (選択 option の $contact.byUid 等が runAllUntilEmpty 実行時に解決される)。
    resumeBindings as Record<string, unknown[]>,
    {
      ...resumedEntryExtras({ ...pending.source, causalTrace: decisionTrace }),
      ...(pending.publicHandRevealToken ? { publicHandRevealToken: pending.publicHandRevealToken } : {}),
    },
  );
  runAllUntilEmpty(state);
}

/**
 * 2026-06-06 タスクC: pending optional を run(boolean) で解決し、optional 効果を再開する。
 * applyChoiceAndContinuation の boolean 版。再開すべき optional 効果は engine holder
 * (__pendingEffectOptionalResume) から取り出す。ctx.dyn.optionalRun=run を渡して再 walk すると
 * resolveEffectPicks の optional case が:
 *   - run=true  → 内部 effect を walk (内部の $pick は __pendingEffectPickQueue へ再 push)。
 *   - run=false → no-op (空 parallel) を返す。
 * を行い、結果を queue → runAllUntilEmpty で実行する。
 */
export function applyOptionalAndContinuation(
  state: GameState,
  pending: PendingEffectOptionalSide,
  run: boolean,
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const resumeEffect = _takePendingOptionalResume();
  if (!resumeEffect) return;
  consumeQueuedOptional(pending);
  const continuation = _takePendingOptionalContinuation();
  // engine wave-18: surface 時の contact bindings を復元。ctx.bindings 自体は fresh {} のままにする —
  // resume walk は contact を必要とせず (optional 内 inContact pick / $contact.* は queue → runtime entryToCtx で
  // 解決)、resumeBindings を ctx.bindings に alias すると inner の bind 書込 ($entered 等) が下の queue 6th arg
  // (entry.bindings) を汚染し既存 optional (B09038 sceneEnter 等) を壊す。よって contact は 6th arg 経由でのみ伝達。
  const resumeBindings = _takePendingOptionalBindings();
  const hasResumeBindings = resumeBindings != null && Object.keys(resumeBindings).length > 0;
  // WC2b: surface 時に保持した costPaid を復元 (optional 内 $cost.* 参照用、B06023)。null は従来挙動。
  const resumeCostPaid = _takePendingOptionalCostPaid();
  const ctx: EffectCtx = continuation?.ctx ?? {
    source: {
      cardId: pending.source.cardId,
      uid: pending.source.uid,
      abilityId: pending.source.abilityId,
      player: pending.ownerPlayer ?? pending.player,
      area: pending.source.area ?? 'scene',
      ...(pending.source.resolutionKind ? { resolutionKind: pending.source.resolutionKind } : {}),
    },
    bindings: {},
    dyn: { optionalRun: run },
    // 2026-06-06 タスクC: optional 内の $trigger.<field> (B03038 の $trigger.gained 等) を解決可能に
    triggerPayload: (pending as { triggerPayload?: unknown }).triggerPayload,
    // WC2b: $cost.* (invokeHiramekiOfCard cardIds) は runtime (entryToCtx) 解決なので下の queue entryExtras
    // へも渡す。resume walk 自体の pre-walk でも参照できるよう ctx にも載せる。
    ...(resumeCostPaid ? { costPaid: resumeCostPaid } : {}),
  };
  if (continuation) {
    (ctx.dyn ??= {}).optionalRun = run;
    if (resumeCostPaid) ctx.costPaid = resumeCostPaid;
  }
  // Declining the optional consumes its causal reveal. Do not carry it into a
  // later continuation, which is a sibling rather than the revealed target.
  if (run && pending.publicHandRevealToken) {
    (ctx.causal ??= {}).publicHandRevealToken = pending.publicHandRevealToken;
  }
  const decisionTrace = restoreEffectCausalTrace(ctx, pending.source.causalTrace);
  recordEffectCausalDecision(state, decisionTrace, pending.player);
  const pendingBeforeResolve = snapshotContinuationPending();
  const resolved = resolveEffectPicks(state, resumeEffect, ctx, {
    byPlayer: pending.ownerPlayer ?? pending.player,
    humanChooser: true,
    humanPlayer: pending.player,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  });
  if (continuation) {
    withStructuredCausalResolution(state, () => runContinuationChain(state, {
      remainder: [resolved], ctx, kind: 'sequence', outer: continuation,
    }, decisionTrace, pendingBeforeResolve), decisionTrace);
    completeEffectCausalTrace(state, decisionTrace, ctx.source.player);
    return;
  }
  // 2026-06-06 タスクC: payload に元 triggerPayload を載せて queue する (あれば)。これで runtime ctx
  // (entryToCtx) が triggerPayload を持ち、resumed effect 内の $trigger.<field> (B03038 evidenceToDeck の
  // $trigger.gained 等) が実行時に解決される。triggerPayload 無し (通常 optional) は従来の {run, source} marker。
  const optTriggerPayload = (pending as { triggerPayload?: unknown }).triggerPayload;
  event.queue(
    state,
    resolved as never,
    resumedEntrySource(pending.source, pending.ownerPlayer ?? pending.player),
    'effect:optional-resolved',
    optTriggerPayload ?? { run, source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId } },
    // engine wave-18: 復元した contact bindings を queue 6th arg で entry → runtime ctx.contact へ伝達
    // (optional 内 $contact.* / inContact pick が runAllUntilEmpty 実行時に entryToCtx で解決される)。
    // 非空 (contact 有) のときのみ渡す — 空 optional (B09038 等) は従来通り bindings 省略 = 挙動不変。
    hasResumeBindings ? (resumeBindings as Record<string, unknown[]>) : undefined,
    // WC2b: costPaid を entry へ永続化 → runtime entryToCtx が復元し optional 内 $cost.* を解決 (B06023)。
    {
      ...resumedEntryExtras({ ...pending.source, causalTrace: decisionTrace }),
      ...(resumeCostPaid ? { costPaid: resumeCostPaid } : {}),
      ...(run && pending.publicHandRevealToken ? { publicHandRevealToken: pending.publicHandRevealToken } : {}),
    },
  );
  runAllUntilEmpty(state);
}

/** AI 経路の pick 候補選択 (PA char pick は policy.chooseAtomTarget、それ以外 / fallback は先頭採用)。 */
type AtomTargetChooser = (
  state: GameState,
  verb: string,
  args: Readonly<Record<string, unknown>>,
  cands: ReadonlyArray<Candidate>,
  byPlayer: Player,
) => Candidate | null;

function chooseAiPick(
  state: GameState,
  pending: PendingEffectPickSide,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): { pickedUid: string | null; pickedUids?: string[] } {
  const cands = pending.candidates;
  if (cands.length === 0) return { pickedUid: null };
  // PA char pick 用に Candidate(kind:'char') を再構築して heuristic に渡す。
  // (非 char verb は chooseAtomTarget が null を返し先頭採用 fallback されるため安全。)
  const charCands: Candidate[] = cands.map(
    (c) => ({ kind: 'char', uid: c.uid, cardId: c.cardId, player: c.player }) as unknown as Candidate,
  );
  const chosen = policy?.chooseAtomTarget?.(state, pending.atomVerb, pending.atomArgs, charCands, pending.player);
  const preferred = (chosen as { uid?: string } | null | undefined)?.uid;
  const selected = maximumFeasiblePendingPickSelection(pending, preferred ? [preferred] : []);
  if (selected.length === 0) return { pickedUid: null };
  return selected.length > 1
    ? { pickedUid: selected[0]!, pickedUids: selected }
    : { pickedUid: selected[0]! };

  /* Legacy greedy implementation replaced by the shared exact selector.
  // W2b (P50/r27): mustBeSelectedByOppEvent の forced 集合 (pending.forcedUids、push 時算出) を honor。
  // 「必ず選ぶ」— 単一 pick は forced 先頭が heuristic を上書き、multi は forced を先頭合流して
  // nMax clamp (min(forced, nMax) 枚、公式Q&A)。forced 不在は従来 byte 等価。
  const forced = (pending.forcedUids ?? []).filter((u) => cands.some((c) => c.uid === u));
  // chosen は kind:'char' (uid あり) のみ渡しているため uid を持つが、Candidate union 上は narrow 不能 → cast。
  const pickedUid = forced[0] ?? (chosen as { uid?: string } | null | undefined)?.uid ?? cands[0]!.uid;
  if (pending.nMax > 1) {
    // cluster14: distinctNames (「それぞれカード名の異なる」B09010) 時は UI(CardListModal isDistinctNamesBlocked)
    //   と同義 incremental dedup — 既選択候補の name component(rules/19 split-name) と1つでも衝突したら skip。
    // forced は dedup walk / greedy の先頭に来るよう並べ替える (forced 0 件は元順 = byte 等価)。
    const orderedCands = forced.length > 0
      ? [...cands.filter((c) => forced.includes(c.uid)), ...cands.filter((c) => !forced.includes(c.uid))]
      : cands;
    // engine mega-wave W4 (2026-07-03, r84): perSideMax (「自分と相手で1枚ずつ」B08019 a2) — distinctNames
    // と同型の greedy walk (side 別 counter)。両 flag 併用時は perSideMax gate → name-dedup の順で複合。
    if (pending.distinctNames === true || pending.distinctLevel === true || pending.distinctColors === true || typeof pending.perSideMax === 'number' || typeof pending.aggregateLevelMax === 'number') {
      const seen = new Set<string>();
      const seenLv = new Set<number>(); // Cluster WB1 (2026-07-11, B09105): distinctLevel greedy dedup
      const seenColors = new Set<string>();
      const bySide: Record<string, number> = {};
      let totalLevel = 0;
      const chosen: string[] = [];
      for (const c of orderedCands) {
        if (chosen.length >= pending.nMax) break;
        if (typeof pending.perSideMax === 'number') {
          const side = (c as { player?: string }).player ?? '?';
          if ((bySide[side] ?? 0) >= pending.perSideMax) continue;
        }
        if (pending.distinctNames === true) {
          const d = def.card(c.cardId);
          const comps = d ? allCardNameComponentsForDef(d, c.kind === 'card' ? c.area : undefined) : [c.cardId];
          if (comps.some((x) => seen.has(x))) continue;
          comps.forEach((x) => seen.add(x));
        }
        // Cluster WB1: distinctLevel — 既選択と同レベルは skip (「それぞれレベルの異なる」B09105)。
        if (pending.distinctLevel === true) {
          const lv = def.card(c.cardId)?.level;
          if (typeof lv === 'number') {
            if (seenLv.has(lv)) continue;
            seenLv.add(lv);
          }
        }
        const level = def.card(c.cardId)?.level ?? 0;
        if (typeof pending.aggregateLevelMax === 'number' && totalLevel + level > pending.aggregateLevelMax) continue;
        if (pending.distinctColors === true) {
          const colors = def.card(c.cardId)?.colors ?? [];
          if (colors.some(color => seenColors.has(color))) continue;
          colors.forEach(color => seenColors.add(color));
        }
        if (typeof pending.perSideMax === 'number') {
          const side = (c as { player?: string }).player ?? '?';
          bySide[side] = (bySide[side] ?? 0) + 1;
        }
        totalLevel += level;
        chosen.push(c.uid);
      }
      return { pickedUid: chosen[0] ?? pickedUid, pickedUids: chosen };
    }
    // multi-pick: greedy に nMax まで取る (取れるだけ取る heuristic、resolve-picks の cardIds 経路と整合)
    return { pickedUid, pickedUids: orderedCands.slice(0, pending.nMax).map((c) => c.uid) };
  }
  return { pickedUid };
  */
}

/**
 * AI/CPU 経路で __pendingEffectPickQueue を順次 drain する。PA 短縮形 atom 等が runtime に
 * tryRePickFromAtom で積んだ pick を heuristic 解決し、continuation も進める (BUG-109)。
 * policy.playTurn が applyMove + runAllUntilEmpty 後に呼ぶ (human modal を持たない側の補完)。
 */
export function drainAiEffectPicks(
  state: GameState,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): void {
  if (stopIfGameAlreadyEnded(state)) return;
  const g = globalThis as {
    __pendingEffectPickQueue?: PendingEffectPickSide[];
    __humanPlayerSide?: 'self' | 'opp' | null;
  };
  // BUG-138 (wave#2 cluster2 X8): human 所有の pending は AI が横取り解決しない (rules/15
  // 未解決効果は所有者が解決)。__humanPlayerSide (BUG-132 導入の human 検出 side-channel) が
  // set のときのみ skip — smoke / spectator は null のため従来挙動 byte-equal。
  // skip した human pending は queue に温存され、playTurn の humanPick pause →
  // useOppTurnDriver.surfacePendingSideChannels が UI modal へ転送する。
  const humanSide = g.__humanPlayerSide ?? null;
  let guard = 0;
  let i = 0;
  while (i < (g.__pendingEffectPickQueue?.length ?? 0)) {
    if (++guard > 64) break; // 安全弁 (1 ターンの pick 数が 64 を超えることは無い)
    const q = g.__pendingEffectPickQueue!;
    const pending = q[i]!;
    if (humanSide !== null && pending.player === humanSide) {
      i++; // human 所有 → 温存 (同一所有者内の FIFO 順は維持される)
      continue;
    }
    q.splice(i, 1); // 解決対象を queue から取り出す (humanSide null なら i=0 のままで従来 shift と同一)
    const { pickedUid, pickedUids } = chooseAiPick(state, pending, policy);
    if (pickedUid === null) {
      // cluster14: skipResolvesAtom 付き pending (0枚=「〜まで」で必須 continuation あり、B09010 の
      //   FILE上1リムーブ等) は、human path (useEngineDispatch skipResolvesAtom 分岐) と対称に
      //   applyPickSkipAndContinuation で remainder を実行する (rules/15 「〜まで」=0枚可 + 公式Q&A)。
      if (pending.skipResolvesAtom === true) {
        applyPickSkipAndContinuation(state, pending);
        continue;
      }
      // BUG-111 #2 / family (nest): continuation があれば head の kind で gate しつつ実行する。
      //   sequence-origin → head.remainder (mandatory) + outer / chain-origin → outer のみ (「そうした場合」gate)。
      //   chain-origin で outer 無し (standalone chain) は no-op = 従来の drop と同一。
      //   AI は通常 greedy で decline しない (chooseAiPick は候補空のときのみ null) ため本枝は主に防御的。
      if (pending.continuation) {
        applyPickSkipAndContinuation(state, pending, false);
        continue;
      }
      // 候補 0 + continuation 無し → 純粋 skip。
      continue;
    }
    applyPickAndContinuation(state, pending, pickedUid, pickedUids);
    if (state.gameResult !== undefined) break;
  }
}

/**
 * テスト/ツール用: 所有権 (__humanPlayerSide) を無視して全 pending を drain する。
 * human modal の代行 (UI を介さず heuristic で確定) を行うテストハーネス専用 —
 * production コードからは呼ばないこと (BUG-138: 横取りの再導入になる)。
 */
export function _drainAllEffectPicksForTest(
  state: GameState,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): void {
  const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
  const saved = g.__humanPlayerSide ?? null;
  g.__humanPlayerSide = null;
  try {
    drainAiEffectPicks(state, policy);
  } finally {
    g.__humanPlayerSide = saved;
  }
}

/**
 * BUG-138/249: human 所有の未解決 decision (owner order / pick / optional / choice) が
 * engine 側に残っているか。playTurn が move 選択前に確認し、残っていれば
 * paused:{humanPick:true} で停止する (rules/05 効果解決中は次の行動に移れない /
 * rules/15 未解決効果は所有者が解決)。__humanPlayerSide 未設定 (null) なら常に false
 * — smoke / spectator は従来挙動 byte-equal。
 */
export function hasPendingHumanPick(state?: GameState): boolean {
  const g = globalThis as {
    __pendingEffectPickQueue?: PendingEffectPickSide[];
    __pendingEffectOptionalSide?: { player: 'self' | 'opp' } | null;
    __pendingEffectRepeatOptionalSide?: { player: 'self' | 'opp' } | null;
    __pendingEffectChoiceSide?: { player: 'self' | 'opp' } | null;
    __pendingDeckReorderSide?: { player: 'self' | 'opp' } | null;
    __pendingDeckPlaceSide?: {
      player: 'self' | 'opp';
      ownerPlayer: 'self' | 'opp';
    } | null;
    __pendingMisread?: {
      player: 'self' | 'opp';
    } | null;
    __pendingChooseInterceptSide?: { player: 'self' | 'opp' } | null;
    __pendingRpsSide?: { player: 'self' | 'opp' } | null;
    __pendingSetCardChoiceSide?: { player: 'self' | 'opp' } | null;
    __pendingSetCardReplacementSide?: { player: 'self' | 'opp' } | null;
    __humanPlayerSide?: 'self' | 'opp' | null;
  };
  const humanSide = g.__humanPlayerSide ?? null;
  if (humanSide === null) return false;
  if (state && pendingOwnerOrderGroup(state, humanSide).length >= 2) return true;
  if ((g.__pendingEffectPickQueue ?? []).some(p => p.player === humanSide)) return true;
  if (g.__pendingEffectOptionalSide?.player === humanSide) return true;
  if (g.__pendingEffectRepeatOptionalSide?.player === humanSide) return true;
  if (g.__pendingEffectChoiceSide?.player === humanSide) return true;
  if (g.__pendingDeckReorderSide?.player === humanSide) return true;
  if (g.__pendingDeckPlaceSide?.ownerPlayer === humanSide) return true;
  if (g.__pendingMisread?.player === humanSide) return true;
  if (g.__pendingChooseInterceptSide?.player === humanSide) return true;
  if (g.__pendingRpsSide?.player === humanSide) return true;
  if (g.__pendingSetCardChoiceSide?.player === humanSide) return true;
  if (g.__pendingSetCardReplacementSide?.player === humanSide) return true;
  return false;
}
