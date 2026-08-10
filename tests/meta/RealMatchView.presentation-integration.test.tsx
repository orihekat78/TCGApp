import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { flow } from '@/engine';
import { registerAll } from '@/cards';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  getPresentationQueue,
} from '@/ui/presentation/coordinator';
import { usePresentationStore } from '@/ui/presentation/store';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  matchSessionId,
} from '@/ui/services/matchSession';
import { getFinalizedReplay } from '@/ui/services/liveReplayRecorder';
import { useGameStateStore } from '@/ui/state/store';
import { RealMatchView } from '../../meta-app/src/screens/RealMatchView';

const replayMock = vi.hoisted(() => ({ log: null as object | null }));

vi.mock('@/ui/components/Playmat', () => ({
  Playmat: () => <div data-testid="real-playmat" />,
}));
vi.mock('@/ui/hooks/useReplayDriver', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/ui/hooks/useReplayDriver')>(),
  useReplayDriver: () => ({ state: { log: replayMock.log } }),
}));
vi.mock('@/ui/components/ReplayPanel', () => ({ ReplayPanel: () => null }));
vi.mock('@/ui/hooks/useEffectPickFlowDriver', () => ({
  useEffectPickFlowDriver: vi.fn(),
}));
vi.mock('@/ui/hooks/useHiramekiDemoDriver', () => ({
  useHiramekiDemoDriver: vi.fn(),
}));
vi.mock('@/ui/hooks/useCutinDemoDriver', () => ({
  useCutinDemoDriver: vi.fn(),
}));
vi.mock('@/ui/components/MulliganModal', () => ({ MulliganModal: () => null }));
vi.mock('@/ui/components/EffectPickerModal', () => ({ EffectPickerModal: () => null }));
vi.mock('@/ui/components/EffectDecisionModalHosts', () => ({ EffectDecisionModalHosts: () => null }));
vi.mock('@/ui/components/DeckRevealOverlay', () => ({ DeckRevealOverlay: () => null }));
vi.mock('@/ui/components/PublicHandRevealWindow', () => ({ PublicHandRevealWindow: () => null }));
vi.mock('@/ui/components/VictoryOverlay', () => ({ VictoryOverlay: () => null }));
vi.mock('@/ui/components/TutorialOverlay', () => ({ TutorialOverlay: () => null }));
vi.mock('@/ui/components/HiramekiDemoPickerModal', () => ({
  HiramekiDemoPickerModal: ({ onPick }: { onPick: (cardId: string) => void }) => (
    <button type="button" data-testid="meta-hirameki-demo-pick" onClick={() => onPick('B04028')}>
      pick
    </button>
  ),
}));
vi.mock('@/ui/components/HiramekiDemoBanner', () => ({ HiramekiDemoBanner: () => null }));
vi.mock('@/ui/components/CutinDemoPickerModal', () => ({ CutinDemoPickerModal: () => null }));
vi.mock('@/ui/components/CutinDemoBanner', () => ({ CutinDemoBanner: () => null }));

