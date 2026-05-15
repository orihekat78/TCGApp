// Phase 7 Task 7.11: HandZone tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HandZone, type HandCardMeta } from '@/ui/components/HandZone';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function card(overrides: Partial<HandCardMeta> & Pick<HandCardMeta, 'cardId'>): HandCardMeta {
  return {
    name: 'カード',
    color: 'blue',
    type: 'キャラ',
    cost: 3,
    ap: 5000,
    lp: 1,
    lv: 3,
    ...overrides,
  };
}

describe('HandZone', () => {
  it('renders empty state when no cards', () => {
    const html = strip(renderToString(<HandZone cards={[]} expanded={true} />));
    expect(html).toMatch(/hand-zone hand-zone--empty/);
    expect(html).toMatch(/aria-label="手札 0 枚"/);
    expect(html).toMatch(/hand-empty-message">手札なし/);
  });

  it('renders all cards as a flat list', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'A', name: 'カードA', color: 'blue' }),
      card({ cardId: 'B', name: 'カードB', color: 'yellow' }),
      card({ cardId: 'C', name: 'カードC', color: 'red' }),
    ];
    const html = strip(renderToString(<HandZone cards={cards} expanded={true} />));
    expect(html).toMatch(/role="list"/);
    expect(html).toMatch(/aria-label="手札 3 枚"/);
    expect(html).toMatch(/data-count="3"/);
    expect(html.match(/class="hand-card /g)?.length).toBe(3);
    expect(html).toMatch(/data-card-id="A"/);
    expect(html).toMatch(/data-card-id="B"/);
    expect(html).toMatch(/data-card-id="C"/);
  });

  it('renders cost / type-badge / stats with correct color stripe', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'A', cost: 5, type: 'キャラ', ap: 7000, lp: 2, lv: 5 }),
    ];
    const html = strip(renderToString(<HandZone cards={cards} expanded={true} />));
    expect(html).toMatch(/class="cost">5</);
    expect(html).toMatch(/class="type-badge">キャラ</);
    expect(html).toMatch(/class="ap">7000</);
    expect(html).toMatch(/class="lp">2</);
    expect(html).toMatch(/class="lv">5</);
  });

  it('renders "—" for null AP/LP (event cards)', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'E', type: 'イベント', ap: null, lp: null, lv: 3 }),
    ];
    const html = strip(renderToString(<HandZone cards={cards} expanded={true} />));
    expect(html).toMatch(/class="type-badge">イベント</);
    expect(html).toMatch(/class="ap">—</);
    expect(html).toMatch(/class="lp">—</);
    expect(html).toMatch(/class="lv">3</);
  });

  it('applies featured class on the matching cardId', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'A' }),
      card({ cardId: 'B' }),
    ];
    const html = strip(renderToString(
      <HandZone cards={cards} expanded={true} featuredCardId="B" />,
    ));
    expect(html).toMatch(/hand-card color-blue featured/);
    // featured が 1 枚のみ
    expect(html.match(/featured/g)?.length).toBe(1);
  });

  it('applies disabled class + title when canUse returns false', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'A', color: 'blue' }),
      card({ cardId: 'B', color: 'yellow' }),
    ];
    const html = strip(renderToString(
      <HandZone
        cards={cards}
        expanded={true}
        canUse={(c) => c.color === 'yellow'}
        disabledReason={() => '色不一致'}
      />,
    ));
    // A は disabled (color blue は !== yellow)
    expect(html).toMatch(/data-card-id="A"[^>]*data-color="blue"[^>]*title="色不一致"[^>]*aria-disabled/);
    expect(html).toMatch(/hand-card color-blue disabled/);
    // B は disabled なし
    expect(html).not.toMatch(/data-card-id="B"[^>]*disabled/);
  });

  it('all enabled by default when canUse not provided', () => {
    const cards: HandCardMeta[] = [
      card({ cardId: 'A' }),
      card({ cardId: 'B' }),
    ];
    const html = strip(renderToString(<HandZone cards={cards} />));
    expect(html).not.toMatch(/disabled/);
  });

  it('renders all 5 color classes for cards', () => {
    const colors: HandCardMeta['color'][] = ['blue', 'yellow', 'red', 'green', 'purple'];
    const cards: HandCardMeta[] = colors.map((color, i) => card({ cardId: `c-${i}`, color }));
    const html = strip(renderToString(<HandZone cards={cards} expanded={true} />));
    for (const color of colors) {
      expect(html).toMatch(new RegExp(`hand-card color-${color}`));
    }
  });
});
