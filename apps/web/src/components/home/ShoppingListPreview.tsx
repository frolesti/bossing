'use client';

import Link from 'next/link';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import { useShoppingList } from '@/context/ShoppingListContext';

export function ShoppingListPreview() {
  const { items } = useShoppingList();
  const itemCount = items.length;
  // TODO: Això hauria de venir d'una consulta real d'optimització, però de moment ho deixem amb un placeholder dinàmic o ocultem
  const potentialSavings = itemCount * 1.5; 

  if (itemCount === 0) {
    return (
      <section className="card bg-white p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-50 rounded-lg text-green-600">
             <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">La teva llista</h2>
            <p className="text-sm text-gray-500">La llista està buida</p>
          </div>
        </div>
        <Link 
          href="/list"
          className="block w-full text-center py-2 px-4 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          Afegir productes
        </Link>
      </section>
    );
  }

  return (
    <section className="card bg-white p-4 rounded-xl shadow-sm">
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
        {items.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <span className="text-gray-700">{item.name}</span>
            <span className="text-gray-400 text-sm">x{item.quantity}</span>
          </div>
        ))}
         {items.length > 3 && (
            <p className="text-xs text-center text-gray-400 mt-2">... i {items.length - 3} més</p>
         )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{itemCount} productes</p>
            <p className="text-sm font-medium text-green-600">
              Estalvi estimat ~{potentialSavings.toFixed(2)}€
            </p>
          </div>
          <Link href="/list?view=optimize" className="btn-primary flex items-center justify-center bg-green-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
            Optimitzar
          </Link>
        </div>
      </div>
    </section>
  );
}
