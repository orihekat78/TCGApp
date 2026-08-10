import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { declare, _getContext, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { atomReserveEffect } from '@/engine/effect/atom-handlers/misc';
import {
  _drainPendingDeckRevealSide,
  _drainPendingPublicHandRevealSide,
  publicHandRevealToken,
  queuePendingDeckRevealSide,
  queuePendingPublicHandRevealSide,
} from '@/engine/effect/atom-handlers/_shared';
import {
  _drainPendingEffectOptionalSide,
  _drainPendingSetCardReplacementSide,
  _peekPendingEffectOptionalSide,
  _peekPendingEffectPickSide,
  _peekPendingSetCardReplacementGuard,
  _peekPendingSetCardReplacementSide,
  pushPendingEffectOptionalSide,
  pushPendingEffectPickSide,
  pushPendingEffectRepeatOptionalSide,
  pushPendingSetCardReplacementSide,
  resetPendingEffectSession,
} from '@/engine/effect/pending-state';
import {
  hydratePendingRuntimeState,
  persistPendingRuntimeState,
  resetPendingRuntimeStateAfterGameEnd,
  restorePendingRuntimeState,
  snapshotPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import {
  rememberedRuntimeAtomTargetPolicy,
  resetRuntimeAtomTargetPolicySession,
  resolveEffectPicks,
  type ResolveEffectPicksOpts,
} from '@/engine/effect/resolve-picks';
import { applyRepeatOptionalAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import type { Candidate, Effect, EffectCtx, GameState } from '@/engine/types';

const noop: Effect = { kind: 'atom', verb: 'noop', args: {} };
const effectCtx: EffectCtx = {
  source: { player: 'self', area: 'scene', cardId: 'SOURCE', uid: 'SOURCE#1' },
  bindings: {},
};

function persistedDeckPlace(
  value: Record<string, unknown>,
  currentDeck: string[] = ['A', 'B'],
): GameState {
  const state = createEmptyGameState();
  state.players.opp.deck = [...currentDeck];
  state.pendingRuntimeState = {
    token: 1,
    snapshot: [{ key: '__pendingDeckPlaceSide', present: true, value }],
  };
  return state;
}

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

  it('persists the trusted set-card replacement guard after its presentation is drained', () => {
    const state = createEmptyGameState();
    const pending = {
      player: 'self' as const,
      fromUid: 'HOST#1',
      setCardInstanceId: 'set:HOST#1:CARD#1',
      candidates: [{ uid: 'TARGET#1', cardId: 'TARGET' }],
      source: { cardId: 'CARD', uid: 'HOST#1', abilityId: 'replace' },
      resume: { kind: 'scene-to-hand' as const },
    };
    pushPendingSetCardReplacementSide(pending);

    expect(_drainPendingSetCardReplacementSide()).toEqual(pending);
    expect(_peekPendingSetCardReplacementSide()).toBeNull();
    expect(_peekPendingSetCardReplacementGuard()).toEqual(pending);

    persistPendingRuntimeState(state);
    resetPendingEffectSession();
    expect(_peekPendingSetCardReplacementGuard()).toBeNull();

    expect(hydratePendingRuntimeState(state)).toBe(true);
    expect(_peekPendingSetCardReplacementSide()).toBeNull();
    expect(_peekPendingSetCardReplacementGuard()).toEqual(pending);
  });

  it('clears persisted and live pending decisions when the game is already over', () => {
    const state = createEmptyGameState();
    pushPendingEffectOptionalSide({
      player: 'self',
      source: { cardId: 'SOURCE', uid: 'SOURCE#1', abilityId: 'a1' },
    });
    queuePendingDeckRevealSide({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['PUBLIC'],
      matched: 'PUBLIC',
    });
    queuePendingPublicHandRevealSide({
      owner: 'opp',
      audience: 'all',
      cardIds: ['PUBLIC'],
      handSnapshot: ['PUBLIC'],
      lifetime: 'presentation',
      resolutionToken: 'terminal-save:1',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    persistPendingRuntimeState(state);
    state.gameResult = { winner: 'self', reason: 'evidence' };

    runAllUntilEmpty(state);

    expect(state.pendingRuntimeState).toBeUndefined();
    expect(state.pendingRuntimeSeq).toBe(1);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
    expect(_drainPendingDeckRevealSide()).toBeNull();
    expect(_drainPendingPublicHandRevealSide()).toBeNull();
    expect(snapshotPendingRuntimeState().every((entry) => !entry.present)).toBe(true);
  });

  it('hard-clears stale presentation output when an apply continuation starts after game end', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    queuePendingDeckRevealSide({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['STALE-PUBLIC'],
      matched: 'STALE-PUBLIC',
    });

    drainAiEffectPicks(state);

    expect(_drainPendingDeckRevealSide()).toBeNull();
    expect(snapshotPendingRuntimeState().every((entry) => !entry.present)).toBe(true);
  });

  it('keeps only completed live presentation outputs at the active terminal boundary', () => {
    const state = createEmptyGameState();
    pushPendingEffectOptionalSide({
      player: 'self',
      source: { cardId: 'SOURCE', uid: 'SOURCE#1', abilityId: 'a1' },
    });
    queuePendingDeckRevealSide({
      player: 'self',
      visibility: 'private',
      viewer: 'self',
      revealed: ['PENDING'],
      matched: null,
      awaitingPick: true,
      source: { cardId: 'PENDING', abilityId: 'a1' },
    });
    queuePendingDeckRevealSide({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['FIRST'],
      matched: 'FIRST',
      source: { cardId: 'FIRST', abilityId: 'a1' },
    });
    queuePendingDeckRevealSide({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['SECOND'],
      matched: 'SECOND',
      source: { cardId: 'SECOND', abilityId: 'a1' },
    });
    queuePendingPublicHandRevealSide({
      owner: 'opp',
      audience: 'all',
      cardIds: ['TRANSIENT'],
      handSnapshot: ['TRANSIENT'],
      lifetime: 'effect',
      resolutionToken: 'terminal-active:effect',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    queuePendingPublicHandRevealSide({
      owner: 'opp',
      audience: 'all',
      cardIds: ['PRESENTATION'],
      handSnapshot: ['PRESENTATION'],
      lifetime: 'presentation',
      resolutionToken: 'terminal-active:presentation',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });

    resetPendingRuntimeStateAfterGameEnd({ preserveCompletedPresentations: true });

    expect(_peekPendingEffectOptionalSide()).toBeNull();
    expect(_drainPendingDeckRevealSide()?.revealed).toEqual(['FIRST']);
    expect(_drainPendingDeckRevealSide()?.revealed).toEqual(['SECOND']);
    expect(_drainPendingDeckRevealSide()).toBeNull();
    expect(_drainPendingPublicHandRevealSide()).toMatchObject({
      lifetime: 'presentation',
      cardIds: ['PRESENTATION'],
    });
    expect(_drainPendingPublicHandRevealSide()).toBeNull();

    resetPendingRuntimeStateAfterGameEnd({ preserveCompletedPresentations: true });
    expect(snapshotPendingRuntimeState().every((entry) => !entry.present)).toBe(true);
    expect(state.pendingRuntimeSeq).toBeUndefined();
  });

  it('preserves completed presentation output when repeat-optional resolution ends the match', () => {
    const state = createEmptyGameState();
    const pending = {
      player: 'self' as const,
      source: { cardId: 'SOURCE', uid: 'SOURCE#1', abilityId: 'a1' },
      remaining: 1,
    };
    queuePendingDeckRevealSide({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['TERMINAL-REVEAL'],
      matched: 'TERMINAL-REVEAL',
      source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    pushPendingEffectRepeatOptionalSide(pending, {
      body: { kind: 'atom', verb: 'opponentLoses', args: { player: 'self' } },
      remaining: 1,
      ctx: effectCtx,
      remainder: [],
    });

    applyRepeatOptionalAndContinuation(state, pending, true);
    runAllUntilEmpty(state);

    expect(state.gameResult).toMatchObject({ winner: 'self', reason: 'alt-lose' });
    expect(_drainPendingDeckRevealSide()?.revealed).toEqual(['TERMINAL-REVEAL']);
  });

  it('rejects persisted runtime entries outside the pending-key allowlist', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__replayInjectedGlobal',
        present: true,
        value: 'injected',
      }],
    };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('Invalid pending runtime snapshot key at index 0');
    expect((globalThis as { __replayInjectedGlobal?: unknown }).__replayInjectedGlobal)
      .toBeUndefined();
  });

  it('validates every persisted runtime entry before changing live channels', () => {
    const probe = globalThis as { __pendingHirameki?: unknown };
    probe.__pendingHirameki = { probe: 'original' };
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [
        {
          key: '__pendingHirameki',
          present: true,
          value: {
            player: 'self',
            cardId: 'REPLACEMENT',
            abilityId: 'hirameki',
          },
        },
        {
          key: '__notAPendingChannel',
          present: true,
          value: null,
        },
      ],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('Invalid pending runtime snapshot key at index 1');
      expect(probe.__pendingHirameki).toEqual({ probe: 'original' });
    } finally {
      delete probe.__pendingHirameki;
    }
  });

  it('snapshots and restores a paused Hirameki action checkpoint', () => {
    const probe = globalThis as { __pendingHirameki?: unknown };
    probe.__pendingHirameki = {
      player: 'self',
      cardId: 'HIRAMEKI',
      abilityId: 'a1',
      actionId: 'action-1',
      causalCorrelationEventId: 'evidence-remove',
      gainDeferred: true,
    };

    try {
      const snapshot = snapshotPendingRuntimeState();
      delete probe.__pendingHirameki;
      restorePendingRuntimeState(snapshot);
      expect(probe.__pendingHirameki).toMatchObject({
        actionId: 'action-1',
        causalCorrelationEventId: 'evidence-remove',
      });
    } finally {
      delete probe.__pendingHirameki;
    }
  });

  it('rejects a malformed persisted Hirameki action checkpoint transactionally', () => {
    const probe = globalThis as { __pendingHirameki?: unknown };
    probe.__pendingHirameki = { player: 'self', cardId: 'LIVE', abilityId: 'a1' };
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingHirameki',
        present: true,
        value: {
          player: 'self',
          cardId: 'INVALID',
          abilityId: 'a1',
          actionId: 'action-1',
          causalCorrelationEventId: '',
        },
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('pendingHirameki.causalCorrelationEventId');
      expect(probe.__pendingHirameki).toEqual({ player: 'self', cardId: 'LIVE', abilityId: 'a1' });
    } finally {
      delete probe.__pendingHirameki;
    }
  });

  it('rejects duplicate persisted runtime channels before changing live channels', () => {
    const probe = globalThis as { __pendingContactStartAxId?: unknown };
    probe.__pendingContactStartAxId = 'live-action';
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [
        { key: '__pendingContactStartAxId', present: true, value: 'first' },
        { key: '__pendingContactStartAxId', present: true, value: 'second' },
      ],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('Invalid pending runtime snapshot duplicate key at index 1');
      expect(probe.__pendingContactStartAxId).toBe('live-action');
    } finally {
      delete probe.__pendingContactStartAxId;
    }
  });

  it('rejects internal runtime ownership markers from persisted snapshots', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRuntimeStateMarker',
        present: true,
        value: {
          token: 1,
          owner: { token: 1, snapshot: [] },
        },
      }],
    };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('internal marker cannot be persisted');
  });

  it('rejects an invalid persisted runtime token before changing live channels', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = { token: 0, snapshot: [] };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('Invalid pending runtime token');
  });

  it.each([-1, 1.5, 'evil'])('rejects an invalid restored runtime sequence before hydration: %s', (sequence) => {
    const state = createEmptyGameState();
    state.pendingRuntimeSeq = sequence as unknown as number;
    state.pendingRuntimeState = { token: 1, snapshot: [] };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('Invalid pending runtime sequence');
  });

  it.each([0, -1, 1.5, 'evil'])('rejects an invalid active runtime token before persistence: %s', (token) => {
    const state = createEmptyGameState();
    const malformed = {
      token: token as number,
      snapshot: [],
    };
    state.pendingRuntimeState = malformed;

    expect(() => persistPendingRuntimeState(state))
      .toThrow('Invalid pending runtime token');
    expect(state.pendingRuntimeState).toBe(malformed);
    expect(state.pendingRuntimeSeq).toBeUndefined();
  });

  it('rejects an invalid runtime sequence even when an active token can be reused', () => {
    const state = createEmptyGameState();
    const persisted = { token: 1, snapshot: [] };
    state.pendingRuntimeState = persisted;
    state.pendingRuntimeSeq = 'evil' as unknown as number;

    expect(() => persistPendingRuntimeState(state))
      .toThrow('Invalid pending runtime sequence');
    expect(state.pendingRuntimeState).toBe(persisted);
    expect(state.pendingRuntimeSeq).toBe('evil');
  });

  it('rejects ignored values on absent persisted entries before changing live channels', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: false,
        value: () => 7,
      }],
    };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('absent entries cannot contain a value');
  });

  it('clears live channels omitted by a persisted authority snapshot', () => {
    pushPendingEffectOptionalSide({
      player: 'self',
      source: { cardId: 'OLD', abilityId: 'OLD', uid: 'OLD#1' },
    });
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingHirameki',
        present: true,
        value: { player: 'self', cardId: 'NEW', abilityId: 'NEW' },
      }],
    };

    try {
      expect(hydratePendingRuntimeState(state)).toBe(true);
      expect(_peekPendingEffectOptionalSide()).toBeNull();
    } finally {
      delete (globalThis as { __pendingHirameki?: unknown }).__pendingHirameki;
    }
  });

  it('rejects functions hidden in unknown persisted pending fields', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: true,
        value: [{
          player: 'self',
          candidates: [],
          atomVerb: 'noop',
          atomArgs: {},
          nMin: 0,
          nMax: 0,
          source: { cardId: 'SOURCE', abilityId: 'ability' },
          extra: () => 7,
        }],
      }],
    };

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('functions are not persistable');
  });

  it.each([
    {
      label: 'invalid atom minimum policy',
      atomArgs: { minimumPolicy: 'partial' },
      minimumPolicy: undefined,
      error: 'atomArgs.minimumPolicy',
    },
    {
      label: 'exact atom policy without canonical runtime policy',
      atomArgs: { minimumPolicy: 'exact' },
      minimumPolicy: undefined,
      error: 'minimumPolicy must match atomArgs.minimumPolicy',
    },
    {
      label: 'runtime policy disagrees with atom policy',
      atomArgs: { minimumPolicy: 'exact' },
      minimumPolicy: 'best-effort',
      error: 'minimumPolicy must match atomArgs.minimumPolicy',
    },
  ])('rejects persisted pick policy split-brain: $label', ({ atomArgs, minimumPolicy, error }) => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: true,
        value: [{
          player: 'self',
          candidates: [],
          atomVerb: 'noop',
          atomArgs,
          nMin: 0,
          nMax: 0,
          ...(minimumPolicy === undefined ? {} : { minimumPolicy }),
          source: { cardId: 'SOURCE', abilityId: 'ability' },
        }],
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow(error);
  });

  it('round-trips canonical requested bounds and exact policy through persisted runtime state', () => {
    const state = createEmptyGameState();
    const pending = {
      player: 'self' as const,
      candidates: [
        { uid: 'card:self:hand:A#0', cardId: 'A', player: 'self' as const, kind: 'card' as const, area: 'hand', index: 0 },
        { uid: 'card:self:hand:B#1', cardId: 'B', player: 'self' as const, kind: 'card' as const, area: 'hand', index: 1 },
      ],
      atomVerb: 'discard',
      atomArgs: { player: 'self', n: 2, minimumPolicy: 'exact' },
      nMin: 2,
      nMax: 2,
      requestedNMin: 2,
      requestedNMax: 2,
      minimumPolicy: 'exact' as const,
      source: { cardId: 'SOURCE', abilityId: 'ability' },
    };
    pushPendingEffectPickSide(pending);
    persistPendingRuntimeState(state);
    const persisted = structuredClone(state.pendingRuntimeState);
    resetPendingEffectSession();
    state.pendingRuntimeState = persisted;

    expect(hydratePendingRuntimeState(state)).toBe(true);
    expect(_peekPendingEffectPickSide()).toEqual(pending);
  });

  it('rejects a persisted exact pick whose requested minimum is no longer feasible', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: true,
        value: [{
          player: 'self',
          candidates: [
            { uid: 'card:self:hand:A#0', cardId: 'A', player: 'self', kind: 'card', area: 'hand', index: 0 },
          ],
          atomVerb: 'discard',
          atomArgs: { player: 'self', n: 2, minimumPolicy: 'exact' },
          nMin: 2,
          nMax: 2,
          requestedNMin: 2,
          requestedNMax: 2,
          minimumPolicy: 'exact',
          source: { cardId: 'SOURCE', abilityId: 'ability' },
        }],
      }],
    };

    expect(() => hydratePendingRuntimeState(state)).toThrow('exact minimum is not feasible');
    expect(_peekPendingEffectPickSide()).toBeNull();
  });

  it('rejects prototype-mutating keys before hydrating persisted pending data', () => {
    const payload: Record<string, unknown> = {
      player: 'self',
      cardIds: ['A', 'B'],
    };
    Object.defineProperty(payload, '__proto__', {
      value: {
        deckSnapshot: ['A', 'X', 'B'],
        occurrences: [
          { cardId: 'A', index: 0 },
          { cardId: 'B', index: 2 },
        ],
      },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const probe = globalThis as { __pendingDeckReorderSide?: unknown };
    probe.__pendingDeckReorderSide = { probe: 'original' };
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingDeckReorderSide',
        present: true,
        value: payload,
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow(/dangerous key.*__proto__/i);
      expect(probe.__pendingDeckReorderSide).toEqual({ probe: 'original' });
    } finally {
      delete probe.__pendingDeckReorderSide;
    }
  });

  it('validates live pending data for persistence before mutating GameState', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    (globalThis as { __pendingRpsBindings?: unknown }).__pendingRpsBindings = cyclic;
    const state = createEmptyGameState();

    expect(() => persistPendingRuntimeState(state)).toThrow(/cyclic/i);
    expect(state.pendingRuntimeSeq).toBeUndefined();
    expect(state.pendingRuntimeState).toBeUndefined();
  });

  it('does not persist runtime-only rng functions inside continuations', () => {
    (globalThis as { __pendingRpsContinuation?: unknown }).__pendingRpsContinuation = {
      remainder: [],
      ctx: {
        source: { player: 'self', area: 'scene' },
        bindings: {},
        rng: () => 0.5,
      },
      kind: 'sequence',
    };
    const state = createEmptyGameState();

    expect(() => persistPendingRuntimeState(state))
      .toThrow('functions are not persistable');
    expect(state.pendingRuntimeSeq).toBeUndefined();
    expect(state.pendingRuntimeState).toBeUndefined();
  });

  it('accepts persisted continuations with explicit empty source identifiers', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: {
              player: 'self',
              area: 'scene',
              cardId: '',
              uid: '',
              abilityId: '',
            },
            bindings: {},
          },
          kind: 'sequence',
        },
      }],
    };

    expect(hydratePendingRuntimeState(state)).toBe(true);
  });

  it('accepts persisted continuation bindings that intentionally store partial card snapshots', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingRpsContinuation',
        present: true,
        value: {
          remainder: [],
          ctx: {
            source: { player: 'self', area: 'scene' },
            bindings: {
              discarded: [{ cardId: 'DISCARDED' }],
              removed: [{ uid: 'REMOVED#1', cardId: 'REMOVED', snapLevel: 4 }],
              declaredTrait: [{ trait: 'CIA' }],
            },
          },
          kind: 'sequence',
        },
      }],
    };

    expect(hydratePendingRuntimeState(state)).toBe(true);
  });

  it('rejects a deck reorder snapshot with only one stale-state guard', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingDeckReorderSide',
        present: true,
        value: {
          player: 'self',
          cardIds: ['CARD'],
          deckSnapshot: ['CARD'],
        },
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('deckSnapshot and occurrences must be provided together');
    } finally {
      delete (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide;
    }
  });

  it('rejects a deck placement snapshot with only one stale-state guard', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingDeckPlaceSide',
        present: true,
        value: {
          player: 'opp',
          ownerPlayer: 'self',
          cardIds: ['CARD'],
          deckSnapshot: ['CARD'],
        },
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('deckSnapshot and occurrences must be provided together');
    } finally {
      delete (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide;
    }
  });

  it('rejects a deck placement snapshot without stale-state guards', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingDeckPlaceSide',
        present: true,
        value: {
          player: 'opp',
          ownerPlayer: 'self',
          cardIds: ['CARD'],
          ctx: {
            source: { player: 'self', area: 'scene' },
            bindings: {},
          },
        },
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('deckSnapshot and occurrences are required');
    } finally {
      delete (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide;
    }
  });

  it('rejects a deck placement snapshot without its continuation context', () => {
    const state = createEmptyGameState();
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingDeckPlaceSide',
        present: true,
        value: {
          player: 'opp',
          ownerPlayer: 'self',
          cardIds: ['CARD'],
          deckSnapshot: ['CARD'],
          occurrences: [{ cardId: 'CARD', index: 0 }],
        },
      }],
    };

    try {
      expect(() => hydratePendingRuntimeState(state))
        .toThrow('ctx is required');
    } finally {
      delete (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide;
    }
  });

  it.each([
    {
      label: 'occurrence count mismatch',
      value: {
        player: 'opp', ownerPlayer: 'self', cardIds: ['A', 'B'], deckSnapshot: ['A', 'B'],
        occurrences: [{ cardId: 'A', index: 0 }], ctx: effectCtx,
      },
      error: 'count must match cardIds',
    },
    {
      label: 'occurrence card multiset mismatch',
      value: {
        player: 'opp', ownerPlayer: 'self', cardIds: ['A', 'B'], deckSnapshot: ['A', 'C'],
        occurrences: [{ cardId: 'A', index: 0 }, { cardId: 'C', index: 1 }], ctx: effectCtx,
      },
      error: 'card multiset must match cardIds',
    },
    {
      label: 'duplicate occurrence index',
      value: {
        player: 'opp', ownerPlayer: 'self', cardIds: ['A', 'A'], deckSnapshot: ['A', 'A'],
        occurrences: [{ cardId: 'A', index: 0 }, { cardId: 'A', index: 0 }], ctx: effectCtx,
      },
      error: 'must be unique',
    },
    {
      label: 'out-of-range occurrence index',
      value: {
        player: 'opp', ownerPlayer: 'self', cardIds: ['A'], deckSnapshot: ['A'],
        occurrences: [{ cardId: 'A', index: 1 }], ctx: effectCtx,
      },
      error: 'must reference deckSnapshot',
    },
    {
      label: 'occurrence card differs from the deck snapshot',
      value: {
        player: 'opp', ownerPlayer: 'self', cardIds: ['A'], deckSnapshot: ['B'],
        occurrences: [{ cardId: 'A', index: 0 }], ctx: effectCtx,
      },
      error: 'must match deckSnapshot occurrence',
    },
  ])('rejects a deck placement snapshot with $label', ({ value, error }) => {
    expect(() => hydratePendingRuntimeState(persistedDeckPlace(value, value.deckSnapshot)))
      .toThrow(error);
  });

  it('rejects a deck placement snapshot that no longer matches the target deck', () => {
    const state = persistedDeckPlace({
      player: 'opp',
      ownerPlayer: 'self',
      cardIds: ['A'],
      deckSnapshot: ['A'],
      occurrences: [{ cardId: 'A', index: 0 }],
      ctx: effectCtx,
    }, ['B']);

    expect(() => hydratePendingRuntimeState(state))
      .toThrow('deckSnapshot must match current player deck');
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
