import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeckRevealOverlay card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingDeckReveal: { player: 'self', revealed: ['D08015'], matched: 'D08015' },
      pendingEffectPick: null,
      pendingDeckReorder: null,
      gameState: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ pendingDeckReveal: null });
  });

  it('keeps reveal progression while exposing each public card through a sibling detail control', () => {
    act(() => root.render(<DeckRevealOverlay />));

    const card = container.querySelector<HTMLElement>('[data-testid="deck-reveal-card-0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="deck-reveal-detail-0"]')!;
    expect(card.querySelector('img')).not.toBeNull();
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(detail.getAttribute('aria-label')).toContain(card.querySelector('.deck-reveal-card-name')!.textContent!);
    expect(detail.getAttribute('aria-label')).toContain('詳細を表示');
    act(() => detail.click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).not.toBeNull();
  });

  it('opens a revealed card from context menu without changing the reveal phase', () => {
    act(() => root.render(<DeckRevealOverlay />));

    const card = container.querySelector<HTMLElement>('[data-testid="deck-reveal-card-0"]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => card.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    expect(container.querySelector('[data-testid="deck-reveal-list"]')).not.toBeNull();
  });

  it('keeps the reveal detail control at the mobile touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/DeckRevealOverlay.css'), 'utf8');
    expect(css).toMatch(/\.deck-reveal-card-detail\s*\{[\s\S]*min-width:\s*48px;[\s\S]*min-height:\s*48px;/);
  });
});
