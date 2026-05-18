// Phase 7 Task 7.12: TopBar tests
//
// Round 2 修正: turn.number はゲーム全体の通し番号、UI 表示は player 視点。
// 先攻/後攻 は firstPlayer prop で動的判定 (旧 static mapping {self:'先攻',opp:'後攻'} を廃止)。

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
      <TopBar turn={baseTurn} firstPlayer="self" scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/class="topbar"[^>]*role="banner"/);
    expect(html).toMatch(/class="topbar-left"/);
    expect(html).toMatch(/class="topbar-center"/);
    expect(html).toMatch(/class="topbar-right"/);
  });

  it('renders chapter-tag with 先攻 N ターン目 when current player is the first player', () => {
    // turn.number=3 (game turn) + firstPlayer='self' + turn.player='self'
    // → self is first, playing their 2nd turn (game turns 1,3,5… are first player's)
    // → "先攻 2ターン目"
    const html = strip(renderToString(
      <TopBar
        turn={{ number: 3, player: 'self' }}
        firstPlayer="self"
        scratchTrace={baseScratch}
        effectStackCount={0}
      />,
    ));
    expect(html).toMatch(/class="chapter-tag"[^>]*aria-label="先攻 2ターン目"/);
    expect(html).toMatch(/先攻 2ターン目/);
  });

  it('renders 後攻 N ターン目 when current player is the second player', () => {
    // turn.number=4 (game turn) + firstPlayer='self' + turn.player='opp'
    // → opp is second, playing their 2nd turn (game turns 2,4,6… are second player's)
    // → "後攻 2ターン目"
    const html = strip(renderToString(
      <TopBar
        turn={{ number: 4, player: 'opp' }}
        firstPlayer="self"
        scratchTrace={baseScratch}
        effectStackCount={0}
      />,
    ));
    expect(html).toMatch(/後攻 2ターン目/);
  });

  it('flips label when self is the second player (Round 2 regression test)', () => {
    // bug B-7 の regression test: self=後攻、turn.number=2 = 後攻の初手
    // 旧実装は static mapping で "先攻 2ターン目" と誤表示していた。
    const html = strip(renderToString(
      <TopBar
        turn={{ number: 2, player: 'self' }}
        firstPlayer="opp"
        scratchTrace={baseScratch}
        effectStackCount={0}
      />,
    ));
    expect(html).toMatch(/後攻 1ターン目/);
    expect(html).not.toMatch(/先攻/);
  });

  it('renders both scratch items (自 / 相) with correct found state', () => {
    const html = strip(renderToString(
      <TopBar
        turn={baseTurn}
        firstPlayer="self"
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
      <TopBar turn={baseTurn} firstPlayer="self" scratchTrace={baseScratch} effectStackCount={3} />,
    ));
    expect(html).toMatch(/class="effect-stack"[^>]*aria-label="効果スタック 3 件"/);
    expect(html).toMatch(/効果スタック: 3/);
  });

  it('renders effect-stack 0 (mock 仕様: 常時表示)', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} firstPlayer="self" scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/効果スタック: 0/);
  });

  it('uses default narratorName "ナレーター" and copyright', () => {
    const html = strip(renderToString(
      <TopBar turn={baseTurn} firstPlayer="self" scratchTrace={baseScratch} effectStackCount={0} />,
    ));
    expect(html).toMatch(/class="narrator-name">ナレーター</);
    expect(html).toMatch(/© 青山剛昌／小学館 © TOMY/);
  });

  it('respects custom narratorName and copyright props', () => {
    const html = strip(renderToString(
      <TopBar
        turn={baseTurn}
        firstPlayer="self"
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
