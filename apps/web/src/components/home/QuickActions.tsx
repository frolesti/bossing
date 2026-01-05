import Link from 'next/link';
import { Scan, TrendingDown, MapPin, Sparkles } from 'lucide-react';

const actions = [
  {
    href: '/scan',
    icon: Scan,
    label: 'Escanejar',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    href: '/deals',
    icon: TrendingDown,
    label: 'Ofertes',
    color: 'bg-red-100 text-red-600',
  },
  {
    href: '/nearby',
    icon: MapPin,
    label: 'A prop',
    color: 'bg-green-100 text-green-600',
  },
  {
    href: '/optimize',
    icon: Sparkles,
    label: 'Optimitzar',
    color: 'bg-purple-100 text-purple-600',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map(({ href, icon: Icon, label, color }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2"
        >
          <div className={`p-3 rounded-2xl ${color}`}>
            <Icon size={24} />
          </div>
          <span className="text-xs font-medium text-gray-600">{label}</span>
        </Link>
      ))}
    </div>
  );
}
