import { beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { B01007 } from '@/cards/ct-p01/B01007';
import { B09027 } from '@/cards/ct-p09/B09027';
import { B04008 } from '@/cards/ct-p04/B04008';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B03011 } from '@/cards/ct-p03/B03011';
import { B07048 } from '@/cards/ct-p07/B07048';
import { B05033 } from '@/cards/ct-p05/B05033';
import { D06002 } from '@/cards/ct-d06/D06002';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility, canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { flow } from '@/engine/flow';
import { canPayAtomically, canPayWithPreflight, pay } from '@/engine/cost/pay';
import { canPay } from '@/engine/cost/evaluate';
import { event } from '@/engine/event';
import { _setResolutionLock } from '@/engine/event/registry';
import { _clearPendingSetCardReplacementSide, _drainPendingSetCardReplacementSide, _peekPendingSetCardReplacementSide, pushPendingSetCardReplacementSide, type PendingSetCardReplacementSide } from '@/engine/effect/pending-state';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, Cost, GameState } from '@/engine/types';
import { enumDeclaredAbilityIdsFor, enumDeclaredAbilitySources } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { findRemoveSetCardCost } from '@/ui/hooks/useActionsPanelFlow/cost';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { useGameStateStore } from '@/ui/state/store';

function card(id: string, abilities: AbilityDef[] = [], traits: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1,
    traits, rarity: 'C', imageUrl: '', abilities, ruleRefs: [],
  };
}

function declared(id: string, cost: AbilityDef['cost']): AbilityDef {
  return {
    id, type: 'declared', scope: 'on-scene', cost,
    effect: { kind: 'atom', verb: 'noop', args: {} }, description: '', ruleRefs: [],
  };
}

function stateWith(cardIds: string[], hand: string[] = []): GameState {
  return produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    draft.players.self.partner = { cardId: 'BLUE-PARTNER', state: 'active', location: 'partner-area' };
    draft.players.self.hand = hand;
    for (const id of cardIds) mutate.scene.enter(draft, 'self', id, { active: true });
  });
}

function declaredMoves(state: GameState) {
  return enumerateMoves(state, 'self').filter((move) => move.kind === 'declaredAbility');
}

function replacementSentinel(uid: string, cardId: string): PendingSetCardReplacementSide {
  return {
    player: 'self',
    fromUid: uid,
    setCardInstanceId: `sentinel:${cardId}`,
    source: { uid, cardId, abilityId: 'sentinel' },
    candidates: [],
  };
}

beforeEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  _resetUidCounter();
  resetDefRegistry();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
    pendingEffectPick: null,
    pendingEffectChoice: null,
    pendingEffectOptional: null,
    pendingChooseIntercept: null,
    pendingLeaveIntercept: null,
    pendingRps: null,
    pendingSetCardChoice: null,
    pendingSetCardReplacement: null,
    pendingEffectRepeatOptional: null,
    pendingDeckReorder: null,
    pendingDeckPlace: null,
  });
  _setResolutionLock(false, null);
  _clearPendingSetCardReplacementSide();
  flow.action._resetActionContexts();
  registerCardDef({
    id: 'BLUE-PARTNER', no: 'BLUE-PARTNER', kind: 'partner', names: ['BLUE-PARTNER'], colors: ['青'],
    level: 0, traits: [], abilities: [], ruleRefs: [],
  } as CardDef);
  registerCardDef(B01007);
  registerCardDef(B09027);
  registerCardDef(B04008);
  registerCardDef(B02052);
  registerCardDef(B03011);
  registerCardDef(B07048);
  registerCardDef(B05033);
  registerCardDef(D06002);
  registerCardDef(card('B04008-HAND-1', [], [B04008.traits[0]! ]));
  registerCardDef(card('B04008-HAND-2', [], [B04008.traits[0]! ]));
  registerCardDef(card('HAND-COST', [declared('a1', {
    kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 2, max: 2 }, chooser: 'self' }, n: 2,
  })]));
  registerCardDef(card('SLEEP-COST', [declared('a1', { kind: 'sleepSelf' })]));
  registerCardDef(card('NO-COST-DECLARED', [declared('a1', undefined)]));
  registerCardDef(card('COMPOSITE-COST', [declared('a1', {
    kind: 'pay', items: [
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'choice', items: [
        { kind: 'removeSetCard', n: 1 },
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      ] },
    ],
  })]));
  registerCardDef(card('NESTED-HAND-COST', [declared('a1', {
    kind: 'pay', items: [
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'pay', items: [
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      ] },
    ],
  })]));
  registerCardDef(card('NESTED-CHOICE-COST', [declared('a1', {
    kind: 'pay', items: [
      { kind: 'choice', items: [
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
        { kind: 'choice', items: [
          { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 2, max: 2 }, chooser: 'self' }, n: 2 },
          { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 3, max: 3 }, chooser: 'self' }, n: 3 },
        ] },
      ] },
      { kind: 'choice', items: [
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 4, max: 4 }, chooser: 'self' }, n: 4 },
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 5, max: 5 }, chooser: 'self' }, n: 5 },
      ] },
    ],
  })]));
  registerCardDef(card('NESTED-REMOVE-SET-COST', [declared('a1', {
    kind: 'choice', items: [
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'choice', items: [
        { kind: 'removeSetCard', n: 1 },
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      ] },
    ],
  })]));
  registerCardDef(card('DEFERRED-COMPOSITE-COST', [declared('a1', {
    kind: 'pay', items: [
      { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  })]));
  registerCardDef(card('FLIP-TWO-COST', [declared('a1', { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } })]));
  registerCardDef(card('ALT-TARGET', [declared('a1', {
    kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1,
  })], ['detective']));
  registerCardDef(card('ALT-PROVIDER', [{
    id: 'a1', type: 'continuous', scope: 'on-scene', description: '', ruleRefs: [],
    continuousModifier: { alternativeCostProvider: { targetFilter: { trait: 'detective' } } },
  }]));
});

