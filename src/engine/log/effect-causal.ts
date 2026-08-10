import type {
  CausalEffectTrace,
  CausalEventKind,
  CausalLogEntryV1,
  CausalOutcome,
  EffectCtx,
  GameState,
} from '@/engine/types';
import {
  appendCausal,
  isCausalLogEntry,
  type AppendCausalInput,
  type PublicCausalLocator,
} from './causal.js';

const structuredResolutionDepth = new WeakMap<object, number>();
const activeCausalTraceStack = new WeakMap<object, CausalEffectTrace[]>();
const activeCausalCorrelationStack = new WeakMap<object, string[]>();

export function withStructuredCausalResolution<T>(
  state: GameState,
  run: () => T,
  trace?: CausalEffectTrace,
): T {
  const key = state as object;
  structuredResolutionDepth.set(key, (structuredResolutionDepth.get(key) ?? 0) + 1);
  if (trace !== undefined) {
    const stack = activeCausalTraceStack.get(key) ?? [];
    stack.push(trace);
    activeCausalTraceStack.set(key, stack);
  }
  try {
    return run();
  } finally {
    if (trace !== undefined) {
      const stack = activeCausalTraceStack.get(key);
      stack?.pop();
      if (!stack?.length) activeCausalTraceStack.delete(key);
    }
    const next = (structuredResolutionDepth.get(key) ?? 1) - 1;
    if (next <= 0) structuredResolutionDepth.delete(key);
    else structuredResolutionDepth.set(key, next);
  }
}

/** Snapshot the immediate parent effect root a newly queued child must inherit. */
export function currentEffectCausalCorrelationEventId(state: GameState): string | undefined {
  const stack = activeCausalTraceStack.get(state as object);
  const trace = stack?.at(-1);
  if (trace !== undefined && trace.completed !== true) return trace.rootEventId;
  return activeCausalCorrelationStack.get(state as object)?.at(-1);
}

/** Restore a journaled parent-effect root while its listeners run later. */
export function withEffectCausalCorrelation<T>(
  state: GameState,
  correlationEventId: string | undefined,
  run: () => T,
): T {
  if (correlationEventId === undefined) return run();
  const key = state as object;
  const stack = activeCausalCorrelationStack.get(key) ?? [];
  stack.push(correlationEventId);
  activeCausalCorrelationStack.set(key, stack);
  try {
    return run();
  } finally {
    stack.pop();
    if (stack.length === 0) activeCausalCorrelationStack.delete(key);
  }
}

export function isStructuredCausalResolutionActive(state: GameState): boolean {
  return (structuredResolutionDepth.get(state as object) ?? 0) > 0;
}

type StandaloneCausalRootInput = Omit<AppendCausalInput, 'parentEventId' | 'correlationEventId'>;
type CausalTraceOperationInput = Omit<AppendCausalInput, 'parentEventId' | 'correlationEventId'>;

/** Start one public causal graph for a player action outside effect resolution. */
export function startStandaloneCausalTrace(
  state: GameState,
  input: StandaloneCausalRootInput,
): CausalEffectTrace | undefined {
  if (
    state.causalLog === undefined
    || state.gameResult !== undefined
    || isStructuredCausalResolutionActive(state)
  ) return undefined;
  const root = appendCausal(state, input);
  return { rootEventId: root.eventId, tailEventId: root.eventId };
}

/** Append a public operation to an explicitly owned player-action graph. */
export function recordCausalTraceOperation(
  state: GameState,
  trace: CausalEffectTrace | undefined,
  input: CausalTraceOperationInput,
): CausalLogEntryV1 | undefined {
  if (trace === undefined || trace.completed === true) return undefined;
  const operation = appendCausal(state, {
    ...input,
    parentEventId: trace.tailEventId,
  });
  trace.tailEventId = operation.eventId;
  return operation;
}

