import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { event } from '@/engine/event';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { applyChooseInterceptResponse, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { consultChooseIntercept, findChooseIntercept } from '@/engine/effect/consult-choose-intercept';
import { _clearPendingChooseInterceptSide, _drainPendingChooseInterceptSide } from '@/engine/effect/pending-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B04003P } from '@/cards/ct-p04/B04003P';
import { B08081 } from '@/cards/ct-p08/B08081';
import { B08081P } from '@/cards/ct-p08/B08081P';
import type { CardDef, EffectCtx } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const HOST: CardDef = {
  id: 'HOST', no: 'test/HOST', kind: 'character', names: ['Host'], colors: ['赤'],
  level: 1, ap: 1000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [],
};
const OPP_SOURCE: CardDef = {
  id: 'OPP_SOURCE', no: 'test/OPP_SOURCE', kind: 'character', names: ['Opponent'], colors: ['青'],
  level: 1, ap: 1000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [],
};
const OPP_EVENT: CardDef = { ...OPP_SOURCE, id: 'OPP_EVENT', no: 'test/OPP_EVENT', kind: 'event' };
const RAN: CardDef = { ...HOST, id: 'RAN', no: 'test/RAN', names: ['毛利蘭'] };
const RESPONSE_PROTECTOR: CardDef = {
  ...HOST,
  id: 'RESPONSE_PROTECTOR', no: 'test/RESPONSE_PROTECTOR', names: ['工藤新一'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
    trigger: { hook: 'effect:choose-intercept-discard' as never, interceptTarget: { cardName: '毛利蘭' } } as never,
    description: '',
  }],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingChooseInterceptSide();
  engine.cards._resetRegistry();
  [HOST, B02067, B04003, B04003P, B08081, B08081P, OPP_SOURCE, OPP_EVENT, RAN, RESPONSE_PROTECTOR].forEach((card) => engine.cards.register(card));
  registerTriggeredListener();
});

