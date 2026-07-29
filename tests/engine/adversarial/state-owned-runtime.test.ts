import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { declare, _getContext, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { atomReserveEffect } from '@/engine/effect/atom-handlers/misc';
import { publicHandRevealToken } from '@/engine/effect/atom-handlers/_shared';
import {
  _drainPendingEffectOptionalSide,
  _peekPendingEffectOptionalSide,
  pushPendingEffectOptionalSide,
  resetPendingEffectSession,
} from '@/engine/effect/pending-state';
import {
  hydratePendingRuntimeState,
  restorePendingRuntimeState,
  snapshotPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import {
  rememberedRuntimeAtomTargetPolicy,
  resetRuntimeAtomTargetPolicySession,
  resolveEffectPicks,
  type ResolveEffectPicksOpts,
} from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import type { Candidate, Effect, EffectCtx, GameState } from '@/engine/types';

const noop: Effect = { kind: 'atom', verb: 'noop', args: {} };
const effectCtx: EffectCtx = {
  source: { player: 'self', area: 'scene', cardId: 'SOURCE', uid: 'SOURCE#1' },
  bindings: {},
};

describe('adversarial: runtime identity is owned by GameState', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetPendingEffectSession();
  });

  it('continues effect entry IDs after JSON restore and registry reset', () => {
    const first = produce(createEmptyGameState(), (draft) => {
      for (let i = 0; i < 7; i++) event.queue(draft, noop, { player: 'self' });
    });
    const restored = JSON.parse(JSON.stringify(first)) as GameState;
    event._resetRegistry();

    const next = produce(restored, (draft) => {
      event.queue(draft, noop, { player: 'self' });
    });

    expect(next.pendingEffects.at(-1)?.id).toBe('e_8');
    expect(new Set(next.pendingEffects.map((entry) => entry.id)).size).toBe(8);
  });

  it('continues scene UIDs after JSON restore and module reset', () => {
    const first = produce(createEmptyGameState(), (draft) => {
      for (let i = 0; i < 7; i++) {
        mutate.scene.enter(draft, i % 2 === 0 ? 'self' : 'opp', `C${i}`, {});
      }
    });
    const restored = JSON.parse(JSON.stringify(first)) as GameState;
    _resetUidCounter();

    const next = produce(restored, (draft) => {
      mutate.scene.enter(draft, 'opp', 'NEW', {});
    });

    expect(next.players.opp.scene.at(-1)?.uid).toBe('NEW#8');
  });

  it('recovers scene UID sequence from persisted continuations in a legacy save', () => {
    const restored = createEmptyGameState();
    restored.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 'OLD#9',
        byPlayer: 'self',
        target: { kind: 'case', player: 'opp' },
        phase: 'guard-window',
        startedAt: { turn: 1, nano: 1 },
      },
    };
    restored.pendingEffects.push({
      id: 'e_1',
      source: { player: 'self', uid: 'STACK#12' },
      triggeredBy: { hook: 'test' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: noop,
      state: 'pending',
    });

    const next = produce(JSON.parse(JSON.stringify(restored)) as GameState, (draft) => {
      mutate.scene.enter(draft, 'self', 'NEW', {});
    });

    expect(next.players.self.scene.at(-1)?.uid).toBe('NEW#13');
  });

  it('continues ActionContext IDs from restored state without cross-match globals', () => {
    const restored = createEmptyGameState();
    restored.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    restored.players.self.scene.push({
      cardId: 'A',
      uid: 'A#1',
      state: 'active',
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    restored.players.opp.scene.push({
      cardId: 'B',
      uid: 'B#2',
      state: 'sleep',
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    Object.assign(restored, {
      actionContextSeq: 7,
      actionContexts: {
        ax_7: {
          id: 'ax_7',
          byUid: 'old',
          byPlayer: 'opp',
          target: { kind: 'case', player: 'self' },
          phase: 'action-end',
          startedAt: { turn: 2, nano: 1 },
        },
      },
    });

    const next = produce(restored, (draft) => {
      declare(draft, 'A#1', { kind: 'char', uid: 'B#2' });
    });

    expect(_getContext(next, 'ax_8')?.byUid).toBe('A#1');
    expect(Object.keys(next.actionContexts ?? {})).toEqual(['ax_7', 'ax_8']);
  });

  it('restores a paused turn-boundary decision instead of skipping it', () => {
    const base = createEmptyGameState();
    base.turn = { number: 3, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    base.pendingTurnTransition = {
      endingPlayer: 'self',
      stage: 'after-end-start',
      startNextTurn: true,
    };
    pushPendingEffectOptionalSide({
      player: 'self',
      source: { cardId: 'SOURCE', abilityId: 'optional', uid: 'SOURCE#1' },
    });

    const paused = produce(base, (draft) => runAllUntilEmpty(draft));
    resetPendingEffectSession();
    const restored = JSON.parse(JSON.stringify(paused)) as GameState;
    const stillPaused = produce(restored, (draft) => runAllUntilEmpty(draft));

    expect(stillPaused.turn).toMatchObject({ number: 3, player: 'self' });
    expect(stillPaused.pendingTurnTransition?.stage).toBe('after-end-start');
    expect(_peekPendingEffectOptionalSide()?.source.abilityId).toBe('optional');
  });

  it('hydrates independent paused states even when their local tokens collide', () => {
    const pausedState = (abilityId: string): GameState => {
      resetPendingEffectSession();
      const base = createEmptyGameState();
      pushPendingEffectOptionalSide({
        player: 'self',
        source: { cardId: 'SOURCE', abilityId, uid: `${abilityId}#1` },
      });
      return JSON.parse(JSON.stringify(
        produce(base, (draft) => runAllUntilEmpty(draft)),
      )) as GameState;
    };
    const stateA = pausedState('A');
    const stateB = pausedState('B');

    expect(stateA.pendingRuntimeState?.token).toBe(1);
    expect(stateB.pendingRuntimeState?.token).toBe(1);
    expect(hydratePendingRuntimeState(stateA)).toBe(true);
    expect(_peekPendingEffectOptionalSide()?.source.abilityId).toBe('A');
    expect(hydratePendingRuntimeState(stateB)).toBe(true);
    expect(_peekPendingEffectOptionalSide()?.source.abilityId).toBe('B');
    expect(hydratePendingRuntimeState(stateB)).toBe(false);
  });

  it('keeps the live continuation marker atomic across a failed dispatch retry', () => {
    const base = createEmptyGameState();
    base.turn = { number: 3, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    base.pendingTurnTransition = {
      endingPlayer: 'self',
      stage: 'after-end-start',
      startNextTurn: true,
    };
    pushPendingEffectOptionalSide({
      player: 'self',
      source: { cardId: 'SOURCE', abilityId: 'optional', uid: 'SOURCE#1' },
    });
    const paused = produce(base, (draft) => runAllUntilEmpty(draft));
    const dispatchSnapshot = snapshotPendingRuntimeState();

    resetPendingEffectSession();
    restorePendingRuntimeState(dispatchSnapshot);
    _drainPendingEffectOptionalSide();
    const resumed = produce(paused, (draft) => runAllUntilEmpty(draft));

    expect(resumed.turn).toMatchObject({ number: 4, player: 'opp' });
    expect(resumed.pendingRuntimeState).toBeUndefined();
  });

  it('continues reserved-effect IDs after JSON restore without a module counter', () => {
    const restored = createEmptyGameState();
    restored.reservedEffects.push({
      id: 're_8',
      trigger: { hook: 'old', mode: 'next-match', player: 'self', armedTurn: 1 },
      effect: noop,
      source: { player: 'self', cardId: 'SOURCE' },
    });

    const next = produce(JSON.parse(JSON.stringify(restored)) as GameState, (draft) => {
      atomReserveEffect(draft, {
        hook: 'next',
        mode: 'next-match',
        effect: noop,
      }, effectCtx);
    });

    expect(next.reservedEffects.map((entry) => entry.id)).toEqual(['re_8', 're_9']);
  });

  it('continues public-hand reveal tokens from restored GameState', () => {
    const restored = createEmptyGameState();
    Object.assign(restored, { publicHandRevealSeq: 7 });
    const ctx = structuredClone(effectCtx);

    expect(publicHandRevealToken(restored, ctx)).toBe('public-hand-reveal:8');
    expect(ctx.causal?.publicHandRevealToken).toBe('public-hand-reveal:8');
  });

  it('restores the built-in AI target policy without a module callback registry', () => {
    const state = createEmptyGameState();
    state.players.opp.scene.push(
      {
        cardId: 'LOW',
        uid: 'LOW#1',
        state: 'active',
        isNamed: false,
        enterOrder: 1,
        setCards: [],
        stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: 1000,
        lpOverride: 1,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      },
      {
        cardId: 'HIGH',
        uid: 'HIGH#2',
        state: 'active',
        isNamed: false,
        enterOrder: 2,
        setCards: [],
        stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: 9000,
        lpOverride: 1,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      },
    );
    const ctx = structuredClone(effectCtx);
    const candidates: Candidate[] = [
      { kind: 'char', player: 'opp', uid: 'LOW#1' },
      { kind: 'char', player: 'opp', uid: 'HIGH#2' },
    ];
    const opts = {
      chooseAtomTarget: () => candidates[1] ?? null,
      runtimeAtomTargetPolicyKey: 'heuristic',
      byPlayer: 'self',
    } as ResolveEffectPicksOpts;

    resolveEffectPicks(state, { kind: 'parallel', steps: [] }, ctx, opts);
    const restoredCtx = JSON.parse(JSON.stringify(ctx)) as EffectCtx;
    resetRuntimeAtomTargetPolicySession();

    const restoredPolicy = rememberedRuntimeAtomTargetPolicy(restoredCtx);
    expect(restoredPolicy?.(state, 'sceneRemove', {}, candidates, 'self')).toMatchObject({
      uid: 'HIGH#2',
    });
  });
});
