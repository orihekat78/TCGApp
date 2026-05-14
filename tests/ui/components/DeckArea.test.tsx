// Phase 7 Task 7.7: DeckArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DeckArea } from '@/ui/components/DeckArea';

describe('DeckArea', () => {
  it('renders zone shell with side class and label', () => {
    const html = renderToString(<DeckArea count={28} side="self" />);
    expect(html).toMatch(/deck-area side-self/);
    expect(html).toMatch(/zone-label/);
    expect(html).toMatch(/<span>デッキ<\/span>/);
  });

  it('shows count badge with the numeric value', () => {
    const html = renderToString(<DeckArea count={28} side="self" />);
    expect(html).toMatch(/class="deck-count">28</);
  });

  it('renders 4 layers (l1+l2+l3+top) when count >= 4', () => {
    const html = renderToString(<DeckArea count={28} side="self" />);
    expect(html).toMatch(/class="layer l3"/);
    expect(html).toMatch(/class="layer l2"/);
    expect(html).toMatch(/class="layer l1"/);
    expect(html).toMatch(/class="layer top"/);
    expect(html).toMatch(/monogram">DC</);
  });

  it('renders 3 layers (l2+l1+top) when count is 3', () => {
    const html = renderToString(<DeckArea count={3} side="self" />);
    expect(html).not.toMatch(/class="layer l3"/);
    expect(html).toMatch(/class="layer l2"/);
    expect(html).toMatch(/class="layer l1"/);
    expect(html).toMatch(/class="layer top"/);
  });

  it('renders 2 layers (l1+top) when count is 2', () => {
    const html = renderToString(<DeckArea count={2} side="self" />);
    expect(html).not.toMatch(/class="layer l3"/);
    expect(html).not.toMatch(/class="layer l2"/);
    expect(html).toMatch(/class="layer l1"/);
    expect(html).toMatch(/class="layer top"/);
  });

  it('renders 1 layer (top only) when count is 1', () => {
    const html = renderToString(<DeckArea count={1} side="self" />);
    expect(html).not.toMatch(/class="layer l1"/);
    expect(html).toMatch(/class="layer top"/);
  });

  it('renders deck-empty marker and no top layer when count is 0', () => {
    const html = renderToString(<DeckArea count={0} side="self" />);
    expect(html).not.toMatch(/class="layer top"/);
    expect(html).toMatch(/class="deck-empty"[^>]*aria-label="デッキ空">EMPTY</);
    expect(html).toMatch(/class="deck-count">0</);
  });

  it('applies side-opp class for opponent side', () => {
    const html = renderToString(<DeckArea count={28} side="opp" />);
    expect(html).toMatch(/deck-area side-opp/);
  });

  it('exposes count via data attribute on the stack wrapper', () => {
    const html = renderToString(<DeckArea count={15} side="self" />);
    expect(html).toMatch(/data-count="15"/);
  });
});
