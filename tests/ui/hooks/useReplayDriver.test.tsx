import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayLog } from '@/ai/replay/recorder';
import { buildReplayLogV3 } from '@/ai/replay/state-frame';
import { createEmptyGameState } from '@/engine/state-factory';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import type { CausalLogEntryV1 } from '@/engine/types';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useReplayDriver, type ReplayDriverApi } from '@/ui/hooks/useReplayDriver';
import {
  currentPresentationSessionId,
  getPresentationQueue,
} from '@/ui/presentation/coordinator';
import { beginMatchSession, commitMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const replayPlayerMock = vi.hoisted(() => ({
  replayLog: vi.fn((log: ReplayLog) => ({ finalState: structuredClone(log.initialState) })),
}));

vi.mock('@/ai/replay/player.js', () => ({
  replayLog: replayPlayerMock.replayLog,
  ScriptedPolicy: class {},
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeLog(): ReplayLog {
  const initialState = createEmptyGameState();
  initialState.turn = {
    number: 1,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  return {
    schemaVersion: 1,
    initialState,
    moves: [{ turn: 1, player: 'self', move: { kind: 'endTurn' } }],
    result: { winner: 'self', reason: 'turn-cap', turns: 1 },
  };
}

describe('useReplayDriver', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootMounted: boolean;
  let driver: ReplayDriverApi | null;

  function ReplayProbe(): null {
    driver = useReplayDriver();
    return null;
  }

  function StoreProbe(): null {
    useGameStateStore((state) => state.gameState);
    return null;
  }

  beforeEach(() => {
    replayPlayerMock.replayLog.mockClear();
    driver = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    rootMounted = true;
    useGameStateStore.getState().resetMatchSessionState();
    act(() => root.render(
      <>
        <ReplayProbe />
        <StoreProbe />
      </>,
    ));
  });

  afterEach(() => {
    if (rootMounted) act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not update the external game store from a React state updater', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => driver!.loadLog(makeLog()));
    errorSpy.mockClear();
    act(() => driver!.step());

    const renderedUpdateWarning = errorSpy.mock.calls.some((args) =>
      args.some((arg) =>
        typeof arg === 'string'
        && arg.includes('Cannot update a component')
        && arg.includes('while rendering a different component'),
      ),
    );
    expect(renderedUpdateWarning).toBe(false);
    expect(driver!.state.currentMoveIndex).toBe(1);
  });

  it('keeps autoplay store updates outside React state updaters', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => driver!.loadLog(makeLog()));
    errorSpy.mockClear();
    act(() => {
      driver!.setSpeed(10);
      driver!.play();
    });
    await act(async () => vi.advanceTimersByTime(10));

    const renderedUpdateWarning = errorSpy.mock.calls.some((args) =>
      args.some((arg) =>
        typeof arg === 'string'
        && arg.includes('Cannot update a component')
        && arg.includes('while rendering a different component'),
      ),
    );
    expect(renderedUpdateWarning).toBe(false);
    expect(driver!.state.currentMoveIndex).toBe(1);
  });

  it('loads, steps, and seeks ReplayLogV3 frames without legacy engine replay', () => {
    const initial = createEmptyGameState();
    startCausalSession(initial, 'driver-v3');
    const opened = appendCausal(initial, {
      actor: 'self',
      kind: 'use',
      source: { kind: 'player', side: 'self' },
      targets: [],
      outcome: { type: 'state', state: 'active' },
    });
    const terminal = structuredClone(initial);
    terminal.turn.number = 2;
    appendCausal(terminal, {
      actor: 'self',
      kind: 'game-result',
      parentEventId: opened.eventId,
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'player', side: 'opp' }],
      outcome: { type: 'state', state: 'success' },
    });
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    const log = buildReplayLogV3({
      artifactId: 'driver-v3-artifact',
      sessionId: 'driver-v3',
      viewerMode: 'solo-self',
      states: [initial, terminal],
    });

    act(() => driver!.loadLog(log));
    expect(useGameStateStore.getState().gameState?.turn.number).toBe(0);
    expect(currentPresentationSessionId()).toBe('driver-v3');
    expect(getPresentationQueue().items()).toEqual([]);
    act(() => driver!.step());
    expect(useGameStateStore.getState().gameState?.gameResult).toEqual({
      winner: 'self', reason: 'evidence',
    });
    expect(currentPresentationSessionId()).toBe('driver-v3');
    expect(getPresentationQueue().items()).toEqual([]);
    act(() => driver!.seek(0));
    expect(useGameStateStore.getState().gameState?.gameResult).toBeUndefined();
    expect(currentPresentationSessionId()).toBe('driver-v3');
    expect(getPresentationQueue().items()).toEqual([]);
    act(() => driver!.seek(1));
    expect(useGameStateStore.getState().gameState?.turn.number).toBe(2);
    expect(currentPresentationSessionId()).toBe('driver-v3');
    expect(getPresentationQueue().items()).toEqual([]);
    expect(replayPlayerMock.replayLog).not.toHaveBeenCalled();
  });

  it('pauses autoplay immediately on a terminal replay frame without touching live cleanup', async () => {
    vi.useFakeTimers();
    const initial = createEmptyGameState();
    startCausalSession(initial, 'terminal-autoplay');
    const opened = appendCausal(initial, {
      actor: 'self', kind: 'use', source: { kind: 'player', side: 'self' },
      targets: [], outcome: { type: 'state', state: 'active' },
    });
    const terminal = structuredClone(initial);
    terminal.turn.number = 2;
    appendCausal(terminal, {
      actor: 'self', kind: 'game-result', parentEventId: opened.eventId, source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'player', side: 'opp' }], outcome: { type: 'state', state: 'success' },
    });
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    const log = buildReplayLogV3({
      artifactId: 'terminal-autoplay-artifact', sessionId: 'terminal-autoplay', viewerMode: 'solo-self',
      states: [initial, terminal],
    });

    act(() => driver!.loadLog(log));
    act(() => {
      driver!.setSpeed(10);
      driver!.play();
    });
    await act(async () => vi.advanceTimersByTime(10));

    expect(useGameStateStore.getState().gameState?.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(driver!.state.isPlaying).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('projects imported V3 runtime continuations before store preparation can hydrate them', () => {
    const log = makeTerminalV3LogWithUntrustedRuntime();

    expect(() => act(() => driver!.loadLog(log))).not.toThrow();

    expect((globalThis as { __pendingEffectPickQueue?: unknown }).__pendingEffectPickQueue)
      .toEqual([]);
    expect(useGameStateStore.getState().gameState?.pendingRuntimeState).toBeUndefined();
    expect(useGameStateStore.getState().gameState?.pendingEffects).toEqual([]);
    expect(useGameStateStore.getState().gameState?.reservedEffects).toEqual([]);
  });

  it('keeps imported V3 hidden identities out of both playback frames and retained driver state', () => {
    const initial = createEmptyGameState();
    startCausalSession(initial, 'driver-v3-private');
    initial.players.opp.hand = ['OPP-FRAME-0-HAND'];
    initial.players.opp.deck = ['OPP-FRAME-0-DECK'];
    initial.players.opp.partner = {
      cardId: 'OPP-FRAME-0-PARTNER', state: 'sleep', location: 'file-area',
    };
    initial.players.opp.file = [{
      type: 'assisted-partner', cardId: 'OPP-FRAME-0-PARTNER',
    }];
    const opened = appendCausal(initial, {
      actor: 'self',
      kind: 'use',
      source: { kind: 'player', side: 'self' },
      targets: [],
      outcome: { type: 'state', state: 'active' },
    });
    const terminal = structuredClone(initial);
    terminal.turn.number = 2;
    terminal.players.opp.hand = ['OPP-FRAME-1-HAND'];
    terminal.players.opp.deck = ['OPP-FRAME-1-DECK'];
    appendCausal(terminal, {
      actor: 'self',
      kind: 'game-result',
      parentEventId: opened.eventId,
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'player', side: 'opp' }],
      outcome: { type: 'state', state: 'success' },
    });
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    const log = buildReplayLogV3({
      artifactId: 'driver-v3-private-artifact',
      sessionId: 'driver-v3-private',
      viewerMode: 'spectator',
      states: [initial, terminal],
    });
    const secrets = [
      'OPP-FRAME-0-HAND', 'OPP-FRAME-0-DECK',
      'OPP-FRAME-1-HAND', 'OPP-FRAME-1-DECK',
    ];
    const expectNoSecrets = (value: unknown) => {
      const serialized = JSON.stringify(value);
      for (const secret of secrets) expect(serialized).not.toContain(secret);
    };

    act(() => driver!.loadLog(log));
    expectNoSecrets(driver!.state.log);
    expectNoSecrets(useGameStateStore.getState().gameState);
    expect(JSON.stringify(driver!.state.log)).toContain('OPP-FRAME-0-PARTNER');
    expect(JSON.stringify(useGameStateStore.getState().gameState)).toContain('OPP-FRAME-0-PARTNER');
    act(() => driver!.step());
    expectNoSecrets(useGameStateStore.getState().gameState);
    act(() => driver!.seek(0));
    expectNoSecrets(useGameStateStore.getState().gameState);
    act(() => driver!.seek(1));
    expectNoSecrets(useGameStateStore.getState().gameState);
  });

  it('projects legacy fallback states before playback controls can expose secrets', () => {
    const log = makeLog();
    log.initialState.players.self.hand = ['SELF-LEGACY-HAND'];
    log.initialState.players.opp.hand = ['OPP-LEGACY-HAND-SECRET'];
    log.initialState.players.opp.deck = ['OPP-LEGACY-DECK-SECRET'];
    log.initialState.players.self.case.cardId = 'ORIGINAL-LEGACY-CASE';

    act(() => driver!.loadLog(log));
    const initial = useGameStateStore.getState().gameState!;
    expect(JSON.stringify(initial)).toContain('SELF-LEGACY-HAND');
    expect(JSON.stringify(initial)).not.toContain('OPP-LEGACY-HAND-SECRET');
    expect(JSON.stringify(initial)).not.toContain('OPP-LEGACY-DECK-SECRET');
    expect(JSON.stringify(driver!.state.log)).toContain('SELF-LEGACY-HAND');
    expect(JSON.stringify(driver!.state.log)).not.toContain('OPP-LEGACY-HAND-SECRET');
    expect(JSON.stringify(driver!.state.log)).not.toContain('OPP-LEGACY-DECK-SECRET');

    act(() => driver!.step());
    expect(JSON.stringify(useGameStateStore.getState().gameState))
      .not.toContain('OPP-LEGACY-HAND-SECRET');
  });

  it('rejects replay load over a live match without replacing its state', () => {
    const liveState = createEmptyGameState();
    liveState.players.self.case.cardId = 'LIVE-CASE';
    act(() => useGameStateStore.getState().setGameState(liveState));

    expect(() => act(() => driver!.loadLog(makeLog())))
      .toThrow('Cannot load replay over an active match');
    expect(useGameStateStore.getState().gameState).toBe(liveState);
  });

  it('invalidates an in-flight match before claiming replay state', () => {
    const pendingMatch = beginMatchSession('self');
    const log = makeLog();

    act(() => driver!.loadLog(log));
    const replayState = useGameStateStore.getState().gameState;
    const replaySessionId = currentPresentationSessionId();
    const replayEpoch = getPresentationQueue().currentEpoch();
    expect(driver!.state.log).toMatchObject({
      schemaVersion: 1,
      moves: log.moves,
      result: log.result,
    });
    expect(driver!.state.log?.initialState.players.self).toEqual(log.initialState.players.self);
    expect(driver!.state.log).not.toBe(log);
    expect(replayState).not.toBeNull();

    const staleLiveState = createEmptyGameState();
    staleLiveState.players.self.case.cardId = 'STALE-LIVE-CASE';

    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, staleLiveState);
    });
    expect(committed).toBe(false);
    expect(useGameStateStore.getState().gameState).toBe(replayState);
    expect(currentPresentationSessionId()).toBe(replaySessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(replayEpoch);
  });

  it('keeps an in-flight match intact when replay causal validation fails', () => {
    const pendingMatch = beginMatchSession('self');
    const pendingSessionId = currentPresentationSessionId();
    const pendingEpoch = getPresentationQueue().currentEpoch();
    const malformedLog = makeLog();
    const causalSessionId = 'malformed-replay';
    malformedLog.initialState.causalLog = {
      schemaVersion: 1,
      sessionId: causalSessionId,
      nextSequence: 2,
    };
    malformedLog.initialState.log = [{
      schemaVersion: 1,
      eventId: `${causalSessionId}:1`,
      sessionId: causalSessionId,
      sequence: 1,
      ts: 1,
      player: 'self',
      actor: 'self',
      turn: 1,
      action: 'causal.use',
      kind: 'use',
      parentEventId: `${causalSessionId}:404`,
      targets: [],
      outcome: { type: 'none' },
    }];

    expect(() => act(() => driver!.loadLog(malformedLog))).toThrow(/missing causal edge/i);
    expect(driver!.state.log).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(currentPresentationSessionId()).toBe(pendingSessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(pendingEpoch);

    const liveState = createEmptyGameState();
    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, liveState);
    });
    expect(committed).toBe(true);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
  });

  it('keeps an in-flight match intact when replay store preparation fails', () => {
    const pendingMatch = beginMatchSession('self');
    const pendingSessionId = currentPresentationSessionId();
    const pendingEpoch = getPresentationQueue().currentEpoch();
    const malformedLog = makeLog();
    (malformedLog.initialState.players.self as unknown as { scene: null }).scene = null;

    expect(() => act(() => driver!.loadLog(malformedLog))).toThrow();
    expect(driver!.state.log).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(currentPresentationSessionId()).toBe(pendingSessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(pendingEpoch);

    const liveState = createEmptyGameState();
    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, liveState);
    });
    expect(committed).toBe(true);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
  });

  it('keeps an in-flight match intact when replay pending values cannot surface', () => {
    const pendingMatch = beginMatchSession('self');
    const pendingSessionId = currentPresentationSessionId();
    const pendingEpoch = getPresentationQueue().currentEpoch();
    const malformedLog = makeLog();
    malformedLog.initialState.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: true,
        value: 'not-a-queue',
      }],
    };

    expect(() => act(() => driver!.loadLog(malformedLog))).toThrow();
    expect(driver!.state.log).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(currentPresentationSessionId()).toBe(pendingSessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(pendingEpoch);

    const liveState = createEmptyGameState();
    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, liveState);
    });
    expect(committed).toBe(true);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
  });

  it('keeps an in-flight match intact when a replay pending item is incomplete', () => {
    const pendingMatch = beginMatchSession('self');
    const pendingSessionId = currentPresentationSessionId();
    const pendingEpoch = getPresentationQueue().currentEpoch();
    const malformedLog = makeLog();
    malformedLog.initialState.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingEffectPickQueue',
        present: true,
        value: [{ player: 'self' }],
      }],
    };

    expect(() => act(() => driver!.loadLog(malformedLog))).toThrow(/pendingEffectPick/i);
    expect(driver!.state.log).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(currentPresentationSessionId()).toBe(pendingSessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(pendingEpoch);

    const liveState = createEmptyGameState();
    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, liveState);
    });
    expect(committed).toBe(true);
    expect(useGameStateStore.getState().gameState).toBe(liveState);
  });

  it('discards imported replay action continuations before claiming playback ownership', () => {
    const pendingMatch = beginMatchSession('self');
    const malformedLog = makeLog();
    malformedLog.initialState.actionContextSeq = 1;
    malformedLog.initialState.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 'attacker',
        byPlayer: 'self',
        target: { kind: 'char', uid: 'target' },
        phase: 'judge',
        pendingLeaveIntercept: {
          player: 'opp',
          targetUid: '',
          interceptorUid: 'interceptor',
        },
        startedAt: { turn: 1, nano: 1 },
      },
    };

    expect(() => act(() => driver!.loadLog(malformedLog))).not.toThrow();
    expect(driver!.state.log).not.toBeNull();
    expect(useGameStateStore.getState().gameState?.actionContexts).toEqual({});
    expect(useGameStateStore.getState().gameState).not.toBeNull();

    const liveState = createEmptyGameState();
    let committed = false;
    act(() => {
      committed = commitMatchSession(pendingMatch, liveState);
    });
    expect(committed).toBe(false);
    expect(useGameStateStore.getState().gameState).not.toBe(liveState);
  });

  it('clears replay-owned state when replay closes', () => {
    act(() => driver!.loadLog(makeLog()));
    expect(useGameStateStore.getState().gameState).not.toBeNull();

    act(() => driver!.unloadLog());
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('preserves ambient pending runtime across replay step, seek, and unload', () => {
    act(() => driver!.loadLog(makeLog()));
    const ambientRuntime = globalThis as { __pendingContactStartAxId?: string };
    ambientRuntime.__pendingContactStartAxId = 'ambient-live-action';

    try {
      const before = snapshotPendingRuntimeState();

      act(() => driver!.step());
      expect(snapshotPendingRuntimeState()).toEqual(before);

      act(() => driver!.seek(0));
      expect(snapshotPendingRuntimeState()).toEqual(before);

      act(() => driver!.unloadLog());
      expect(snapshotPendingRuntimeState()).toEqual(before);
    } finally {
      delete ambientRuntime.__pendingContactStartAxId;
    }
  });

  it('clears pending runtime only at the replay session boundary', () => {
    const oldRuntime = globalThis as { __pendingContactStartAxId?: string };
    oldRuntime.__pendingContactStartAxId = 'superseded-live-action';
    try {
      act(() => driver!.loadLog(makeLog()));
      expect(oldRuntime.__pendingContactStartAxId).toBeNull();
    } finally {
      delete oldRuntime.__pendingContactStartAxId;
    }
  });

  it('does not clear a newer live match when replay closes', () => {
    act(() => driver!.loadLog(makeLog()));
    const liveState = createEmptyGameState();
    liveState.players.self.case.cardId = 'NEW-LIVE-CASE';
    let presentation: ReturnType<typeof seedLivePresentation>;
    act(() => {
      presentation = seedLivePresentation(liveState);
    });

    act(() => driver!.unloadLog());
    expect(useGameStateStore.getState().gameState).toBe(liveState);
    expect(currentPresentationSessionId()).toBe(presentation!.sessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(presentation!.epoch);
    expect(getPresentationQueue().items()).toEqual(presentation!.items);
  });

  it('clears replay-owned state when the driver unmounts', () => {
    act(() => driver!.loadLog(makeLog()));
    expect(useGameStateStore.getState().gameState).not.toBeNull();

    act(() => root.unmount());
    rootMounted = false;
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('does not clear a newer live match when the driver unmounts', () => {
    act(() => driver!.loadLog(makeLog()));
    const liveState = createEmptyGameState();
    liveState.players.self.case.cardId = 'NEW-LIVE-CASE';
    let presentation: ReturnType<typeof seedLivePresentation>;
    act(() => {
      presentation = seedLivePresentation(liveState);
    });

    act(() => root.unmount());
    rootMounted = false;
    expect(useGameStateStore.getState().gameState).toBe(liveState);
    expect(currentPresentationSessionId()).toBe(presentation!.sessionId);
    expect(getPresentationQueue().currentEpoch()).toBe(presentation!.epoch);
    expect(getPresentationQueue().items()).toEqual(presentation!.items);
  });

  it('rejects human engine actions against replay-owned state', () => {
    act(() => driver!.loadLog(makeLog()));
    const replayState = useGameStateStore.getState().gameState;

    const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });

    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(replayState);
    expect(useGameStateStore.getState().gameState?.turn).toEqual({
      number: 1,
      player: 'self',
      phase: 'main',
      isFirstPlayerFirstTurn: false,
    });
  });

  it('does not let stale replay controls or autoplay mutate a newer live match', async () => {
    vi.useFakeTimers();
    act(() => driver!.loadLog(makeLog()));
    act(() => {
      driver!.setSpeed(10);
      driver!.play();
    });
    const liveState = createEmptyGameState();
    liveState.players.self.case.cardId = 'NEW-LIVE-CASE';
    let presentation: ReturnType<typeof seedLivePresentation>;
    act(() => { presentation = seedLivePresentation(liveState); });
    const ambientRuntime = globalThis as { __pendingContactStartAxId?: string };
    ambientRuntime.__pendingContactStartAxId = 'new-live-action';
    const beforeRuntime = snapshotPendingRuntimeState();

    try {
      await act(async () => vi.advanceTimersByTime(20));
      act(() => {
        driver!.step();
        driver!.seek(1);
        driver!.unloadLog();
      });
      expect(useGameStateStore.getState().gameState).toBe(liveState);
      expect(driver!.state.currentMoveIndex).toBe(0);
      expect(snapshotPendingRuntimeState()).toEqual(beforeRuntime);
      expect(currentPresentationSessionId()).toBe(presentation!.sessionId);
      expect(getPresentationQueue().currentEpoch()).toBe(presentation!.epoch);
      expect(getPresentationQueue().items()).toEqual(presentation!.items);
    } finally {
      delete ambientRuntime.__pendingContactStartAxId;
    }
  });
});

function seedLivePresentation(liveState: ReturnType<typeof createEmptyGameState>) {
  const token = beginMatchSession('self');
  if (!commitMatchSession(token, liveState)) throw new Error('live fixture commit failed');
  const sessionId = currentPresentationSessionId();
  const event: CausalLogEntryV1 = {
    schemaVersion: 1,
    eventId: `${sessionId}:1`,
    sessionId,
    sequence: 1,
    ts: 1,
    turn: 1,
    player: 'self',
    actor: 'self',
    action: 'causal.summary',
    kind: 'summary',
    targets: [],
    outcome: { type: 'none' },
  };
  getPresentationQueue().enqueue(event, [event]);
  return {
    sessionId,
    epoch: getPresentationQueue().currentEpoch(),
    items: getPresentationQueue().items(),
  };
}

function makeTerminalV3LogWithUntrustedRuntime() {
  const sessionId = 'driver-v3-runtime-boundary';
  const state = createEmptyGameState();
  startCausalSession(state, sessionId);
  state.turn = {
    number: 1,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  state.pendingRuntimeState = {
    token: 1,
    snapshot: [{
      key: '__pendingEffectPickQueue',
      present: true,
      value: 'not-a-queue',
    }],
  };
  appendCausal(state, {
    actor: 'self',
    kind: 'game-result',
    source: { kind: 'player', side: 'self' },
    targets: [{ kind: 'player', side: 'opp' }],
    outcome: { type: 'state', state: 'success' },
  });
  state.gameResult = { winner: 'self', reason: 'evidence' };

  return buildReplayLogV3({
    artifactId: 'driver-v3-runtime-boundary-artifact',
    sessionId,
    viewerMode: 'solo-self',
    states: [state],
  });
}
