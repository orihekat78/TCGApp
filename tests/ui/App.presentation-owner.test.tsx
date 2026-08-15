import { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flow } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import { endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const { stepTurnMock } = vi.hoisted(() => ({ stepTurnMock: vi.fn() }));

vi.mock('@/ai/policy.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/ai/policy.js')>(),
  stepTurn: stepTurnMock,
}));

import App from '@/App';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('standalone App presentation ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    stepTurnMock.mockReset();
    _resetIsDriving();
    resetPresentationQueue('standalone-app-owner');
    useGameStateStore.setState({
      gameState: null,
      spectatorMode: false,
      aiSpeedMs: 400,
      isAiPaused: false,
      aiStepCounter: 0,
      oppMoveTick: 0,
      activeActionId: null,
      activeCardUid: null,
      activeCardLabel: null,
      pendingMisread: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingRps: null,
      pendingChooseIntercept: null,
      pendingLeaveIntercept: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
      pendingEffectRepeatOptional: null,
      pendingDeckReveal: null,
      pendingPublicHandReveal: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
      pendingHirameki: null,
      hiramekiDemoMode: 'idle',
      hiramekiDemoSelectedCardId: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
    resetPresentationQueue('standalone-app-owner-cleanup');
    vi.useRealTimers();
  });

  it('starts the public Hirameki demo through the state-owned action checkpoint', () => {
    useGameStateStore.setState({ hiramekiDemoMode: 'picking' });
    act(() => root.render(<App />));

    const card = container.querySelector<HTMLButtonElement>('[data-testid="hirameki-demo-pick-B04028"]');
    expect(card).not.toBeNull();
    act(() => card!.click());

    const store = useGameStateStore.getState();
    const actionId = store.activeActionId;
    expect(actionId).not.toBeNull();
    expect(store.hiramekiDemoMode).toBe('playing');
    expect(store.hiramekiDemoSelectedCardId).toBe('B04028');
    expect(store.pendingHirameki).toMatchObject({
      actionId,
      player: 'self',
      cardId: 'B04028',
      abilityId: 'a2',
      gainDeferred: true,
      causalCorrelationEventId: undefined,
      heldEvidence: {
        token: `hirameki:${actionId}:self`,
        player: 'self',
        cardId: 'B04028',
      },
    });
    expect(flow.action._getContext(store.gameState!, actionId!)).toMatchObject({
      phase: 'judge',
      judgeResolved: true,
      deferredCaseEvidenceGain: true,
    });
  });

  it('drains exactly one preloaded item per interval before one non-terminal CPU continuation under StrictMode', async () => {
    const causalState = createEmptyGameState();
    causalState.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    startCausalSession(causalState, 'standalone-app-owner');
    appendCausal(causalState, {
      actor: 'opp',
      kind: 'draw',
      targets: [],
      outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    appendCausal(causalState, {
      actor: 'opp',
      kind: 'discard',
      targets: [],
      outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    const afterFirstStep = structuredClone(causalState);
    stepTurnMock.mockReturnValue({
      move: { kind: 'handUseCard', cardId: 'D08001' },
      nextState: afterFirstStep,
      done: false,
    });

    act(() => useGameStateStore.getState().setGameState(causalState));
    expect(getPresentationQueue().items().map((item) => (
      item.type === 'event' ? item.event.eventId : item.type
    ))).toEqual(['standalone-app-owner:1', 'standalone-app-owner:2']);

    act(() => root.render(<StrictMode><App /></StrictMode>));
    const initiallyMountedEventIds = Array.from(
      container.querySelectorAll('[data-testid="presentation-causal-host"]'),
      (node) => node.getAttribute('data-event-id'),
    );

    await act(async () => vi.advanceTimersByTime(819));
    expect(getPresentationQueue().outstandingCount()).toBe(2);
    expect(stepTurnMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(getPresentationQueue().outstandingCount()).toBe(1);
    expect(initiallyMountedEventIds).toEqual(['standalone-app-owner:1']);
    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-event-id'))
      .toBe('standalone-app-owner:2');
    expect(stepTurnMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(819));
    expect(getPresentationQueue().outstandingCount()).toBe(1);
    expect(stepTurnMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    await act(async () => vi.advanceTimersByTime(0));
    expect(getPresentationQueue().outstandingCount()).toBe(0);
    expect(stepTurnMock).toHaveBeenCalledOnce();
    expect(useGameStateStore.getState().oppMoveTick).toBe(1);
    expect(useGameStateStore.getState().gameState?.gameResult).toBeUndefined();
    await act(async () => vi.advanceTimersByTime(399));
    expect(stepTurnMock).toHaveBeenCalledOnce();
  });

  it('renders contact and refresh through the presentation queue without legacy duplicate surfaces', () => {
    const causalState = createEmptyGameState();
    startCausalSession(causalState, 'standalone-specialized-owner');
    appendCausal(causalState, {
      actor: 'opp',
      kind: 'declare',
      tags: ['contact', 'refresh'],
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    resetPresentationQueue('standalone-specialized-owner');
    act(() => useGameStateStore.getState().setGameState(causalState));

    act(() => root.render(<App />));

    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-variant'))
      .toBe('contact');
    expect(container.querySelector('[data-testid="recent-action-toast"]')).toBeNull();
    expect(container.querySelector('[data-testid="contact-flash"]')).toBeNull();
    expect(container.querySelector('[data-testid="refresh-overlay"]')).toBeNull();
  });
});
