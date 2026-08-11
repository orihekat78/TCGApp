import { useEffect, useState } from 'react';
import { getCardImagePlaceholder } from '@/ui/services/cardImage';
import { catalogCardImageSource } from '../hooks/useCatalogCardImage';

interface Props {
  imagePath: string | null | undefined;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}

export function CatalogCardArt({
  imagePath,
  alt,
  className,
  loading = 'lazy',
}: Props) {
  const candidate = catalogCardImageSource(imagePath);
  const [source, setSource] = useState(candidate);

  useEffect(() => {
    setSource(candidate);
  }, [candidate]);

  return (
    <img
      className={className ? `card-art ${className}` : 'card-art'}
      src={source}
      alt={alt}
      loading={loading}
      draggable={false}
      onError={() => {
        const placeholder = getCardImagePlaceholder();
        if (source !== placeholder) setSource(placeholder);
      }}
    />
  );
}
