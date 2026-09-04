import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyChoiceAndContinuation,
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyRepeatOptionalAndContinuation,
  applyRpsAndContinuation,
  applySetCardChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainPendingDeckRevealSide } from '@/engine/effect/atom-handlers/_shared';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  _drainPendingEffectRepeatOptionalSide,
  _drainPendingRpsSide,
  _drainPendingSetCardChoiceSide,
  _pushPendingEffectPickSideForTest,
  setPendingSetCardChoiceRemainder,
} from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { cutIn } from '@/engine/flow/contact';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, ActionContext, CardDef, Effect, GameState } from '@/engine/types';

function card(id: string, kind: CardDef['kind'], abilities: AbilityDef[] = []): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: ['赤'],
    level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
  };
}

function ownEventAbility(effect: Effect): AbilityDef {
  return {
    id: 'a1',
    type: 'triggered',
    scope: 'on-hand',
    trigger: {
      hook: 'effect:declared',
      selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
    },
    effect,
  };
}

function legalEventState(cardId: string): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤'];
  state.players.self.file = [{ type: 'card-back', cardId: 'FILE' }];
  state.players.self.hand = [cardId];
  state.players.self.deck = [];
  return state;
}

describe('BUG-166/176 production provenance wiring', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectPickQueue();
    while (_drainPendingDeckRevealSide()) { /* clear presentation FIFO */ }
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('normal event hand-use keeps provenance through listener, pending choice, and resume', () => {
    const effect: Effect = {
      kind: 'choice',
      chooser: 'self',
      options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    };
    register(card('NORMAL', 'event', [ownEventAbility(effect)]));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = legalEventState('NORMAL');

    handUseCard(state, 'self', 'NORMAL');
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectChoiceSide();
    expect(pending?.source.resolutionKind).toBe('normal-event');
    applyChoiceAndContinuation(state, pending!, 0);

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['NORMAL']);
    expect(state.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
  });

  it('choice resume preserves the full source tuple into its next human decision', () => {
    const effect: Effect = {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom', verb: 'sceneSetState', args: {
            uid: '$pick', state: 'sleep',
            target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 0, max: 1 }, chooser: 'self' },
          },
        },
        { kind: 'parallel', steps: [] },
      ],
    };
    register(card('NORMAL', 'event', [ownEventAbility(effect)]));
    register(card('TARGET', 'character'));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = legalEventState('NORMAL');
    mutate.scene.enter(state, 'self', 'TARGET', {});

    handUseCard(state, 'self', 'NORMAL');
    runAllUntilEmpty(state);
    applyChoiceAndContinuation(state, _drainPendingEffectChoiceSide()!, 0);

    expect(_drainPendingEffectPickSide()).toMatchObject({
      player: 'self', ownerPlayer: 'self',
      source: { uid: 'hand:self:NORMAL', cardId: 'NORMAL', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event' },
    });
  });

  it('contact cut-in is queued as cutin and may refresh from its own remove card', () => {
    const cutinAbility: AbilityDef = {
      id: 'ci',
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    };
    register(card('ATK', 'character'));
    register(card('DEF', 'character'));
    register(card('CUTIN', 'event', [cutinAbility]));
    registerTriggeredListener();
    const state = createEmptyGameState();
    const attacker = mutate.scene.enter(state, 'self', 'ATK', {});
    const defender = mutate.scene.enter(state, 'opp', 'DEF', {});
    state.players.self.hand = ['CUTIN'];
    state.players.self.deck = [];
    const ax: ActionContext = {
      id: 'ax-provenance',
      byUid: attacker.uid,
      byPlayer: 'self',
      target: { kind: 'char', uid: defender.uid },
      phase: 'action-1',
      cutInUsed: {},
      startedAt: { turn: 1, nano: 0 },
      apSnapshot: { aUid: attacker.uid, aAP: 1000, bUid: defender.uid, bAP: 1000 },
      contactImmune: false,
    };

    cutIn(state, ax, 'self', 'CUTIN', 'ci');
    expect(state.pendingEffects.find((entry) => entry.source.cardId === 'CUTIN')?.source.resolutionKind).toBe('cutin');
    runAllUntilEmpty(state);

    expect(state.players.self.hand).toEqual(['CUTIN']);
    expect(state.players.self.remove).toEqual([]);
  });

  it('event queue serializes normal-event provenance into runtime EffectCtx', () => {
    register(card('NORMAL', 'event'));
    const state = createEmptyGameState();
    state.players.self.remove = ['NORMAL'];
    event.queue(
      state,
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { player: 'self', cardId: 'NORMAL', resolutionKind: 'normal-event' },
      'effect:declared',
      { kind: 'event-use' },
    );
    expect(state.pendingEffects[0]?.source.resolutionKind).toBe('normal-event');

    runAllUntilEmpty(state);

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['NORMAL']);
    expect(state.gameResult).toMatchObject({ reason: 'deck-out' });
  });

  it('does not inherit a normal-event marker into a third-party declaration reaction', () => {
    const own = ownEventAbility({ kind: 'parallel', steps: [] });
    const observer: AbilityDef = {
      id: 'observe',
      type: 'triggered',
      scope: 'on-scene',
      trigger: {
        hook: 'effect:declared',
        matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
      },
      effect: { kind: 'parallel', steps: [] },
    };
    register(card('NORMAL', 'event', [own]));
    register(card('OBSERVER', 'character', [observer]));
    registerTriggeredListener();
    const state = legalEventState('NORMAL');
    mutate.scene.enter(state, 'self', 'OBSERVER', {});

    handUseCard(state, 'self', 'NORMAL');

    expect(state.pendingEffects.find((entry) => entry.source.cardId === 'NORMAL')?.source.resolutionKind).toBe('normal-event');
    expect(state.pendingEffects.find((entry) => entry.source.cardId === 'OBSERVER')?.source.resolutionKind).toBeUndefined();
  });

  it('keeps provenance across the dedicated RPS decision boundary', () => {
    register(card('NORMAL', 'event'));
    const state = createEmptyGameState();
    state.players.self.remove = ['NORMAL'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runEffect(
      state,
      {
        kind: 'rps',
        win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        lose: { kind: 'parallel', steps: [] },
      },
      {
        source: { player: 'self', cardId: 'NORMAL', uid: 'event:self', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event' },
        bindings: {},
      },
    );
    const pending = _drainPendingRpsSide();
    expect(pending?.source.resolutionKind).toBe('normal-event');
    const winningHand = pending?.aiHand === 'rock' ? 'paper' : pending?.aiHand === 'paper' ? 'scissors' : 'rock';
    applyRpsAndContinuation(state, pending!, winningHand);

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['NORMAL']);
    expect(state.gameResult).toMatchObject({ reason: 'deck-out' });
  });

  it('keeps provenance across optional and repeat-optional decisions', () => {
    register(card('NORMAL', 'event'));
    const source = {
      source: { player: 'self' as const, cardId: 'NORMAL', uid: 'event:self', abilityId: 'a1', area: 'hand' as const, resolutionKind: 'normal-event' as const },
      bindings: {},
    };
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    const optionalState = createEmptyGameState();
    optionalState.players.self.remove = ['NORMAL'];
    resolveEffectPicks(
      optionalState,
      { kind: 'optional', chooser: 'owner', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
      source,
      { humanChooser: true, humanPlayer: 'self', byPlayer: 'self', source: { cardId: 'NORMAL', abilityId: 'a1' } },
    );
    const optional = _drainPendingEffectOptionalSide();
    expect(optional?.source.resolutionKind).toBe('normal-event');
    applyOptionalAndContinuation(optionalState, optional!, true);
    expect(optionalState.pendingEffects.find((entry) => entry.triggeredBy.hook === 'effect:optional-resolved')?.source).toEqual({
      player: 'self', uid: 'event:self', cardId: 'NORMAL', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
    });
    expect(optionalState.players.self.remove).toEqual(['NORMAL']);
    expect(optionalState.gameResult).toMatchObject({ reason: 'deck-out' });

    const declinedState = createEmptyGameState();
    resolveEffectPicks(
      declinedState,
      { kind: 'optional', chooser: 'owner', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } } },
      source,
      { humanChooser: true, humanPlayer: 'self', byPlayer: 'self', source: { cardId: 'NORMAL', abilityId: 'a1' } },
    );
    applyOptionalAndContinuation(declinedState, _drainPendingEffectOptionalSide()!, false);
    expect(declinedState.pendingEffects.find((entry) => entry.triggeredBy.hook === 'effect:optional-resolved')?.source).toEqual({
      player: 'self', uid: 'event:self', cardId: 'NORMAL', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
    });

    const repeatState = createEmptyGameState();
    repeatState.players.self.remove = ['NORMAL'];
    runEffect(
      repeatState,
      { kind: 'repeatOptional', max: 1, body: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
      source,
    );
    const repeat = _drainPendingEffectRepeatOptionalSide();
    expect(repeat?.source.resolutionKind).toBe('normal-event');
    applyRepeatOptionalAndContinuation(repeatState, repeat!, true);
    expect(repeatState.players.self.remove).toEqual(['NORMAL']);
    expect(repeatState.gameResult).toMatchObject({ reason: 'deck-out' });
  });

  it('keeps provenance in generic pick and set-card-choice resumes', () => {
    register(card('NORMAL', 'event'));
    register(card('HOST', 'character'));
    register(card('SET', 'event'));

    const pickState = createEmptyGameState();
    pickState.players.self.remove = ['NORMAL'];
    _pushPendingEffectPickSideForTest({
      player: 'self',
      candidates: [{ uid: 'dummy', cardId: 'HOST', player: 'self' }],
      atomVerb: 'draw',
      atomArgs: { player: 'self', n: 0 },
      nMin: 1,
      nMax: 1,
      source: { cardId: 'NORMAL', uid: 'event:self', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event' },
    });
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(pickState, pick!, 'dummy');
    expect(pickState.pendingEffects.find((entry) => entry.triggeredBy.hook === 'effect:pick-resolved')?.source).toEqual({
      player: 'self', uid: 'event:self', cardId: 'NORMAL', abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
    });

    const skipState = createEmptyGameState();
    _pushPendingEffectPickSideForTest({
      player: 'self',
      candidates: [{ uid: 'dummy', cardId: 'HOST', player: 'self' }],
      atomVerb: 'draw',
      atomArgs: { player: 'self', n: 0 },
      nMin: 0,
      nMax: 1,
      source: { cardId: 'NORMAL', uid: 'event:self', abilityId: 'a2', area: 'evidence', resolutionKind: 'hirameki' },
    });
    applyPickSkipAndContinuation(skipState, _drainPendingEffectPickSide()!);
    expect(skipState.pendingEffects.find((entry) => entry.triggeredBy.hook === 'effect:pick-resolved')?.source).toEqual({
      player: 'self', uid: 'event:self', cardId: 'NORMAL', abilityId: 'a2', area: 'evidence', resolutionKind: 'hirameki',
    });

    const setState = createEmptyGameState();
    setState.players.self.remove = ['NORMAL'];
    const host = mutate.scene.enter(setState, 'self', 'HOST', {});
    mutate.char.setCard(setState, host.uid, 'SET', false);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const source = {
      source: { player: 'self' as const, cardId: 'NORMAL', uid: 'event:self', abilityId: 'a1', area: 'hand' as const, resolutionKind: 'normal-event' as const, triggerBatch: 91, ownerChosenOrder: 0, ownerOrderConfirmed: true },
      bindings: {},
    };
    runEffect(setState, { kind: 'setCardToEvidence', hostUid: host.uid }, source);
    event.queue(setState, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, { player: 'self', cardId: 'SIBLING', abilityId: 'a1' });
    runAllUntilEmpty(setState);
    expect(setState.pendingEffects[0]?.state).toBe('pending');
    const pendingSet = _drainPendingSetCardChoiceSide();
    expect(pendingSet?.source.resolutionKind).toBe('normal-event');
    expect(pendingSet?.source).toMatchObject({ triggerBatch: 91, ownerChosenOrder: 0, ownerOrderConfirmed: true });
    setPendingSetCardChoiceRemainder([{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }], 'sequence');
    applySetCardChoiceAndContinuation(setState, pendingSet!, pendingSet!.entries[0]!.instanceId);
    expect(setState.players.self.remove).toEqual(['NORMAL']);
    expect(setState.gameResult).toMatchObject({ reason: 'deck-out' });
  });

  it('keeps same-card reveal windows distinct by ability after real choice resumes', () => {
    const revealOption: Effect = {
      kind: 'atom', verb: 'deckRevealUntil', args: {
        player: 'self', maxN: 1, chooseMatch: 'upTo', filter: { kind: 'character' },
        bind: '$revealed', bindMatch: '$matched', visibility: 'public', viewer: 'all',
      },
    };
    register(card('TOP', 'character'));
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    state.players.self.deck = ['TOP'];
    const effect: Effect = { kind: 'choice', chooser: 'self', options: [revealOption, { kind: 'parallel', steps: [] }] };
    const queueChoice = (abilityId: string) => event.queue(
      state,
      effect,
      {
        player: 'self', uid: 'hand:self:DUAL', cardId: 'DUAL', abilityId,
        area: 'hand', resolutionKind: 'normal-event',
      },
      'effect:declared',
    );

    queueChoice('a1');
    runAllUntilEmpty(state);
    const firstChoice = _drainPendingEffectChoiceSide()!;
    expect(firstChoice.source.abilityId).toBe('a1');
    applyChoiceAndContinuation(state, firstChoice, 0);
    const firstPick = _drainPendingEffectPickSide()!;
    expect(firstPick.source.abilityId).toBe('a1');
    applyPickAndContinuation(state, firstPick, firstPick.candidates[0]!.uid);

    queueChoice('a2');
    runAllUntilEmpty(state);
    const secondChoice = _drainPendingEffectChoiceSide()!;
    expect(secondChoice.source.abilityId).toBe('a2');
    applyChoiceAndContinuation(state, secondChoice, 0);
    const secondPick = _drainPendingEffectPickSide()!;
    expect(secondPick.source.abilityId).toBe('a2');
    applyPickAndContinuation(state, secondPick, secondPick.candidates[0]!.uid);

    const firstReveal = _drainPendingDeckRevealSide();
    const secondReveal = _drainPendingDeckRevealSide();
    expect(firstReveal?.source).toEqual({ cardId: 'DUAL', uid: 'hand:self:DUAL', abilityId: 'a1' });
    expect(secondReveal?.source).toEqual({ cardId: 'DUAL', uid: 'hand:self:DUAL', abilityId: 'a2' });
    expect(firstReveal).not.toHaveProperty('awaitingPick');
    expect(secondReveal).not.toHaveProperty('awaitingPick');
    expect(_drainPendingDeckRevealSide()).toBeNull();
  });
});
