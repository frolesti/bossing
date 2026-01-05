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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="text-red-500" size={20} />
          <h2 className="font-semibold text-gray-900">Ofertes a prop teu</h2>
        </div>
        <Link
          href="/deals"
          className="flex items-center text-sm text-primary-600 font-medium"
        >
          Més ofertes
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="space-y-3">
        {mockDeals.map((deal) => (
          <Link
            key={deal.id}
            href={`/product/${deal.id}`}
            className="card flex items-center gap-4 active:bg-gray-50"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
              {/* TODO: Imatge del producte */}
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{deal.name}</p>
              <p className="text-sm text-gray-500">{deal.supermarket}</p>
              <p className="text-xs text-gray-400">{deal.distance} km</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-600">
                {deal.dealPrice.toFixed(2)}€
              </p>
              <p className="text-sm text-gray-400 line-through">
                {deal.originalPrice.toFixed(2)}€
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
