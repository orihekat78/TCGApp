import { CatalogCardArt } from './CatalogCardArt';

interface Props {
  imagePath: string | null;
  alt: string;
  className?: string;
}

export function IdentityCardArt({ imagePath, alt, className }: Props) {
  return <CatalogCardArt imagePath={imagePath} alt={alt} className={className} />;
}