export function completeOwnedCausalTrace(
  state: GameState,
  trace: CausalEffectTrace | undefined,
  actor: 'self' | 'opp',
  kind: Extract<CausalEventKind, 'summary' | 'cancel' | 'fizzle'> = 'summary',
  outcome: CausalOutcome = { type: 'state', state: 'success' },
  tags?: AppendCausalInput['tags'],
): CausalLogEntryV1 | undefined {
  if (trace === undefined || trace.completed === true) return undefined;
  if (state.gameResult !== undefined) {
    const terminals = state.log.filter(
      (entry): entry is CausalLogEntryV1 => isCausalLogEntry(entry) && entry.kind === 'game-result',
    );
    if (terminals.length > 1) throw new Error('Causal history has multiple game-result events');
    let terminal = terminals[0];
    if (terminal !== undefined) {
      const causal = state.log.filter(isCausalLogEntry);
      if (causal.at(-1)?.eventId !== terminal.eventId) {
        throw new Error('Causal history has an event after game-result');
      }
    } else {
      const winner = state.gameResult.winner;
      terminal = appendCausal(state, {
        actor: winner,
        kind: 'game-result',
        parentEventId: trace.tailEventId,
        source: { kind: 'player', side: winner },
        targets: [{ kind: 'player', side: winner === 'self' ? 'opp' : 'self' }],
        outcome: { type: 'state', state: 'success' },
      });
    }
    trace.tailEventId = terminal.eventId;
    trace.completed = true;
    delete trace.awaitingResume;
    return terminal;
  }
  const completion = appendCausal(state, {
    actor,
    kind,
    ...(tags?.length ? { tags } : {}),
    parentEventId: trace.tailEventId,
    source: { kind: 'player', side: actor },
    targets: [],
    outcome,
  });
  trace.tailEventId = completion.eventId;
  trace.completed = true;
  delete trace.awaitingResume;
  return completion;
}

export function cloneCausalEffectTrace(trace: CausalEffectTrace | undefined): CausalEffectTrace | undefined {
  return trace === undefined ? undefined : { ...trace };
}

export function ensureEffectCausalTrace(state: GameState, ctx: EffectCtx): CausalEffectTrace | undefined {
  if (state.causalLog === undefined) return undefined;
  const existing = ctx.causal?.trace;
  const correlationEventId = ctx.causal?.correlationEventId;
  if (existing !== undefined && correlationEventId !== undefined) {
    throw new Error('causal trace and child correlation are mutually exclusive');
  }
  if (existing !== undefined) return existing;
  const root = appendCausal(state, {
    actor: ctx.source.player,
    kind: ctx.source.abilityId ? 'declare' : 'use',
    source: publicEffectSource(state, ctx),
    targets: [],
    outcome: { type: 'state', state: 'active' },
    ...(correlationEventId ? { correlationEventId } : {}),
  });
  const trace: CausalEffectTrace = {
    rootEventId: root.eventId,
    tailEventId: root.eventId,
  };
  const causal = (ctx.causal ??= {});
  delete causal.correlationEventId;
  causal.trace = trace;
  return trace;
}

function publicEffectSource(state: GameState, ctx: EffectCtx): PublicCausalLocator {
  const { player, area, uid, cardId } = ctx.source;
  if (
    area === 'scene'
    && typeof uid === 'string'
    && typeof cardId === 'string'
    && state.players[player].scene.some((card) => card.uid === uid && card.cardId === cardId)
  ) {
    return { kind: 'scene-card', side: player, uid };
  }
  if (
    area === 'case'
    && typeof cardId === 'string'
    && cardId.length > 0
    && state.players[player].case.cardId === cardId
  ) {
    return { kind: 'case-card', side: player };
  }
  if (
    area === 'partner-area'
    && typeof cardId === 'string'
    && cardId.length > 0
    && state.players[player].partner.cardId === cardId
  ) {
    return { kind: 'partner-card', side: player };
  }
  return { kind: 'player', side: player };
}

