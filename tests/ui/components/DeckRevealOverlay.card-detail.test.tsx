import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DeckRevealOverlay card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      pendingDeckReveal: { player: 'self', visibility: 'private', viewer: 'self', revealed: ['D08015'], matched: 'D08015' },
      pendingEffectPick: null,
      pendingDeckReorder: null,
      gameState: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ pendingDeckReveal: null });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
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

  it('pauses reveal progression while details are open, then resumes from the remaining duration', () => {
    vi.useFakeTimers();
    act(() => root.render(<DeckRevealOverlay />));

    act(() => vi.advanceTimersByTime(400));
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="deck-reveal-detail-0"]')!;
    act(() => detail.click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();

    // The original 3100ms reveal timeline must not run behind the detail modal.
    act(() => vi.advanceTimersByTime(5000));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).not.toBeNull();

    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());
    expect(container.querySelector('.card-expand-modal')).toBeNull();

    // 2700ms remained when the detail opened. A restart would still be visible
    // after 2700ms; continuation from the remaining duration dismisses exactly then.
    act(() => vi.advanceTimersByTime(2699));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
  });

  it('keeps the reveal detail control at the mobile touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/DeckRevealOverlay.css'), 'utf8');
    expect(css).toMatch(/\.deck-reveal-card-detail\s*\{[\s\S]*min-width:\s*48px;[\s\S]*min-height:\s*48px;/);
  });

  it('uses the reveal-return presentation without bottom-placement or shuffle copy', () => {
    vi.useFakeTimers();
    useGameStateStore.setState({
      pendingDeckReveal: { player: 'opp', visibility: 'public', viewer: 'all', revealed: ['D08015'], matched: 'D08015', presentation: 'reveal-return' },
    });
    act(() => root.render(<DeckRevealOverlay />));
    act(() => vi.advanceTimersByTime(1000));

    expect(container.querySelector('[data-testid="deck-reveal-header"]')?.textContent).toContain('元のデッキへ戻しています');
    expect(container.querySelector('[data-testid="deck-reveal-shuffle"]')).toBeNull();
    expect(container.querySelector('.deck-reveal-card.is-matched')).toBeNull();
    expect(container.querySelector('.deck-reveal-match-badge')).toBeNull();
  });

  it('uses the Investigation presentation without a false shuffle phase', () => {
    vi.useFakeTimers();
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'opp', visibility: 'public', viewer: 'all',
        revealed: ['D08015'], matched: null,
        presentation: 'reveal-to-bottom',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));
    act(() => vi.advanceTimersByTime(1000));

    expect(container.querySelector('[data-testid="deck-reveal-header"]')?.textContent).toContain('デッキの下へ');
    expect(container.querySelector('[data-testid="deck-reveal-shuffle"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1100));
    expect(container.querySelector('[data-testid="deck-reveal-shuffle"]')).toBeNull();
    expect(container.querySelector('.deck-reveal-match-badge')).toBeNull();
  });

  it('describes randomized revealed cards without claiming a whole-deck shuffle', () => {
    vi.useFakeTimers();
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'self', visibility: 'public', viewer: 'all',
        revealed: ['D08015'], matched: null,
        presentation: 'reveal-to-bottom-randomized',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));
    act(() => vi.advanceTimersByTime(1000));

    const header = container.querySelector('[data-testid="deck-reveal-header"]')?.textContent ?? '';
    expect(header).toContain('公開したカード');
    expect(header).toContain('デッキの下');
    expect(header).not.toContain('デッキをシャッフル中');
    expect(container.querySelector('[data-testid="deck-reveal-shuffle"]')).toBeNull();
  });

  it('dismisses a matched-only reveal without claiming a return, bottom move, or shuffle', () => {
    vi.useFakeTimers();
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'self', visibility: 'public', viewer: 'all',
        revealed: ['D08015'], matched: 'D08015', presentation: 'reveal-complete',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));
    expect(container.querySelector('[data-testid="deck-reveal-header"]')?.textContent).toContain('公開中');
    act(() => vi.advanceTimersByTime(999));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
    expect(container.querySelector('[data-testid="deck-reveal-shuffle"]')).toBeNull();
  });

  it('shows a terminal reveal without stagger and dismisses it within three seconds', () => {
    vi.useFakeTimers();
    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({
      gameState: terminal,
      pendingDeckReveal: {
        player: 'self', visibility: 'public', viewer: 'all',
        revealed: ['D08015', 'D08015', 'D08015', 'D08015', 'D08015', 'D08015'],
        matched: 'D08015',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));

    const overlay = container.querySelector('[data-testid="deck-reveal-overlay"]');
    expect(overlay?.classList.contains('is-terminal')).toBe(true);
    act(() => vi.advanceTimersByTime(2_999));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
  });

  it('fails closed without rendering an unauthorized private CPU look', () => {
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'opp', visibility: 'private', viewer: 'opp',
        revealed: ['D08015'], matched: 'D08015',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));

    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('fails closed for every private look when no human owns a side', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    useGameStateStore.setState({
      pendingDeckReveal: {
        player: 'self', visibility: 'private', viewer: 'self',
        revealed: ['D08015'], matched: 'D08015',
      },
    });
    act(() => root.render(<DeckRevealOverlay />));

    expect(container.querySelector('[data-testid="deck-reveal-overlay"]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
