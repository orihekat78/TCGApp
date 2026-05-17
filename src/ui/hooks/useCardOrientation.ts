// useCardOrientation — cardId 画像の natural サイズから向きを自動判定するフック (Phase 9-D)
//
// 事件カードは個別に向きが異なる:
//   - D08026 (青の古城): 1000×716 → 'landscape'
//   - D11021 (婚活パーティー): 716×1000 → 'portrait'
// CardDef にメタ追加せず、画像 natural width/height から実測する設計。

import { useEffect, useState } from 'react';
import { useCardImage } from './useCardImage';

export type CardOrientation = 'portrait' | 'landscape';

/**
 * cardId の画像 natural サイズから向きを自動判定。
 * - 初回 render では `null` (画像読込前)。呼出側は fallback を用意すること。
 * - 画像読込失敗時も `null` を返す。
 * - placeholder (data: URI) のみのときは判定しない (`null`)。
 */
export function useCardOrientation(
  cardId: string | null | undefined,
): CardOrientation | null {
  const url = useCardImage(cardId);
  const [orient, setOrient] = useState<CardOrientation | null>(null);

  useEffect(() => {
    if (!cardId || url.startsWith('data:')) {
      setOrient(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setOrient(img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait');
    };
    img.onerror = () => {
      if (!cancelled) setOrient(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [cardId, url]);

  return orient;
}