export function restoreEffectCausalTrace(ctx: EffectCtx, trace: CausalEffectTrace | undefined): CausalEffectTrace | undefined {
  if (trace === undefined) return undefined;
  const restored = cloneCausalEffectTrace(trace)!;
  const causal = (ctx.causal ??= {});
  delete causal.correlationEventId;
  causal.trace = restored;
  return restored;
}

/**
 * Transfer a paused branch back to the trace object owned by its enclosing
 * resolver. Keep the authority object's identity: the stack finalizer retains
 * that exact reference while a parallel branch runs.
 */
export function handoffPausedEffectCausalTrace(
  authority: CausalEffectTrace | undefined,
  paused: CausalEffectTrace | undefined,
): void {
  adoptEffectCausalTrace(authority, paused);
  if (authority === undefined || paused === undefined) return;
  authority.awaitingResume = true;
}

/** Adopt a completed synchronous branch without marking the effect paused. */
export function adoptEffectCausalTrace(
  authority: CausalEffectTrace | undefined,
  branch: CausalEffectTrace | undefined,
): void {
  if (authority === undefined || branch === undefined) return;
  if (authority.rootEventId !== branch.rootEventId) {
    throw new Error('causal trace adoption crossed effect roots');
  }
  if (authority.completed === true || branch.completed === true) {
    throw new Error('causal trace adoption cannot adopt a completed trace');
  }
  authority.tailEventId = branch.tailEventId;
}

/** Bind every resumed continuation frame to one live causal trace authority. */
export function bindEffectCausalTrace(
  ctx: EffectCtx,
  trace: CausalEffectTrace | undefined,
): CausalEffectTrace | undefined {
  if (trace === undefined) return undefined;
  const causal = (ctx.causal ??= {});
  delete causal.correlationEventId;
  causal.trace = trace;
  return trace;
}

export function markEffectCausalAwaitingResume(trace: CausalEffectTrace | undefined): void {
  if (trace === undefined || trace.completed === true) return;
  trace.awaitingResume = true;
}

export function recordEffectCausalDecision(
  state: GameState,
  trace: CausalEffectTrace | undefined,
  actor: 'self' | 'opp',
): void {
  if (trace === undefined || trace.completed === true) return;
  const decision = appendCausal(state, {
    actor,
    kind: 'select',
    parentEventId: trace.tailEventId,
    source: { kind: 'player', side: actor },
    targets: [],
    outcome: { type: 'state', state: 'success' },
  });
  trace.tailEventId = decision.eventId;
  delete trace.awaitingResume;
}

type EffectCausalOperationInput = Omit<AppendCausalInput, 'parentEventId'>;

/**
 * Append one public, typed operation to the currently resolving effect.
 * Callers must provide public locators only; appendCausal performs the final
 * projection and rejects stale or hidden card references.
 */
export function recordEffectCausalOperation(
  state: GameState,
  ctx: EffectCtx,
  input: EffectCausalOperationInput,
): CausalLogEntryV1 | undefined {
  const pendingDecisionActor = ctx.causal?.pendingDecisionActor;
  if (pendingDecisionActor !== undefined) {
    const decisionTrace = ensureEffectCausalTrace(state, ctx);
    recordEffectCausalDecision(state, decisionTrace, pendingDecisionActor);
    delete ctx.causal?.pendingDecisionActor;
  }
  const trace = ctx.causal?.trace;
  if (trace === undefined || trace.completed === true) return;
  const operation = appendCausal(state, {
    ...input,
    parentEventId: trace.tailEventId,
  });
  trace.tailEventId = operation.eventId;
  return operation;
}

export function completeEffectCausalTrace(
  state: GameState,
  trace: CausalEffectTrace | undefined,
  actor: 'self' | 'opp',
  kind: Extract<CausalEventKind, 'summary' | 'cancel' | 'fizzle'> = 'summary',
  outcome: CausalOutcome = { type: 'state', state: 'success' },
): void {
  if (trace === undefined || trace.completed === true || trace.awaitingResume === true) return;
  completeOwnedCausalTrace(state, trace, actor, kind, outcome);
}
