import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B09004 } from '@/cards/ct-p09/B09004';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { event } from '@/engine/event';
import { _peekPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _snapshotPendingPublicHandRevealSide } from '@/engine/effect/atom-handlers/_shared';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve';
import type { AbilityDef, CardDef } from '@/engine/types';
import { sceneChar } from '../../../helpers/fixtures';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const REVEALED = card('ORDER_REVEALED', { names: ['工藤新一'] });
const BOND = card('ORDER_BOND', { names: ['工藤新一'] });
const THROWER = card('ORDER_THROWER', {
  abilities: [{
    id: 'throw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'effect:declared' },
    condition: { kind: 'custom', check: () => { throw new Error('declared rollback probe'); } },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: 'Test-only observer that fails after cost payment.', ruleRefs: [],
  } as AbilityDef],
});
const SOURCE = card('ORDER_SOURCE', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    cost: {
      kind: 'revealFromHand', n: 1,
      target: {
        kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '工藤新一' } },
        n: { min: 1, max: 1 }, chooser: 'self',
      },
    },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: 'Reveal Shinichi as cost, then resolve this effect.', ruleRefs: [],
  } as AbilityDef],
});

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B09004, REVEALED, BOND, SOURCE, THROWER].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('declared cost-trigger ordering', () => {
  it('queues the declared effect before a hand-reveal reaction released by its cost', () => {
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(SOURCE.id, 'source'), sceneChar(B09004.id, 'ran'), sceneChar(BOND.id, 'bond'),
    ];
    state.players.self.hand = [REVEALED.id];

    activateDeclaredAbility(state, 'source', 'a1', {
      revealFromHand: { indices: [0] },
    } as never);

    expect(state.pendingEffects.filter(entry => entry.state === 'pending').map(entry => ({
      cardId: entry.source.cardId, abilityId: entry.source.abilityId,
    }))).toEqual([
      { cardId: SOURCE.id, abilityId: 'a1' },
      { cardId: B09004.id, abilityId: 'a1' },
    ]);
  });

  it('resolves the declared effect before surfacing its cost-triggered reaction', () => {
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(SOURCE.id, 'source'), sceneChar(B09004.id, 'ran'), sceneChar(BOND.id, 'bond'),
    ];
    state.players.self.hand = [REVEALED.id];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    activateDeclaredAbility(state, 'source', 'a1', {
      revealFromHand: { indices: [0] },
    } as never);
    runAllUntilEmpty(state);

    expect(state.pendingEffects.find(entry => entry.source.cardId === SOURCE.id)?.state).toBe('resolved');
    expect(_peekPendingEffectOptionalSide()?.source).toMatchObject({
      cardId: B09004.id,
      abilityId: 'a1',
    });
  });

  it('restores pending runtime channels when declaration fails after reveal payment', () => {
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(SOURCE.id, 'source'), sceneChar(THROWER.id, 'thrower')];
    state.players.self.hand = [REVEALED.id];
    const revealBefore = _snapshotPendingPublicHandRevealSide();

    expect(() => produce(state, draft => {
      activateDeclaredAbility(draft, 'source', 'a1', {
        revealFromHand: { indices: [0] },
      } as never);
    })).toThrow('declared rollback probe');

    expect(_snapshotPendingPublicHandRevealSide()).toEqual(revealBefore);
  });
});
