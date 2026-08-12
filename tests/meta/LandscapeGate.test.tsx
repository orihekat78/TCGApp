import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { CardExpandModal } from '@/ui/components/CardExpandModal';
import { ChoicePickerModal } from '@/ui/components/ChoicePickerModal';
import { MatchMenu } from '../../meta-app/src/components/MatchMenu';
import { LandscapeGate } from '../../meta-app/src/shared/LandscapeGate';

type Listener = (event: Event) => void;

function createMediaQuery(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  return {
    query: {
      get matches() { return matches; },
      addEventListener: vi.fn((_: 'change', listener: Listener) => listeners.add(listener)),
      removeEventListener: vi.fn((_: 'change', listener: Listener) => listeners.delete(listener)),
    },
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener(new Event('change')));
    },
  };
}

function StateProbe({ removable = false, disabled = false }: { removable?: boolean; disabled?: boolean }) {
  const [count, setCount] = useState(0);
  return (
    <section data-testid="route-subtree">
      <output data-testid="state-probe">{count}</output>
      {!removable ? (
        <button
          type="button"
          data-testid="route-focus"
          disabled={disabled}
          onClick={() => setCount((value) => value + 1)}
        >
          route action
        </button>
      ) : null}
      {removable ? null : <span>route content</span>}
    </section>
  );
}

