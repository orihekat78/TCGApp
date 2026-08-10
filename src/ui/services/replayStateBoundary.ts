import type { GameState } from '@/engine/types';

/**
 * Clone only the state a read-only replay may own.
 *
 * Live resolver descriptors can contain executable card predicates. They are
 * required while a match is resolving, but Replay never resumes that runtime
 * and must remain structured-clone/JSON safe at its persistence boundary.
 */
export function cloneReplayStateAtCommit(state: GameState): GameState {
  const {
    pendingRuntimeState: _pendingRuntimeState,
    pendingReasoningContinuation: _pendingReasoningContinuation,
    pendingTurnTransition: _pendingTurnTransition,
    effectTriggerBatchContext: _effectTriggerBatchContext,
    effectTriggerBatchConfirmedContext: _effectTriggerBatchConfirmedContext,
    ...persisted
  } = state;

  return structuredClone({
    ...persisted,
    pendingEffects: [],
    actionContexts: {},
    reservedEffects: [],
  });
}
