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
import { App } from '../../meta-app/src/App';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { useMetaStore } from '../../meta-app/src/state/metaStore';
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
    useDecksStore.setState({
      decks: [SAMPLE_DECK, SAMPLE_DECK_OPP],
      activeDeckId: SAMPLE_DECK.id,
    });
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useMetaStore.setState({ _setupStartError: null });
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

  it('共通ヘッダーと対戦準備に必要な実動操作を一画面へまとめる', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));

    const nav = container.querySelector('nav[aria-label="メインナビゲーション"]');
    expect(Array.from(nav!.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
      'ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定',
    ]);
    expect(nav!.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('ゲーム開始');
    expect(container.querySelectorAll('.setup-player-panel')).toHaveLength(2);
    expect(container.textContent).toContain('少年探偵団・標準');
    expect(container.textContent).toContain('江戸川コナン');
    expect(container.textContent).toContain('青の古城探索事件');
    expect(container.textContent).toContain('警察・標準');
    expect(container.textContent).toContain('萩原千速');
    expect(container.textContent).toContain('千速と重悟の婚活パーティー');
    expect(container.querySelectorAll('button[aria-label^="使用デッキを変更"]')).toHaveLength(2);
    for (const label of ['CPU対戦', '観戦', '先攻', 'CPU難易度', 'ノーマル（固定）', 'デッキを入れ替え', 'ランダムに選択', '戻る', '対戦を開始']) {
      expect(container.textContent).toContain(label);
    }
  });

  it('デッキ変更は確認まで保留し、確定後に該当側だけ反映する', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const selfChange = container.querySelector<HTMLButtonElement>('button[aria-label="使用デッキを変更（あなた）"]')!;
    act(() => selfChange.click());
    const choices = container.querySelectorAll<HTMLInputElement>('input[name="home-active-deck"]');
    act(() => choices[1]!.click());
    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK.id);
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'このデッキを使用')!;
    act(() => confirm.click());
    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK_OPP.id);
    expect(container.querySelector('.setup-player-panel--opp')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK_OPP.id);
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

  it('開始A/Bが逆順に完了しても最新BだけをGameStateへcommitする', async () => {
    const a = deferred<ReturnType<typeof createEmptyGameState>>();
    const b = deferred<ReturnType<typeof createEmptyGameState>>();
    startMock.mockReset().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;
    act(() => ready.click());

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="デッキを入れ替え"]')!.click());
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

  it('先攻のあなた・CPU・ランダムをengine optionへ正確に対応付ける', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const button = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((candidate) => candidate.textContent?.trim() === name)!;
    const ready = container.querySelector<HTMLButtonElement>('.meta-btn-ready')!;

    act(() => button('あなた').click());
    act(() => ready.click());
    act(() => button('CPU').click());
    act(() => ready.click());
    act(() => button('ランダム').click());
    act(() => ready.click());

    expect(startMock.mock.calls.map((call) => call[2]?.firstPlayer)).toEqual(['self', 'opp', undefined]);
  });

  it('観戦開始はownership・spectator store・engine option・履歴metadataを同時に設定する', () => {
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const observe = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '観戦')!;
    act(() => observe.click());
    act(() => container.querySelector<HTMLButtonElement>('.meta-btn-ready')!.click());

    expect((globalThis as { __humanPlayerSide?: unknown }).__humanPlayerSide).toBeNull();
    expect(useGameStateStore.getState().spectatorMode).toBe(true);
    expect(startMock.mock.calls[0]?.[2]?.spectator).toBe(true);
    expect(useMetaStore.getState()._matchMeta).toEqual({
      mode: 'observe',
      selfDeckName: SAMPLE_DECK.name,
      oppDeckName: SAMPLE_DECK_OPP.name,
    });
  });

  it('ランダム選択は保存済みデッキだけを独立抽選し、モードと先攻を変えない', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    act(() => root.render(<SetupScreen onNav={() => undefined} />));
    const button = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((candidate) => candidate.textContent?.trim() === name)!;
    act(() => button('観戦').click());
    act(() => button('あなた').click());
    act(() => button('ランダムに選択').click());

    expect(container.querySelector('.setup-player-panel--self')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK_OPP.id);
    expect(container.querySelector('.setup-player-panel--opp')?.getAttribute('data-deck-id')).toBe(SAMPLE_DECK_OPP.id);
    expect(button('観戦').getAttribute('aria-pressed')).toBe('true');
    expect(button('あなた').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-deck-id="test-bug-274-public"]')).toBeNull();
    vi.restoreAllMocks();
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

    act(() => container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')[1]!.click());
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
    const observe = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '観戦')!;
    act(() => observe.click());
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
