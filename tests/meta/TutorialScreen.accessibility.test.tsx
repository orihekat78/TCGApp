import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorialScreen } from '../../meta-app/src/screens/TutorialScreen';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { normalizeSettings, useMetaStore } from '../../meta-app/src/state/metaStore';

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }));
vi.mock('../../meta-app/src/util/customGameStart', () => ({ customGameStart: startMock }));

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, fail) => { reject = fail; });
  return { promise, reject };
}

describe('TutorialScreen accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ??= class {
      observe() { /* jsdom test double */ }
      disconnect() { /* jsdom test double */ }
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    useDecksStore.setState({ decks: [SAMPLE_DECK, SAMPLE_DECK_OPP], activeDeckId: SAMPLE_DECK.id });
    useMetaStore.setState({ _setupStartError: null, _matchMeta: null, _pendingPracticeStepId: null, settings: normalizeSettings(null) });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('moves focus into the viewer, traps Tab, and restores its opening trigger', () => {
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const trigger = container.querySelector<HTMLButtonElement>('.tutorial-step-list button');
    expect(trigger).not.toBeNull();
    act(() => trigger!.click());

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = dialog.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')!;
    expect(document.activeElement).toBe(close);
    const focusable = dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const last = focusable[focusable.length - 1]!;
    act(() => close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(last);
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(close);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('announces a failed practice start and focuses its retry control', async () => {
    const pending = deferred<never>();
    startMock.mockReset().mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const practice = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('PRACTICE'))!;
    act(() => practice.click());

    await act(async () => {
      pending.reject(new Error('forced failure'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });

    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    const retry = container.querySelector<HTMLButtonElement>('[data-tutorial-retry]');
    expect(alert?.textContent).toContain('対戦を開始できませんでした');
    expect(retry).not.toBeNull();
    expect(document.activeElement).toBe(retry);
  });

  it('announces a failed guided start and focuses its retry control', async () => {
    const pending = deferred<never>();
    startMock.mockReset().mockReturnValue(pending.promise);
    act(() => root.render(<TutorialScreen onNav={() => undefined} />));
    const chapter = [...container.querySelectorAll<HTMLButtonElement>('.meta-row')]
      .find((button) => button.textContent?.includes('LESSON L3'))!;
    act(() => chapter.click());
    const step = container.querySelector<HTMLButtonElement>('.tutorial-step-list button')!;
    act(() => step.click());
    const guided = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent?.includes('このステップを実戦で試す'))!;
    act(() => guided.click());

    await act(async () => {
      pending.reject(new Error('forced guided failure'));
      try { await pending.promise; } catch { /* expected */ }
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('ガイド対戦を開始できませんでした');
    expect(document.activeElement).toBe(container.querySelector('[data-tutorial-retry]'));
  });
});
