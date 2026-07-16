import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02051 } from '@/cards/ct-p02/B02051';
import { B09049 } from '@/cards/ct-p09/B09049';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState, Player, SceneChar } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

function other(side: Player): Player {
  return side === 'self' ? 'opp' : 'self';
}

function startHumanEffect(state: GameState, owner: Player, effect: Effect, sourceUid?: string): EffectCtx {
  const ctx: EffectCtx = {
    source: { player: owner, area: sourceUid ? 'scene' : 'hand', cardId: 'TEST', abilityId: 'a1', ...(sourceUid ? { uid: sourceUid } : {}) },
    bindings: {},
  };
  const resolved = resolveEffectPicks(state, effect, ctx, {
    byPlayer: owner,
    humanChooser: true,
    humanPlayer: owner,
    source: { cardId: ctx.source.cardId ?? '', abilityId: 'a1' },
  });
  runEffect(state, resolved, ctx);
  runAllUntilEmpty(state);
  return ctx;
}

const ORDER_OBSERVER: CardDef = {
  id: 'TEST_ORDER_OBSERVER',
  no: 'TEST_ORDER_OBSERVER',
  kind: 'character',
  names: ['TEST_ORDER_OBSERVER'],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'observer order probe',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
  ruleRefs: ['rules/15-abilities-effects.md'],
};

describe('continuation chain gate — real card carriers', () => {
  beforeEach(() => {
    registerAll();
    registerCardDef(ORDER_OBSERVER);
    _clearPendingEffectPickQueue();
  });

  it.each(['self', 'opp'] as const)('B02051 %s: active→sleep permits remove tail', owner => {
    const state = createEmptyGameState();
    const target = sceneChar('D08015', `${owner}-target`);
    target.state = 'active';
    state.players[owner].scene = [target];
    state.players[other(owner)].scene = [sceneChar('D08015', `${owner}-victim`)];
    startHumanEffect(state, owner, B02051.abilities[0]!.effect as Effect);

    const sleep = _drainPendingEffectPickSide();
    expect(sleep?.atomVerb).toBe('sceneSetState');
    applyPickAndContinuation(state, sleep!, target.uid);
    expect(_drainPendingEffectPickSide()?.atomVerb).toBe('sceneRemove');
  });

  it.each([
    ['self', 'sleep'], ['self', 'stun'], ['opp', 'sleep'], ['opp', 'stun'],
  ] as const)('B02051 %s: %s→sleep no-op blocks remove tail', (owner, initial) => {
    const state = createEmptyGameState();
    const target = sceneChar('D08015', `${owner}-target`);
    target.state = initial;
    state.players[owner].scene = [target];
    state.players[other(owner)].scene = [sceneChar('D08015', `${owner}-victim`)];
    startHumanEffect(state, owner, B02051.abilities[0]!.effect as Effect);

    const sleep = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, sleep!, target.uid);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it.each(['self', 'opp'] as const)('B02051 %s: decline blocks remove tail', owner => {
    const state = createEmptyGameState();
    state.players[owner].scene = [sceneChar('D08015', `${owner}-target`)];
    state.players[other(owner)].scene = [sceneChar('D08015', `${owner}-victim`)];
    startHumanEffect(state, owner, B02051.abilities[0]!.effect as Effect);

    applyPickSkipAndContinuation(state, _drainPendingEffectPickSide()!, false);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it.each([
    ['self', 'active', true], ['self', 'sleep', false], ['self', 'stun', false],
    ['opp', 'active', true], ['opp', 'sleep', false], ['opp', 'stun', false],
  ] as const)('B09049 %s: selected %s target controls self-active tail', (owner, initial, applies) => {
    const state = createEmptyGameState();
    const source = sceneChar('B09049', `${owner}-source`);
    source.state = 'sleep';
    const target = sceneChar('D08015', `${owner}-target`);
    target.state = initial;
    state.players[owner].scene = [source, target] as SceneChar[];
    startHumanEffect(state, owner, B09049.abilities[0]!.effect as Effect, source.uid);

    const sleep = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, sleep!, target.uid);
    expect(state.players[owner].scene.find(c => c.uid === source.uid)?.state).toBe(applies ? 'active' : 'sleep');
  });

  it.each(['self', 'opp'] as const)('B09049 %s: decline leaves self asleep', owner => {
    const state = createEmptyGameState();
    const source = sceneChar('B09049', `${owner}-source`);
    source.state = 'sleep';
    state.players[owner].scene = [source, sceneChar('D08015', `${owner}-target`)];
    startHumanEffect(state, owner, B09049.abilities[0]!.effect as Effect, source.uid);

    applyPickSkipAndContinuation(state, _drainPendingEffectPickSide()!, false);
    expect(state.players[owner].scene.find(c => c.uid === source.uid)?.state).toBe('sleep');
  });

  it('finishes the carrier remainder before draining leave observers', () => {
    const state = createEmptyGameState();
    const target = sceneChar(ORDER_OBSERVER.id, 'observer-target');
    state.players.self.scene = [target];
    state.players.self.deck = ['D08015', 'D08016'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'hand', cardId: 'TEST_ORDER_SOURCE', abilityId: 'a1' },
      bindings: { '$move': [{ cardId: 'D08015' }] },
    };
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'sceneRemove',
          args: {
            uid: '$pick',
            target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
          },
        },
        { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$move' } },
      ],
    };
    const resolved = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, humanPlayer: 'self',
      source: { cardId: 'TEST_ORDER_SOURCE', abilityId: 'a1' },
    });
    runEffect(state, resolved, ctx);
    runAllUntilEmpty(state);

    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, target.uid);
    expect(state.players.self.hand, 'remainder moves old top before observer draw').toEqual(['D08016']);
  });

  it('keeps observers deferred across a second human pick', () => {
    const state = createEmptyGameState();
    const observer = sceneChar(ORDER_OBSERVER.id, 'observer-target');
    const secondTarget = sceneChar('D08015', 'second-target');
    state.players.self.scene = [observer, secondTarget];
    state.players.self.deck = ['D08016'];
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'hand', cardId: 'TEST_ORDER_SOURCE', abilityId: 'a1' },
      bindings: {},
    };
    const pick = (verb: 'sceneRemove' | 'sceneSetState', args: Record<string, unknown>): Effect => ({
      kind: 'atom', verb,
      args: {
        uid: '$pick', ...args,
        target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
      },
    } as Effect);
    const effect: Effect = {
      kind: 'sequence',
      steps: [pick('sceneRemove', {}), pick('sceneSetState', { state: 'sleep' })],
    };
    // Enter through the runtime atom handler so the first carrier is queued
    // once; the initial pre-walk is covered by the tests above.
    runEffect(state, effect, ctx);
    runAllUntilEmpty(state);

    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, observer.uid);
    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb).toBe('sceneSetState');
    expect(state.players.self.hand, 'observer must wait while the effect re-pauses').toEqual([]);
    applyPickAndContinuation(state, second!, secondTarget.uid);
    expect(state.players.self.hand).toEqual(['D08016']);
    expect(state.players.self.scene.find(c => c.uid === secondTarget.uid)?.state).toBe('sleep');
  });
});
