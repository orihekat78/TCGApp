import { describe, expect, it, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { run } from '@/engine/effect/resolver';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';

const character = (id: string, level: number, traits: string[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 0, lp: 1,
  traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

describe('B08003 cost-paid stacked-card chooser', () => {
  beforeEach(() => { _resetRegistry(); _clearPendingEffectPickQueue(); });

  it('offers the opponent only the exact remove occurrences paid as stacked-card cost', () => {
    registerCardDef(character('OLD', 8, ['少年探偵団']));
    registerCardDef(character('PAID_A', 8, ['少年探偵団']));
    registerCardDef(character('PAID_B', 8, ['少年探偵団']));
    const state = createEmptyGameState();
    state.players.self.remove = ['OLD', 'PAID_A', 'PAID_B'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'B08003', uid: 'host', abilityId: 'a2' },
      bindings: {},
      costPaid: { removeStackedCards: { entries: [
        { cardId: 'PAID_A', instanceId: 'stack:host:1', removeIndex: 1 },
        { cardId: 'PAID_B', instanceId: 'stack:host:2', removeIndex: 2 },
      ] } },
    };
    const effect: Effect = {
      kind: 'atom', verb: 'sceneEnter', args: {
        player: 'self', cardId: '$pick.cardId', from: 'remove', sourceRequired: true, viaEffect: true,
        target: { kind: 'pick', chooser: 'opp-of-owner', n: { min: 1, max: 1 }, query: {
          area: 'remove', side: 'self', fromCostPaidCards: 'removeStackedCards',
          filter: { kind: 'character', levelMax: 8, trait: '少年探偵団' },
        } },
      },
    };

    run(state, effect, ctx);
    const pending = _drainPendingEffectPickSide();

    expect(pending?.player).toBe('opp');
    expect(pending?.candidates).toEqual([
      { kind: 'card', uid: 'card:self:remove:PAID_A#1', cardId: 'PAID_A', player: 'self', area: 'remove', index: 1 },
      { kind: 'card', uid: 'card:self:remove:PAID_B#2', cardId: 'PAID_B', player: 'self', area: 'remove', index: 2 },
    ]);
    // Legacy selections still resolve when they identify exactly one pending occurrence.
    applyPickAndContinuation(state, pending!, 'PAID_B#2');
    expect(state.players.self.remove).toEqual(['OLD', 'PAID_A']);
    expect(state.players.self.scene.map(c => c.cardId)).toEqual(['PAID_B']);
  });
});
