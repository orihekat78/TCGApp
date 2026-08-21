import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { event } from '@/engine/event';
import { _drainPendingEffectPickSide, resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { applyChooseInterceptResponse, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { consultChooseIntercept, findChooseIntercept } from '@/engine/effect/consult-choose-intercept';
import { _clearPendingChooseInterceptSide, _drainPendingChooseInterceptSide, _peekPendingChooseInterceptResume } from '@/engine/effect/pending-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { runOne } from '@/engine/resolve/stack';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B04003P } from '@/cards/ct-p04/B04003P';
import { B08081 } from '@/cards/ct-p08/B08081';
import { B08081P } from '@/cards/ct-p08/B08081P';
import type { CardDef, CausalLogEntryV1, EffectCtx, EffectStackEntry } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const HOST: CardDef = {
  id: 'HOST', no: 'test/HOST', kind: 'character', names: ['Host'], colors: ['赤'],
  level: 1, ap: 1000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [],
};
const OPP_SOURCE: CardDef = {
  id: 'OPP-SOURCE', no: 'test/OPP-SOURCE', kind: 'character', names: ['Opponent'], colors: ['青'],
  level: 1, ap: 1000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [],
};
const OPP_EVENT: CardDef = { ...OPP_SOURCE, id: 'OPP-EVENT', no: 'test/OPP-EVENT', kind: 'event' };
const RAN: CardDef = { ...HOST, id: 'RAN', no: 'test/RAN', names: ['毛利蘭'] };
const RESPONSE_PROTECTOR: CardDef = {
  ...HOST,
  id: 'RESPONSE-PROTECTOR', no: 'test/RESPONSE-PROTECTOR', names: ['工藤新一'],
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
  function causalInterceptEntry(): EffectStackEntry {
    return {
      id: 'choose-intercept-entry',
      source: { player: 'opp', cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom', verb: 'sceneSetState', args: {
              player: 'self', uid: '$pick', state: 'sleep',
              target: {
                kind: 'pick',
                query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } },
                n: { min: 1, max: 1 },
                chooser: 'opp',
              },
            },
          },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
      state: 'pending',
    };
  }

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
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    expect(findChooseIntercept(base, 'ran', ctx)).toEqual({ kind: 'none' });
    const duringOppTurn = produce(base, (d) => { d.turn.player = 'opp'; });
    expect(produce(duringOppTurn, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({ kind: 'discard-or-cancel', protectorCardId: 'B04003' });
    })).toBeDefined();
  });

  it('collects every physical B04003 copy into one simultaneous response batch', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.scene.push(
        sceneChar('RAN', 'ran'),
        sceneChar('B04003', 'shinichi-1'),
        sceneChar('B04003', 'shinichi-2'),
      );
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    });
    const ctx: EffectCtx = {
      source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: {},
    };

    const after = produce(state, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({
        kind: 'discard-or-cancel',
        protectorUid: 'shinichi-1',
        remainingProtectors: [{ protectorUid: 'shinichi-2' }],
      });
    });

    expect(after.players.self.scene.find((char) => char.uid === 'shinichi-1')?.declaredUseCount.a1).toBe(1);
    expect(after.players.self.scene.find((char) => char.uid === 'shinichi-2')?.declaredUseCount.a1).toBe(1);
  });

  it('B08081 excludes itself and requires a non-black ally', () => {
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const noAlly = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp'; d.players.self.scene.push(sceneChar('B08081', 'masumi')); d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
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
      source: { cardId: 'OPP-EVENT', uid: 'event-source', abilityId: 'a1', player: 'opp', area: 'remove' }, bindings: {},
    })).toBe(false);
  });

  it('finds one character-owned discard-or-cancel response and consumes its limit', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const after = produce(state, (d) => {
      expect(findChooseIntercept(d, 'ran', ctx)).toMatchObject({
        kind: 'discard-or-cancel', responder: 'opp', protectorUid: 'shinichi', abilityId: 'a1',
      });
      expect(findChooseIntercept(d, 'ran', ctx)).toEqual({ kind: 'none' });
    });
    expect(after.players.self.scene.find((char) => char.uid === 'shinichi')?.declaredUseCount.a1).toBe(1);
  });

  it('has AI discard one exact hand occurrence and continue the selected atom', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.hand = ['x', 'x'];
      d.players.opp.deck = ['drawn', 'still-in-deck'];
      startCausalSession(d, 'choose-ai-pay');
    });
    const effect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
        } },
        { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'self', n: 1 } },
      ],
    };
    const after = produce(state, (d) => {
      runOne(d, {
        ...causalInterceptEntry(),
        id: 'choose-ai-pay-entry',
        deferredPicks: true,
        effect: effect as never,
      });
    });
    expect(after.players.opp.hand).toEqual(['x', 'drawn']);
    expect(after.players.opp.remove).toEqual(['x']);
    expect(after.players.opp.deck).toEqual(['still-in-deck']);
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('sleep');
    expect(validateCausalLog(after.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-ai-pay:1'],
      ['select', 'choose-ai-pay:2'],
      ['discard', 'choose-ai-pay:3'],
      ['sleep', 'choose-ai-pay:4'],
      ['draw', 'choose-ai-pay:5'],
      ['summary', 'choose-ai-pay:6'],
    ]);
  });

  it('has AI negate the selected atom and sequence remainder when it cannot pay', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
      startCausalSession(d, 'choose-ai-unable');
    });
    const effect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
        } },
        { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'self', n: 1 } },
      ],
    };
    const after = produce(state, (d) => {
      runOne(d, { ...causalInterceptEntry(), id: 'choose-ai-unable-entry', deferredPicks: true, effect: effect as never });
    });
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.deck).toEqual(['drawn']);
    expect(validateCausalLog(after.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-ai-unable:1'],
      ['select', 'choose-ai-unable:2'],
      ['cancel', 'choose-ai-unable:3'],
    ]);
  });

  it('has AI resolve every simultaneous response even when one response cancels the selected effect', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.scene.push(
        sceneChar('RAN', 'ran', { setCards: [{ cardId: 'B02067', faceUp: true }] }),
        sceneChar('B04003', 'shinichi'),
      );
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.hand = ['payment'];
      d.players.opp.deck = ['drawn'];
      startCausalSession(d, 'choose-ai-mixed');
    });
    const effect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
        } },
        { kind: 'atom' as const, verb: 'draw' as never, args: { player: 'self', n: 1 } },
      ],
    };

    const after = produce(state, (d) => {
      runOne(d, { ...causalInterceptEntry(), id: 'choose-ai-mixed-entry', deferredPicks: true, effect: effect as never });
    });

    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.declaredUseCount.a1).toBe(1);
    expect(after.players.self.scene.find((char) => char.uid === 'shinichi')?.declaredUseCount.a1).toBe(1);
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.remove).toEqual(['payment']);
    expect(after.players.opp.deck).toEqual(['drawn']);
    const causalKinds = validateCausalLog(after.log as CausalLogEntryV1[]).map((node) => node.kind);
    expect(causalKinds).toContain('discard');
    expect(causalKinds.at(-1)).toBe('cancel');
    expect(causalKinds).not.toContain('sleep');
    expect(causalKinds).not.toContain('draw');
    expect(causalKinds).not.toContain('summary');
  });

  it('links a terminal AI remainder to both synchronous choose-intercept decisions', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.hand = ['payment'];
      startCausalSession(d, 'choose-ai-terminal');
    });
    const effect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'sceneSetState' as never, args: {
          uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } }, n: { min: 1, max: 1 } },
        } },
        { kind: 'atom' as const, verb: 'opponentLoses' as never, args: { player: 'self' } },
      ],
    };

    const after = produce(state, (d) => {
      runOne(d, { ...causalInterceptEntry(), id: 'choose-ai-terminal-entry', deferredPicks: true, effect: effect as never });
    });

    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'alt-lose' });
    expect(validateCausalLog(after.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-ai-terminal:1'],
      ['select', 'choose-ai-terminal:2'],
      ['discard', 'choose-ai-terminal:3'],
      ['sleep', 'choose-ai-terminal:4'],
      ['game-result', 'choose-ai-terminal:5'],
    ]);
  });

  it('negates the selected effect remainder immediately when its set host is chosen by an opponent effect', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.number = 3;
      d.players.self.scene.push(sceneChar('HOST', 'host', {
        setCards: [{ cardId: 'B02067', faceUp: true }],
      }));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = {
      source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' },
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
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP-SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'host', cardId: 'HOST', player: 'self' }], nMax: 1,
      continuation: { kind: 'sequence', remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], ctx },
    } as never;
    const after = produce(state, (d) => { applyPickAndContinuation(d, pending, 'host'); });
    expect(after.players.self.scene[0].state).toBe('active');
    expect(after.players.opp.hand).toEqual([]);
  });

  it('opens discard-or-cancel for a human response and continues after one exact hand occurrence is removed', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.hand = ['x', 'x'];
      d.players.opp.deck = ['drawn', 'still-in-deck'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP-SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'ran', cardId: 'RAN', player: 'self' }], nMax: 1,
      continuation: { kind: 'sequence', remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], ctx },
    } as never;
    const after = produce(state, (d) => {
      applyPickAndContinuation(d, pending, 'ran');
      const side = _drainPendingChooseInterceptSide();
      expect(side).toMatchObject({ player: 'opp', targetUid: 'ran' });
      applyChooseInterceptResponse(d, side!, 1);
    });
    expect(after.players.opp.hand).toEqual(['x', 'drawn']);
    expect(after.players.opp.remove).toEqual(['x']);
    expect(after.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('sleep');
    expect(after.players.opp.deck).toEqual(['still-in-deck']);
  });

  it('cancels the original pick and continuation when discard-or-cancel is declined or impossible', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.deck = ['drawn'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP-SOURCE', abilityId: 'a1', uid: 'opp-source' },
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

  it('keeps target selection, responder payment, and success in one causal chain', () => {
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    state.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
    state.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    state.players.opp.hand.push('x');
    state.players.opp.deck.push('drawn', 'still-in-deck');
    startCausalSession(state, 'choose-pay');

    runOne(state, causalInterceptEntry());
    const pick = _drainPendingEffectPickSide();
    expect(pick).not.toBeNull();
    applyPickAndContinuation(state, pick!, 'ran');
    const intercept = _drainPendingChooseInterceptSide();
    expect(intercept).toMatchObject({ player: 'opp', targetUid: 'ran' });
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-pay:1'],
    ]);

    applyChooseInterceptResponse(state, intercept!, 0);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-pay:1'],
      ['select', 'choose-pay:2'],
      ['discard', 'choose-pay:3'],
      ['sleep', 'choose-pay:4'],
      ['draw', 'choose-pay:5'],
      ['summary', 'choose-pay:6'],
    ]);
    expect(state.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('sleep');
    expect(state.players.opp.remove).toEqual(['x']);
    expect(state.players.opp.hand).toEqual(['drawn']);
  });

  it('records an intercept refusal as a terminal cancel without an orphan summary', () => {
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    state.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
    state.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    state.players.opp.hand.push('x');
    state.players.opp.deck.push('drawn', 'still-in-deck');
    startCausalSession(state, 'choose-decline');

    runOne(state, causalInterceptEntry());
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, pick!, 'ran');
    const intercept = _drainPendingChooseInterceptSide();
    applyChooseInterceptResponse(state, intercept!, null);

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-decline:1'],
      ['select', 'choose-decline:2'],
      ['cancel', 'choose-decline:3'],
    ]);
    expect(state.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('active');
    expect(state.players.opp.hand).toEqual(['x']);
  });

  it('keeps one causal chain when payment resumes into another human pick', () => {
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    state.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
    state.players.self.hand.push('self-discard');
    state.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    state.players.opp.hand.push('payment');
    startCausalSession(state, 'choose-repause');
    const entry: EffectStackEntry = {
      ...causalInterceptEntry(),
      id: 'choose-repause-entry',
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom', verb: 'sceneSetState', args: {
              player: 'self', uid: '$pick', state: 'sleep',
              target: {
                kind: 'pick',
                query: { area: 'scene', side: 'opp', filter: { cardName: '毛利蘭' } },
                n: { min: 1, max: 1 },
                chooser: 'opp',
              },
            },
          },
          { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
        ],
      },
    };

    runOne(state, entry);
    const targetPick = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, targetPick!, 'ran');
    const intercept = _drainPendingChooseInterceptSide();
    applyChooseInterceptResponse(state, intercept!, 0);

    const nestedPick = _drainPendingEffectPickSide();
    expect(nestedPick?.atomVerb).toBe('discard');
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-repause:1'],
      ['select', 'choose-repause:2'],
      ['discard', 'choose-repause:3'],
      ['sleep', 'choose-repause:4'],
    ]);

    applyPickAndContinuation(state, nestedPick!, nestedPick!.candidates[0]!.uid);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-repause:1'],
      ['select', 'choose-repause:2'],
      ['discard', 'choose-repause:3'],
      ['sleep', 'choose-repause:4'],
      ['select', 'choose-repause:5'],
      ['discard', 'choose-repause:6'],
      ['summary', 'choose-repause:7'],
    ]);
  });

  it('records the unconditional set-card interception as select then cancel', () => {
    const state = createEmptyGameState();
    state.turn.number = 3;
    state.players.self.scene.push(sceneChar('HOST', 'host', {
      setCards: [{ cardId: 'B02067', faceUp: true }],
    }));
    state.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
    startCausalSession(state, 'choose-immediate');
    const entry: EffectStackEntry = {
      ...causalInterceptEntry(),
      id: 'choose-immediate-entry',
      effect: {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          player: 'self', uid: '$pick', state: 'sleep',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'opp', filter: { cardName: 'Host' } },
            n: { min: 1, max: 1 },
            chooser: 'opp',
          },
        },
      },
    };

    runOne(state, entry);
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, pick!, 'host');

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['select', 'choose-immediate:1'],
      ['cancel', 'choose-immediate:2'],
    ]);
    expect(state.players.self.scene[0]?.state).toBe('active');
  });

  it('rejects an invalid discard occurrence without consuming the resumable effect', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('RAN', 'ran'), sceneChar('RESPONSE-PROTECTOR', 'shinichi'));
      d.players.opp.scene.push(sceneChar('OPP-SOURCE', 'opp-source'));
      d.players.opp.hand = ['x'];
    });
    const ctx: EffectCtx = { source: { cardId: 'OPP-SOURCE', uid: 'opp-source', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} };
    const pending = {
      player: 'self', ownerPlayer: 'opp', source: { cardId: 'OPP-SOURCE', abilityId: 'a1', uid: 'opp-source' },
      atomVerb: 'sceneSetState', atomArgs: { uid: '$pick', state: 'sleep' }, candidates: [{ uid: 'ran', cardId: 'RAN', player: 'self' }], nMin: 1, nMax: 1,
      continuation: { kind: 'sequence', remainder: [], ctx },
    } as never;
    let side: ReturnType<typeof _drainPendingChooseInterceptSide> = null;
    const awaiting = produce(state, (d) => {
      applyPickAndContinuation(d, pending, 'ran');
      side = _drainPendingChooseInterceptSide();
    });

    expect(() => produce(awaiting, (d) => applyChooseInterceptResponse(d, side!, 4))).toThrow(/discard occurrence/i);
    expect(_peekPendingChooseInterceptResume()).not.toBeNull();

    const resumed = produce(awaiting, (d) => applyChooseInterceptResponse(d, side!, 0));
    expect(resumed.players.opp.hand).toEqual([]);
    expect(resumed.players.self.scene.find((char) => char.uid === 'ran')?.state).toBe('sleep');
  });
});
