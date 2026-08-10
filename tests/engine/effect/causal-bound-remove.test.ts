import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';

function runBoundRemove(sessionId: string, setup: (state: GameState) => void, bound: string[]): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);

  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: 'boundToRemove', args: { player: 'opp', bindKey: '$bound' } },
      bindings: {
        $bound: bound.map((cardId) => ({ kind: 'card', cardId, area: 'deck', player: 'opp' })),
      },
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

describe('boundToRemove causal projection', () => {
  it('records the actual deck-to-remove count under the resolving effect chain', () => {
    const state = runBoundRemove('causal-bound-actual', (draft) => {
      draft.players.opp.deck = ['PRIVATE-BOUND', 'PRIVATE-DECOY'];
    }, ['PRIVATE-BOUND', 'PRIVATE-MISSING']);

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'causal-bound-actual:1', { type: 'move', from: 'deck', to: 'remove', count: 1 }],
      ['summary', 'causal-bound-actual:2', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: 'opp', zone: 'deck' },
      targets: [{ kind: 'zone', side: 'opp', zone: 'remove' }],
    });
    expect(state.players.opp.deck).toEqual(['PRIVATE-DECOY']);
    expect(state.players.opp.remove).toEqual(['PRIVATE-BOUND']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records the tagged remove-to-deck refresh after exact deck exhaustion', () => {
    const state = runBoundRemove('causal-bound-refresh', (draft) => {
      draft.players.opp.deck = ['PRIVATE-BOUND'];
      draft.players.opp.remove = ['PRIVATE-REMOVE'];
    }, ['PRIVATE-BOUND']);

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'causal-bound-refresh:1', undefined, { type: 'move', from: 'deck', to: 'remove', count: 1 }],
      ['zone-move', 'causal-bound-refresh:2', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['summary', 'causal-bound-refresh:3', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(state.players.opp.remove).toEqual([]);
    expect(state.players.opp.deck).toHaveLength(2);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it.each([
    ['empty', [], ['PRIVATE-DECK']],
    ['missing', ['PRIVATE-MISSING'], ['PRIVATE-DECK']],
  ])('emits no operation for a %s bound', (caseId, bound, deck) => {
    const state = runBoundRemove(`causal-bound-noop-${caseId}`, (draft) => {
      draft.players.opp.deck = deck;
    }, bound);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind)).toEqual(['declare', 'summary']);
    expect(state.players.opp.deck).toEqual(['PRIVATE-DECK']);
    expect(state.players.opp.remove).toEqual([]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });
});
