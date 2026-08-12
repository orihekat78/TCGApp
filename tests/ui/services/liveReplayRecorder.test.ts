import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { replayStates } from '@/ai/replay/state-frame';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { mutate } from '@/engine/mutate';
import { createEmptyGameState } from '@/engine/state-factory';
import { FILE_CARD_BACK_PLACEHOLDER, type SceneCharacter } from '@/engine/types';
import {
  checkpointLiveReplayRecording,
  finalizeLiveReplayRecording,
  getFinalizedReplay,
  resetLiveReplayRecorderForTests,
  rollbackLiveReplayRecording,
  startLiveReplayRecording,
} from '@/ui/services/liveReplayRecorder';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { cloneReplayStateAtCommit } from '@/ui/services/replayStateBoundary';
import { projectReplayLogForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';

function trackedState(sessionId: string, turn: number) {
  const state = createEmptyGameState();
  startCausalSession(state, sessionId);
  state.turn.number = turn;
  state.turn.phase = 'main';
  return state;
}

function privateSceneCharacter(): SceneCharacter {
  return {
    cardId: 'PUBLIC-SCENE-CARD',
    uid: 'scene:self:private',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [{ cardId: 'SELF-HIDDEN-SET', faceUp: false, instanceId: 'set:hidden' }],
    stackedCards: [{ cardId: 'SELF-HIDDEN-STACK', instanceId: 'stack:hidden' }],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function privateTrackedState(sessionId: string) {
  const state = trackedState(sessionId, 1);
  state.players.self.hand = ['SELF-HAND-SECRET'];
  state.players.opp.hand = ['OPP-HAND-SECRET'];
  state.players.self.deck = ['SELF-DECK-SECRET'];
  state.players.opp.deck = ['OPP-DECK-SECRET'];
  state.players.self.evidence = [{
    cardId: 'SELF-HIDDEN-EVIDENCE',
    faceUp: false,
    origin: { turn: 1, via: 'effect', sourceCardId: 'SELF-HIDDEN-SOURCE' },
  }];
  state.players.self.file = [{ type: 'card-back', cardId: 'SELF-HIDDEN-FILE' }];
  state.players.self.scene = [privateSceneCharacter()];
  return state;
}

function startRecording(sessionId: string, viewerMode: 'solo-self' | 'spectator'): void {
  resetPresentationQueue(sessionId);
  startLiveReplayRecording({ sessionId, viewerMode });
}

describe('live ReplayLogV3 recorder', () => {
  beforeEach(() => {
    resetLiveReplayRecorderForTests();
    useGameStateStore.getState().resetMatchSessionState();
  });

  afterEach(() => resetLiveReplayRecorderForTests());

  it('captures human and CPU commits once at the GameState boundary and freezes terminal state', () => {
    const sessionId = 'match-live-a';
    startRecording(sessionId, 'solo-self');
    const initial = trackedState(sessionId, 1);
    useGameStateStore.getState().setGameState(initial);
    const cpu = structuredClone(initial);
    cpu.turn.player = 'opp';
    cpu.players.opp.hand.push('D11001');
    useGameStateStore.getState().setGameState(cpu);
    useGameStateStore.getState().setGameState(structuredClone(cpu));
    const terminal = structuredClone(cpu);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.getState().setGameState(terminal);

    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const log = getFinalizedReplay(sessionId);
    expect(log).not.toBeNull();
    expect(log!.viewerMode).toBe('solo-self');
    expect(log!.frames).toHaveLength(2);
    expect(log!.result).toEqual({ winner: 'self', reason: 'evidence', turns: 1 });
  });

  it('rolls back only speculative captures and preserves the confirmed prefix', () => {
    const sessionId = 'match-live-transaction';
    startRecording(sessionId, 'solo-self');
    const initial = trackedState(sessionId, 1);
    useGameStateStore.getState().setGameState(initial);
    const confirmed = structuredClone(initial);
    appendCausal(confirmed, {
      actor: 'self', kind: 'use', targets: [], outcome: { type: 'state', state: 'success' },
    });
    useGameStateStore.getState().setGameState(confirmed);
    const checkpoint = checkpointLiveReplayRecording();
    const speculativeTerminal = structuredClone(confirmed);
    mutate.gameResult.set(speculativeTerminal, 'opp', 'concede');
    useGameStateStore.getState().setGameState(speculativeTerminal);

    expect(rollbackLiveReplayRecording(checkpoint)).toBe(true);
    expect(finalizeLiveReplayRecording(sessionId)).toBe(false);

    const committedTerminal = structuredClone(confirmed);
    mutate.gameResult.set(committedTerminal, 'opp', 'concede');
    useGameStateStore.getState().setGameState(committedTerminal);
    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const replay = getFinalizedReplay(sessionId);
    expect(replay?.result).toEqual({ winner: 'opp', reason: 'concede', turns: 1 });
    expect(replay?.frames).toHaveLength(2);
    expect(replay?.frames.map(({ causalEventIds }) => causalEventIds)).toEqual([
      [`${sessionId}:1`],
      [`${sessionId}:2`],
    ]);
    const replayedStates = replayStates(replay!);
    const terminalStates = replayedStates.filter((state) => state.gameResult !== undefined);
    expect(terminalStates).toHaveLength(1);
    expect(terminalStates[0]?.gameResult).toEqual({ winner: 'opp', reason: 'concede' });
    const terminalEvents = terminalStates[0]!.log.filter((entry) => (
      typeof entry === 'object' && entry !== null && 'kind' in entry && entry.kind === 'game-result'
    ));
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0]).toMatchObject({
      actor: 'opp',
      source: { kind: 'player', side: 'opp' },
      targets: [{ kind: 'player', side: 'self' }],
    });
    for (const state of replayedStates) {
      expect(state.pendingEffects).toEqual([]);
      expect(state.reservedEffects).toEqual([]);
      expect(state.actionContexts).toEqual({});
      expect(state.pendingRuntimeState).toBeUndefined();
      expect(state.pendingReasoningContinuation).toBeUndefined();
      expect(state.pendingTurnTransition).toBeUndefined();
    }
    expect(finalizeLiveReplayRecording(sessionId)).toBe(false);
    expect(getFinalizedReplay(sessionId)).toEqual(replay);
  });

  it('does not roll a stale checkpoint over a replacement recording authority', () => {
    startRecording('match-live-old', 'solo-self');
    useGameStateStore.getState().setGameState(trackedState('match-live-old', 1));
    const staleCheckpoint = checkpointLiveReplayRecording();

    const sessionId = 'match-live-new';
    startRecording(sessionId, 'spectator');
    const initial = trackedState(sessionId, 1);
    useGameStateStore.getState().setGameState(initial);
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.getState().setGameState(terminal);

    expect(rollbackLiveReplayRecording(staleCheckpoint)).toBe(false);
    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    expect(getFinalizedReplay(sessionId)?.result).toEqual({
      winner: 'self', reason: 'evidence', turns: 1,
    });
  });

  it('ignores foreign-session states and refuses a non-terminal finalization', () => {
    startRecording('match-live-a', 'spectator');
    useGameStateStore.getState().setGameState(trackedState('match-foreign', 1));
    useGameStateStore.getState().setGameState(trackedState('match-live-a', 1));

    expect(finalizeLiveReplayRecording('match-live-a')).toBe(false);
    expect(getFinalizedReplay('match-live-a')).toBeNull();
  });

  it('reconstructs a V3 replay captured from the causal terminal producer', () => {
    const sessionId = 'match-live-reconstruct';
    startRecording(sessionId, 'solo-self');
    const initial = trackedState(sessionId, 1);
    useGameStateStore.getState().setGameState(initial);
    const terminal = structuredClone(initial);
    mutate.partner.solveCase(terminal, 'self');
    useGameStateStore.getState().setGameState(terminal);

    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const log = getFinalizedReplay(sessionId);
    expect(log).not.toBeNull();
    expect(log!.frames[0]?.causalEventIds).toEqual([`${sessionId}:1`]);

    const [replayedInitial, replayedTerminal] = replayStates(log!);
    expect(replayedInitial.gameResult).toBeUndefined();
    expect(replayedTerminal?.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(replayedTerminal?.players.self.partner.state).toBe('sleep');
  });

  it('freezes a public causal ref when its card later leaves the visible source zone', () => {
    const sessionId = 'match-live-public-prefix';
    startRecording(sessionId, 'spectator');
    const initial = trackedState(sessionId, 1);
    initial.players.self.scene = [privateSceneCharacter()];
    appendCausal(initial, {
      actor: 'self',
      kind: 'use',
      source: { kind: 'scene-card', side: 'self', uid: 'scene:self:private' },
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    useGameStateStore.setState({ gameState: initial });

    const terminal = structuredClone(initial);
    terminal.players.self.scene = [];
    terminal.players.self.remove.push('PUBLIC-SCENE-CARD');
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });

    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const persistedProjection = projectReplayLogForViewer(getFinalizedReplay(sessionId)!);
    const [replayedInitial, replayedTerminal] = replayStates(persistedProjection);
    expect(replayedInitial.log[0]).toEqual(replayedTerminal.log[0]);
    expect(replayedInitial.log[0]).toMatchObject({
      source: {
        kind: 'card',
        side: 'self',
        zone: 'scene',
        cardNumber: 'PUBLIC-SCENE-CARD',
      },
    });
  });

  it('rejects a committed mutation of previously captured raw causal history', () => {
    const sessionId = 'match-live-mutated-prefix';
    startRecording(sessionId, 'spectator');
    const initial = trackedState(sessionId, 1);
    appendCausal(initial, {
      actor: 'self',
      kind: 'use',
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    useGameStateStore.setState({ gameState: initial });

    const mutated = structuredClone(initial);
    (mutated.log[0] as { result?: string }).result = 'failed';

    expect(() => useGameStateStore.setState({ gameState: mutated }))
      .toThrow(/immutable prefix/i);
  });

  it('keeps the committed snapshot when the source object is mutated later', () => {
    const sessionId = 'match-live-snapshot';
    startRecording(sessionId, 'solo-self');
    const initial = trackedState(sessionId, 1);
    initial.players.self.hand = ['D08001'];
    // Bypass the production normalizer here so the test can mutate the exact
    // source reference after the recorder subscriber has observed it.
    useGameStateStore.setState({ gameState: initial });

    initial.players.self.hand[0] = 'MUTATED-AFTER-COMMIT';
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });

    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const log = getFinalizedReplay(sessionId);
    expect(log).not.toBeNull();
    expect(JSON.stringify(log!.initialState)).toContain('D08001');
    expect(JSON.stringify(log!.initialState)).not.toContain('MUTATED-AFTER-COMMIT');
  });

  it('removes live resolver descriptors before cloning a replay snapshot', () => {
    const sessionId = 'match-live-runtime-boundary';
    startRecording(sessionId, 'solo-self');
    const resolving = trackedState(sessionId, 1);
    resolving.pendingEffects.push({
      id: 'custom-effect',
      source: { player: 'opp', cardId: 'D11005' },
      triggeredBy: { hook: 'enter' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'custom', fn: () => undefined },
      state: 'resolved',
    });
    resolving.reservedEffects.push({
      id: 'custom-reserved',
      trigger: { hook: 'turn:end:start', mode: 'turn-end', player: 'opp', armedTurn: 1 },
      effect: { kind: 'custom', fn: () => undefined },
      source: { player: 'opp', cardId: 'D11005' },
    });
    resolving.pendingRuntimeState = {
      token: 1,
      snapshot: [{ key: 'runtime-selector', present: true, value: () => false }],
    };

    expect(() => useGameStateStore.setState({ gameState: resolving })).not.toThrow();

    const terminal = trackedState(sessionId, 1);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });
    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);

    const log = getFinalizedReplay(sessionId)!;
    expect(log.initialState.pendingEffects).toEqual([]);
    expect(log.initialState.reservedEffects).toEqual([]);
    expect(log.initialState.actionContexts).toEqual({});
    expect(log.initialState.pendingRuntimeState).toBeUndefined();
  });

  it('rejects executable values outside the explicitly removed resolver fields', () => {
    const state = trackedState('match-live-invalid-function', 1);
    (state.players.self.case as unknown as { cardId: unknown }).cardId = () => 'not-json';

    expect(() => cloneReplayStateAtCommit(state)).toThrow();
  });

  it('does not expose the recorder-owned artifact by mutable reference', () => {
    const sessionId = 'match-live-handoff';
    startRecording(sessionId, 'solo-self');
    const initial = trackedState(sessionId, 1);
    useGameStateStore.setState({ gameState: initial });
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });
    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);

    const first = getFinalizedReplay(sessionId)!;
    first.initialState.players.self.case.cardId = 'MUTATED-CONSUMER-COPY';
    const second = getFinalizedReplay(sessionId)!;

    expect(second.initialState.players.self.case.cardId).not.toBe('MUTATED-CONSUMER-COPY');
  });

  it.each([
    ['spectator', false],
    ['solo-self', true],
  ] as const)('projects private identities before finalizing a %s artifact', (viewerMode, revealSelfHand) => {
    const sessionId = `match-live-private-${viewerMode}`;
    startRecording(sessionId, viewerMode);
    const initial = privateTrackedState(sessionId);
    useGameStateStore.setState({ gameState: initial });
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });

    expect(finalizeLiveReplayRecording(sessionId)).toBe(true);
    const log = getFinalizedReplay(sessionId)!;
    const serialized = JSON.stringify(log);

    expect(log.initialState.players.self.hand).toEqual([
      revealSelfHand ? 'SELF-HAND-SECRET' : FILE_CARD_BACK_PLACEHOLDER,
    ]);
    for (const secret of [
      'OPP-HAND-SECRET', 'SELF-DECK-SECRET', 'OPP-DECK-SECRET',
      'SELF-HIDDEN-EVIDENCE', 'SELF-HIDDEN-SOURCE', 'SELF-HIDDEN-FILE',
      'SELF-HIDDEN-SET', 'SELF-HIDDEN-STACK',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized.includes('SELF-HAND-SECRET')).toBe(revealSelfHand);
  });
});
