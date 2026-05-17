// CardArt — カード画像表示の drop-in 部品 (Phase 9-C)
// 既存の `<div className="silhouette" />` を置き換えて img を出す。
// CDN から取得できれば実画像、失敗時は SVG placeholder にフォールバック。

import { useEffect, useState, type JSX } from 'react';
import { useCardImage } from '../hooks/useCardImage';
import { getCardImagePlaceholder } from '@/ui/services/cardImage';
import './CardArt.css';

export type CardArtProps = {
  cardId: string | null | undefined;
  alt?: string;
  className?: string;
};

export function CardArt({ cardId, alt, className }: CardArtProps): JSX.Element {
  const candidate = useCardImage(cardId);
  const [src, setSrc] = useState<string>(candidate);

  // cardId が変わったら src を再設定 (前回の onError 結果をリセット)
  useEffect(() => {
    setSrc(candidate);
  }, [candidate]);

  return (
    <img
      className={className ? `card-art ${className}` : 'card-art'}
      src={src}
      alt={alt ?? cardId ?? ''}
      loading="lazy"
      draggable={false}
      onError={() => {
        const placeholder = getCardImagePlaceholder();
        if (src !== placeholder) setSrc(placeholder);
      }}
    />
  );
}
