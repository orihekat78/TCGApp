// Phase 7 Task 7.10: RemoveArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RemoveArea } from '@/ui/components/RemoveArea';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

const resolveCard = (cardId: string): ResolvedCardMeta => {
  const colorMap: Record<string, ResolvedCardMeta['color']> = {
    'A': 'blue', 'B': 'yellow', 'C': 'red',
  };
  return {
    name: `カード${cardId}`,
    color: colorMap[cardId] ?? 'blue',
    ap: 0, lp: 0, lv: 0,
  };
};

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

describe('RemoveArea', () => {
  it('renders zone shell with side class and label', () => {
    const html = strip(renderToString(
      <RemoveArea cards={[]} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/remove-area side-self/);
    expect(html).toMatch(/<span>リムーブ<\/span>/);
  });

  it('shows count=0 (highlighted as zero) and EMPTY when no cards', () => {
    const html = strip(renderToString(
      <RemoveArea cards={[]} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/class="count zero">0</);
    expect(html).toMatch(/class="stack-empty"[^>]*aria-label="リムーブ空">EMPTY/);
    expect(html).not.toMatch(/class="card /);
  });

  it('renders the latest card (last in array) with correct color', () => {
    const html = strip(renderToString(
      <RemoveArea cards={['A', 'B', 'C']} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/class="count">3</);
    // 配列末尾は 'C' → color: red
    expect(html).toMatch(/class="card color-red"/);
    expect(html).toMatch(/data-card-id="C"/);
    expect(html).toMatch(/aria-label="最新リムーブ: カードC"/);
    // 'A' / 'B' は表示しない (最新のみ)
    expect(html).not.toMatch(/data-card-id="A"/);
    expect(html).not.toMatch(/data-card-id="B"/);
  });

  it('shows count=1 single-card stack', () => {
    const html = strip(renderToString(
      <RemoveArea cards={['A']} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/class="count">1</);
    expect(html).toMatch(/class="card color-blue"/);
    expect(html).not.toMatch(/stack-empty/);
  });

  it('applies side-opp class for opponent side', () => {
    const html = strip(renderToString(
      <RemoveArea cards={['A']} side="opp" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/remove-area side-opp/);
  });

  it('does NOT highlight count when > 0', () => {
    const html = strip(renderToString(
      <RemoveArea cards={['A']} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).not.toMatch(/class="count zero"/);
    expect(html).toMatch(/class="count">1</);
  });
});
