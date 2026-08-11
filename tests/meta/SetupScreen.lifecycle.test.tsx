import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { useConfirmation, useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useGameStateStore } from '@/ui/state/store';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { BUG_274_PUBLIC_DECK_ID } from '../../meta-app/src/data/bug274ValidationDeck';
import { SetupScreen } from '../../meta-app/src/screens/SetupScreen';
import { TUTORIAL_CHAPTERS, TutorialScreen } from '../../meta-app/src/screens/TutorialScreen';
import { App } from '../../meta-app/src/App';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { normalizeSettings, useMetaStore } from '../../meta-app/src/state/metaStore';
import { endMatchSession } from '@/ui/services/matchSession';

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }));
vi.mock('../../meta-app/src/util/customGameStart', () => ({ customGameStart: startMock }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function lastStartSessionId(): string {
  const options = startMock.mock.calls.at(-1)?.[2] as { sessionId?: string } | undefined;
  if (!options?.sessionId) throw new Error('customGameStart sessionId was not captured');
  return options.sessionId;
}

function malformedPresentationState(sessionId: string) {
  const state = createEmptyGameState();
  startCausalSession(state, sessionId);
  appendCausal(state, {
    actor: 'opp', kind: 'draw', targets: [], outcome: { type: 'none' },
  });
  (state.log[0] as { parentEventId?: string }).parentEventId = `${sessionId}:999`;
  return state;
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
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ??= class {
      observe() { /* jsdom test double */ }
      unobserve() { /* jsdom test double */ }
      disconnect() { /* jsdom test double */ }
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    useTargetPicker().cancel();
    useConfirmation().reject();
    useTargetPickerStore.getState()._reset();
    useConfirmationStore.getState()._reset();
    useDecksStore.setState({
      decks: [SAMPLE_DECK, SAMPLE_DECK_OPP],
      activeDeckId: SAMPLE_DECK.id,
    });
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useMetaStore.setState({
      _setupStartError: null,
      _matchMeta: null,
      _pendingPracticeStepId: null,
      settings: normalizeSettings(null),
    });
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
    window.location.hash = '';
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

  it('HOMEで確定したデッキをプレイヤー1の初期選択にする', () => {
    useDecksStore.setState({ activeDeckId: SAMPLE_DECK_OPP.id });
    act(() => root.render(<SetupScreen onNav={() => undefined} />));

    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id'))
      .toBe(SAMPLE_DECK_OPP.id);
  });

  it('参考構成どおりカード対峙と3つのプルダウンだけを中央へまとめる', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));

    const nav = container.querySelector('nav[aria-label="メインナビゲーション"]');
    expect(Array.from(nav!.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
      'ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定',
    ]);
    expect(nav!.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('ゲーム開始');
    expect(container.querySelectorAll('.setup-player-panel')).toHaveLength(2);
    expect(container.querySelectorAll('.setup-incident-art')).toHaveLength(0);
    expect(container.textContent).toContain('PLAYER');
    expect(container.textContent).not.toContain('あなた');
    expect(container.querySelectorAll('.setup-player-card-name')).toHaveLength(4);
    expect(container.querySelectorAll('.setup-player-card-name[aria-label^="パートナーカード"]')).toHaveLength(2);
    expect(container.querySelectorAll('.setup-player-card-name[aria-label^="事件カード"]')).toHaveLength(2);
    expect(container.textContent).toContain('少年探偵団・標準');
    expect(container.textContent).toContain('江戸川コナン');
    expect(container.textContent).toContain('青の古城探索事件');
    expect(container.textContent).toContain('警察・標準');
    expect(container.textContent).toContain('萩原千速');
    expect(container.textContent).toContain('千速と重悟の婚活パーティー');
    expect(container.querySelectorAll('button[aria-label^="使用デッキを変更"]')).toHaveLength(2);
    for (const label of ['対戦準備', 'CPU対戦', '観戦', '先攻', 'CPU難易度', 'ノーマル', '対戦を開始']) {
      expect(container.textContent).toContain(label);
    }
    expect(container.querySelectorAll('.setup-controls select')).toHaveLength(3);
    const controlIcons = Array.from(container.querySelectorAll<SVGElement>('.setup-control-icon'));
    expect(controlIcons.map((icon) => icon.dataset.icon)).toEqual(['mode', 'first', 'cpu']);
    expect(controlIcons[0]?.dataset.symbol).toBe('gamepad');
    expect(controlIcons.every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(container.querySelector('.setup-controls > .setup-start')).not.toBeNull();
    const interactiveOrder = Array.from(
      container.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('.setup-stage button, .setup-stage select'),
    )
      .filter((control) => !control.disabled)
      .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim());
    expect(interactiveOrder).toEqual([
      '使用デッキを変更（PLAYER）',
      '使用デッキを変更（CPU）',
      'プレイモード',
      '先攻',
      '対戦を開始',
    ]);
    expect(container.querySelector('.setup-actions')).toBeNull();
    expect(container.textContent).not.toContain('戻る');
    const cpuDifficulty = container.querySelector<HTMLSelectElement>('select[aria-label="CPU難易度"]');
    expect(cpuDifficulty?.disabled).toBe(true);
    expect(cpuDifficulty?.getAttribute('aria-describedby')).toBe('setup-cpu-difficulty-note');
    expect(container.querySelector('#setup-cpu-difficulty-note')?.textContent)
      .toBe('現在はノーマル固定');
    expect(container.textContent).not.toContain('ゲームセッティング');
    expect(container.textContent).not.toContain('デッキを入れ替え');
    expect(container.textContent).not.toContain('ランダムに選択');
    expect(container.querySelector('.setup-vs')).toBeNull();
  });

  it('デッキ変更は確認まで保留し、確定後に該当側だけ反映する', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const selfChange = container.querySelector<HTMLButtonElement>('button[aria-label="使用デッキを変更（PLAYER）"]')!;
    act(() => selfChange.click());
    const choices = container.querySelectorAll<HTMLInputElement>('input[name="home-active-deck"]');
    act(() => choices[2]!.click());
    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK.id);
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'このデッキを使用')!;
    act(() => confirm.click());
    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id')).toBe(BUG_274_PUBLIC_DECK_ID);
    expect(container.querySelector('.setup-player-panel--opp')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK_OPP.id);
  });

  it('does not steal focus back after closing the setup deck dialog', async () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const selfChange = container.querySelector<HTMLButtonElement>('.setup-player-panel--self .setup-change-deck')!;
    const oppChange = container.querySelector<HTMLButtonElement>('.setup-player-panel--opp .setup-change-deck')!;
    act(() => selfChange.click());
    const dialog = container.querySelector<HTMLDialogElement>('dialog')!;
    act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));

    expect(container.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(selfChange);
    oppChange.focus();
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(oppChange);
  });

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

  it('開始中の重複操作は同じ対戦sessionを二重初期化しない', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReset().mockReturnValue(pending.promise);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
    act(() => {
      ready.click();
      ready.click();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock.mock.calls[0]![0].id).toBe(SAMPLE_DECK.id);
    expect(startMock.mock.calls[0]![1].id).toBe(SAMPLE_DECK_OPP.id);
    expect(ready.disabled).toBe(true);

    const state = createEmptyGameState();
    state.players.self.case.cardId = 'ONLY-START';
    await act(async () => { pending.resolve(state); await pending.promise; });
    expect(useGameStateStore.getState().gameState).toBe(state);
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

  it('先攻のあなた・CPU・ランダムをengine optionへ正確に対応付ける', () => {
    const startWith = (choice: 'p1' | 'p2' | 'random') => {
      act(() => root.render(<SetupScreen key={choice} onNav={() => undefined} />));
      const first = container.querySelector<HTMLSelectElement>('select[aria-label="先攻"]')!;
      const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
      act(() => { first.value = choice; first.dispatchEvent(new Event('change', { bubbles: true })); });
      act(() => ready.click());
      const result = startMock.mock.calls.at(-1)?.[2]?.firstPlayer;
      endMatchSession();
      return result;
    };

    expect([startWith('p1'), startWith('p2'), startWith('random')]).toEqual(['self', 'opp', undefined]);
  });

  it('観戦開始はownership・spectator store・engine option・履歴metadataを同時に設定する', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const mode = container.querySelector<HTMLSelectElement>('select[aria-label="プレイモード"]')!;
    const selfHeading = container.querySelector<HTMLElement>('.setup-player-panel--self h2')!;
    const oppHeading = container.querySelector<HTMLElement>('.setup-player-panel--opp h2')!;
    const first = container.querySelector<HTMLSelectElement>('select[aria-label="先攻"]')!;
    expect(selfHeading.textContent).toBe('PLAYER');
    act(() => { mode.value = 'observe'; mode.dispatchEvent(new Event('change', { bubbles: true })); });
    expect([selfHeading.textContent, oppHeading.textContent]).toEqual(['CPU 1', 'CPU 2']);
    expect(Array.from(first.options).map((option) => option.textContent)).toEqual(['ランダム', 'CPU 1', 'CPU 2']);
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.setup-change-deck')).map((button) => button.getAttribute('aria-label')))
      .toEqual(['使用デッキを変更（CPU 1）', '使用デッキを変更（CPU 2）']);
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());

    expect((globalThis as { __humanPlayerSide?: unknown }).__humanPlayerSide).toBeNull();
    expect(useGameStateStore.getState().spectatorMode).toBe(true);
    expect(startMock.mock.calls[0]?.[2]?.spectator).toBe(true);
    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({
      sessionId: expect.stringMatching(/^match-/),
      mode: 'observe',
      selfDeckName: SAMPLE_DECK.name,
      oppDeckName: SAMPLE_DECK_OPP.name,
      selfDeckSnapshot: expect.objectContaining({
        schemaVersion: 1,
        deckId: SAMPLE_DECK.id,
        partner: SAMPLE_DECK.partner,
        case: SAMPLE_DECK.case,
        cards: SAMPLE_DECK.cards,
      }),
      oppDeckSnapshot: expect.objectContaining({
        schemaVersion: 1,
        deckId: SAMPLE_DECK_OPP.id,
        partner: SAMPLE_DECK_OPP.partner,
        case: SAMPLE_DECK_OPP.case,
        cards: SAMPLE_DECK_OPP.cards,
      }),
    }));
    expect(startMock.mock.calls[0]?.[2]?.sessionId)
      .toBe(useMetaStore.getState().getMatchMeta()?.sessionId);
  });

  it('削除指定されたデッキ補助操作を表示しない', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    expect(container.querySelector('button[aria-label="デッキを入れ替え"]')).toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('ランダムに選択'))).toBe(false);
  });

  it('現在sessionの開始失敗だけを通知してSETUPへ戻し再試行可能にする', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<SetupScreen onNav={nav} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
    act(() => ready.click());
    await act(async () => {
      pending.reject(new Error('start failed'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });

    expect(nav.mock.calls).toEqual([['match'], ['setup']]);
    expect(container.querySelector('#setup-status')?.textContent).toContain('start failed');
    expect(ready.disabled).toBe(false);
    expect(ready.getAttribute('aria-busy')).toBe('false');
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });

  it('現在sessionの状態commitが拒否された場合もSETUPへ戻して開始中を解除する', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<SetupScreen onNav={nav} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
    act(() => ready.click());

    await act(async () => {
      pending.resolve(malformedPresentationState(lastStartSessionId()));
      await pending.promise;
      await Promise.resolve();
    });

    expect(nav.mock.calls).toEqual([['match'], ['setup']]);
    expect(ready.disabled).toBe(false);
    expect(ready.getAttribute('aria-busy')).toBe('false');
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('MATCH遷移でunmountされた後の開始失敗を、新しいSETUPへ引き継ぐ', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());
    act(() => root.render(<div>match route</div>));
    await act(async () => {
      pending.reject(new Error('route-crossing failure'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });
    act(() => root.render(<SetupScreen onNav={() => undefined} />));

    expect(container.querySelector('#setup-status')?.textContent).toContain('route-crossing failure');
    expect(useMetaStore.getState()._setupStartError).toContain('route-crossing failure');
  });

  it('ends the actual App match session before returning to SETUP after start failure', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReturnValue(pending.promise);
    window.location.hash = '#setup';
    act(() => root.render(<App />));
    await vi.waitFor(async () => {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(container.querySelector('#setup-title')).not.toBeNull();
    }, { timeout: 15_000 });

    const appMode = container.querySelector<HTMLSelectElement>('select[aria-label="プレイモード"]')!;
    act(() => { appMode.value = 'observe'; appMode.dispatchEvent(new Event('change', { bubbles: true })); });
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());
    expect(window.location.hash).toBe('#match');
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.addEventListener('hashchange', () => resolve(), { once: true });
      });
    });
    act(() => useGameStateStore.setState({ pendingEffectOptional: {} as never }));
    expect(useGameStateStore.getState().spectatorMode).toBe(true);

    const setupHashChange = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    await act(async () => {
      pending.reject(new Error('actual-app failure'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });
    await act(async () => {
      await setupHashChange;
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(window.location.hash).toBe('#setup');
    expect(container.querySelector('#setup-status')?.textContent).toContain('actual-app failure');
    expect(document.activeElement).toBe(container.querySelector('.meta-btn-ready'));
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().spectatorMode).toBe(false);
    expect((globalThis as { __humanPlayerSide?: unknown }).__humanPlayerSide).toBeNull();
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
    const mode = container.querySelector<HTMLSelectElement>('select[aria-label="プレイモード"]')!;
    act(() => { mode.value = 'observe'; mode.dispatchEvent(new Event('change', { bubbles: true })); });
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

  it('applies the rehydrated slow spectator preset only to an observe start', () => {
    useMetaStore.getState().setSettings({ spectatorAi: 'slow' });
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const mode = container.querySelectorAll<HTMLSelectElement>('.setup-controls select')[0]!;
    act(() => { mode.value = 'observe'; mode.dispatchEvent(new Event('change', { bubbles: true })); });
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());

    expect(useGameStateStore.getState().aiSpeedMs).toBe(800);
    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({
      sessionId: expect.stringMatching(/^match-/),
      mode: 'observe',
    }));
  });

  it('resets the observe-only speed before a later solo match starts', () => {
    useGameStateStore.getState().setAiSpeedMs(800);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());

    expect(useGameStateStore.getState().aiSpeedMs).toBe(400);
    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({
      mode: 'solo',
    }));
  });

  it('clears an abandoned tutorial marker before a normal setup match starts', () => {
    useMetaStore.getState().startPracticeFor('L5-4');
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());

    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({ mode: 'solo' }));
  });

  it('gives tutorial practice a fresh identity instead of inheriting abandoned observe metadata', () => {
    useGameStateStore.getState().setAiSpeedMs(800);
    useMetaStore.getState().setMatchMeta({
      sessionId: 'abandoned-observe', mode: 'observe', selfDeckName: 'CPU 1 old', oppDeckName: 'CPU 2 old',
    });
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'))!;
    act(() => practice.click());

    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({
      sessionId: expect.stringMatching(/^match-/),
      mode: 'solo',
      selfDeckName: SAMPLE_DECK.name,
      oppDeckName: SAMPLE_DECK_OPP.name,
      selfDeckSnapshot: {
        schemaVersion: 1,
        deckId: SAMPLE_DECK.id,
        name: SAMPLE_DECK.name,
        partner: SAMPLE_DECK.partner,
        case: SAMPLE_DECK.case,
        cards: SAMPLE_DECK.cards.map(({ num, count }) => ({ num, count })),
      },
      oppDeckSnapshot: {
        schemaVersion: 1,
        deckId: SAMPLE_DECK_OPP.id,
        name: SAMPLE_DECK_OPP.name,
        partner: SAMPLE_DECK_OPP.partner,
        case: SAMPLE_DECK_OPP.case,
        cards: SAMPLE_DECK_OPP.cards.map(({ num, count }) => ({ num, count })),
      },
    }));
    expect(useMetaStore.getState().getMatchMeta()?.sessionId).not.toBe('abandoned-observe');
    expect(startMock.mock.calls[0]?.[2]?.sessionId)
      .toBe(useMetaStore.getState().getMatchMeta()?.sessionId);
    expect(useMetaStore.getState()._pendingPracticeStepId).toBe('L5-4');
    expect(useGameStateStore.getState().aiSpeedMs).toBe(400);
  });

  it('captures both decks when a tutorial chapter starts a guided match', () => {
    useGameStateStore.getState().setAiSpeedMs(800);
    const chapter = TUTORIAL_CHAPTERS.find(({ num }) => num === 3)!;
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));

    const chapterButton = [...container.querySelectorAll<HTMLButtonElement>('.meta-row')]
      .find((button) => button.textContent?.includes('LESSON L3'))!;
    act(() => chapterButton.click());
    const stepButton = [...container.querySelectorAll<HTMLButtonElement>('.meta-row')]
      .find((button) => button.textContent?.includes(chapter.steps[0]!.title)
        && button.textContent.includes('開く'))!;
    act(() => stepButton.click());
    const guidedButton = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent?.includes('このステップを実戦で試す'))!;
    act(() => guidedButton.click());

    expect(useMetaStore.getState().getMatchMeta()).toEqual(expect.objectContaining({
      mode: 'solo',
      selfDeckSnapshot: expect.objectContaining({
        deckId: SAMPLE_DECK.id,
        cards: SAMPLE_DECK.cards.map(({ num, count }) => ({ num, count })),
      }),
      oppDeckSnapshot: expect.objectContaining({
        deckId: SAMPLE_DECK_OPP.id,
        cards: SAMPLE_DECK_OPP.cards.map(({ num, count }) => ({ num, count })),
      }),
    }));
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
    expect(useTutorialStore.getState().currentStep)
      .toBe(TUTORIAL_STEPS.findIndex((step) => step.id === chapter.steps[0]!.id));
    expect(useGameStateStore.getState().aiSpeedMs).toBe(400);
  });

  it('tutorial practice ignores duplicate start clicks while initialization is pending', () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'))!;

    act(() => {
      practice.click();
      practice.click();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(practice.disabled).toBe(true);
  });

  it('guided tutorial ignores duplicate start clicks while initialization is pending', () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReturnValue(pending.promise);
    const chapter = TUTORIAL_CHAPTERS.find(({ num }) => num === 3)!;
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const chapterButton = [...container.querySelectorAll<HTMLButtonElement>('.meta-row')]
      .find((button) => button.textContent?.includes('LESSON L3'))!;
    act(() => chapterButton.click());
    const stepButton = [...container.querySelectorAll<HTMLButtonElement>('.meta-row')]
      .find((button) => button.textContent?.includes(chapter.steps[0]!.title)
        && button.textContent.includes('開く'))!;
    act(() => stepButton.click());
    const guidedButton = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent?.includes('このステップを実戦で試す'))!;

    act(() => {
      guidedButton.click();
      guidedButton.click();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
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

  it('clears tutorial identity and progress provenance when the current start fails', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={nav} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'))!;
    act(() => practice.click());
    expect(useMetaStore.getState().getMatchMeta()).not.toBeNull();
    expect(useMetaStore.getState()._pendingPracticeStepId).toBe('L5-4');

    await act(async () => {
      pending.reject(new Error('tutorial start failed'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });

    expect(nav.mock.calls).toEqual([['match'], ['tutorial']]);
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });

  it('returns a tutorial practice to TUTORIAL when the current state commit is rejected', async () => {
    const pending = deferred<ReturnType<typeof createEmptyGameState>>();
    const nav = vi.fn();
    startMock.mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={nav} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'))!;
    act(() => practice.click());

    await act(async () => {
      pending.resolve(malformedPresentationState(lastStartSessionId()));
      await pending.promise;
      await Promise.resolve();
    });

    expect(nav.mock.calls).toEqual([['match'], ['tutorial']]);
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });
});
