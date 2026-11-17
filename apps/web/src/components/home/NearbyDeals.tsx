import Link from 'next/link';
import { ChevronRight, Tag } from 'lucide-react';

// TODO: Obtenir des de l'API
const mockDeals = [
  {
    id: '1',
    name: 'Coca-Cola 2L',
    supermarket: 'Mercadona',
    originalPrice: 2.15,
    dealPrice: 1.49,
    distance: 0.3,
  },
  {
    id: '2',
    name: 'Iogurt Natural Pack',
    supermarket: 'Lidl',
    originalPrice: 1.89,
    dealPrice: 1.29,
    distance: 0.8,
  },
  {
    id: '3',
    name: 'Oli Oliva 1L',
    supermarket: 'Bonpreu',
    originalPrice: 6.99,
    dealPrice: 4.99,
    distance: 1.2,
  },
];

export function NearbyDeals() {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <h2 className="font-heading text-2xl text-ink">Ofertes a prop teu</h2>
        </div>
        <Link
          href="/deals"
          className="flex items-center text-sm text-pen-400 hover:text-pen-600"
        >
          Més ofertes
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="space-y-3">
        {mockDeals.map((deal, i) => (
          <Link
            key={deal.id}
            href={`/product/${deal.id}`}
            className="card flex items-center gap-4 active:shadow-note-hover transition-shadow"
            style={{ transform: `rotate(${i % 2 === 0 ? '0.5' : '-0.3'}deg)` }}
          >
            <div className="w-14 h-14 bg-paper-200 rounded-lg border-2 border-dashed border-paper-400 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-ink truncate">{deal.name}</p>
              <p className="text-sm text-ink-light">{deal.supermarket}</p>
              <p className="text-xs text-ink-faint">{deal.distance} km</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="price-tag">
                {deal.dealPrice.toFixed(2)}€
              </span>
              <p className="text-sm text-redpen-300 line-through mt-1">
                {deal.originalPrice.toFixed(2)}€
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
