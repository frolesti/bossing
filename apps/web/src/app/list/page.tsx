'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  MapPin,
  RefreshCw,
  Check,
} from 'lucide-react';

// Tipus
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  prices?: {
    supermarket: string;
    price: number;
    productName: string;
  }[];
}

interface PriceComparison {
  supermarket: string;
  total: number;
  items: {
    itemId: string;
    productName: string;
    price: number;
    found: boolean;
  }[];
}

// Productes de prova per la llista
const INITIAL_ITEMS: ShoppingItem[] = [
  { id: '1', name: 'Llet sencera', quantity: 2, unit: 'L', checked: false },
  { id: '2', name: 'Pa de motlle', quantity: 1, unit: 'u', checked: false },
  { id: '3', name: 'Ous', quantity: 12, unit: 'u', checked: false },
  { id: '4', name: 'Tomàquets', quantity: 500, unit: 'g', checked: false },
  { id: '5', name: 'Formatge ratllat', quantity: 200, unit: 'g', checked: false },
];

// Preus simulats per supermercat
const MOCK_PRICES: Record<string, Record<string, { price: number; name: string }>> = {
  mercadona: {
    '1': { price: 0.85, name: 'Llet sencera Hacendado 1L' },
    '2': { price: 1.15, name: 'Pa de motlle Hacendado' },
    '3': { price: 2.10, name: 'Ous frescos M Hacendado x12' },
    '4': { price: 1.49, name: 'Tomàquets pera 1kg' },
    '5': { price: 1.75, name: 'Formatge ratllat 4 fromatges 200g' },
  },
  consum: {
    '1': { price: 0.89, name: 'Llet sencera Consum 1L' },
    '2': { price: 1.25, name: 'Pa de motlle Consum' },
    '3': { price: 2.29, name: 'Ous L Consum x12' },
    '4': { price: 1.65, name: 'Tomàquet de penjar 1kg' },
    '5': { price: 1.89, name: 'Formatge ratllat mix 200g' },
  },
  carrefour: {
    '1': { price: 0.79, name: 'Llet sencera Carrefour 1L' },
    '2': { price: 1.09, name: 'Pa de motlle Carrefour' },
    '3': { price: 2.19, name: 'Ous frescos L x12' },
    '4': { price: 1.59, name: 'Tomàquet pera 1kg' },
    '5': { price: 1.69, name: 'Formatge ratllat Carrefour 200g' },
  },
  dia: {
    '1': { price: 0.82, name: 'Llet sencera DIA 1L' },
    '2': { price: 0.99, name: 'Pa de motlle DIA' },
    '3': { price: 1.99, name: 'Ous frescos DIA M x12' },
    '4': { price: 1.39, name: 'Tomàquet madur 1kg' },
    '5': { price: 1.59, name: 'Formatge ratllat DIA 200g' },
  },
};

function ShoppingListContent() {
  const searchParams = useSearchParams();
  const supermarketId = searchParams.get('supermarket');

  const [items, setItems] = useState<ShoppingItem[]>(INITIAL_ITEMS);
  const [newItemName, setNewItemName] = useState('');
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Afegir un nou ítem
  const addItem = () => {
    if (!newItemName.trim()) return;

    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      quantity: 1,
      unit: 'u',
      checked: false,
    };

    setItems([...items, newItem]);
    setNewItemName('');
  };

  // Actualitzar quantitat
  const updateQuantity = (id: string, delta: number) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  // Marcar com a comprat
  const toggleChecked = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Eliminar ítem
  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Comparar preus
  const compareprices = async () => {
    setIsComparing(true);

    // Simular petició a l'API
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const results: PriceComparison[] = Object.entries(MOCK_PRICES).map(
      ([supermarket, prices]) => {
        const itemResults = items.map((item) => {
          const priceInfo = prices[item.id];
          if (priceInfo) {
            return {
              itemId: item.id,
              productName: priceInfo.name,
              price: priceInfo.price * item.quantity,
              found: true,
            };
          }
          return {
            itemId: item.id,
            productName: item.name,
            price: 0,
            found: false,
          };
        });

        const total = itemResults.reduce(
          (sum, item) => sum + (item.found ? item.price : 0),
          0
        );

        return {
          supermarket,
          total,
          items: itemResults,
        };
      }
    );

    // Ordenar per preu total
    results.sort((a, b) => a.total - b.total);

    setComparisons(results);
    setIsComparing(false);
    setShowComparison(true);
  };

  const getSupermarketColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'mercadona':
        return 'bg-green-600';
      case 'consum':
        return 'bg-orange-500';
      case 'carrefour':
        return 'bg-blue-600';
      case 'dia':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSupermarketDisplayName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Llista de la compra</h1>
          </div>
          <Link
            href="/map"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MapPin className="w-5 h-5 text-green-600" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Afegir nou ítem */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              placeholder="Afegir producte..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newItemName.trim()}
            className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Resum */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {items.length} productes · {checkedItems.length} completats
              </p>
            </div>
            <button
              onClick={compareprices}
              disabled={isComparing || items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isComparing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>{isComparing ? 'Comparant...' : 'Comparar preus'}</span>
            </button>
          </div>
        </div>

        {/* Comparació de preus */}
        {showComparison && comparisons.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">Comparació de preus</h2>
              <p className="text-sm text-gray-500">
                Preus estimats per la teva llista
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {comparisons.map((comparison, index) => (
                <div
                  key={comparison.supermarket}
                  className={`p-4 ${index === 0 ? 'bg-green-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getSupermarketColor(
                        comparison.supermarket
                      )}`}
                    >
                      {comparison.supermarket[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {getSupermarketDisplayName(comparison.supermarket)}
                        </p>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                            Millor preu
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {comparison.items.filter((i) => i.found).length} de{' '}
                        {items.length} productes trobats
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {comparison.total.toFixed(2)} €
                      </p>
                      {index > 0 && comparisons[0] && (
                        <p className="text-xs text-gray-500">
                          +
                          {(comparison.total - comparisons[0].total).toFixed(2)}{' '}
                          €
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Llista de productes pendents */}
        {uncheckedItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">
              Per comprar ({uncheckedItems.length})
            </h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {uncheckedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50"
                >
                  <button
                    onClick={() => toggleChecked(item.id)}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 transition-colors flex items-center justify-center"
                  >
                    {item.checked && <Check className="w-4 h-4 text-green-600" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Productes comprats */}
        {checkedItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">
              Comprats ({checkedItems.length})
            </h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {checkedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 opacity-60"
                >
                  <button
                    onClick={() => toggleChecked(item.id)}
                    className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate line-through">
                      {item.name}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estat buit */}
        {items.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">La llista està buida</p>
            <p className="text-sm text-gray-400 mt-1">
              Afegeix productes per començar a comparar preus
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ShoppingListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      }
    >
      <ShoppingListContent />
    </Suspense>
  );
}
