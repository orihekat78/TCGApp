import type { ActionContext, GameState } from '../../types/index.js';

/**
 * Resolve a caller-held ActionContext to the instance owned by the current state.
 *
 * Legacy unit-level callers may still pass a mutable standalone context. A frozen
 * context missing from state is stale/corrupt and must not be mutated silently.
 */
export function contextForState(state: GameState, context: ActionContext): ActionContext {
  const current = state.actionContexts?.[context.id];
  if (current) return current;
  if (Object.isFrozen(context)) {
    throw new Error(`flow.action: missing ActionContext ${context.id}`);
  }
  return context;
}
