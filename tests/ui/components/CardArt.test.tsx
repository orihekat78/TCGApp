// tests/ui/components/CardArt — Phase 9-C: カード画像 img wrapper
// 検証観点 (SSR render):
//   - cardId なしで placeholder (SVG data URI) を出す
//   - cardId が registered CardDef + imageUrl ありなら CDN URL を src にする
//   - extra className が付与される
//   - alt 属性 (cardId fallback)
// onError fallback は jsdom + event firing が必要なので本テストには含めない
// (実機 / Playwright で M2-M5 各 step に確認済み)。

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { engine } from '@/engine';
import { CardArt } from '@/ui/components/CardArt';

const PLACEHOLDER_PREFIX = 'data:image/svg+xml';
const CDN_BASE = 'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/';

function getImgAttr(html: string, attr: string): string | undefined {
  const m = html.match(new RegExp(`${attr}="([^"]*)"`));
  return m ? m[1] : undefined;
}

describe('CardArt', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
  });

  it('renders placeholder when cardId is null', () => {
    const html = renderToString(<CardArt cardId={null} />);
    const src = getImgAttr(html, 'src') ?? '';
    expect(src.startsWith(PLACEHOLDER_PREFIX)).toBe(true);
  });

  it('renders placeholder when cardId is unknown to registry', () => {
    const html = renderToString(<CardArt cardId="UNKNOWN-ID" />);
    const src = getImgAttr(html, 'src') ?? '';
    expect(src.startsWith(PLACEHOLDER_PREFIX)).toBe(true);
  });

  it('renders CDN URL when CardDef has imageUrl', () => {
    engine.cards.register({
      id: 'TEST-A',
      no: '0001/TEST-A',
      kind: 'character',
      names: ['Test A'],
      colors: ['青'],
      level: 1,
      ap: 1000,
      lp: 1,
      traits: [],
      keywords: [],
      rarity: 'C',
      imageUrl: '123456789.jpg',
      abilities: [],
      ruleRefs: [],
    });
    const html = renderToString(<CardArt cardId="TEST-A" />);
    expect(getImgAttr(html, 'src')).toBe(CDN_BASE + '123456789.jpg');
  });

  it('applies extra className when provided', () => {
    const html = renderToString(<CardArt cardId={null} className="case-bg" />);
    expect(getImgAttr(html, 'class')).toBe('card-art case-bg');
  });

  it('uses alt prop or fallback to cardId', () => {
    const withAlt = renderToString(<CardArt cardId="X" alt="Hello" />);
    expect(getImgAttr(withAlt, 'alt')).toBe('Hello');
    const noAlt = renderToString(<CardArt cardId="X" />);
    expect(getImgAttr(noAlt, 'alt')).toBe('X');
  });
});
