import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { event } from '@/engine/event';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B04003P } from '@/cards/ct-p04/B04003P';
import { B08081 } from '@/cards/ct-p08/B08081';
import { B08081P } from '@/cards/ct-p08/B08081P';
import { runCardScenario } from '../helpers/card-probe-harness';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, EffectCtx } from '@/engine/types';

const RAN: CardDef = {
  id: 'DISPATCH_RAN', no: 'test/RAN', kind: 'character', names: ['毛利蘭'], colors: ['青'],
  level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const LOW: CardDef = { ...RAN, id: 'DISPATCH_LOW', no: 'test/LOW', names: ['Low'], ap: 8000 };
const HIGH: CardDef = { ...RAN, id: 'DISPATCH_HIGH', no: 'test/HIGH', names: ['High'], ap: 9000 };
const DISCARD: CardDef = { ...RAN, id: 'DISPATCH_DISCARD', no: 'test/DISCARD', names: ['Discard'] };
const HOST: CardDef = { ...RAN, id: 'DISPATCH_HOST', no: 'test/HOST', names: ['Host'] };
const OPP_SOURCE: CardDef = { ...RAN, id: 'DISPATCH_OPP_SOURCE', no: 'test/OPP_SOURCE', names: ['Opponent'] };
const OPP_EVENT: CardDef = { ...OPP_SOURCE, id: 'DISPATCH_OPP_EVENT', no: 'test/OPP_EVENT', kind: 'event' };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  engine.cards._resetRegistry();
  [B02067P, B04003, B04003P, B08081, B08081P, RAN, LOW, HIGH, DISCARD, HOST, OPP_SOURCE, OPP_EVENT]
    .forEach((card) => engine.cards.register(card));
  registerTriggeredListener();
});

describe('choose-intercept shipped cards — production dispatch probes', () => {
  const interceptEffect = {
    kind: 'sequence' as const,
    steps: [
      { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
        uid: '$pick', state: 'sleep',
        target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
      } },
      { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'self', n: 1 } },
    ],
  };

  const runProductionIntercept = (protector: CardDef, responderHand: string[]) => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.scene.push(sceneChar('DISPATCH_RAN', 'ran'), sceneChar(protector.id, 'protector'));
      d.players.opp.scene.push(sceneChar('DISPATCH_OPP_SOURCE', 'opp-source'));
      d.players.opp.hand = [...responderHand];
      d.players.opp.deck = ['drawn', 'still-in-deck'];
    });
    const ctx: EffectCtx = {
      source: { cardId: 'DISPATCH_OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: {},
    };
    return produce(state, (d) => {
      const resolved = resolveEffectPicks(d, interceptEffect as never, ctx, { byPlayer: 'opp' });
      runEffect(d, resolved, ctx);
      runAllUntilEmpty(d);
    });
  };

  it('B02067P cancels an opponent event selection and its continuation through the direct resolver path', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.number = 3;
      d.players.self.scene.push(sceneChar('DISPATCH_HOST', 'host', { setCards: [{ cardId: 'B02067P', faceUp: true }] }));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = {
      source: { cardId: 'DISPATCH_OPP_EVENT', uid: 'opp-event', abilityId: 'a1', player: 'opp', area: 'remove' },
      bindings: {},
    };
    const selectingEffect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          player: 'opp', uid: '$pick', state: 'sleep',
          target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: 'Host' } }, n: { min: 1, max: 1 }, chooser: 'opp' },
        } },
        { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'opp', n: 1 } },
      ],
    };

    const after = produce(state, (d) => {
      const resolved = resolveEffectPicks(d, selectingEffect as never, ctx, {
        byPlayer: 'opp', chooseAtomTarget: (_s, _verb, _args, candidates) => candidates[0] ?? null,
      });
      runEffect(d, resolved, ctx);
      runAllUntilEmpty(d);
    });

    expect(after.players.self.scene.find((c) => c.uid === 'host')?.state).toBe('active');
    expect(after.players.self.scene.find((c) => c.uid === 'host')?.setCards[0]?.abilityUseCounts?.a1)
      .toEqual({ turn: 3, count: 1 });
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.deck).toEqual(['drawn']);
  });

  it.each([B04003, B04003P, B08081, B08081P])(
    '%s.id production intercept removes one response card and continues the selected effect',
    (card) => {
      const after = runProductionIntercept(card, ['DISPATCH_DISCARD']);
      expect(after.players.self.scene.find((character) => character.uid === 'ran')?.state).toBe('sleep');
      expect(after.players.opp.remove).toEqual(['DISPATCH_DISCARD']);
      expect(after.players.opp.hand).toEqual(['drawn']);
      expect(after.players.opp.deck).toEqual(['still-in-deck']);
    },
  );

  it.each([B04003, B04003P, B08081, B08081P])(
    '%s.id production intercept negates the selected effect when the response cannot be paid',
    (card) => {
      const after = runProductionIntercept(card, []);
      expect(after.players.self.scene.find((character) => character.uid === 'ran')?.state).toBe('active');
      expect(after.players.opp.remove).toEqual([]);
      expect(after.players.opp.hand).toEqual([]);
      expect(after.players.opp.deck).toEqual(['drawn', 'still-in-deck']);
    },
  );

  it.each([B04003, B04003P])('%s.id a2 production declared dispatch pays sleep/reveal, then decks only AP <= 8000 at bottom', (card) => {
    const state = runCardScenario(card, [RAN, LOW, HIGH], {
      name: `${card.id} a2 declared reveal -> AP<=8000 sceneToDeck bottom`,
      setup: {
        selfScene: [{ cardId: card.id, uid: 'shinichi' }],
        oppScene: [{ cardId: 'DISPATCH_LOW', uid: 'low' }, { cardId: 'DISPATCH_HIGH', uid: 'high' }],
        hand: ['DISPATCH_RAN'],
      },
      drive: { kind: 'declared', uid: 'shinichi', abilityId: 'a2' },
      script: [{ pickUid: 'low' }],
      expect: [
        { kind: 'state', uid: 'shinichi', state: 'sleep' },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'DISPATCH_LOW', present: false },
        { kind: 'zone', side: 'opp', zone: 'deck', cardId: 'DISPATCH_LOW', present: true },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'DISPATCH_HIGH', present: true },
        { kind: 'handDelta', side: 'self', n: 0 },
      ],
    });
    expect(state.players.opp.deck.at(-1)).toBe('DISPATCH_LOW');
  });

  it.each([B08081, B08081P])('%s.id a1 production enter dispatch accepts optional discard, then returns an opponent level <= 8 character', (card) => {
    runCardScenario(card, [DISCARD, LOW, HIGH], {
      name: `${card.id} a1 enter optional discard -> opponent level<=8 to hand`,
      setup: {
        selfScene: [{ cardId: card.id, uid: 'masumi' }],
        oppScene: [{ cardId: 'DISPATCH_LOW', uid: 'low' }, { cardId: 'DISPATCH_HIGH', uid: 'high' }],
        hand: ['DISPATCH_DISCARD'],
      },
      drive: { kind: 'enter', cardId: card.id, uid: 'masumi' },
      script: ['optional:take', { pickCardId: 'DISPATCH_DISCARD' }, { pickUid: 'low' }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'DISPATCH_DISCARD', present: true },
        { kind: 'zone', side: 'opp', zone: 'hand', cardId: 'DISPATCH_LOW', present: true },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'DISPATCH_LOW', present: false },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'DISPATCH_HIGH', present: true },
      ],
    });
  });
});
