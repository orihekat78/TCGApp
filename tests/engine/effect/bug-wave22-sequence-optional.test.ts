import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearPendingEffectOptionalSide,
  _drainPendingEffectOptionalSide,
  _peekPendingEffectOptionalSide,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

function stateWithDeck(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.deck = Array.from({ length: 20 }, (_, i) => `D${i}`);
  state.players.self.hand = [];
  return state;
}

function context(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'OPTIONAL-SEQ', uid: 'host#1', abilityId: 'main', area: 'scene' },
    bindings: {},
  };
}

const effect: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
  ],
};

describe('wave22: sequence 内の連続 optional を出現順に中断・再開する', () => {
  beforeEach(() => {
    _clearPendingEffectOptionalSide();
  });

  it('1件目で pause し、take 後に2件目を surface、decline 後に末尾を実行する', () => {
    const state = stateWithDeck();
    const ctx = context();

    runEffect(state, resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'OPTIONAL-SEQ', abilityId: 'main' },
    }), ctx);
    runAllUntilEmpty(state);

    expect(state.players.self.hand).toHaveLength(0);
    const first = _drainPendingEffectOptionalSide();
    expect(first).not.toBeNull();
    applyOptionalAndContinuation(state, first!, true);

    expect(state.players.self.hand).toHaveLength(1);
    const second = _drainPendingEffectOptionalSide();
    expect(second).not.toBeNull();
    applyOptionalAndContinuation(state, second!, false);

    expect(state.players.self.hand).toHaveLength(5);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
  });

  it('nested sequence の inner tail → outer decision → outer tail 順を保つ', () => {
    const state = stateWithDeck();
    const ctx = context();
    const nested: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'sequence', steps: [
          { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
        ] },
        { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 8 } },
      ],
    };

    runEffect(state, resolveEffectPicks(state, nested, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'OPTIONAL-SEQ', abilityId: 'main' },
    }), ctx);
    runAllUntilEmpty(state);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);

    expect(state.players.self.hand).toHaveLength(3);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, false);
    expect(state.players.self.hand).toHaveLength(11);
  });

  it('nested inner tail survives when its resumed remainder surfaces another optional', () => {
    const state = stateWithDeck();
    const ctx = context();
    const nested: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'sequence',
          steps: [
            { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
            { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
          ],
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 8 } },
      ],
    };

    runEffect(state, resolveEffectPicks(state, nested, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'OPTIONAL-SEQ', abilityId: 'main' },
    }), ctx);
    runAllUntilEmpty(state);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);

    expect(state.players.self.hand).toHaveLength(1);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, false);
    expect(state.players.self.hand).toHaveLength(13);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
  });

  it('optional body inner tail survives before the outer sequence tail', () => {
    const state = stateWithDeck();
    const ctx = context();
    const nested: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'optional',
          effect: {
            kind: 'sequence',
            steps: [
              { kind: 'optional', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } } },
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
            ],
          },
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 8 } },
      ],
    };

    runEffect(state, resolveEffectPicks(state, nested, ctx, {
      byPlayer: 'self', humanChooser: true,
      source: { cardId: 'OPTIONAL-SEQ', abilityId: 'main' },
    }), ctx);
    runAllUntilEmpty(state);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, true);

    expect(state.players.self.hand).toHaveLength(0);
    applyOptionalAndContinuation(state, _drainPendingEffectOptionalSide()!, false);
    expect(state.players.self.hand).toHaveLength(12);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
  });
});
