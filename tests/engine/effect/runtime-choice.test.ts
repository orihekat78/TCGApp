import { describe, expect, it } from 'vitest';
import { run } from '@/engine/effect/resolver';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectChoiceSide, _drainPendingEffectChoiceSide } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx } from '@/engine/types';

const choice: Effect = {
  kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
  ],
};

function ctx(): EffectCtx {
  return { source: { player: 'self', cardId: 'TEST', abilityId: 'a1', area: 'hand' }, bindings: {}, dyn: {} };
}

describe('runtime binding choice', () => {
  it('surfaces a human choice when it reaches resolver without a choiceIndex', () => {
    const state = createEmptyGameState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    _clearPendingEffectChoiceSide();

    run(state, choice, ctx());

    expect(_drainPendingEffectChoiceSide()).toMatchObject({ player: 'self', options: [{ index: 0 }, { index: 1 }] });
  });

  it('keeps option 0 as the AI default', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['SELF_DRAW'];
    state.players.opp.deck = ['OPP_DRAW'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    _clearPendingEffectChoiceSide();

    run(state, choice, ctx());

    expect(state.players.self.hand).toEqual(['SELF_DRAW']);
    expect(state.players.opp.hand).toEqual([]);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
  });

  it('runs a sequence tail once, only after the human resolves the runtime choice', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['OPTION', 'TAIL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    _clearPendingEffectChoiceSide();
    const effect: Effect = { kind: 'sequence', steps: [choice, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] };

    run(state, effect, ctx());
    expect(state.players.self.hand).toEqual([]);
    const pending = _drainPendingEffectChoiceSide();
    applyChoiceAndContinuation(state, pending!, 0);

    expect(state.players.self.hand).toEqual(['OPTION', 'TAIL']);
  });
});
