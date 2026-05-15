// Phase 7 Task 7.12: TopBar tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopBar } from '@/ui/components/TopBar';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

const baseTurn = { number: 4, player: 'self' as const };
const baseScratch = { self: '未発見' as const, opp: '未発見' as const };

describe('TopBar', () => {
  it('renders the 3-column layout shell', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/class="topbar"[^>]*role="banner"/);
    expect(html).toMatch(/class="topbar-left"/);
    expect(html).toMatch(/class="topbar-center"/);
    expect(html).toMatch(/class="topbar-right"/);
  });

  it('renders chapter-tag with 先攻 N ターン目 when player is self', () => {
    const html = strip(renderToString(
      <TopBar turn={{ number: 3, player: 'self' }} scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/class="chapter-tag"[^>]*aria-label="先攻 3ターン目"/);
    expect(html).toMatch(/先攻 3ターン目/);
  });

  it('renders 後攻 N ターン目 when player is opp', () => {
    const html = strip(renderToString(
      <TopBar turn={{ number: 5, player: 'opp' }} scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/後攻 5ターン目/);
  });

  it('renders both scratch items (自 / 相) with correct found state', () => {
    const html = strip(renderToString(
      <TopBar
        turn={baseTurn}
        scratchTrace={{ self: '発見済', opp: '未発見' }}
        effectStackCount={0}
      />,
    ));
    // self=発見済 → .scratch.found 適用
    expect(html).toMatch(/class="scratch found"[^>]*title="痕跡: 自"/);
    // opp=未発見 → .scratch のみ (.found なし)
    expect(html).toMatch(/class="scratch"[^>]*title="痕跡: 相"/);
    expect(html).toMatch(/痕跡 自/);
    expect(html).toMatch(/痕跡 相/);
    expect(html).toMatch(/<strong>発見済<\/strong>/);
  });

  it('renders effect-stack count', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} scratchTrace={baseScratch} effectStackCount={3} />,
    ));
    expect(html).toMatch(/class="effect-stack"[^>]*aria-label="効果スタック 3 件"/);
    expect(html).toMatch(/効果スタック: 3/);
  });

  it('renders effect-stack 0 (mock 仕様: 常時表示)', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/効果スタック: 0/);
  });

  it('uses default narratorName "ナレーター" and copyright', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/class="narrator-name">ナレーター</);
    expect(html).toMatch(/© 青山剛昌／小学館 © TOMY/);
  });

  it('respects custom narratorName and copyright props', () => {
    const html = strip(renderToString(
      <TopBar
        turn={baseTurn}
        scratchTrace={baseScratch}
        effectStackCount={0}
        narratorName="探偵"
        copyright="© Test"
      />,
    ));
    expect(html).toMatch(/class="narrator-name">探偵</);
    expect(html).toMatch(/© Test</);
    // narrator-name に "ナレーター" は出ない (aria-label の prefix "ナレーター: " はOK)
    expect(html).not.toMatch(/class="narrator-name">ナレーター/);
  });
});
