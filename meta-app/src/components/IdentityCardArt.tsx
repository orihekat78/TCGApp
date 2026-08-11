import { useEffect, useState } from "react";
import { getCardImagePlaceholder } from "@/ui/services/cardImage";

const imageBase =
  "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/";

interface Props {
  imagePath: string | null;
  alt: string;
  className?: string;
}

export function IdentityCardArt({ imagePath, alt, className }: Props) {
  const initialSource = imagePath
    ? `${imageBase}${imagePath}`
    : getCardImagePlaceholder();
  const [source, setSource] = useState(initialSource);

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource]);

  return (
    <img
      className={className ? `card-art ${className}` : "card-art"}
      src={source}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => {
        const placeholder = getCardImagePlaceholder();
        if (source !== placeholder) setSource(placeholder);
      }}
    />
  );
}
