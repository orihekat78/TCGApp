import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useGameStateStore } from '@/ui/state/store';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';

const optionalDecision = {
  player: 'self' as const,
  source: { cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1' },
};

describe('resolver decision identity', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ pendingDecisionSeq: 0 });
  });

  it('rejects a stale callback and accepts only the currently rendered decision', () => {
    const store = useGameStateStore.getState();
    store.setPendingEffectOptional(optionalDecision);
    const first = useGameStateStore.getState().pendingEffectOptional!;
    store.setPendingEffectOptional(optionalDecision);
    const second = useGameStateStore.getState().pendingEffectOptional!;
    const state = createEmptyGameState();

    expect(first.decisionId).toBe('decision:1');
    expect(second.decisionId).toBe('decision:2');
    expect(isAllowed(state, bindPendingDecision(first, { type: 'optionalResolve', run: false }))).toBe(false);
    expect(isAllowed(state, bindPendingDecision(second, { type: 'optionalResolve', run: false }))).toBe(true);
  });

  it('does not reuse decision IDs across a match-session reset', () => {
    useGameStateStore.getState().setPendingEffectOptional(optionalDecision);
    const beforeReset = useGameStateStore.getState().pendingEffectOptional!;

    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.getState().setPendingEffectOptional(optionalDecision);
    const afterReset = useGameStateStore.getState().pendingEffectOptional!;

    expect(beforeReset.decisionId).toBe('decision:1');
    expect(afterReset.decisionId).toBe('decision:2');
  });

  it('always binds the rendered identity into a public response', () => {
    const action = { type: 'optionalResolve' as const, run: false };
    expect(bindPendingDecision({ decisionId: 'decision:7' }, action)).toEqual({
      ...action,
      decisionId: 'decision:7',
    });
  });
});
