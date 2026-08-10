import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { useMulliganStore, resolveMulligan } from '@/ui/hooks/useMulligan';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  isCurrentMatchSession,
  isMatchSessionActive,
  matchSessionId,
} from '@/ui/services/matchSession';
import {
  currentPresentationSessionId,
  getPresentationQueue,
} from '@/ui/presentation/coordinator';
import { usePresentationStore } from '@/ui/presentation/store';
import { useGameStateStore } from '@/ui/state/store';
import {
  finalizeLiveReplayRecording,
  getFinalizedReplay,
} from '@/ui/services/liveReplayRecorder';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { customGameStart } from '../../meta-app/src/util/customGameStart';

type GuardedStartOptions = Parameters<typeof customGameStart>[2] & {
  isSessionCurrent: () => boolean;
};

describe('real match-session cancellation race', () => {
  beforeEach(() => {
    endMatchSession();
    engine.cards._resetRegistry();
    event._resetRegistry();
    registerAll();
  });

  afterEach(() => {
    endMatchSession();
    useGameStateStore.setState({ gameState: null });
    vi.restoreAllMocks();
  });

  it('leaving a real mulligan then starting again cannot commit, navigate, or leak stale pending state', async () => {
    const startGame = vi.spyOn(engine.flow.setup, 'startGame');
    const nav = vi.fn<(route: 'match' | 'setup') => void>();
    const staleToken = beginMatchSession('self');
    nav('match');
    const staleStart = customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, {
      sessionId: matchSessionId(staleToken),
      firstPlayer: 'self',
      isSessionCurrent: () => isCurrentMatchSession(staleToken),
    } as GuardedStartOptions);
    const staleHandled = staleStart.then(
      (state) => commitMatchSession(staleToken, state),
      () => {
        if (isCurrentMatchSession(staleToken)) nav('setup');
        return false;
      },
    );

    expect(useMulliganStore.getState().current?.player).toBe('self');
    const pickerDone = vi.fn();
    void useTargetPicker().start({ candidates: ['stale-target'] }).then(pickerDone);
    useGameStateStore.setState({ pendingEffectOptional: {} as never });
    const globals = globalThis as Record<string, unknown>;
    globals.__pendingEffectPickQueue = [{ player: 'self', source: { cardId: 'STALE' } }];
    globals.__pendingEffectPickSide = (globals.__pendingEffectPickQueue as unknown[])[0];

    endMatchSession();
    nav('setup');
    await Promise.resolve();
    const mulliganWasSettledOnLeave = useMulliganStore.getState().current === null;
    const pickerWasSettledOnLeave = useTargetPickerStore.getState().phase.phase === 'idle';
    if (!mulliganWasSettledOnLeave) resolveMulligan([]);

    const freshToken = beginMatchSession('self');
    nav('match');
    const freshState = await customGameStart(SAMPLE_DECK_OPP, SAMPLE_DECK, {
      sessionId: matchSessionId(freshToken),
      spectator: true,
      firstPlayer: 'opp',
      isSessionCurrent: () => isCurrentMatchSession(freshToken),
    } as GuardedStartOptions);
    expect(commitMatchSession(freshToken, freshState)).toBe(true);
    expect(usePresentationStore.getState().presentationError).toBeNull();
    expect(getPresentationQueue().outstandingCount()).toBeGreaterThan(0);
    expect(await staleHandled).toBe(false);
    await Promise.resolve();

    expect(mulliganWasSettledOnLeave).toBe(true);
    expect(pickerWasSettledOnLeave).toBe(true);
    expect(pickerDone).toHaveBeenCalledWith(null);
    expect(nav.mock.calls.map(([route]) => route)).toEqual(['match', 'setup', 'match']);
    expect(startGame).toHaveBeenCalledTimes(1);
    expect(useGameStateStore.getState().gameState).toBe(freshState);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(globals.__pendingEffectPickQueue).toEqual([]);
    expect(globals.__pendingEffectPickSide ?? null).toBeNull();

    // Leaving match for the result route must clear transient ownership while
    // retaining the completed GameState consumed by ResultScreen.
    endMatchSession({ preserveGameState: true });
    expect(useGameStateStore.getState().gameState).toBe(freshState);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it('a fresh match session cannot inherit the previous match resolution lock', () => {
    const oldState = createEmptyGameState();
    engine.resolve.lock(oldState, 'old-match');
    expect(engine.resolve.isLocked(oldState)).toBe(true);

    beginMatchSession('self');

    expect(engine.resolve.isLocked(oldState)).toBe(false);
  });

  it('aligns presentation ownership with the caller-owned match session ID', () => {
    const token = beginMatchSession('self');
    expect(isMatchSessionActive()).toBe(true);
    expect(currentPresentationSessionId()).toBe(matchSessionId(token));

    endMatchSession();
    expect(isMatchSessionActive()).toBe(false);
  });

  it('does not report a current session as committed when presentation admission rejects the state', () => {
    const token = beginMatchSession('self');
    const malformed = createEmptyGameState();
    startCausalSession(malformed, matchSessionId(token));
    appendCausal(malformed, {
      actor: 'opp',
      kind: 'draw',
      targets: [],
      outcome: { type: 'none' },
    });
    (malformed.log[0] as { parentEventId?: string }).parentEventId = `${matchSessionId(token)}:999`;

    expect(commitMatchSession(token, malformed)).toBe(false);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(isMatchSessionActive()).toBe(true);
    expect(usePresentationStore.getState().presentationError).toMatch(/parent|missing|edge/i);
  });

  it('rejects a graph-valid causal state from a foreign presentation session before committing it', () => {
    const token = beginMatchSession('self');
    const foreignSession = createEmptyGameState();
    startCausalSession(foreignSession, 'foreign-presentation-session');
    appendCausal(foreignSession, {
      actor: 'opp',
      kind: 'draw',
      targets: [],
      outcome: { type: 'none' },
    });

    expect(commitMatchSession(token, foreignSession)).toBe(false);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(isMatchSessionActive()).toBe(true);
    expect(usePresentationStore.getState().presentationError).toMatch(/session/i);
  });

  it('resets transient presentation controls while preserving a finished GameState', () => {
    const finished = createEmptyGameState();
    finished.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: finished });
    usePresentationStore.setState({
      presentationPaused: true,
      presentationError: 'stale presentation error',
      presentationCompletionNotice: { kind: 'skip', count: 4 },
    });
    const skipBefore = usePresentationStore.getState().presentationSkipToken;

    endMatchSession({ preserveGameState: true });

    expect(useGameStateStore.getState().gameState).toBe(finished);
    expect(usePresentationStore.getState()).toMatchObject({
      presentationPaused: false,
      presentationError: null,
      presentationSkipToken: skipBefore + 1,
      presentationCompletionNotice: { kind: 'skip', count: 4 },
    });

    beginMatchSession('self');
    expect(usePresentationStore.getState().presentationCompletionNotice).toBeNull();
  });

  it('preserves the terminal state and completes teardown when replay finalization is invalid', () => {
    const token = beginMatchSession('self');
    const finished = createEmptyGameState();
    finished.gameResult = { winner: 'self', reason: 'evidence' };
    finished.causalLog = {
      schemaVersion: 1,
      sessionId: matchSessionId(token),
      nextSequence: 2,
    };
    useGameStateStore.setState({ gameState: finished });

    expect(() => endMatchSession({ preserveGameState: true })).not.toThrow();
    expect(useGameStateStore.getState().gameState).toBe(finished);
    expect(isCurrentMatchSession(token)).toBe(false);
  });

  it('discards recorder ownership when a preserved finalization has no terminal state', () => {
    const token = beginMatchSession('self');
    const sessionId = matchSessionId(token);
    const inProgress = createEmptyGameState();
    inProgress.causalLog = { schemaVersion: 1, sessionId, nextSequence: 1 };
    useGameStateStore.setState({ gameState: inProgress });

    endMatchSession({ preserveGameState: true });

    const lateTerminal = structuredClone(inProgress);
    lateTerminal.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: lateTerminal });
    expect(finalizeLiveReplayRecording(sessionId)).toBe(false);
    expect(getFinalizedReplay(sessionId)).toBeNull();
  });
});