describe('choose-intercept — B02067 representative', () => {
  it('B02067 and B02067P have identical rules text', () => {
    expect({ ...B02067, id: '', no: '', rarity: '', imageUrl: '' })
      .toEqual({ ...B02067P, id: '', no: '', rarity: '', imageUrl: '' });
  });

  it('B04003/P and B08081/P retain identical printed rules', () => {
    expect({ ...B04003, id: '', no: '', rarity: '', imageUrl: '' }).toEqual({ ...B04003P, id: '', no: '', rarity: '', imageUrl: '' });
    expect({ ...B08081, id: '', no: '', rarity: '', imageUrl: '' }).toEqual({ ...B08081P, id: '', no: '', rarity: '', imageUrl: '' });
  });


  it('B04003 responds only in the opponent turn', () => {
    const base = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('B04003', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    expect(findChooseIntercept(base, 'ran', ctx)).toEqual({ kind: 'none' });
    const duringOppTurn = produce(base, (d) => { d.turn.player = 'opp'; });
    expect(produce(duringOppTurn, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({ kind: 'discard-or-cancel', protectorCardId: 'B04003' });
    })).toBeDefined();
  });

  it('B08081 excludes itself and requires a non-black ally', () => {
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const noAlly = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp'; d.players.self.scene.push(sceneChar('B08081', 'masumi')); d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
    });
    expect(findChooseIntercept(noAlly, 'masumi', ctx)).toEqual({ kind: 'none' });
    const withAlly = produce(noAlly, (d) => { d.players.self.scene.push(sceneChar('RAN', 'ran')); });
    expect(produce(withAlly, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({ kind: 'discard-or-cancel', protectorCardId: 'B08081' });
    })).toBeDefined();
  });

  it('does not intercept an opponent event effect selecting its host', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('HOST', 'host', { setCards: [{ cardId: 'B02067', faceUp: true }] }));
    });
    expect(consultChooseIntercept(state, 'host', {
      source: { cardId: 'OPP_EVENT', uid: 'event-source', abilityId: 'a1', player: 'opp', area: 'remove' }, bindings: {},
    })).toBe(false);
  });

  it('finds one character-owned discard-or-cancel response and consumes its limit', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE_PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const after = produce(state, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({
        kind: 'discard-or-cancel', responder: 'opp', protectorUid: 'shinichi', abilityId: 'a1',
      });
      expect(findChooseIntercept(d, 'ran', ctx)).toEqual({ kind: 'none' });
    });
    expect(after.players.self.scene.find((char) => char.uid === 'shinichi')?.declaredUseCount.a1).toBe(1);
  });

  it('has AI discard one exact hand occurrence and cancel the selected atom', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE_PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
      d.players.opp.hand = ['x', 'x'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const effect = { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
      uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
    } };
    const after = produce(state, (d) => {
      const resolved = resolveEffectPicks(d, effect as never, ctx, { byPlayer: 'opp' });
      runEffect(d, resolved, ctx);
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.hand).toEqual(['x']);
    expect(after.players.opp.remove).toEqual(['x']);
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
  });

  it('negates the selected effect remainder immediately when its set host is chosen by an opponent effect', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.number = 3;
      d.players.self.scene.push(sceneChar('HOST', 'host', {
        setCards: [{ cardId: 'B02067', faceUp: true }],
      }));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = {
      source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: {},
    };
    const selectingEffect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          player: 'opp', uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: 'Host' } }, n: { min: 1, max: 1 }, chooser: 'opp' },
        } },
        { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'opp', n: 1 } },
      ],
    };

    const after = produce(state, (d) => {
      const resolved = resolveEffectPicks(d, selectingEffect as never, ctx, {
        byPlayer: 'opp',
        chooseAtomTarget: (_state, _verb, _args, candidates) => candidates[0] ?? null,
      });
      runEffect(d, resolved, ctx);
      runAllUntilEmpty(d);
    });

    expect(after.players.self.scene.find((char) => char.uid === 'host')?.state).toBe('active');
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.deck).toEqual(['drawn']);
    expect(after.players.self.scene.find((char) => char.uid === 'host')?.declaredUseCount.a1).toBe(1);
  });

  it('also cancels the human pending-pick atom and its continuation', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('HOST', 'host', { setCards: [{ cardId: 'B02067', faceUp: true }] }));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP_SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'host', cardId: 'HOST', player: 'self' }], nMax: 1,
      continuation: { kind: 'sequence', remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], ctx },
    } as never;
    const after = produce(state, (d) => { applyPickAndContinuation(d, pending, 'host'); });
    expect(after.players.self.scene[0].state).toBe('active');
    expect(after.players.opp.hand).toEqual([]);
  });

  it('opens discard-or-cancel for a human response and cancels on an exact hand occurrence', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE_PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
      d.players.opp.hand = ['x', 'x'];
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP_SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'ran', cardId: 'RAN', player: 'self' }], nMax: 1,
      continuation: { kind: 'sequence', remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], ctx },
    } as never;
    const after = produce(state, (d) => {
      applyPickAndContinuation(d, pending, 'ran');
      const side = _drainPendingChooseInterceptSide();
      expect(side).toMatchObject({ player: 'opp', targetUid: 'ran' });
      applyChooseInterceptResponse(d, side!, 1);
    });
    expect(after.players.opp.hand).toEqual(['x']);
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
    expect(after.players.opp.deck).toEqual(['drawn']);
  });

  it('cancels the original pick and continuation when discard-or-cancel is declined or impossible', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE_PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP_SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP_SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP_SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'ran', cardId: 'RAN', player: 'self' }], nMax: 1,
      continuation: { kind: 'sequence', remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], ctx },
    } as never;
    const after = produce(state, (d) => {
      applyPickAndContinuation(d, pending, 'ran');
      const side = _drainPendingChooseInterceptSide();
      applyChooseInterceptResponse(d, side!, null);
    });
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
    expect(after.log).not.toContainEqual(expect.objectContaining({ action: 'effect:draw' }));
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.deck).toEqual(['drawn']);
  });
});
