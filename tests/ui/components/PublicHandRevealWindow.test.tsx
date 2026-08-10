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
    expect(first?.getAttribute('aria-label')).toBe(`Details for ${cardName}, occurrence 1`);
    expect(second?.getAttribute('aria-label')).toBe(`Details for ${cardName}, occurrence 2`);
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
    act(() => close?.click());

    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(container.querySelector('[data-testid="public-hand-reveal-window"]')).toBeNull();
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
