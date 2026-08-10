import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { admitPresentationFromState, getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import { PresentationCoordinatorHost } from '@/ui/presentation/PresentationCoordinatorHost';
import { usePresentationStore } from '@/ui/presentation/store';
import { useGameStateStore } from '@/ui/state/store';
import type { SceneCharacter } from '@/engine/types';

describe('PresentationCoordinatorHost', () => {
  let container: HTMLDivElement;
  let root: Root;
  let visibilityState: DocumentVisibilityState;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    usePresentationStore.setState({
      presentationPaused: false,
      presentationStepToken: 0,
      presentationSkipToken: 0,
      presentationError: null,
      presentationCompletionNotice: null,
    });
    useGameStateStore.setState({ gameState: null });
    setViewport(1280, 800);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll('#scaler').forEach((element) => element.remove());
    useGameStateStore.setState({ gameState: null });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('owns one FIFO item at a time and advances without mounting legacy duplicate surfaces', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-fifo');
    appendCausal(state, {
      actor: 'self', kind: 'use', targets: [], outcome: { type: 'state', state: 'success' },
    });
    appendCausal(state, {
      actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    resetPresentationQueue('host-fifo');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-event-id'))
      .toBe('host-fifo:1');
    expect(container.querySelector('[data-testid="recent-action-toast"]')).toBeNull();
    expect(container.querySelector('[data-testid="contact-flash"]')).toBeNull();
    expect(container.querySelector('[data-testid="refresh-overlay"]')).toBeNull();

    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-phase'))
      .toBe('cause');
    act(() => vi.advanceTimersByTime(820));
    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-event-id'))
      .toBe('host-fifo:2');
    act(() => vi.advanceTimersByTime(820));
    expect(container.querySelector('[data-testid="presentation-causal-host"]')).toBeNull();
  });

  it('uses one specialized contact presentation instead of a generic duplicate', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-contact');
    appendCausal(state, {
      actor: 'opp', kind: 'declare', tags: ['contact'], targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    resetPresentationQueue('host-contact');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    const host = container.querySelector('[data-testid="presentation-causal-host"]');
    expect(host?.getAttribute('data-variant')).toBe('contact');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it.each([
    ['face-change', { type: 'face-change', from: 'face-down', to: 'face-up', count: 1 }, 'カードの向きを変更', '1枚を表向きに変更'],
    ['activate', { type: 'state', state: 'active' }, 'アクティブにする', 'アクティブ'],
  ] as const)('renders the %s vocabulary without internal labels', (kind, outcome, title, result) => {
    const state = createEmptyGameState();
    startCausalSession(state, `host-${kind}`);
    appendCausal(state, { actor: 'opp', kind, targets: [], outcome });
    resetPresentationQueue(`host-${kind}`);
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));

    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(result);
    expect(container.textContent).not.toContain(`causal.${kind}`);
  });

  it('keeps presentation pause and step separate from engine dispatch', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-step');
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('host-step');
    admitPresentationFromState(state);
    usePresentationStore.getState().setPresentationPaused(true);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    act(() => vi.advanceTimersByTime(10_000));
    expect(getPresentationQueue().outstandingCount()).toBe(1);

    act(() => usePresentationStore.getState().stepPresentation());
    expect(getPresentationQueue().outstandingCount()).toBe(1);
    act(() => vi.advanceTimersByTime(820));
    expect(getPresentationQueue().outstandingCount()).toBe(0);
  });

  it('finishes the current cause-to-result sequence before a pause takes effect', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-pause-boundary');
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('host-pause-boundary');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    act(() => vi.advanceTimersByTime(100));
    act(() => usePresentationStore.getState().setPresentationPaused(true));
    act(() => vi.advanceTimersByTime(720));

    expect(getPresentationQueue().outstandingCount()).toBe(1);
    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-event-id'))
      .toBe('host-pause-boundary:2');
    act(() => vi.advanceTimersByTime(10_000));
    expect(getPresentationQueue().outstandingCount()).toBe(1);
  });

  it('anchors source and target order to the actual public board elements', () => {
    const scaler = document.createElement('div');
    scaler.id = 'scaler';
    scaler.innerHTML = [
      '<div class="scene-area side-opp"><div data-card-id="D11003"></div></div>',
      '<div class="scene-area side-self"></div>',
    ].join('');
    document.body.appendChild(scaler);
    mockRect(scaler.querySelector<HTMLElement>('[data-card-id="D11003"]')!, 40, 60, 80, 120);
    mockRect(scaler.querySelector<HTMLElement>('.scene-area.side-self')!, 300, 220, 240, 140);

    const state = createEmptyGameState();
    state.players.opp.scene = [makeSceneCharacter('opp-source', 'D11003')];
    startCausalSession(state, 'host-anchor');
    appendCausal(state, {
      actor: 'opp',
      kind: 'declare',
      source: { kind: 'scene-card', side: 'opp', uid: 'opp-source' },
      targets: [{ kind: 'zone', side: 'self', zone: 'scene' }],
      outcome: { type: 'state', state: 'success' },
    });
    resetPresentationQueue('host-anchor');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    expect(container.querySelectorAll('.presentation-anchor-box.is-source')).toHaveLength(1);
    expect(container.querySelectorAll('.presentation-anchor-box.is-target')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(120));
    expect(container.querySelectorAll('.presentation-anchor-box.is-target')).toHaveLength(1);
    expect(container.querySelector('.presentation-anchor-box.is-target')?.textContent).toBe('1');
    expect(container.querySelectorAll('.presentation-anchor-connectors line')).toHaveLength(1);
    expect(container.textContent).toContain('[1/1]');
  });

  it('reveals targets immediately without connectors on first reduced-motion mount', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    const scaler = document.createElement('div');
    scaler.id = 'scaler';
    scaler.innerHTML = [
      '<div class="scene-area side-opp"><div data-card-id="D11003"></div></div>',
      '<div class="scene-area side-self"></div>',
    ].join('');
    document.body.appendChild(scaler);
    mockRect(scaler.querySelector<HTMLElement>('[data-card-id="D11003"]')!, 40, 60, 80, 120);
    mockRect(scaler.querySelector<HTMLElement>('.scene-area.side-self')!, 300, 220, 240, 140);

    const state = createEmptyGameState();
    state.players.opp.scene = [makeSceneCharacter('opp-source', 'D11003')];
    startCausalSession(state, 'host-reduced-motion');
    appendCausal(state, {
      actor: 'opp',
      kind: 'declare',
      source: { kind: 'scene-card', side: 'opp', uid: 'opp-source' },
      targets: [{ kind: 'zone', side: 'self', zone: 'scene' }],
      outcome: { type: 'state', state: 'success' },
    });
    resetPresentationQueue('host-reduced-motion');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));

    const host = container.querySelector('[data-testid="presentation-causal-host"]');
    expect(host?.getAttribute('data-phase')).toBe('cause');
    expect(host?.classList.contains('is-reduced-motion')).toBe(true);
    expect(container.querySelectorAll('.presentation-anchor-box.is-source')).toHaveLength(1);
    expect(container.querySelectorAll('.presentation-anchor-box.is-target')).toHaveLength(1);
    expect(container.querySelectorAll('.presentation-anchor-connectors line')).toHaveLength(0);
  });

  it('skips all queued presentation work immediately and confirms the skipped count', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-skip');
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'none' } });
    resetPresentationQueue('host-skip');
    admitPresentationFromState(state);

    act(() => root.render(<PresentationCoordinatorHost speed="slow" />));
    const skip = container.querySelector<HTMLButtonElement>('[data-testid="presentation-skip"]');
    expect(skip).not.toBeNull();
    act(() => skip?.click());

    expect(getPresentationQueue().outstandingCount()).toBe(0);
    expect(container.querySelector('[data-testid="presentation-causal-host"]')).toBeNull();
    expect(container.querySelector('[data-testid="presentation-skip-feedback"]')?.textContent)
      .toBe('2件の処理をスキップ');
    expect(usePresentationStore.getState().presentationCompletionNotice).toEqual({
      kind: 'skip',
      count: 2,
    });

    act(() => vi.advanceTimersByTime(1_200));
    expect(container.querySelector('[data-testid="presentation-skip-feedback"]')).toBeNull();
    expect(usePresentationStore.getState().presentationCompletionNotice).toBeNull();
  });

  it('shows the retained public source and targets for an aggregate item', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-aggregate');
    appendCausal(state, {
      actor: 'opp', kind: 'use', targets: [], outcome: { type: 'state', state: 'success' },
    });
    for (let sequence = 2; sequence <= 63; sequence += 1) {
      appendCausal(state, { actor: 'opp', kind: 'summary', targets: [], outcome: { type: 'none' } });
    }
    const repeated = {
      actor: 'opp' as const,
      kind: 'draw' as const,
      parentEventId: 'host-aggregate:1',
      source: { kind: 'player' as const, side: 'opp' as const },
      targets: [{ kind: 'zone' as const, side: 'self' as const, zone: 'scene' as const }],
      outcome: { type: 'count' as const, amount: 1, unit: 'card' as const },
    };
    const repeatedEvent = appendCausal(state, repeated);
    appendCausal(state, repeated);
    const epoch = resetPresentationQueue('host-aggregate');
    admitPresentationFromState(state);
    for (let index = 0; index < 63; index += 1) getPresentationQueue().completeCurrent(epoch);

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    expect(container.textContent).toContain(repeatedEvent.source?.label);
    expect(container.textContent).toContain(repeatedEvent.targets[0]?.label);
  });

  it('folds remaining presentation into a result notice and clears the live layer after at most three seconds', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'host-terminal');
    appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
    appendCausal(state, { actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'none' } });
    state.gameResult = { winner: 'self', reason: 'evidence' };
    resetPresentationQueue('host-terminal');
    act(() => useGameStateStore.getState().setGameState(state));
    usePresentationStore.getState().setPresentationPaused(true);

    act(() => root.render(<PresentationCoordinatorHost speed="slow" />));
    act(() => vi.advanceTimersByTime(2_999));
    expect(getPresentationQueue().current()).toMatchObject({ type: 'event' });
    act(() => vi.advanceTimersByTime(1));
    expect(getPresentationQueue().items()).toEqual([]);
    expect(usePresentationStore.getState().presentationCompletionNotice).toEqual({
      kind: 'terminal',
      count: 2,
    });
    expect(useGameStateStore.getState().gameState?.gameResult).toEqual(state.gameResult);
  });

  it('bridges document visibility to the queue and restores one bounded summary', () => {
    resetPresentationQueue('host-hidden');
    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));

    act(() => {
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const state = createEmptyGameState();
    startCausalSession(state, 'host-hidden');
    appendCausal(state, {
      actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    appendCausal(state, {
      actor: 'opp', kind: 'discard', targets: [], outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    act(() => admitPresentationFromState(state));

    expect(getPresentationQueue().current()).toBeNull();
    expect(container.querySelector('[data-testid="presentation-causal-host"]')).toBeNull();

    act(() => {
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(getPresentationQueue().current()).toMatchObject({
      type: 'summary', reason: 'hidden', count: 2, firstSequence: 1, lastSequence: 2,
    });
    expect(container.querySelector('[data-testid="presentation-causal-host"]')?.getAttribute('data-variant'))
      .toBe('summary');
  });

  it('uses one horizontal strip anchored inside the centered playmat at 851x393', () => {
    setViewport(851, 393);
    seedSingleEvent('host-gutter');

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    const host = container.querySelector<HTMLElement>('[data-testid="presentation-causal-host"]');
    expect(host?.dataset.presentationPlacement).toBe('playmat-strip');
    expect(Number.parseFloat(host?.style.left ?? ''))
      .toBeCloseTo(84.1667, 3);
    expect(Number.parseFloat(host?.style.width ?? ''))
      .toBeCloseTo(682.6667, 3);
    expect(host?.textContent).toContain('[1/1]');
  });

  it('keeps the same horizontal strip and minimum 12px copy at 720x393', () => {
    setViewport(720, 393);
    seedSingleEvent('host-overlay');

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));
    const host = container.querySelector<HTMLElement>('[data-testid="presentation-causal-host"]');
    expect(host?.dataset.presentationPlacement).toBe('playmat-strip');
    expect(Number.parseFloat(host?.style.left ?? ''))
      .toBeCloseTo(18.6667, 3);
    expect(Number.parseFloat(host?.style.width ?? ''))
      .toBeCloseTo(682.6667, 3);
    expect(container.querySelector('.presentation-causal-sweep')).toBeNull();
  });

  it('shows an owned public failure notice without exposing the internal validation error', () => {
    resetPresentationQueue('host-validation-error');
    usePresentationStore.getState().setPresentationError('Missing parent edge for secret-card-id');

    act(() => root.render(<PresentationCoordinatorHost speed="standard" />));

    const alert = container.querySelector('[data-testid="presentation-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toBe('処理表示を更新できませんでした。対戦状態は直前のままです。');
    expect(container.textContent).not.toContain('secret-card-id');
  });
});

function seedSingleEvent(sessionId: string): void {
  const state = createEmptyGameState();
  startCausalSession(state, sessionId);
  appendCausal(state, { actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' } });
  resetPresentationQueue(sessionId);
  admitPresentationFromState(state);
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function mockRect(element: HTMLElement, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  });
}

function makeSceneCharacter(uid: string, cardId: string): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: [],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}
