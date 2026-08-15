import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicHandRevealWindow } from '@/ui/components/PublicHandRevealWindow';
import { useGameStateStore } from '@/ui/state/store';
import {
  queuePendingPublicHandRevealSide,
  resetPendingAtomSession,
} from '@/engine/effect/atom-handlers/_shared';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('PublicHandRevealWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    resetPendingAtomSession();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingPublicHandReveal: {
        owner: 'opp', audience: 'all', cardIds: ['D08015', 'D08015'], handSnapshot: ['D08015', 'D08015'],
        lifetime: 'effect', resolutionToken: 'public-hand-reveal:1', source: { cardId: 'B03111', abilityId: 'a1' },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({
      gameState: null,
      pendingEffectPick: null,
      pendingPublicHandReveal: null,
    });
    resetPendingAtomSession();
  });

  it('gives duplicate detail controls distinct accessible names with their occurrence and card name', () => {
    act(() => root.render(<PublicHandRevealWindow />));

    const first = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-0"]');
    const second = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-1"]');
    const cardName = container.querySelector('.public-hand-reveal-name')?.textContent;

    expect(cardName).toBeTruthy();
    expect(first?.getAttribute('aria-label')).toBe(`「${cardName}」の詳細（1枚目）`);
    expect(second?.getAttribute('aria-label')).toBe(`「${cardName}」の詳細（2枚目）`);
    expect(first?.getAttribute('aria-label')).not.toBe(second?.getAttribute('aria-label'));
  });

  it('keeps a presentation window until the user explicitly closes it', () => {
    vi.useFakeTimers();
    useGameStateStore.setState((state) => ({
      pendingPublicHandReveal: state.pendingPublicHandReveal
        ? { ...state.pendingPublicHandReveal, lifetime: 'presentation' }
        : null,
    }));
    act(() => root.render(<PublicHandRevealWindow />));
    act(() => vi.advanceTimersByTime(60_000));

    expect(useGameStateStore.getState().pendingPublicHandReveal).not.toBeNull();
    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')).not.toBeNull();

    const close = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-close"]');
    expect(close?.getAttribute('aria-label')).toBe('公開カードを閉じる');
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(close);
    act(() => close?.click());

    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')).toBeNull();
  });

  it('traps keyboard focus and closes a presentation with Escape', () => {
    useGameStateStore.setState((state) => ({
      pendingPublicHandReveal: state.pendingPublicHandReveal
        ? { ...state.pendingPublicHandReveal, lifetime: 'presentation' }
        : null,
    }));
    act(() => root.render(<PublicHandRevealWindow />));

    const close = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-close"]')!;
    const first = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-0"]')!;
    const second = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-1"]')!;
    expect(document.activeElement).toBe(close);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(first);
    act(() => second.focus());
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(close);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });

  it('labels a selected deck card without transporting the private hand snapshot', () => {
    useGameStateStore.setState({
      pendingPublicHandReveal: {
        owner: 'self',
        audience: 'all',
        cardIds: ['D08003'],
        lifetime: 'presentation',
        resolutionToken: 'public-hand-reveal:selected',
        origin: 'deck-selected-card',
        source: { cardId: 'B03079', abilityId: 'a1' },
      },
    });

    act(() => root.render(<PublicHandRevealWindow />));

    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')?.getAttribute('data-origin'))
      .toBe('deck-selected-card');
    expect(container.querySelector('[data-testid="public-hand-reveal-owner"]')?.textContent)
      .toBe('公開して手札に加えたカード');
    expect(container.querySelectorAll('[data-testid^="public-hand-reveal-card-"]')).toHaveLength(1);
    expect(useGameStateStore.getState().pendingPublicHandReveal).not.toHaveProperty('handSnapshot');
  });

  it('keeps each card detail action at the landscape touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/PublicHandRevealWindow.css'), 'utf8');
    expect(css).toMatch(/\.public-hand-reveal-card button\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/);
    expect(css).toMatch(/\.public-hand-reveal-close\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  });

  it('surfaces the next queued presentation after an explicit close', () => {
    useGameStateStore.setState((state) => ({
      pendingPublicHandReveal: state.pendingPublicHandReveal
        ? { ...state.pendingPublicHandReveal, lifetime: 'presentation' }
        : null,
    }));
    queuePendingPublicHandRevealSide({
      owner: 'self',
      audience: 'all',
      cardIds: ['D08003'],
      handSnapshot: ['D08003'],
      lifetime: 'presentation',
      resolutionToken: 'public-hand-reveal:next',
      source: { cardId: 'B09061', abilityId: 'a1' },
    });
    act(() => root.render(<PublicHandRevealWindow />));

    const close = container.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-close"]')!;
    act(() => close.click());

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      resolutionToken: 'public-hand-reveal:next',
      cardIds: ['D08003'],
    });
    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')).not.toBeNull();
  });
});
