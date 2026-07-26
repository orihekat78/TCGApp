import { beforeEach, describe, expect, it } from 'vitest';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';

function character(id: string): CardDef {
  return {
    id, no: `TEST/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const body: Effect = {
  kind: 'sequence',
  steps: [
    {
      kind: 'atom', verb: 'deckRevealUntil', args: {
        player: 'self', maxN: 1, chooseMatch: 'upTo', filter: { kind: 'character' },
        bind: '$revealed', bindMatch: '$matched',
      },
    },
    {
      kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
    },
  ],
};

beforeEach(() => {
  _resetRegistry();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('forEach pending-pick continuation', () => {
  it('runs the next iteration only after the first interactive body resolves', () => {
    const loop = character('LOOP');
    const firstLook = character('FIRST_LOOK');
    const secondLook = character('SECOND_LOOK');
    [loop, firstLook, secondLook].forEach(register);
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(loop.id, 'loop#1'), sceneChar(loop.id, 'loop#2')];
    state.players.self.deck = [firstLook.id, secondLook.id];
    const effect: Effect = {
      kind: 'forEach',
      over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { kind: 'character', cardName: loop.id } } },
      do: body,
    };
    const ctx: EffectCtx = { source: { player: 'self', cardId: loop.id, uid: 'loop#1', abilityId: 'a1', area: 'scene' }, bindings: {} };

    runEffect(state, effect, ctx);
    runAllUntilEmpty(state);
    const first = _drainPendingEffectPickSide();
    expect(first?.candidates.map((candidate) => candidate.cardId)).toEqual([firstLook.id]);

    applyPickAndContinuation(state, first!, first!.candidates[0]!.uid);
    runAllUntilEmpty(state);
    const second = _drainPendingEffectPickSide();
    expect(second?.candidates.map((candidate) => candidate.cardId)).toEqual([secondLook.id]);

    applyPickAndContinuation(state, second!, second!.candidates[0]!.uid);
    runAllUntilEmpty(state);
    expect(state.players.self.hand).toEqual([firstLook.id, secondLook.id]);
  });
});
