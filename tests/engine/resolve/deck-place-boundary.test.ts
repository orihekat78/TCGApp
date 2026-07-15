// A human deckPlace decision is a hard effect-stack boundary, just like deck reorder.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { resolve } from '@/engine/resolve';
import type { Candidate, Effect, EffectStackEntry, GameState } from '@/engine/types';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingDeckPlaceSide?: unknown;
};

function entry(
  state: GameState,
  id: string,
  effect: Effect,
  bindings?: Record<string, Candidate[]>,
): EffectStackEntry {
  return {
    id,
    source: { player: 'self', cardId: 'HOST', uid: 'host' },
    triggeredBy: { hook: 'manual' },
    triggeredAt: { turn: state.turn.number, phase: state.turn.phase, nano: 0 },
    effect,
    bindings,
    state: 'pending',
  };
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  globals.__pendingDeckPlaceSide = null;
});

afterEach(() => {
  globals.__humanPlayerSide = null;
  globals.__pendingDeckPlaceSide = null;
});

describe('deckPlace boundary: effect stack', () => {
  it('keeps the human pending decision and leaves the next stack entry unresolved', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const window = ['A', 'B'].map((cardId, index) => ({
      kind: 'card' as const,
      cardId,
      area: 'deck' as const,
      player: 'self' as const,
      index,
    }));
    resolve.queue(state, entry(
      state,
      'place-first',
      { kind: 'atom', verb: 'deckPlaceSplitBound', args: { player: 'self', bindKey: '$window' } },
      { $window: window },
    ));
    resolve.queue(state, entry(
      state,
      'draw-second',
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ));

    resolve.runAllUntilEmpty(state);

    expect(globals.__pendingDeckPlaceSide).toMatchObject({
      player: 'self',
      ownerPlayer: 'self',
      cardIds: ['A', 'B'],
    });
    expect(state.pendingEffects.map(item => item.state)).toEqual(['resolved', 'pending']);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.deck).toEqual(['A', 'B', 'TAIL']);
  });
});
