// BUG-197: "original abilities" means every printed ability entry, not only keywords.
// External grants/riders and already queued effects remain valid (rules/15, 19, 25).

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { runAtom } from '@/engine/effect/atom-handlers';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { registerMisreadListener, _resetMisreadRegistered, _resetPendingMisread } from '@/engine/listeners/misread';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { candidates as actionCandidates, _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { alternativeCostProviders } from '@/engine/cost/alternative';
import { consultLeaveIntercept } from '@/engine/effect/consult-leave-intercept';
import { matchOneFilter } from '@/engine/target/candidates';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { makeChar, makeCtx } from '../../helpers/fixtures';

const draw = (id: string) => ({
  id,
  type: 'triggered' as const,
  scope: 'on-scene' as const,
  trigger: { hook: 'enter' as const, selfOnly: true },
  effect: { kind: 'atom' as const, verb: 'draw' as const, args: { player: 'self', n: 1 } },
  description: id,
});

function card(id: string, abilities: AbilityDef[], extra: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['緑'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
    ...extra,
  };
}

function baseState(sourceDef: CardDef): GameState {
  registerCardDef(sourceDef);
  const s = createEmptyGameState();
  s.turn.number = 2;
  s.turn.phase = 'main';
  s.players.self.scene.push(makeChar({ uid: 'source', cardId: sourceDef.id, enterOrder: 1 }));
  return s;
}

describe('BUG-197 original ability suppression', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetMisreadRegistered();
    _resetPendingMisread();
    _resetTargetExpanders();
    resetCardDefRegistry();
  });

  it('turn scope suppresses printed keyword, continuous, restriction and declared ability, then expires', () => {
    const abilities: AbilityDef[] = [
      {
        id: 'continuous',
        type: 'continuous',
        scope: 'on-scene',
        continuousModifier: {
          apDelta: 1000,
          selfActionBan: true,
          opponentRestrict: ['cutin'],
        },
        description: '',
      },
      {
        id: 'declared',
        type: 'declared',
        scope: 'on-scene',
        effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        description: '',
      },
    ];
    let s = baseState(card('ORIGINAL', abilities, { keywords: ['ブレット'] }));
    expect(readChar.ap(s, 'source')).toBe(2000);
    expect(readChar.hasKeyword(s, 'source', 'ブレット')).toBe(true);
    expect(readChar.selfContinuousFlag(s, 'source', 'selfActionBan')).toBe(true);
    expect(readChar.restrictsOpponent(s, 'self', 'cutin')).toBe(true);
    expect(canDeclaredAbility(s, 'source', 'declared')).toBe(true);

    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
    });

    expect(readChar.ap(s, 'source')).toBe(1000);
    expect(readChar.hasKeyword(s, 'source', 'ブレット')).toBe(false);
    expect(readChar.selfContinuousFlag(s, 'source', 'selfActionBan')).toBe(false);
    expect(readChar.restrictsOpponent(s, 'self', 'cutin')).toBe(false);
    expect(canDeclaredAbility(s, 'source', 'declared')).toBe(false);
    expect(matchOneFilter(
      s,
      'ORIGINAL',
      { keyword: 'ブレット' },
      s.players.self.scene[0]!,
      { kind: 'char', uid: 'source', cardId: 'ORIGINAL', player: 'self' },
    )).toBe(false);

    s = produce(s, (draft) => {
      mutate.char.clearTurnEffects(draft, 'source', 'turn');
    });
    expect(readChar.ap(s, 'source')).toBe(2000);
    expect(readChar.hasKeyword(s, 'source', 'ブレット')).toBe(true);
    expect(canDeclaredAbility(s, 'source', 'declared')).toBe(true);
  });

  it('suppresses printed trigger but preserves externally granted trigger and already queued effect', () => {
    const printed = draw('printed');
    const granted = {
      ...draw('granted'),
      id: 'granted',
      effect: { kind: 'atom' as const, verb: 'draw' as const, args: { player: 'self', n: 2 } },
    };
    let s = baseState(card('TRIGGERED', [printed]));
    s.players.self.scene[0]!.turnEffects['grantedAbilities'] = [granted];
    registerTriggeredListener();

    s = produce(s, (draft) => {
      event.queue(
        draft,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { player: 'self', uid: 'source', cardId: 'TRIGGERED' },
        'already-fired',
        {},
      );
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
      event.emit(draft, 'enter', { uid: 'source' }, { player: 'self', uid: 'source', cardId: 'TRIGGERED' });
    });

    expect(s.pendingEffects).toHaveLength(2);
    expect(s.pendingEffects[1]?.effect).toEqual(granted.effect);
  });

  it('suppresses printed aura and action target expansion while active', () => {
    const abilities: AbilityDef[] = [
      {
        id: 'aura',
        type: 'continuous',
        scope: 'on-scene',
        continuousModifier: { apDeltaAura: 1000 },
        description: '',
      },
      {
        id: 'expand',
        type: 'triggered',
        scope: 'on-scene',
        trigger: { hook: 'action:pre-target', selfOnly: true },
        effect: {
          kind: 'atom',
          verb: 'expandActionTargets',
          args: { side: 'opp', state: ['active'] },
        },
        description: '',
      },
    ];
    registerCardDef(card('TARGET', []));
    let s = baseState(card('AURA', abilities));
    s.players.self.scene.push(makeChar({ uid: 'ally', cardId: 'TARGET', enterOrder: 2 }));
    s.players.opp.scene.push(makeChar({ uid: 'enemy', cardId: 'TARGET', state: 'active', enterOrder: 1 }));
    expect(readChar.ap(s, 'ally')).toBe(2000);
    expect(actionCandidates(s, 'source').map((c) => c.uid)).toContain('enemy');

    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
    });

    expect(readChar.ap(s, 'ally')).toBe(1000);
    expect(actionCandidates(s, 'source').map((c) => c.uid)).not.toContain('enemy');
  });

  it('direct activation of a suppressed printed declared ability is a no-op', () => {
    const declared: AbilityDef = {
      id: 'declared',
      type: 'declared',
      scope: 'on-scene',
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '',
    };
    let s = baseState(card('DECLARED', [declared]));
    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
      activateDeclaredAbility(draft, 'source', 'declared');
    });
    expect(s.players.self.scene[0]!.declaredUseCount['declared']).toBeUndefined();
    expect(s.pendingEffects).toHaveLength(0);
  });

  it('public useDeclaredAbility does not count, log, or emit a suppressed printed ability', () => {
    const declared: AbilityDef = {
      id: 'declared',
      type: 'declared',
      scope: 'on-scene',
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '',
    };
    let observed = 0;
    event.on('effect:declared', () => { observed += 1; });
    let s = baseState(card('PUBLIC-DECLARED', [declared]));
    s = produce(s, draft => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
      useDeclaredAbility(draft, 'source', 'declared');
    });

    expect(s.players.self.scene[0]!.declaredUseCount['declared']).toBeUndefined();
    expect(s.log.some(entry => entry.action === 'declaredAbility')).toBe(false);
    expect(observed).toBe(0);
    expect(s.pendingEffects).toHaveLength(0);
  });

  it('external keyword remains, disguise inherits suppression, and leaving then re-entering resets it', () => {
    registerCardDef(card('NEW-FACE', [], { keywords: ['迅速'] }));
    let s = baseState(card('OLD-FACE', [], { keywords: ['ブレット'] }));
    s = produce(s, (draft) => {
      mutate.char.grantKeyword(draft, 'source', '外部付与', 'turn');
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
      mutate.char.disguiseInto(draft, 'source', 'NEW-FACE');
    });

    expect(readChar.keywords(s, 'source')).toEqual(['外部付与']);

    s = produce(s, (draft) => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
      mutate.scene.enter(draft, 'self', 'NEW-FACE', {});
    });
    const reentered = s.players.self.scene[0]!;
    expect(readChar.hasKeyword(s, reentered.uid, '迅速')).toBe(true);
  });

  it('permanent scope survives turn cleanup', () => {
    let s = baseState(card('PERMANENT', [], { keywords: ['ブレット'] }));
    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'permanent' }, makeCtx());
      mutate.char.clearTurnEffects(draft, 'source', 'turn');
    });
    expect(readChar.hasKeyword(s, 'source', 'ブレット')).toBe(false);
  });

  it('suppresses a printed leave trigger using the removed-character snapshot', () => {
    const leave: AbilityDef = {
      id: 'leave',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '',
    };
    let s = baseState(card('LEAVER', [leave]));
    registerTriggeredListener();
    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
      mutate.scene.removeToRemove(draft, 'source', 'effect');
    });
    expect(s.pendingEffects).toHaveLength(0);
  });

  it('suppresses printed misread eligibility', () => {
    const misread = {
      id: 'misread',
      type: 'icon-misread',
      scope: 'on-scene',
      effect: { kind: 'atom', verb: 'noop', args: { x: 2 } },
      description: '',
    } as unknown as AbilityDef;
    registerCardDef(card('REASONER', []));
    let s = baseState(card('MISREAD', [misread]));
    s.players.self.scene[0]!.cardId = 'REASONER';
    s.players.opp.scene.push(makeChar({ uid: 'misread', cardId: 'MISREAD', state: 'active', enterOrder: 1 }));
    registerMisreadListener();
    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'misread', scope: 'turn' }, makeCtx());
      event.emit(draft, 'reasoning:before-add', { uid: 'source' }, { player: 'self', uid: 'source' });
    });
    expect(s.players.opp.scene[0]!.state).toBe('active');
  });

  it('suppresses printed alternative-cost and leave-intercept providers', () => {
    const providerAbilities: AbilityDef[] = [
      {
        id: 'alternative',
        type: 'continuous',
        scope: 'on-scene',
        continuousModifier: { alternativeCostProvider: { targetFilter: {} } },
        description: '',
      },
      {
        id: 'intercept',
        type: 'triggered',
        scope: 'on-scene',
        trigger: { hook: 'leave:intercept' as never, optional: true },
        effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'hand' } },
        description: '',
      },
    ];
    registerCardDef(card('VICTIM', []));
    let s = baseState(card('PROVIDER', providerAbilities));
    s.players.self.scene.push(makeChar({ uid: 'victim', cardId: 'VICTIM', enterOrder: 2 }));
    const declared = {
      id: 'declared', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' }, description: '',
    } as AbilityDef;
    const ctx = makeCtx({ source: { player: 'self', uid: 'victim', cardId: 'VICTIM', area: 'scene' } });
    s = produce(s, (draft) => {
      runAtom(draft, 'charDisableOriginal', { uid: 'source', scope: 'turn' }, makeCtx());
    });

    expect(alternativeCostProviders(s, ctx, declared)).toEqual([]);
    expect(consultLeaveIntercept(s, s.players.self.scene[1]!, 'self', 'effect', 'enemy', 'opp')).toBeNull();
  });
});
