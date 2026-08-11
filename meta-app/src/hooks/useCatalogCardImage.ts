import { useEffect, useState } from 'react';
import { getCardImagePlaceholder } from '@/ui/services/cardImage';

const IMAGE_BASE = 'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/';

export function catalogCardImageSource(imagePath: string | null | undefined): string {
  return imagePath ? `${IMAGE_BASE}${imagePath}` : getCardImagePlaceholder();
}

export type CatalogCardOrientation = 'portrait' | 'landscape';

export function useCatalogCardOrientation(
  imagePath: string | null | undefined,
): CatalogCardOrientation | null {
  const source = catalogCardImageSource(imagePath);
  const [orientation, setOrientation] = useState<CatalogCardOrientation | null>(null);

  useEffect(() => {
    if (!imagePath) {
      setOrientation(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setOrientation(image.naturalWidth >= image.naturalHeight ? 'landscape' : 'portrait');
      }
    };
    image.onerror = () => {
      if (!cancelled) setOrientation(null);
    };
    image.src = source;
    return () => {
      cancelled = true;
    };
  }, [imagePath, source]);

  return orientation;
}
