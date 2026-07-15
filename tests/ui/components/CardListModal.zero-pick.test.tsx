import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardListModal } from '@/ui/components/CardListModal';

describe('CardListModal zero-candidate decision', () => {
  it('keeps all public cards, banner, and skip when an optional pick has no matches', () => {
    const html = renderToString(
      <CardListModal
        kind="deck"
        side="self"
        cards={['A', 'B', 'C']}
        pickCands={[]}
        pickBannerText="対象カードはありません"
        pickCanSkip
        pickNMin={0}
        onPick={vi.fn()}
        onPickSkip={vi.fn()}
        onExpand={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="card-list-item-A-0"');
    expect(html).toContain('data-testid="card-list-item-B-1"');
    expect(html).toContain('data-testid="card-list-item-C-2"');
    expect(html).toContain('対象カードはありません');
    expect(html).toContain('data-testid="card-list-pick-skip"');
    expect(html).not.toContain('card-list-item--pickable');
  });
});
