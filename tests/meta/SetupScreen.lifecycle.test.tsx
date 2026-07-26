import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useConfirmation, useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useGameStateStore } from '@/ui/state/store';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { SetupScreen } from '../../meta-app/src/screens/SetupScreen';
import { TutorialScreen } from '../../meta-app/src/screens/TutorialScreen';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { endMatchSession } from '@/ui/services/matchSession';

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }));
vi.mock('../../meta-app/src/util/customGameStart', () => ({ customGameStart: startMock }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const pendingStoreKeys = [
  'pendingHirameki', 'pendingMisread', 'pendingEffectPick', 'pendingEffectChoice',
  'pendingEffectOptional', 'pendingChooseIntercept', 'pendingLeaveIntercept', 'pendingRps',
  'pendingSetCardChoice', 'pendingSetCardReplacement', 'pendingEffectRepeatOptional',
  'pendingDeckReveal', 'pendingDeckReorder', 'pendingDeckPlace',
] as const;

const enginePendingKeys = [
  '__pendingEffectChoiceSide', '__pendingEffectChoiceResume',
  '__pendingEffectOptionalSide', '__pendingEffectOptionalResume',
  '__pendingRpsSide', '__pendingRpsResume',
  '__pendingChooseInterceptSide', '__pendingChooseInterceptResume',
  '__pendingEffectRepeatOptionalSide', '__pendingEffectRepeatOptionalResume',
  '__pendingDeckRevealSide', '__pendingDeckReorderSide', '__pendingDeckPlaceSide',
  '__pendingContactStartAxId',
] as const;

describe('SetupScreen match-session lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useTargetPicker().cancel();
    useConfirmation().reject();
    useTargetPickerStore.getState()._reset();
    useConfirmationStore.getState()._reset();
    useDecksStore.setState({ decks: [SAMPLE_DECK, SAMPLE_DECK_OPP] });
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    for (const key of pendingStoreKeys) useGameStateStore.setState({ [key]: null });
    const never = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReset().mockReturnValue(never.promise);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    const globals = globalThis as Record<string, unknown>;
    globals.__pendingEffectPickQueue = [];
    globals.__pendingEffectPickSide = null;
    for (const key of enginePendingKeys) globals[key] = null;
  });

  function renderAndStart(): void {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready');
    expect(ready).not.toBeNull();
    act(() => ready!.click());
  }

  it('新規開始はtarget/confirmation PromiseをcancelしUI action/pendingを全消去する', async () => {
    const targetDone = vi.fn();
    const confirmDone = vi.fn();
    void useTargetPicker().start({ candidates: ['old-target'], purpose: 'action:target' }).then(targetDone);
    void useConfirmation().ask({ kind: 'standard', title: '旧確認', body: '旧試合' }).then(confirmDone);
    useGameStateStore.setState({ activeActionId: 'old-action' });
    for (const key of pendingStoreKeys) useGameStateStore.setState({ [key]: {} as never });

    renderAndStart();
    await act(async () => { await Promise.resolve(); });

    expect(useTargetPickerStore.getState().phase.phase).toBe('idle');
    expect(useConfirmationStore.getState().current).toBeNull();
    expect(targetDone).toHaveBeenCalledWith(null);
    expect(confirmDone).toHaveBeenCalledWith(false);
    const store = useGameStateStore.getState() as unknown as Record<string, unknown>;
    expect(store.activeActionId).toBeNull();
    for (const key of pendingStoreKeys) expect(store[key], key).toBeNull();
  });

  it('新規開始はengine pending queue/side-channel/resumeを全消去する', () => {
    const globals = globalThis as Record<string, unknown>;
    globals.__pendingEffectPickQueue = [{ player: 'self', source: { cardId: 'OLD' } }];
    globals.__pendingEffectPickSide = (globals.__pendingEffectPickQueue as unknown[])[0];
    for (const key of enginePendingKeys) globals[key] = { stale: true };

    renderAndStart();

    expect(globals.__pendingEffectPickQueue).toEqual([]);
    expect(globals.__pendingEffectPickSide ?? null).toBeNull();
    for (const key of enginePendingKeys) expect(globals[key] ?? null, key).toBeNull();
  });

  it('開始A/Bが逆順に完了しても最新BだけをGameStateへcommitする', async () => {
    const a = deferred<ReturnType<typeof createEmptyGameState>>();
    const b = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReset().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
    act(() => ready.click());

    const selects = container.querySelectorAll<HTMLSelectElement>('select');
    act(() => {
      selects[0]!.value = SAMPLE_DECK_OPP.id;
      selects[0]!.dispatchEvent(new Event('change', { bubbles: true }));
      selects[1]!.value = SAMPLE_DECK.id;
      selects[1]!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => ready.click());

    expect(startMock.mock.calls[0]![0].id).toBe(SAMPLE_DECK.id);
    expect(startMock.mock.calls[0]![1].id).toBe(SAMPLE_DECK_OPP.id);
    expect(startMock.mock.calls[1]![0].id).toBe(SAMPLE_DECK_OPP.id);
    expect(startMock.mock.calls[1]![1].id).toBe(SAMPLE_DECK.id);

    const stateA = createEmptyGameState();
    stateA.players.self.case.cardId = 'A-OLD';
    const stateB = createEmptyGameState();
    stateB.players.self.case.cardId = 'B-NEW';
    await act(async () => { b.resolve(stateB); await b.promise; });
    expect(useGameStateStore.getState().gameState).toBe(stateB);
    await act(async () => { a.resolve(stateA); await a.promise; });
    expect(useGameStateStore.getState().gameState).toBe(stateB);
  });

  it('solo start exposes human=self before customGameStart begins', () => {
    let observed: unknown;
    startMock.mockImplementation(() => {
      observed = (globalThis as { __humanPlayerSide?: unknown }).__humanPlayerSide;
      return deferred<ReturnType<typeof createEmptyGameState>>().promise;
    });
    renderAndStart();
    expect(observed).toBe('self');
  });

  it('human to observe clears ownership before start-time optional processing', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    let observed: unknown;
    startMock.mockImplementation(() => {
      observed = (globalThis as { __humanPlayerSide?: unknown }).__humanPlayerSide;
      if (observed === 'self') useGameStateStore.setState({ pendingEffectOptional: {} as never });
      return deferred<ReturnType<typeof createEmptyGameState>>().promise;
    });
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const modeTiles = container.querySelectorAll<HTMLButtonElement>('button[style*="width: 420px"]');
    expect(modeTiles).toHaveLength(2);
    act(() => modeTiles[1]!.click());
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());
    expect(observed).toBeNull();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it('does not commit a deferred setup result after the route owner ends the session', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<SetupScreen onNav={nav} />));
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());
    expect(nav).toHaveBeenCalledWith('match');
    endMatchSession();
    const stale = createEmptyGameState();
    await act(async () => { pending.resolve(stale); await pending.promise; });
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(nav).toHaveBeenCalledTimes(1);
  });

  it('ignores a deferred tutorial rejection after the route owner ends the session', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={nav} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'));
    expect(practice).toBeDefined();
    act(() => practice!.click());
    expect(nav).toHaveBeenCalledWith('match');
    endMatchSession();
    await act(async () => {
      pending.reject(new Error('stale'));
      try { await pending.promise; } catch { /* expected */ }
    });
    expect(nav).toHaveBeenCalledTimes(1);
  });
});
