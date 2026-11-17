import { Package } from 'lucide-react';

export function CatalogIcon({ iconUrl, iconPosition, imageUrl }: { iconUrl?: string; iconPosition?: string; imageUrl?: string }) {
  if (imageUrl) return <img src={imageUrl} alt="" loading="lazy" className="w-10 h-10 shrink-0 object-contain bg-white" />;
  if (iconUrl) return <span aria-hidden="true" className="block shrink-0 w-7 h-7 bg-no-repeat"
    style={{ backgroundImage: `url("${iconUrl}")`, backgroundPosition: iconPosition || 'center',
      ...(iconPosition ? {} : { backgroundSize: 'contain' }) }} />;
  return <Package aria-hidden="true" className="w-7 h-7 shrink-0 text-brand-600" strokeWidth={1.5} />;
}