describe('LandscapeGate', () => {
  let container: HTMLDivElement;
  let root: Root;
  let media: ReturnType<typeof createMediaQuery>;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let lock: ReturnType<typeof vi.fn>;

  beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    endMatchSession();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    media = createMediaQuery(false);
    requestFullscreen = vi.fn().mockResolvedValue(undefined);
    lock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('matchMedia', vi.fn(() => media.query));
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn(), lock },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    endMatchSession();
  });

  function render(children = <StateProbe />) {
    act(() => root.render(<LandscapeGate>{children}</LandscapeGate>));
  }

  function setLandscape(next: boolean) {
    act(() => media.setMatches(next));
  }

  it('defers the initial route subtree in portrait and focuses the recovery CTA', () => {
    render();

    expect(container.querySelector('[data-testid="route-subtree"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]'));
    expect(container.textContent).toContain('横画面で開始');
  });

  it('keeps forward and reverse Tab focus inside the portrait dialog', () => {
    render();
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]')!;

    act(() => cta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(cta);

    act(() => cta.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true,
    })));
    expect(document.activeElement).toBe(cta);
  });

  it('removes an open MATCH menu before the portrait gate becomes the sole modal owner', () => {
    const token = beginMatchSession('self');
    expect(commitMatchSession(token, createEmptyGameState())).toBe(true);
    render(<MatchMenu replayActive={false} />);
    setLandscape(true);

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="match-menu-trigger"]')!.click());
    act(() => document.querySelector<HTMLButtonElement>('[data-testid="match-menu-surrender"]')!.click());
    const staleSubmit = document.querySelector<HTMLButtonElement>('[data-testid="match-menu-confirm-submit"]')!;
    expect(document.querySelector('[data-testid="match-menu-dialog"]')).not.toBeNull();

    setLandscape(false);

    const cta = container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]')!;
    expect(document.querySelector('[data-testid="match-menu-dialog"]')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(1);
    expect(document.activeElement).toBe(cta);
    act(() => cta.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).toBe(cta);

    act(() => staleSubmit.click());
    expect(useGameStateStore.getState().gameState?.gameResult).toBeUndefined();
    expect(useGameStateStore.getState().gameState?.log.filter((entry) => entry.kind === 'game-result')).toHaveLength(0);
  });

  it('contains a card-detail portal and suspends every underlying modal in portrait', () => {
    const closeDetail = vi.fn();
    const cancelDecision = vi.fn();
    render(
      <>
        <ChoicePickerModal
          open
          sourceName="Decision"
          options={[{ index: 0, label: 'Option' }]}
          onPick={vi.fn()}
          onCancel={cancelDecision}
        />
        <CardExpandModal cardId="D08015" onClose={closeDetail} />
      </>,
    );
    setLandscape(true);

    const content = container.querySelector<HTMLElement>('[data-testid="landscape-gate-content"]')!;
    const detail = document.querySelector<HTMLElement>('.card-expand-modal-backdrop')!;
    expect(content.contains(detail)).toBe(true);

    setLandscape(false);

    expect(document.querySelectorAll('.card-expand-modal-backdrop[aria-modal="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(1);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })));
    expect(closeDetail).not.toHaveBeenCalled();
    expect(cancelDecision).not.toHaveBeenCalled();

    setLandscape(true);
    expect(detail.getAttribute('aria-modal')).toBe('true');
    expect(detail.hasAttribute('aria-hidden')).toBe(false);
    expect(detail.hasAttribute('inert')).toBe(false);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })));
    expect(closeDetail).toHaveBeenCalledOnce();
    expect(cancelDecision).not.toHaveBeenCalled();
  });

  it('focuses the route content after the first landscape transition', () => {
    render();
    setLandscape(true);

    expect(document.activeElement).toBe(
      container.querySelector<HTMLElement>('[data-testid="landscape-gate-content"]'),
    );
  });

  it('mounts once in landscape, then preserves route state inert and hidden in portrait', () => {
    render();
    setLandscape(true);
    const content = container.querySelector<HTMLElement>('[data-testid="landscape-gate-content"]')!;
    const action = container.querySelector<HTMLButtonElement>('[data-testid="route-focus"]')!;
    act(() => action.click());
    expect(container.querySelector('[data-testid="state-probe"]')?.textContent).toBe('1');

    setLandscape(false);
    expect(container.querySelector('[data-testid="state-probe"]')?.textContent).toBe('1');
    expect(content.hidden).toBe(true);
    expect(content.getAttribute('aria-hidden')).toBe('true');
    expect(content.hasAttribute('inert')).toBe(true);

    setLandscape(true);
    expect(content.hidden).toBe(false);
    expect(container.querySelector('[data-testid="state-probe"]')?.textContent).toBe('1');
  });

  it('restores focus to the prior route control after landscape resumes', () => {
    render();
    setLandscape(true);
    const action = container.querySelector<HTMLButtonElement>('[data-testid="route-focus"]')!;
    act(() => action.focus());
    setLandscape(false);
    expect(document.activeElement).toBe(container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]'));

    setLandscape(true);
    expect(document.activeElement).toBe(action);
  });

  it('uses the content fallback when the prior focus target is disconnected', () => {
    render();
    setLandscape(true);
    const action = container.querySelector<HTMLButtonElement>('[data-testid="route-focus"]')!;
    act(() => action.focus());
    setLandscape(false);
    act(() => root.render(<LandscapeGate><StateProbe removable /></LandscapeGate>));
    setLandscape(true);

    expect(document.activeElement).toBe(container.querySelector<HTMLElement>('[data-testid="landscape-gate-content"]'));
  });

  it('uses the content fallback when the prior focus target becomes disabled', () => {
    render();
    setLandscape(true);
    const action = container.querySelector<HTMLButtonElement>('[data-testid="route-focus"]')!;
    act(() => action.focus());
    setLandscape(false);
    act(() => root.render(<LandscapeGate><StateProbe disabled /></LandscapeGate>));
    setLandscape(true);

    expect(document.activeElement).toBe(container.querySelector<HTMLElement>('[data-testid="landscape-gate-content"]'));
  });

  it('keeps a recoverable Japanese instruction visible when fullscreen is denied', async () => {
    requestFullscreen.mockRejectedValueOnce(new Error('denied'));
    render();
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]')!;
    await act(async () => { cta.click(); await Promise.resolve(); });

    expect(container.textContent).toContain('自動回転を有効にして、端末を横向きにしてください');
    expect(lock).not.toHaveBeenCalled();
  });

  it('keeps a recoverable Japanese instruction visible when browser APIs are unsupported', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    render();
    const cta = container.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-cta"]')!;
    await act(async () => { cta.click(); await Promise.resolve(); });

    expect(container.textContent).toContain('このブラウザでは横画面への切り替えを完了できませんでした');
  });
});
