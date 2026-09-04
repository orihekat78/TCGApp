// tests/ui/state/store.test.ts — Phase 7 Task 7.1 tests
// 規約: store は GameState の受動的ホルダ + dispatcher
// 仕様:
//  - 初期 gameState は null（ゲーム未ロード）
//  - setGameState(s) で全置換
//  - dispatch(mutator) で mutator の戻り値に置換（null のときは no-op、mutator も呼ばれない）
//  - subscribe で変更通知が届く

import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { gameResult } from '@/engine/mutate/gameResult';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import {
  checkpointLiveReplayRecording,
  resetLiveReplayRecorderForTests,
  startLiveReplayRecording,
} from '@/ui/services/liveReplayRecorder';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import type { GameState } from '@/engine/types/game-state';

describe('useGameStateStore', () => {
  beforeEach(() => {
    // 各テスト前に state を null にリセット
    useGameStateStore.setState({ gameState: null });
  });

  afterEach(() => resetLiveReplayRecorderForTests());

  it('initial gameState is null (no game loaded)', () => {
    // 初期化直後（reset）に null であることを確認
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('setGameState replaces the whole state', () => {
    const initial: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(initial);
    expect(useGameStateStore.getState().gameState).toBe(initial);

    // 別の state で置き換えると入れ替わる
    const replacement: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(replacement);
    expect(useGameStateStore.getState().gameState).toBe(replacement);
    expect(useGameStateStore.getState().gameState).not.toBe(initial);
  });

  it('sets replay projection without hydrating pending runtime or live surfaces', () => {
    const replayState = createEmptyGameState();
    replayState.pendingRuntimeState = {
      token: 1,
      snapshot: [{ key: '__privateReplayDecision', present: true, value: 'secret' }],
    };
    useGameStateStore.setState({ activeActionId: 'live-action', spectatorMode: true });

    expect(() => useGameStateStore.getState().setReplayGameState(replayState)).not.toThrow();
    expect(useGameStateStore.getState().gameState).toBe(replayState);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(useGameStateStore.getState().spectatorMode).toBe(false);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('never mutates ambient pending runtime while projecting replay frames', () => {
    const ambientRuntime = globalThis as { __pendingContactStartAxId?: string };
    ambientRuntime.__pendingContactStartAxId = 'ambient-live-action';
    try {
      const before = snapshotPendingRuntimeState();
      useGameStateStore.getState().setReplayGameState(createEmptyGameState());
      expect(snapshotPendingRuntimeState()).toEqual(before);
      useGameStateStore.getState().setReplayGameState(null);
      expect(snapshotPendingRuntimeState()).toEqual(before);
    } finally {
      delete ambientRuntime.__pendingContactStartAxId;
    }
  });

  it('dispatch(mutator) applies the mutator and stores its return value', () => {
    const initial: GameState = createEmptyGameState();
    useGameStateStore.getState().setGameState(initial);

    const mutator = (s: GameState): GameState => ({
      ...s,
      turn: { ...s.turn, number: s.turn.number + 1 },
    });

    useGameStateStore.getState().dispatch(mutator);

    const after = useGameStateStore.getState().gameState;
    expect(after).not.toBeNull();
    expect(after).not.toBe(initial); // 新しい参照
    expect(after!.turn.number).toBe(initial.turn.number + 1);
    // 関係ないフィールドは保持
    expect(after!.turn.player).toBe(initial.turn.player);
  });

  it('dispatch on null state is a no-op (mutator NOT called)', () => {
    // 前提: gameState が null
    expect(useGameStateStore.getState().gameState).toBeNull();

    const mutator = vi.fn((s: GameState) => s);
    useGameStateStore.getState().dispatch(mutator);

    expect(mutator).not.toHaveBeenCalled();
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('subscribers fire on setGameState and dispatch', () => {
    const listener = vi.fn();
    const unsubscribe = useGameStateStore.subscribe(listener);

    try {
      const s1 = createEmptyGameState();
      useGameStateStore.getState().setGameState(s1);
      expect(listener).toHaveBeenCalledTimes(1);

      useGameStateStore
        .getState()
        .dispatch((s) => ({ ...s, turn: { ...s.turn, number: s.turn.number + 1 } }));
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
  });

  it('rolls back the live replay recorder before restoring a generic dispatch after a subscriber failure', () => {
    const sessionId = 'generic-dispatch-rollback';
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    resetPresentationQueue(sessionId);
    useGameStateStore.getState().setGameState(initial);
    startLiveReplayRecording({ sessionId, viewerMode: 'solo-self' });
    const storeBefore = useGameStateStore.getState();
    const replayBefore = checkpointLiveReplayRecording();
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-dispatch';
    const runtimeBefore = snapshotPendingRuntimeState();
    const unsubscribe = useGameStateStore.subscribe((current) => {
      runtime.__pendingContactStartAxId = 'during-dispatch';
      throw new Error('engine-error');
    });

    try {
      expect(() => useGameStateStore.getState().dispatch((state) => {
        const next = structuredClone(state);
        appendCausal(next, {
          actor: 'self', kind: 'use', targets: [], outcome: { type: 'state', state: 'success' },
        });
        return next;
      })).toThrow('engine-error');

      expect(useGameStateStore.getState()).toBe(storeBefore);
      expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      expect(checkpointLiveReplayRecording()).toEqual(replayBefore);
    } finally {
      unsubscribe();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('commits terminal state and central actionable surfaces in one snapshot', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'concede' };
    const completedDeckReveal = { awaitingPick: false } as never;
    const presentationHandReveal = { lifetime: 'presentation' } as never;
    useGameStateStore.setState({
      activeActionId: 'ax_1',
      pendingEffectPick: {} as never,
      pendingDeckReveal: completedDeckReveal,
      pendingPublicHandReveal: presentationHandReveal,
    });
    const snapshots: ReturnType<typeof useGameStateStore.getState>[] = [];
    const unsubscribe = useGameStateStore.subscribe((snapshot) => snapshots.push(snapshot));
    try {
      expect(useGameStateStore.getState().commitTerminalState(state)).toBe(true);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].gameState?.gameResult).toEqual({ winner: 'opp', reason: 'concede' });
      expect(snapshots[0].activeActionId).toBeNull();
      expect(snapshots[0].pendingEffectPick).toBeNull();
      expect(snapshots[0].pendingDeckReveal).toBe(completedDeckReveal);
      expect(snapshots[0].pendingPublicHandReveal).toBe(presentationHandReveal);
    } finally {
      unsubscribe();
    }
  });

  it('commits a direct terminal write after disposing its held Hirameki runtime authority', () => {
    const state = createEmptyGameState();
    state.actionContexts = {
      pending: {
        id: 'pending',
        byUid: 'ACTOR#1',
        byPlayer: 'self',
        target: { kind: 'case', player: 'opp' },
        phase: 'judge',
        judgeResolved: true,
        deferredCaseEvidenceGain: true,
        pendingHiramekiEvidenceRemoval: {
          token: 'hirameki:pending:opp',
          player: 'opp',
          abilityId: 'a1',
          effectValid: true,
          decisionResolved: false,
          evidence: {
            cardId: 'HELD-HIRAMEKI',
            faceUp: true,
            origin: { turn: 1, via: 'action-case' },
          },
        },
        startedAt: { turn: 1, nano: 1 },
      },
    };
    state.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingHirameki',
        present: true,
        value: {
          player: 'opp',
          cardId: 'HELD-HIRAMEKI',
          abilityId: 'a1',
          effectValid: true,
          actorUid: 'ACTOR#1',
          actionId: 'pending',
          heldEvidence: {
            token: 'hirameki:pending:opp',
            player: 'opp',
            cardId: 'HELD-HIRAMEKI',
          },
          gainDeferred: true,
        },
      }],
    };
    state.pendingTurnTransition = {
      endingPlayer: 'self',
      stage: 'after-end-start',
      startNextTurn: true,
    };
    state.pendingReasoningContinuation = { token: 7, uid: 'ACTOR#1', player: 'self' };
    state.pendingEffects = (['pending', 'resolving'] as const).map((entryState, index) => ({
      id: `terminal-${entryState}`,
      source: { player: 'self' as const, cardId: 'SOURCE', abilityId: 'a1' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: index + 1 },
      effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
      state: entryState,
    }));
    state.reservedEffects = (['next-match', 'turn-end'] as const).map((mode, index) => ({
      id: `reserved-${mode}`,
      trigger: { hook: `reserved:${mode}`, mode, player: 'self', armedTurn: 1 },
      effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
      source: { player: 'self' as const, cardId: `RESERVED-${index}` },
    }));

    gameResult.set(state, 'opp', 'deck-out');

    expect(useGameStateStore.getState().commitTerminalState(state)).toBe(true);
    expect(useGameStateStore.getState().gameState).toMatchObject({
      gameResult: { winner: 'opp', reason: 'deck-out' },
      actionContexts: {},
    });
    expect(useGameStateStore.getState().gameState?.players.opp.remove)
      .toEqual(['HELD-HIRAMEKI']);
    expect(useGameStateStore.getState().gameState?.pendingRuntimeState).toBeUndefined();
    expect(useGameStateStore.getState().gameState?.pendingTurnTransition).toBeUndefined();
    expect(useGameStateStore.getState().gameState?.pendingReasoningContinuation).toBeUndefined();
    expect(useGameStateStore.getState().gameState?.pendingEffects.map(entry => entry.state))
      .toEqual(['cancelled', 'cancelled']);
    expect(useGameStateStore.getState().gameState?.reservedEffects).toEqual([]);
  });

  it('rolls back the live replay recorder when a natural terminal publish listener throws', () => {
    const sessionId = 'terminal-replay-rollback';
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    resetPresentationQueue(sessionId);
    useGameStateStore.setState({ gameState: initial });
    startLiveReplayRecording({ sessionId, viewerMode: 'solo-self' });
    const storeBefore = useGameStateStore.getState();
    const replayBefore = checkpointLiveReplayRecording();
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    runtime.__pendingContactStartAxId = 'before-terminal';
    const runtimeBefore = snapshotPendingRuntimeState();
    const terminal = structuredClone(initial);
    gameResult.set(terminal, 'self', 'evidence');
    const unsubscribe = useGameStateStore.subscribe((current) => {
      if (current.gameState === terminal) throw new Error('terminal-engine-error');
    });

    try {
      expect(() => useGameStateStore.getState().commitTerminalState(terminal)).toThrow('terminal-engine-error');
      expect(useGameStateStore.getState()).toBe(storeBefore);
      expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      expect(checkpointLiveReplayRecording()).toEqual(replayBefore);
    } finally {
      unsubscribe();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('keeps a legitimate nested publication made while a delegated terminal dispatch rolls back', () => {
    const sessionId = 'terminal-dispatch-nested-rollback';
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    resetPresentationQueue(sessionId);
    useGameStateStore.setState({ gameState: initial });
    startLiveReplayRecording({ sessionId, viewerMode: 'solo-self' });
    const storeBefore = useGameStateStore.getState();
    const replayBefore = checkpointLiveReplayRecording();
    const terminal = structuredClone(initial);
    gameResult.set(terminal, 'self', 'evidence');
    const nested = { ...initial, turn: { ...initial.turn, number: initial.turn.number + 1 } };
    let nestedPublished = false;
    const nestedUnsubscribe = useGameStateStore.subscribe((current) => {
      if (nestedPublished || current !== storeBefore) return;
      nestedPublished = true;
      useGameStateStore.getState().setGameState(nested);
    });
    const failingUnsubscribe = useGameStateStore.subscribe((current) => {
      if (current.gameState === terminal) throw new Error('terminal-dispatch-error');
    });

    try {
      expect(() => useGameStateStore.getState().dispatch(() => terminal))
        .toThrow('terminal-dispatch-error');
      expect(nestedPublished).toBe(true);
      expect(useGameStateStore.getState().gameState).toBe(nested);
      expect(checkpointLiveReplayRecording()?.statesLength)
        .toBe((replayBefore?.statesLength ?? 0) + 1);
    } finally {
      failingUnsubscribe();
      nestedUnsubscribe();
    }
  });

  it('keeps same-GameState UI and runtime published by a terminal rollback subscriber', () => {
    const initial = createEmptyGameState();
    useGameStateStore.setState({ gameState: initial });
    const storeBefore = useGameStateStore.getState();
    const terminal = structuredClone(initial);
    gameResult.set(terminal, 'self', 'evidence');
    const runtime = globalThis as { __pendingContactStartAxId?: string };
    let nestedRuntime: ReturnType<typeof snapshotPendingRuntimeState> | null = null;
    let nestedPublished = false;
    const nestedUnsubscribe = useGameStateStore.subscribe((current) => {
      if (nestedPublished || current !== storeBefore) return;
      nestedPublished = true;
      useGameStateStore.getState().setActiveCard('nested-store-card', 'nested store');
      runtime.__pendingContactStartAxId = 'nested-store-runtime';
      nestedRuntime = snapshotPendingRuntimeState();
    });
    const failingUnsubscribe = useGameStateStore.subscribe((current) => {
      if (current.gameState === terminal) throw new Error('same-state terminal dispatch error');
    });

    try {
      expect(() => useGameStateStore.getState().dispatch(() => terminal))
        .toThrow('same-state terminal dispatch error');
      expect(useGameStateStore.getState()).toMatchObject({
        gameState: initial,
        activeCardUid: 'nested-store-card',
        activeCardLabel: 'nested store',
      });
      expect(snapshotPendingRuntimeState()).toEqual(nestedRuntime);
    } finally {
      failingUnsubscribe();
      nestedUnsubscribe();
      delete runtime.__pendingContactStartAxId;
    }
  });

  it('normalizes a natural terminal state with an open action before publish', () => {
    const state = createEmptyGameState();
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'partner:self', byPlayer: 'self',
        target: { kind: 'case', player: 'opp' }, phase: 'guard-window',
        startedAt: { turn: 1, nano: 1 },
      },
    };
    gameResult.set(state, 'opp', 'evidence');
    useGameStateStore.setState({ activeActionId: 'ax_1', pendingEffectPick: {} as never });

    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(useGameStateStore.getState().gameState?.actionContexts).toEqual({});
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
