// useCardImage — cardId から公式 CDN 画像 URL を構築する React フック (Phase 9-C)
//
// 配信方針 (AGENTS.md):
//   - 固定・記名済みの少人数だけが認証後に利用
//   - 画像はリポジトリにも配信物にも同梱しない
//   - CDN URL は公式 takaratomy ホストを参照、binary は <img> が直接読込
//
// 設計メモ (CORS 制約への対応):
//   - 一方 `<img src="...">` は CORS の影響を受けない (canvas でない限り)。
//   - 本フックは URL 文字列を同期的に返すだけ。失敗時は CardArt 側で
//     `<img onError>` を捕まえて placeholder にフォールバックする。

import { useMemo } from 'react';
import { engine } from '@/engine';
import { getCardImagePlaceholder } from '@/ui/services/cardImage';

const IMAGE_BASE = 'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/';

/**
 * cardId から画像 URL を同期返却する。
 * - cardId 未指定 / CardDef 未登録 / imageUrl 空 → placeholder
 * - 通常時 → 公式 CDN URL
 *
 * `<img>` が CDN にアクセスして失敗した場合の fallback は呼び出し側 (CardArt) の責務。
 */
export function useCardImage(cardId: string | null | undefined): string {
  return useMemo(() => {
    if (!cardId) return getCardImagePlaceholder();
    const def = engine.cards.get(cardId);
    if (!def?.imageUrl) return getCardImagePlaceholder();
    return IMAGE_BASE + def.imageUrl;
  }, [cardId]);
}
