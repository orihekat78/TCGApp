import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _drainPendingEffectChoiceSide, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx } from '@/engine/types';

const ctx = (): EffectCtx => ({
  source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'a1' },
  bindings: {},
});

const conditionalStunPick: Effect = {
  kind: 'conditional',
  if: { kind: 'bound', key: '$revealed', presence: 'matched' },
  then: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 1 }, query: { area: 'scene', side: 'either', state: ['sleep'] } },
    },
  },
} as Effect;

describe('binding-dependent conditional pick deferral', () => {
  beforeAll(() => registerAll());
  beforeEach(() => _clearPendingEffectPickQueue());

  it('does not surface either branch before its binding is produced', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push({
      cardId: 'TARGET', uid: 'sleeping', state: 'sleep', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: {}, declaredUseCount: {},
    });

    const resolved = resolveEffectPicks(state, conditionalStunPick, ctx(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'TEST', abilityId: 'a1' },
    });

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(resolved).toEqual(conditionalStunPick);
  });

  it('surfaces only the runtime-selected branch and resumes its Pattern-A scene pick', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    state.players.self.scene.push({
      cardId: 'TARGET', uid: 'sleeping', state: 'sleep', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: {}, declaredUseCount: {},
    });
    const effectCtx = ctx();
    effectCtx.bindings.$revealed = [{ kind: 'card', cardId: 'GREEN', area: 'deck', player: 'self', index: 0 }];

    runEffect(state, conditionalStunPick, effectCtx);

    expect(_drainPendingEffectPickSide()).toMatchObject({
      player: 'self', atomVerb: 'sceneSetState', candidates: [{ uid: 'sleeping' }],
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('keeps legacy runtime re-picks queued when no runtime owner marker exists', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const state = createEmptyGameState();
    state.players.self.scene.push({
      cardId: 'TARGET', uid: 'legacy-sleeping', state: 'sleep', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: {}, declaredUseCount: {},
    });
    const effectCtx = ctx();
    effectCtx.bindings.$revealed = [{ kind: 'card', cardId: 'GREEN', area: 'deck', player: 'self', index: 0 }];

    runEffect(state, conditionalStunPick, effectCtx);

    expect(_drainPendingEffectPickSide()).toMatchObject({
      player: 'self', atomVerb: 'sceneSetState', candidates: [{ uid: 'legacy-sleeping' }],
    });
    expect(state.players.self.scene[0]?.state).toBe('sleep');
  });

  it('re-walks a binding-selected continuation so its human choice is surfaced', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    state.players.self.hand = ['CAMEL'];
    const effect: Effect = {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1, bind: '$camel' } },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$camel', presence: 'matched' },
          then: { kind: 'choice', chooser: 'self', options: [
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 3 } },
          ] },
          else: { kind: 'choice', chooser: 'self', options: [
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
          ] },
        },
      ],
    } as Effect;

    const effectCtx = ctx();
    runEffect(state, resolveEffectPicks(state, effect, effectCtx, {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'TEST', abilityId: 'a1' },
    }), effectCtx);
    const discard = _drainPendingEffectPickSide();
    expect(discard).not.toBeNull();

    applyPickAndContinuation(state, discard!, 'CAMEL#0');

    expect(_drainPendingEffectChoiceSide()).toMatchObject({
      player: 'self', options: [
        { index: 0, verb: 'draw', args: { player: 'self', n: 1 } },
        { index: 1, verb: 'draw', args: { player: 'self', n: 3 } },
      ],
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('keeps an opponent human decision when a bound conditional re-walks an opp-of-owner target', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    const state = createEmptyGameState();
    for (const uid of ['opp-first', 'opp-second']) {
      state.players.opp.scene.push({
        cardId: 'D08015', uid, state: 'active', isNamed: false, enterOrder: 1,
        setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null, turnEffects: {}, declaredUseCount: {},
      });
    }
    state.players.opp.hand = ['D08015'];
    const effect: Effect = {
      kind: 'chain', steps: [
        {
          kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1, bind: '$removed' },
        },
        {
          kind: 'conditional', if: { kind: 'bound', key: '$removed', presence: 'matched' }, then: {
            kind: 'atom', verb: 'sceneSetState', args: {
              uid: '$pick', state: 'sleep',
              target: { kind: 'pick', chooser: 'opp-of-owner', n: { min: 1, max: 1 }, query: { area: 'scene', side: 'opp' } },
            },
          },
        },
      ],
    } as Effect;
    const effectCtx = ctx();

    runEffect(state, resolveEffectPicks(state, effect, effectCtx, {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'TEST', abilityId: 'a1' },
    }), effectCtx);
    const first = _drainPendingEffectPickSide();
    expect(first).toMatchObject({ player: 'opp', candidates: [{ uid: 'D08015#0' }] });
    expect(first?.continuation?.ctx.source.player).toBe('self');

    applyPickAndContinuation(state, first!, 'D08015#0');

    expect(_drainPendingEffectPickSide()).toMatchObject({
      player: 'opp', candidates: [{ uid: 'opp-first' }, { uid: 'opp-second' }], atomVerb: 'sceneSetState',
    });
    expect(state.players.opp.scene[0]?.state).toBe('active');
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });
});
