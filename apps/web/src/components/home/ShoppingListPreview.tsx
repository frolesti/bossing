import Link from 'next/link';
import { ChevronRight, ShoppingCart } from 'lucide-react';

// TODO: Connectar amb l'estat real de la llista
const mockItems = [
  { id: '1', name: 'Llet', quantity: 2 },
  { id: '2', name: 'Pa', quantity: 1 },
  { id: '3', name: 'Ous', quantity: 12 },
];

export function ShoppingListPreview() {
  const itemCount = mockItems.length;
  const potentialSavings = 4.35; // TODO: Calcular des del backend

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="text-primary-600" size={20} />
          <h2 className="font-semibold text-gray-900">La teva llista</h2>
        </div>
        <Link
          href="/list"
          className="flex items-center text-sm text-primary-600 font-medium"
        >
          Veure tot
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="space-y-2">
        {mockItems.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <span className="text-gray-700">{item.name}</span>
            <span className="text-gray-400 text-sm">x{item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{itemCount} productes</p>
            <p className="text-sm font-medium text-green-600">
              Pots estalviar fins a {potentialSavings.toFixed(2)}€
            </p>
          </div>
          <Link href="/optimize" className="btn-primary text-sm py-2 px-4">
            Optimitzar
          </Link>
        </div>
      </div>
    </section>
  );
}
