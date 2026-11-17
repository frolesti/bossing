import Link from 'next/link';
import { Scan, TrendingDown, MapPin, Sparkles } from 'lucide-react';

const actions = [
  {
    href: '/scan',
    icon: Scan,
    label: 'Escanejar',
    color: 'bg-pen-50 text-pen-500 border-pen-200',
    emoji: '📷',
  },
  {
    href: '/deals',
    icon: TrendingDown,
    label: 'Ofertes',
    color: 'bg-redpen-50 text-redpen-400 border-redpen-200',
    emoji: '🏷️',
  },
  {
    href: '/nearby',
    icon: MapPin,
    label: 'A prop',
    color: 'bg-marker-50 text-marker-600 border-marker-200',
    emoji: '📍',
  },
  {
    href: '/optimize',
    icon: Sparkles,
    label: 'Optimitzar',
    color: 'bg-sticky-50 text-sticky-500 border-sticky-200',
    emoji: '✨',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map(({ href, icon: Icon, label, color, emoji }, i) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-1.5 group"
          style={{ transform: `rotate(${i % 2 === 0 ? '-1' : '1'}deg)` }}
        >
          <div className={`p-3 rounded-lg border-2 ${color} shadow-sticker transition-transform group-hover:scale-105 group-active:scale-95`}>
            <span className="text-2xl">{emoji}</span>
          </div>
          <span className="text-sm text-ink-light group-hover:text-ink">{label}</span>
        </Link>
      ))}
    </div>
  );
}