describe('BUG-245: declared ability cost authorization', () => {
  it('atomic authorization is pure: it does not emit cost listeners or consume event IDs', () => {
    const state = produce(stateWith(['SET-COST']), (draft) => {
      draft.players.self.scene[0]!.setCards.push({ cardId: 'witness', faceUp: false, instanceId: 'set:witness' });
    });
    const uid = state.players.self.scene[0]!.uid;
    let listenerCalls = 0;
    event.on('setcard:leave', () => {
      listenerCalls += 1;
      return { kind: 'atom', verb: 'noop', args: {} };
    });

    expect(canPayAtomically(state, { kind: 'removeSetCard', n: 1 }, {
      source: { cardId: 'SET-COST', uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {},
    })).toBe(true);
    expect(listenerCalls).toBe(0);
    expect(state.players.self.scene[0]!.setCards).toHaveLength(1);
    const queued = produce(state, (draft) => { event.queue(draft, { kind: 'atom', verb: 'noop', args: {} }); });
    expect(queued.pendingEffects[0]!.id).toBe('e_1');
  });

  it('prepares a composite payment before commit when a later scene-to-deck leaf defers', () => {
    event._resetRegistry();
    const replacementTrait = (B02052.abilities[2]!.setCardRemovalReplacement?.filter as { trait?: string } | undefined)?.trait;
    expect(replacementTrait).toBeTypeOf('string');
    registerCardDef(card('REPLACEMENT-TARGET', [], [replacementTrait!]));
    const state = produce(stateWith(['DEFERRED-COMPOSITE-COST', 'REPLACEMENT-TARGET'], ['reveal']), (draft) => {
      draft.turn.player = 'opp';
      mutate.char.setCard(draft, draft.players.self.scene[0]!.uid, 'B02052', true);
    });
    const uid = state.players.self.scene[0]!.uid;
    const cost: Cost = {
      kind: 'pay', items: [
        { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
        { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      ],
    };
    const ctx = { source: { cardId: 'DEFERRED-COMPOSITE-COST', uid, player: 'self' as const, area: 'scene' as const }, bindings: {} };
    const before = JSON.stringify(state);
    let handRevealEvents = 0;
    event.on('hand:reveal', (draft) => { handRevealEvents += 1; draft.players.self.hand = []; return { kind: 'atom', verb: 'noop', args: {} }; });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(false);
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(() => produce(state, (draft) => { pay(draft, cost, ctx); })).toThrow('sceneToDeckBottom was replaced or deferred');
    expect(JSON.stringify(state)).toBe(before);
    expect(handRevealEvents).toBe(0);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
    const queued = produce(state, (draft) => { event.queue(draft, { kind: 'atom', verb: 'noop', args: {} }); });
    expect(queued.pendingEffects[0]!.id).toBe('e_1');
  });

  it('restores a pre-existing replacement side channel after preflight rejects another payment', () => {
    const replacementTrait = (B02052.abilities[2]!.setCardRemovalReplacement?.filter as { trait?: string } | undefined)?.trait;
    registerCardDef(card('REPLACEMENT-TARGET', [], [replacementTrait!]));
    const state = produce(stateWith(['DEFERRED-COMPOSITE-COST', 'REPLACEMENT-TARGET'], ['reveal']), (draft) => {
      draft.turn.player = 'opp';
      mutate.char.setCard(draft, draft.players.self.scene[0]!.uid, 'B02052', true);
    });
    const uid = state.players.self.scene[0]!.uid;
    const original = replacementSentinel(uid, 'B01007');
    pushPendingSetCardReplacementSide(original);
    const cost: Cost = { kind: 'sceneToDeckBottom', n: 1, target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } };

    expect(canPayWithPreflight(state, cost, { source: { cardId: 'DEFERRED-COMPOSITE-COST', uid, player: 'self', area: 'scene' }, bindings: {} })).toBe(false);
    expect(_peekPendingSetCardReplacementSide()).toBe(original);
    expect(_drainPendingSetCardReplacementSide()).toBe(original);
  });

  it('journals reveal listeners until every composite cost leaf has committed', () => {
    event._resetRegistry();
    const state = stateWith(['HAND-COST'], ['revealed', 'payment']);
    const uid = state.players.self.scene[0]!.uid;
    const cost: Cost = { kind: 'pay', items: [
      { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ] };
    let calls = 0;
    event.on('hand:reveal', (draft) => { calls += 1; draft.players.self.hand = []; return { kind: 'atom', verb: 'noop', args: {} }; });
    const result = produce(state, (draft) => {
      pay(draft, cost, { source: { cardId: 'HAND-COST', uid, player: 'self', area: 'scene' }, bindings: {} });
    });

    expect(calls).toBe(1);
    expect(result.players.self.remove).toContain('revealed');
    expect(result.pendingEffects[0]!.id).toBe('e_1');
  });

  it('uses the normal scene-to-deck cascade for B03011 selfToDeckBottom', () => {
    const state = produce(stateWith(['B03011']), (draft) => {
      const source = draft.players.self.scene[0]!;
      source.setCards.push({ cardId: 'set-card', faceUp: false, instanceId: 'set:1' });
      source.stackedCards = [{ cardId: 'stack-card', instanceId: 'stack:1' }];
    });
    const uid = state.players.self.scene[0]!.uid;
    const cost = B03011.abilities[0]!.cost!;
    const result = produce(state, (draft) => {
      pay(draft, cost, { source: { cardId: 'B03011', uid, player: 'self', area: 'scene' }, bindings: {} });
    });

    expect(result.players.self.scene.some((entry) => entry.uid === uid)).toBe(false);
    expect(result.players.self.deck.at(-1)).toBe('B03011');
    expect(result.players.self.remove).toEqual(expect.arrayContaining(['set-card', 'stack-card']));
  });

  it('rejects custom costs without invoking either closure', () => {
    const state = stateWith(['SLEEP-COST']);
    let checks = 0;
    let payments = 0;
    const custom: Cost = {
      kind: 'custom',
      check: () => { checks += 1; return true; },
      pay: () => { payments += 1; },
    };
    const ctx = {
      source: { cardId: 'SLEEP-COST', uid: state.players.self.scene[0]!.uid, player: 'self', area: 'scene' },
      bindings: {},
    };
    expect(canPay(state, custom, ctx)).toBe(false);
    expect(canPayAtomically(state, custom, ctx)).toBe(false);
    expect({ checks, payments }).toEqual({ checks: 0, payments: 0 });
    expect(() => produce(state, (draft) => {
      pay(draft, { kind: 'custom', check: () => { checks += 1; return true; }, pay: () => { payments += 1; } }, {
        source: { cardId: 'SLEEP-COST', uid: state.players.self.scene[0]!.uid, player: 'self', area: 'scene' }, bindings: {},
      });
    })).toThrow('custom costs are unsupported');
    expect({ checks, payments }).toEqual({ checks: 0, payments: 0 });
  });

  it('simulates sequential zone transitions and refresh without mutating the live state', () => {
    const state = produce(stateWith(['SLEEP-COST', 'ALT-TARGET'], ['HAND']), (draft) => {
      draft.players.self.deck = ['DECK'];
      draft.players.self.scene[1]!.setCards.push({ cardId: 'SET', faceUp: false, instanceId: 'set:1' });
    });
    const before = JSON.stringify(state);
    const ctx = {
      source: { cardId: 'SLEEP-COST', uid: state.players.self.scene[0]!.uid, player: 'self' as const, area: 'scene' as const },
      bindings: {},
    };
    const hand = { kind: 'pick' as const, query: { area: 'hand' as const, side: 'self' as const }, n: { min: 1, max: 1 }, chooser: 'self' as const };
    const remove = (n: number) => ({ kind: 'pick' as const, query: { area: 'remove' as const, side: 'self' as const }, n: { min: n, max: n }, chooser: 'self' as const });
    const otherScene = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'self' as const, excludeSelf: true }, n: { min: 1, max: 1 }, chooser: 'self' as const };

    expect(canPayAtomically(state, { kind: 'pay', items: [
      { kind: 'removeDeckTop', player: 'self', n: 1 },
      { kind: 'removeDeckTop', player: 'self', n: 1 },
      { kind: 'removeFromHand', target: hand, n: 1 },
      { kind: 'removeAreaToDeckBottom', target: remove(1), n: 1 },
      { kind: 'removeFromScene', target: otherScene, n: 1 },
      { kind: 'removeAreaToDeckBottom', target: remove(2), n: 2 },
    ] }, ctx)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects opponent-scoped and malformed cost definitions at authorization boundary', () => {
    const state = produce(stateWith(['SLEEP-COST']), (draft) => { draft.players.opp.hand = ['OPP']; });
    const before = JSON.stringify(state);
    const ctx = {
      source: { cardId: 'SLEEP-COST', uid: state.players.self.scene[0]!.uid, player: 'self' as const, area: 'scene' as const },
      bindings: {},
    };
    const opponentCost: Cost = {
      kind: 'removeFromHand', n: 1,
      target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 }, chooser: 'self' },
    };
    const malformed = {
      kind: 'removeFromHand', n: -1,
      target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 2, max: 1 }, chooser: 'self' },
    } as Cost;

    expect(canPayAtomically(state, opponentCost, ctx)).toBe(false);
    expect(canPayAtomically(state, malformed, ctx)).toBe(false);
    expect(canPay(state, opponentCost, ctx)).toBe(false);
    expect(canPay(state, malformed, ctx)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects a mis-targeted picked witness without zero-paying the declared cost', () => {
    const state = stateWith(['HAND-COST'], ['payment']);
    const uid = state.players.self.scene[0]!.uid;
    const cost = {
      kind: 'removeFromHand' as const, n: 1,
      target: { kind: 'pick' as const, query: { area: 'hand' as const, side: 'self' as const }, n: { min: 1, max: 1 }, chooser: 'self' as const },
    };
    const ctx = {
      source: { cardId: 'HAND-COST', uid, player: 'self' as const, area: 'scene' as const },
      bindings: {},
      picked: [{ kind: 'char' as const, uid, cardId: 'HAND-COST', player: 'self' as const }],
    };
    const before = JSON.stringify(state);

    expect(canPayAtomically(state, cost, ctx)).toBe(false);
    expect(() => produce(state, draft => { pay(draft, cost, ctx); })).toThrow('removeFromHand is not payable');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects surplus picked candidates instead of slicing them to a fixed-n cost', () => {
    const state = stateWith(['HAND-COST'], ['first', 'second']);
    const uid = state.players.self.scene[0]!.uid;
    const cost: Cost = { kind: 'removeFromHand', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } };
    const ctx = {
      source: { cardId: 'HAND-COST', uid, player: 'self' as const, area: 'scene' as const }, bindings: {},
      picked: [
        { kind: 'card' as const, cardId: 'first', player: 'self' as const, area: 'hand' as const, index: 0 },
        { kind: 'card' as const, cardId: 'second', player: 'self' as const, area: 'hand' as const, index: 1 },
      ],
    };
    const before = JSON.stringify(state);
    expect(canPayAtomically(state, cost, ctx)).toBe(false);
    expect(() => produce(state, (draft) => { pay(draft, cost, ctx); })).toThrow('removeFromHand is not payable');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects surplus reveal witnesses through the direct payment API', () => {
    const state = stateWith(['HAND-COST'], ['first', 'second']);
    const uid = state.players.self.scene[0]!.uid;
    const cost: Cost = { kind: 'revealFromHand', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } };
    const ctx = {
      source: { cardId: 'HAND-COST', uid, player: 'self' as const, area: 'scene' as const }, bindings: {},
      picked: [
        { kind: 'card' as const, cardId: 'first', player: 'self' as const, area: 'hand' as const, index: 0 },
        { kind: 'card' as const, cardId: 'second', player: 'self' as const, area: 'hand' as const, index: 1 },
      ],
    };
    const before = JSON.stringify(state);

    expect(canPayAtomically(state, cost, ctx)).toBe(false);
    expect(() => produce(state, (draft) => { pay(draft, cost, ctx); })).toThrow('revealFromHand is not payable');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects mismatched TargetingRef counts and out-of-ref sleep witnesses before mutation', () => {
    const state = stateWith(['HAND-COST', 'SLEEP-COST'], ['one', 'two']);
    const handUid = state.players.self.scene[0]!.uid;
    const sleepUid = state.players.self.scene[1]!.uid;
    const malformed: Cost = {
      kind: 'removeFromHand', n: 2,
      target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
    };
    const sleepCost: Cost = {
      kind: 'sleepChar',
      target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
    };
    const before = JSON.stringify(state);
    const handCtx = { source: { cardId: 'HAND-COST', uid: handUid, player: 'self' as const, area: 'scene' as const }, bindings: {} };
    const sleepCtx = {
      source: { cardId: 'SLEEP-COST', uid: sleepUid, player: 'self' as const, area: 'scene' as const }, bindings: {},
      picked: [{ kind: 'char' as const, uid: 'forged', cardId: 'forged', player: 'opp' as const }],
    };

    expect(canPayAtomically(state, malformed, handCtx)).toBe(false);
    expect(canPayAtomically(state, sleepCost, sleepCtx)).toBe(false);
    expect(() => produce(state, draft => { pay(draft, sleepCost, sleepCtx); })).toThrow('sleepChar is not payable');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('requires the exact minimum active targets for sleep and stun costs', () => {
    const state = produce(stateWith(['SLEEP-COST', 'SLEEP-COST']), (draft) => {
      draft.players.self.scene[1]!.state = 'sleep';
    });
    const ctx = { source: { cardId: 'SLEEP-COST', uid: state.players.self.scene[0]!.uid, abilityId: 'a1', player: 'self' as const, area: 'scene' as const }, bindings: {} };
    const sleepTwo = { kind: 'sleepChar' as const, target: { kind: 'pick' as const, query: { area: 'scene' as const, side: 'self' as const }, n: { min: 2, max: 2 }, chooser: 'self' as const } };
    const stunTwo = { ...sleepTwo, kind: 'stunChar' as const };

    expect(canPay(state, sleepTwo, ctx)).toBe(false);
    expect(canPay(state, stunTwo, ctx)).toBe(false);
    const enough = produce(state, (draft) => { draft.players.self.scene[1]!.state = 'active'; });
    expect(canPay(enough, sleepTwo, ctx)).toBe(true);
    expect(canPay(enough, stunTwo, ctx)).toBe(true);
  });

  it.each(['sleepChar', 'stunChar'] as const)(
    '%s skips an ineligible sleeping match before applying the target cap',
    (kind) => {
      const state = produce(stateWith(['SLEEP-COST', 'SLEEP-COST']), (draft) => {
        draft.players.self.scene[0]!.state = 'sleep';
      });
      const sleepingUid = state.players.self.scene[0]!.uid;
      const activeUid = state.players.self.scene[1]!.uid;
      const cost: Cost = {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self' },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      };
      const ctx = {
        source: {
          cardId: 'SLEEP-COST',
          uid: sleepingUid,
          abilityId: 'a1',
          player: 'self' as const,
          area: 'scene' as const,
        },
        bindings: {},
      };

      expect(canPayAtomically(state, cost, ctx)).toBe(true);
      const after = produce(state, (draft) => { pay(draft, cost, ctx); });
      expect(after.players.self.scene.find(char => char.uid === sleepingUid)?.state).toBe('sleep');
      expect(after.players.self.scene.find(char => char.uid === activeUid)?.state).toBe(
        kind === 'sleepChar' ? 'sleep' : 'stun',
      );
    },
  );

  it.each(['sleepChar', 'stunChar'] as const)(
    '%s pays with the exact explicit active character UID and rejects a forged UID',
    (kind) => {
      const state = stateWith(['SLEEP-COST', 'SLEEP-COST']);
      const firstUid = state.players.self.scene[0]!.uid;
      const chosenUid = state.players.self.scene[1]!.uid;
      const cost: Cost = {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self' },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      };
      const ctx = {
        source: {
          cardId: 'SLEEP-COST',
          uid: firstUid,
          abilityId: 'a1',
          player: 'self' as const,
          area: 'scene' as const,
        },
        bindings: {},
        dyn: { costParams: { [kind]: { uids: [chosenUid] } } },
      };

      expect(canPayAtomically(state, cost, ctx)).toBe(true);
      const after = produce(state, (draft) => { pay(draft, cost, ctx); });
      expect(after.players.self.scene.find(char => char.uid === firstUid)?.state).toBe('active');
      expect(after.players.self.scene.find(char => char.uid === chosenUid)?.state).toBe(
        kind === 'sleepChar' ? 'sleep' : 'stun',
      );

      const forgedCtx = {
        ...ctx,
        dyn: { costParams: { [kind]: { uids: ['forged'] } } },
      };
      expect(canPayAtomically(state, cost, forgedCtx)).toBe(false);
      expect(() => produce(state, (draft) => { pay(draft, cost, forgedCtx); }))
        .toThrow(`${kind} is not payable`);
    },
  );

  it.each(['sleepChar', 'stunChar'] as const)(
    '%s rejects a malformed outer costParams channel without throwing and preserves legacy ctx.picked selection',
    (kind) => {
      const state = stateWith(['SLEEP-COST', 'SLEEP-COST']);
      const first = state.players.self.scene[0]!;
      const chosen = state.players.self.scene[1]!;
      const cost: Cost = {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self' },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      };
      const baseCtx = {
        source: {
          cardId: 'SLEEP-COST', uid: first.uid, abilityId: 'a1', player: 'self' as const, area: 'scene' as const,
        },
        bindings: {},
      };

      for (const rawCostParams of [null, [], 'bad']) {
        const malformedCtx = { ...baseCtx, dyn: { costParams: rawCostParams } } as never;
        expect(() => canPayAtomically(state, cost, malformedCtx)).not.toThrow();
        expect(canPayAtomically(state, cost, malformedCtx)).toBe(false);
        expect(() => produce(state, (draft) => { pay(draft, cost, malformedCtx); }))
          .toThrow(`${kind} is not payable`);
      }

      const legacyPickedCtx = {
        ...baseCtx,
        picked: [{ kind: 'char' as const, uid: chosen.uid, cardId: chosen.cardId, player: 'self' as const }],
      };
      expect(canPayAtomically(state, cost, legacyPickedCtx)).toBe(true);
      const after = produce(state, (draft) => { pay(draft, cost, legacyPickedCtx); });
      expect(after.players.self.scene.find(char => char.uid === first.uid)?.state).toBe('active');
      expect(after.players.self.scene.find(char => char.uid === chosen.uid)?.state).toBe(
        kind === 'sleepChar' ? 'sleep' : 'stun',
      );
    },
  );

  it('validates the exact sleepChar UID again at the public declaration boundary', () => {
    registerCardDef(card('TARGETED-SLEEP', [declared('a1', {
      kind: 'sleepChar',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'self', filter: { trait: 'payer' } },
        n: { min: 1, max: 1 },
        chooser: 'self',
      },
    })]));
    registerCardDef(card('PAYER-A', [], ['payer']));
    registerCardDef(card('PAYER-B', [], ['payer']));
    const state = stateWith(['TARGETED-SLEEP', 'PAYER-A', 'PAYER-B']);
    const sourceUid = state.players.self.scene[0]!.uid;
    const firstUid = state.players.self.scene[1]!.uid;
    const chosenUid = state.players.self.scene[2]!.uid;

    expect(canActivateDeclaredAbility(state, sourceUid, 'a1', {
      sleepChar: { uids: ['forged'] },
    })).toBe(false);
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: sourceUid,
      abilId: 'a1',
      costParams: { sleepChar: { uids: ['forged'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(state);

    expect(canActivateDeclaredAbility(state, sourceUid, 'a1', {
      sleepChar: { uids: [chosenUid] },
    })).toBe(true);
    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: sourceUid,
      abilId: 'a1',
      costParams: { sleepChar: { uids: [chosenUid] } },
    })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find(char => char.uid === firstUid)?.state).toBe('active');
    expect(after.players.self.scene.find(char => char.uid === chosenUid)?.state).toBe('sleep');
  });

  it.each(['sleepChar', 'stunChar'] as const)(
    '%s fails closed at the public declaration boundary for every malformed or ineligible explicit witness',
    (kind) => {
      const sourceId = `TARGETED-${kind}`;
      registerCardDef(card(sourceId, [declared('a1', {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self', filter: { trait: 'payer' } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      })]));
      registerCardDef(card(`PAYER-A-${kind}`, [], ['payer']));
      registerCardDef(card(`PAYER-B-${kind}`, [], ['payer']));
      registerCardDef(card(`SLEEPING-PAYER-${kind}`, [], ['payer']));
      registerCardDef(card(`STUNNED-PAYER-${kind}`, [], ['payer']));
      const state = produce(stateWith([
        sourceId, `PAYER-A-${kind}`, `PAYER-B-${kind}`, `SLEEPING-PAYER-${kind}`, `STUNNED-PAYER-${kind}`,
      ]), (draft) => {
        draft.players.self.scene[3]!.state = 'sleep';
        draft.players.self.scene[4]!.state = 'stun';
      });
      const sourceUid = state.players.self.scene[0]!.uid;
      const payerUid = state.players.self.scene[1]!.uid;
      const secondPayerUid = state.players.self.scene[2]!.uid;
      const sleepingPayerUid = state.players.self.scene[3]!.uid;
      const stunnedPayerUid = state.players.self.scene[4]!.uid;
      const outsiderUid = sourceUid;
      const malformed: Array<[string, unknown]> = [
        ['undefined own property', undefined],
        ['null', null],
        ['missing uids', {}],
        ['undefined uids', { uids: undefined }],
        ['null uids', { uids: null }],
        ['non-array uids', { uids: payerUid }],
        ['empty cardinality', { uids: [] }],
        ['duplicate uids', { uids: [payerUid, payerUid] }],
        ['too many uids', { uids: [payerUid, secondPayerUid] }],
        ['already sleeping payer', { uids: [sleepingPayerUid] }],
        ['already stunned payer', { uids: [stunnedPayerUid] }],
        ['filter-excluded uid', { uids: [outsiderUid] }],
      ];

      for (const [label, witness] of malformed) {
        const costParams = { [kind]: witness } as never;
        expect(canActivateDeclaredAbility(state, sourceUid, 'a1', costParams), label).toBe(false);
        const before = JSON.stringify(state);
        useGameStateStore.setState({ gameState: state });
        expect(dispatchEngineAction({ type: 'declaredAbility', uid: sourceUid, abilId: 'a1', costParams }), label)
          .toEqual({ ok: false, reason: 'not-allowed' });
        expect(JSON.stringify(useGameStateStore.getState().gameState), label).toBe(before);
      }
    },
  );

  it.each([
    ['sleepChar', 'self'],
    ['sleepChar', 'opp'],
    ['stunChar', 'self'],
    ['stunChar', 'opp'],
  ] as const)(
    '%s requires an exact witness for the human %s player at the public declaration boundary',
    (kind, player) => {
      const sourceId = `HUMAN-${player}-${kind}`;
      const firstPayerId = `FIRST-${player}-${kind}`;
      const chosenPayerId = `CHOSEN-${player}-${kind}`;
      registerCardDef(card(sourceId, [declared('a1', {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self', filter: { trait: 'payer' } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      })]));
      registerCardDef(card(firstPayerId, [], ['payer']));
      registerCardDef(card(chosenPayerId, [], ['payer']));
      const state = produce(createEmptyGameState(), (draft) => {
        draft.turn = { number: 1, player, phase: 'main', isFirstPlayerFirstTurn: false };
        draft.players[player].partner = { cardId: 'BLUE-PARTNER', state: 'active', location: 'partner-area' };
        mutate.scene.enter(draft, player, sourceId, { active: true });
        mutate.scene.enter(draft, player, firstPayerId, { active: true });
        mutate.scene.enter(draft, player, chosenPayerId, { active: true });
      });
      const sourceUid = state.players[player].scene[0]!.uid;
      const firstPayerUid = state.players[player].scene[1]!.uid;
      const chosenPayerUid = state.players[player].scene[2]!.uid;
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = player;

      const malformedOuterParams: Array<[string, unknown]> = [
        ['absent', undefined],
        ['null', null],
        ['array', []],
        ['string', 'bad'],
      ];
      for (const [label, rawCostParams] of malformedOuterParams) {
        const costParams = rawCostParams as never;
        expect(canActivateDeclaredAbility(state, sourceUid, 'a1', costParams), label).toBe(false);
        useGameStateStore.setState({ gameState: state });
        expect(dispatchEngineAction({
          type: 'declaredAbility',
          uid: sourceUid,
          abilId: 'a1',
          ...(rawCostParams === undefined ? {} : { costParams }),
        }), label).toEqual({ ok: false, reason: 'not-allowed' });
        expect(useGameStateStore.getState().gameState, label).toEqual(state);
      }

      expect(enumerateMoves(state, player)).toContainEqual({
        kind: 'declaredAbility', uid: sourceUid, abilityId: 'a1',
      });
      const implicit = produce(state, (draft) => { activateDeclaredAbility(draft, sourceUid, 'a1'); });
      expect(implicit.players[player].scene.find(char => char.uid === firstPayerUid)?.state).toBe(
        kind === 'sleepChar' ? 'sleep' : 'stun',
      );
      expect(implicit.players[player].scene.find(char => char.uid === chosenPayerUid)?.state).toBe('active');

      const validCostParams = { [kind]: { uids: [chosenPayerUid] } };
      expect(canActivateDeclaredAbility(state, sourceUid, 'a1', validCostParams)).toBe(true);
      useGameStateStore.setState({ gameState: state });
      expect(dispatchEngineAction({
        type: 'declaredAbility',
        uid: sourceUid,
        abilId: 'a1',
        costParams: validCostParams,
      })).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players[player].scene.find(char => char.uid === firstPayerUid)?.state).toBe('active');
      expect(after.players[player].scene.find(char => char.uid === chosenPayerUid)?.state).toBe(
        kind === 'sleepChar' ? 'sleep' : 'stun',
      );
    },
  );

  it.each(['sleepChar', 'stunChar'] as const)(
    '%s permits an exact alternative payment without a printed-cost witness',
    (kind) => {
      const sourceId = `ALT-${kind}`;
      const payerId = `ALT-PAYER-${kind}`;
      registerCardDef(card(sourceId, [declared('a1', {
        kind,
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self', filter: { trait: 'payer' } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      })], ['detective']));
      registerCardDef(card(payerId, [], ['payer']));
      const state = stateWith([sourceId, payerId, 'ALT-PROVIDER']);
      const sourceUid = state.players.self.scene.find(char => char.cardId === sourceId)!.uid;
      const payerUid = state.players.self.scene.find(char => char.cardId === payerId)!.uid;
      const providerUid = state.players.self.scene.find(char => char.cardId === 'ALT-PROVIDER')!.uid;
      const costParams = {
        paymentMode: 'alternative' as const,
        alternativeCostProviderUid: providerUid,
      };

      expect(canActivateDeclaredAbility(state, sourceUid, 'a1', costParams)).toBe(true);
      useGameStateStore.setState({ gameState: state });
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: sourceUid, abilId: 'a1', costParams }))
        .toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.scene.some(char => char.uid === providerUid)).toBe(false);
      expect(after.players.self.scene.find(char => char.uid === payerUid)?.state).toBe('active');
    },
  );

  it('rejects direct B01007 dispatch with an empty hand before cost payment or effect resolution', () => {
    const state = stateWith(['B01007']);
    const uid = state.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: state });

    expect(canDeclaredAbility(state, uid, 'a2')).toBe(true);
    expect(canActivateDeclaredAbility(state, uid, 'a2')).toBe(false);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a2' })).toEqual({ ok: false, reason: 'not-allowed' });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene[0]!.declaredUseCount['a2']).toBeUndefined();
    expect(after.log.some((entry) => entry.action === 'declaredAbility')).toBe(false);
  });

  it('preserves an already pending set-card replacement when preflight rejects another activation', () => {
    const state = stateWith(['B01007']);
    const uid = state.players.self.scene[0]!.uid;
    const pendingReplacement = replacementSentinel(uid, 'B01007');
    pushPendingSetCardReplacementSide(pendingReplacement);
    useGameStateStore.setState({
      gameState: state,
      pendingSetCardReplacement: pendingReplacement,
    });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a2' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(_drainPendingSetCardReplacementSide()).toMatchObject({ player: 'self', source: { uid } });
    expect(useGameStateStore.getState().pendingSetCardReplacement).toMatchObject({ player: 'self', source: { uid } });
  });

  it('blocks a new public declaration while a resolution, pending prompt, or action context owns dispatch', () => {
    const state = stateWith(['B01007'], ['payment']);
    const uid = state.players.self.scene[0]!.uid;
    const pending = replacementSentinel(uid, 'B01007');
    useGameStateStore.setState({ gameState: state, pendingSetCardReplacement: pending });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a2' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(pending);

    useGameStateStore.setState({ pendingSetCardReplacement: null, activeActionId: 'action:open' });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a2' })).toEqual({ ok: false, reason: 'not-allowed' });

    useGameStateStore.setState({ activeActionId: null });
    _setResolutionLock(true, 'test');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a2' })).toEqual({ ok: false, reason: 'not-allowed' });
    _setResolutionLock(false, null);
  });

  it('uses the same runtime declaration authorization in engine activation, UI, AI, and dispatcher', () => {
    const base = produce(stateWith(['NO-COST-DECLARED']), (draft) => {
      mutate.scene.enter(draft, 'opp', 'NO-COST-DECLARED', { active: true });
    });
    const selfUid = base.players.self.scene[0]!.uid;
    const oppUid = base.players.opp.scene[0]!.uid;
    const assertBlocked = (state: GameState, uid: string, player: 'self' | 'opp') => {
      const before = JSON.stringify(state);
      // Structural declaration discovery intentionally stays timing-agnostic.
      expect(canDeclaredAbility(state, uid, 'a1')).toBe(true);
      expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(false);
      expect(enumDeclaredAbilityIdsFor(state, uid)).toEqual([]);
      expect(enumerateMoves(state, player)).not.toContainEqual({ kind: 'declaredAbility', uid, abilityId: 'a1' });
      expect(isAllowed(state, { type: 'declaredAbility', uid, abilId: 'a1' })).toBe(false);
      useGameStateStore.setState({ gameState: state });
      expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
      const direct = produce(state, (draft) => { activateDeclaredAbility(draft, uid, 'a1'); });
      expect(JSON.stringify(direct)).toBe(before);
    };

    assertBlocked(base, oppUid, 'opp');
    assertBlocked(produce(base, (draft) => { draft.turn.player = 'opp'; }), selfUid, 'self');
    assertBlocked(produce(base, (draft) => { draft.turn.phase = 'auto'; }), selfUid, 'self');
    assertBlocked(produce(base, (draft) => { draft.turn.phase = 'end'; }), selfUid, 'self');

    expect(canDeclaredAbility(base, selfUid, 'a1')).toBe(true);
    expect(canActivateDeclaredAbility(base, selfUid, 'a1')).toBe(true);
    expect(enumDeclaredAbilityIdsFor(base, selfUid)).toEqual(['a1']);
    expect(enumerateMoves(base, 'self')).toContainEqual({ kind: 'declaredAbility', uid: selfUid, abilityId: 'a1' });
    useGameStateStore.setState({ gameState: base });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: selfUid, abilId: 'a1' })).toEqual({ ok: true });
  });

  it('rejects a no-cost declaration while an action, pending resolution, or resolver lock is open', () => {
    const base = produce(stateWith(['NO-COST-DECLARED']), (draft) => {
      mutate.scene.enter(draft, 'opp', 'NO-COST-DECLARED', { active: true });
    });
    const selfUid = base.players.self.scene[0]!.uid;
    const oppUid = base.players.opp.scene[0]!.uid;
    const assertUnchanged = (state: GameState) => {
      const before = JSON.stringify(state);
      expect(canActivateDeclaredAbility(state, selfUid, 'a1')).toBe(false);
      const direct = produce(state, (draft) => { activateDeclaredAbility(draft, selfUid, 'a1'); });
      expect(JSON.stringify(direct)).toBe(before);
      useGameStateStore.setState({ gameState: state });
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: selfUid, abilId: 'a1' })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
    };

    const actionOpen = produce(base, (draft) => {
      draft.players.opp.scene[0]!.state = 'sleep';
      flow.action.declare(draft, selfUid, { kind: 'char', uid: oppUid });
    });
    assertUnchanged(actionOpen);

    const pending = produce(base, (draft) => { event.queue(draft, { kind: 'atom', verb: 'noop', args: {} }); });
    assertUnchanged(pending);

    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    pushPendingSetCardReplacementSide(replacementSentinel(selfUid, 'NO-COST-DECLARED'));
    assertUnchanged(base);
    _drainPendingSetCardReplacementSide();

    _setResolutionLock(true, 'test');
    assertUnchanged(base);
    _setResolutionLock(false, null);
  });

  it('rejects insufficient remove-from-hand and sleeping costs, while preserving payable declarations', () => {
    const insufficient = stateWith(['HAND-COST'], ['one']);
    const handUid = insufficient.players.self.scene[0]!.uid;
    expect(canDeclaredAbility(insufficient, handUid, 'a1')).toBe(true);
    expect(canActivateDeclaredAbility(insufficient, handUid, 'a1')).toBe(false);
    expect(enumDeclaredAbilitySources(insufficient, 'self')).not.toContain(handUid);
    expect(enumDeclaredAbilityIdsFor(insufficient, handUid)).toEqual([]);
    expect(declaredMoves(insufficient)).not.toContainEqual({ kind: 'declaredAbility', uid: handUid, abilityId: 'a1' });
    useGameStateStore.setState({ gameState: insufficient });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: handUid, abilId: 'a1' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(insufficient);

    const sleeping = produce(stateWith(['SLEEP-COST']), (draft) => {
      mutate.scene.setState(draft, draft.players.self.scene[0]!.uid, 'sleep');
    });
    expect(canActivateDeclaredAbility(sleeping, sleeping.players.self.scene[0]!.uid, 'a1')).toBe(false);

    const payable = stateWith(['B01007'], ['payment']);
    const payableUid = payable.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: payable });
    expect(canActivateDeclaredAbility(payable, payableUid, 'a2')).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: payableUid, abilId: 'a2' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual([]);
  });

  it('rejects B04008 through UI, AI, and dispatcher when either declared cost leaf is unpayable', () => {
    const sleeping = produce(stateWith(['B04008']), (draft) => {
      draft.players.self.case.status = '解決編';
      draft.players.self.scene[0]!.state = 'sleep';
    });
    const sleepingUid = sleeping.players.self.scene[0]!.uid;
    expect(canActivateDeclaredAbility(sleeping, sleepingUid, 'a1')).toBe(false);
    expect(enumDeclaredAbilitySources(sleeping, 'self')).not.toContain(sleepingUid);
    expect(declaredMoves(sleeping)).not.toContainEqual({ kind: 'declaredAbility', uid: sleepingUid, abilityId: 'a1' });
    useGameStateStore.setState({ gameState: sleeping });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: sleepingUid, abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(sleeping);

    const emptyHand = produce(stateWith(['B04008']), (draft) => {
      draft.players.self.case.status = '解決編';
    });
    const emptyHandUid = emptyHand.players.self.scene[0]!.uid;
    expect(canActivateDeclaredAbility(emptyHand, emptyHandUid, 'a1')).toBe(false);
    expect(enumDeclaredAbilityIdsFor(emptyHand, emptyHandUid)).toEqual([]);
    useGameStateStore.setState({ gameState: emptyHand });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: emptyHandUid, abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(emptyHand);
  });

  it('activates checked-in B04008 through the public dispatcher when both cost leaves are payable', () => {
    const state = produce(stateWith(['B04008'], ['B04008-HAND-1', 'B04008-HAND-2']), (draft) => {
      draft.players.self.case.status = '解決編';
    });
    const uid = state.players.self.scene[0]!.uid;

    expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(true);
    expect(enumDeclaredAbilitySources(state, 'self')).toContain(uid);
    expect(declaredMoves(state)).toContainEqual({ kind: 'declaredAbility', uid, abilityId: 'a1' });
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.scene.find((entry) => entry.uid === uid)?.state).toBe('sleep');
    expect(after.log.some((entry) => entry.action === 'declaredAbility')).toBe(true);
  });

  it('keeps a declaration legal through an eligible alternative cost and aligns UI/AI candidates', () => {
    const state = stateWith(['ALT-TARGET', 'ALT-PROVIDER']);
    const targetUid = state.players.self.scene.find((entry) => entry.cardId === 'ALT-TARGET')!.uid;
    const providerUid = state.players.self.scene.find((entry) => entry.cardId === 'ALT-PROVIDER')!.uid;

    expect(canActivateDeclaredAbility(state, targetUid, 'a1')).toBe(true);
    expect(enumDeclaredAbilitySources(state, 'self')).toContain(targetUid);
    expect(enumDeclaredAbilityIdsFor(state, targetUid)).toContain('a1');
    expect(declaredMoves(state)).toContainEqual({ kind: 'declaredAbility', uid: targetUid, abilityId: 'a1' });

    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: targetUid, abilId: 'a1', costParams: { alternativeCostProviderUid: 'not-a-provider' } }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: targetUid, abilId: 'a1',
      costParams: { paymentMode: 'printed', alternativeCostProviderUid: providerUid },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((entry) => entry.uid === providerUid)).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: targetUid, abilId: 'a1', costParams: { alternativeCostProviderUid: providerUid } })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((entry) => entry.uid === providerUid)).toBe(false);
  });

  it('never changes a selected B07048 printed set-card payment into B05033 after its witness becomes stale', () => {
    const state = produce(stateWith(['B07048', 'B05033']), (draft) => {
      draft.players.self.partner.cardId = 'D06002';
      const source = draft.players.self.scene.find((entry) => entry.cardId === 'B07048')!;
      source.setCards = [
        { cardId: 'SET-ONE', faceUp: false, instanceId: 'set:one' },
        { cardId: 'SET-TWO', faceUp: false, instanceId: 'set:two' },
      ];
    });
    const sourceUid = state.players.self.scene.find((entry) => entry.cardId === 'B07048')!.uid;
    const providerUid = state.players.self.scene.find((entry) => entry.cardId === 'B05033')!.uid;
    const printed = {
      paymentMode: 'printed' as const,
      removeSetCard: { hostUids: [sourceUid, sourceUid], instanceIds: ['set:one', 'set:two'] },
    };
    expect(canActivateDeclaredAbility(state, sourceUid, 'a2', printed)).toBe(true);

    const stale = produce(state, (draft) => {
      mutate.char.removeOneSetCard(draft, sourceUid, { setCardInstanceId: 'set:two', cause: 'cost' });
    });
    const before = JSON.stringify(stale);
    useGameStateStore.setState({ gameState: stale });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: sourceUid, abilId: 'a2', costParams: printed }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((entry) => entry.uid === providerUid)).toBe(true);
    expect(useGameStateStore.getState().gameState!.players.self.scene.find((entry) => entry.uid === sourceUid)?.declaredUseCount.a2).toBeUndefined();

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: sourceUid, abilId: 'a2',
      costParams: { paymentMode: 'alternative', alternativeCostProviderUid: providerUid },
    })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.scene.some((entry) => entry.uid === providerUid)).toBe(false);
    expect(useGameStateStore.getState().gameState!.players.self.scene.find((entry) => entry.uid === sourceUid)?.declaredUseCount.a2).toBe(1);
  });

  it('rejects an explicitly selected unpayable B09027 choice before changing state, then accepts its payable branch', () => {
    const rejected = stateWith(['B09027'], ['payment']);
    const uid = rejected.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: rejected });

    expect(canActivateDeclaredAbility(rejected, uid, 'a1', { costChoice: 0 })).toBe(false);
    expect(canActivateDeclaredAbility(rejected, uid, 'a1', { costChoice: 9 })).toBe(false);
    expect(canActivateDeclaredAbility(rejected, uid, 'a1', { costChoicePath: [1, 999] })).toBe(false);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoice: 0 } }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(rejected);
    expect(rejected.players.self.hand).toEqual(['payment']);
    expect(rejected.players.self.scene[0]!.declaredUseCount['a1']).toBeUndefined();
    expect(rejected.log.some((entry) => entry.action === 'declaredAbility')).toBe(false);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoicePath: [1, 999] } }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(rejected);

    expect(canActivateDeclaredAbility(rejected, uid, 'a1', { costChoice: 1 })).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoice: 1 } }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual([]);
  });

  it('checks an explicit choice inside a composite declared cost before paying any item', () => {
    const state = stateWith(['COMPOSITE-COST'], ['first', 'second']);
    const uid = state.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: state });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoice: 0 } }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(state.players.self.hand).toEqual(['first', 'second']);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoice: 1 } }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual([]);
  });

  it('honors one explicit selection per nested and sibling cost choice', () => {
    const state = stateWith(['NESTED-CHOICE-COST'], Array.from({ length: 7 }, (_v, i) => `h${i}`));
    const uid = state.players.self.scene[0]!.uid;
    expect(canActivateDeclaredAbility(state, uid, 'a1', { costChoice: 1 })).toBe(false);
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoice: 1 } }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(canActivateDeclaredAbility(state, uid, 'a1', { costChoicePath: [1, 0, 1] })).toBe(true);
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1', costParams: { costChoicePath: [1, 0, 1] } }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual([]);
  });

  it('applies costChoicePath to the exact nested removeSetCard branch for declaration and UI picking', () => {
    const state = stateWith(['NESTED-REMOVE-SET-COST'], ['payment']);
    const uid = state.players.self.scene[0]!.uid;
    const cost: Cost = {
      kind: 'choice', items: [
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
        { kind: 'choice', items: [
          { kind: 'removeSetCard', n: 1 },
          { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
        ] },
      ],
    };

    expect(findRemoveSetCardCost(cost, [0])).toBeNull();
    expect(findRemoveSetCardCost(cost, [1, 0])).toMatchObject({ kind: 'removeSetCard', n: 1 });
    expect(canActivateDeclaredAbility(state, uid, 'a1', { costChoicePath: [0] })).toBe(true);
    expect(canActivateDeclaredAbility(state, uid, 'a1', { costChoicePath: [1, 0] })).toBe(false);
  });

  it('rejects nested composite costs that compete for the same hand card atomically', () => {
    const rejected = stateWith(['NESTED-HAND-COST'], ['only']);
    const uid = rejected.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: rejected });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(rejected);
    expect(rejected.players.self.hand).toEqual(['only']);
    expect(rejected.players.self.scene[0]!.declaredUseCount['a1']).toBeUndefined();
    expect(rejected.log.some((entry) => entry.action === 'declaredAbility')).toBe(false);
    expect(rejected.pendingEffects).toEqual([]);

    const accepted = stateWith(['NESTED-HAND-COST'], ['first', 'second']);
    const acceptedUid = accepted.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: accepted });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: acceptedUid, abilId: 'a1' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toEqual([]);
  });

  it('rejects duplicate explicit evidence picks before flipping or declaring', () => {
    const state = produce(stateWith(['FLIP-TWO-COST']), (draft) => {
      draft.players.self.evidence = ['E1', 'E2'].map((cardId) => ({
        cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' as const },
      }));
    });
    const uid = state.players.self.scene[0]!.uid;
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid, abilId: 'a1', costParams: { flipFaceUpEvidence: { indices: [0, 0] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(state.players.self.evidence.map((entry) => entry.faceUp)).toEqual([false, false]);
    expect(state.players.self.scene[0]!.declaredUseCount['a1']).toBeUndefined();
    expect(state.pendingEffects).toEqual([]);
  });
});
