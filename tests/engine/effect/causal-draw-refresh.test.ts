import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';

function runCausalDraw(
  sessionId: string,
  setup: (state: GameState) => void,
  effect: EffectStackEntry['effect'] = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
): GameState {
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
      effect,
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

describe('draw causal refresh projection', () => {
  it('does not append an invalid zero-card draw when an empty deck causes deck-out', () => {
    expect(() => runCausalDraw('causal-empty-draw', () => {})).not.toThrow();

    const state = runCausalDraw('causal-empty-draw-state', () => {});
    expect(state.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['game-result', { type: 'state', state: 'success' }],
    ]);
  });

  it('records the actual refresh from remove to deck after the draw that exhausted the deck', () => {
    const state = runCausalDraw('causal-draw-refresh', (draft) => {
      draft.players.self.deck = ['PRIVATE-DRAW'];
      draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['draw', 'causal-draw-refresh:1', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['zone-move', 'causal-draw-refresh:2', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['summary', 'causal-draw-refresh:3', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(state.players.self.hand).toEqual(['PRIVATE-DRAW']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.players.self.deck).toHaveLength(2);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records an initial refresh before the draw it enables', () => {
    const state = runCausalDraw('causal-refresh-before-draw', (draft) => {
      draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'causal-refresh-before-draw:1', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['draw', 'causal-refresh-before-draw:2', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['summary', 'causal-refresh-before-draw:3', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records draw-up-to-hand-size refresh after the exhausting draw', () => {
    const state = runCausalDraw(
      'causal-draw-up-refresh',
      (draft) => {
        draft.players.self.deck = ['PRIVATE-DRAW'];
        draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
      },
      { kind: 'atom', verb: 'drawUpToHandSize', args: { player: 'self', n: 1 } },
    );

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['draw', 'causal-draw-up-refresh:1', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['zone-move', 'causal-draw-up-refresh:2', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['summary', 'causal-draw-up-refresh:3', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });
});