describe('RealMatchView committed terminal presentation integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    registerAll();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    replayMock.log = null;
    endMatchSession();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts the public Hirameki demo through the state-owned action checkpoint', () => {
    beginCommittedLiveMatch();
    useGameStateStore.setState({ hiramekiDemoMode: 'picking' });
    act(() => root.render(<RealMatchView onMatchEnd={vi.fn()} />));

    const pick = container.querySelector<HTMLButtonElement>('[data-testid="meta-hirameki-demo-pick"]');
    expect(pick).not.toBeNull();
    act(() => pick!.click());

    const store = useGameStateStore.getState();
    const actionId = store.activeActionId;
    expect(store).toMatchObject({
      hiramekiDemoMode: 'playing',
      hiramekiDemoSelectedCardId: 'B04028',
      pendingHirameki: {
        actionId,
        player: 'self',
        cardId: 'B04028',
        abilityId: 'a2',
        gainDeferred: true,
        causalCorrelationEventId: expect.any(String),
      },
    });
    expect(flow.action._getContext(store.gameState!, actionId!)).toMatchObject({
      phase: 'judge',
      judgeResolved: true,
      deferredCaseEvidenceGain: true,
    });
  });

  it('finalizes one route after the deadline and clears retained terminal surfaces', () => {
    const { sessionId, liveState } = beginCommittedLiveMatch();
    usePresentationStore.getState().setPresentationPaused(true);
    const queue = getPresentationQueue();
    const beginTerminal = vi.spyOn(queue, 'beginTerminal');
    const advanceTerminal = vi.spyOn(queue, 'advanceTerminal');
    const onMatchEnd = vi.fn(() => endMatchSession({ preserveGameState: true }));
    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));

    commitTerminalState(liveState, true);
    expect(usePresentationStore.getState().presentationError).toBeNull();
    expect(queue.outstandingCount()).toBe(1);
    expect(beginTerminal).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(2_999));
    expect(onMatchEnd).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onMatchEnd).toHaveBeenCalledOnce();
    expect(advanceTerminal).toHaveBeenCalledOnce();
    expect(queue.outstandingCount()).toBe(0);
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(getFinalizedReplay(sessionId)).not.toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(onMatchEnd).toHaveBeenCalledOnce();
  });

  it('routes once on presentation skip and clears retained terminal surfaces immediately', () => {
    const { liveState } = beginCommittedLiveMatch();
    usePresentationStore.getState().setPresentationPaused(true);
    const onMatchEnd = vi.fn(() => endMatchSession({ preserveGameState: true }));
    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));

    commitTerminalState(liveState, true);
    act(() => usePresentationStore.getState().skipPresentation());

    expect(onMatchEnd).toHaveBeenCalledOnce();
    expect(getPresentationQueue().outstandingCount()).toBe(0);
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(onMatchEnd).toHaveBeenCalledOnce();
  });

  it('cancels an armed terminal deadline when replay ownership replaces the live view', () => {
    const { liveState } = beginCommittedLiveMatch();
    usePresentationStore.getState().setPresentationPaused(true);
    const onMatchEnd = vi.fn();
    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));
    commitTerminalState(liveState, false);
    act(() => vi.advanceTimersByTime(1_000));

    act(() => {
      replayMock.log = {};
      root.render(<RealMatchView onMatchEnd={onMatchEnd} />);
    });
    act(() => vi.advanceTimersByTime(10_000));

    expect(onMatchEnd).not.toHaveBeenCalled();
    expect(usePresentationStore.getState().presentationError).toBeNull();
    expect(useGameStateStore.getState().gameState?.gameResult).toEqual({
      winner: 'opp',
      reason: 'evidence',
    });
  });
});

function beginCommittedLiveMatch(): {
  sessionId: string;
  liveState: ReturnType<typeof createEmptyGameState>;
} {
  const token = beginMatchSession('self');
  const sessionId = matchSessionId(token);
  const liveState = createEmptyGameState();
  startCausalSession(liveState, sessionId);
  expect(commitMatchSession(token, liveState)).toBe(true);
  return { sessionId, liveState };
}

function commitTerminalState(
  liveState: ReturnType<typeof createEmptyGameState>,
  retainSurfaces: boolean,
): void {
  const terminalState = structuredClone(liveState);
  appendCausal(terminalState, {
    actor: 'opp',
    kind: 'game-result',
    source: { kind: 'player', side: 'opp' },
    targets: [{ kind: 'player', side: 'self' }],
    outcome: { type: 'state', state: 'success' },
  });
  terminalState.gameResult = { winner: 'opp', reason: 'evidence' };
  act(() => {
    useGameStateStore.getState().setGameState(terminalState);
    if (!retainSurfaces) return;
    useGameStateStore.getState().setPendingDeckReveal({
      player: 'opp',
      visibility: 'public',
      viewer: 'all',
      revealed: ['D08015'],
      matched: 'D08015',
    });
    useGameStateStore.getState().setPendingPublicHandReveal({
      owner: 'opp',
      audience: 'all',
      cardIds: ['D08015'],
      handSnapshot: ['D08015'],
      lifetime: 'presentation',
      resolutionToken: 'real-host-terminal:1',
      source: {},
    });
  });
}
