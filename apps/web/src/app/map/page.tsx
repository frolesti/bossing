'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, List, MapPin } from 'lucide-react';

// Importar el mapa dinàmicament per evitar errors SSR
const SupermarketMap = dynamic(
  () => import('@/components/map/SupermarketMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
        <MapPin className="w-8 h-8 text-gray-400" />
      </div>
    ),
  }
);

interface Supermarket {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number;
}

export default function MapPage() {
  const [selectedSupermarket, setSelectedSupermarket] =
    useState<Supermarket | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSupermarketSelect = (supermarket: Supermarket) => {
    setSelectedSupermarket(supermarket);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            Supermercats propers
          </h1>
        </div>
      </header>

      {/* Contingut principal */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Mapa */}
        <SupermarketMap
          onSupermarketSelect={handleSupermarketSelect}
          selectedSupermarket={selectedSupermarket}
        />

        {/* Accions amb supermercat seleccionat */}
        {selectedSupermarket && (
          <div className="bg-white rounded-xl shadow-lg p-4 space-y-4 animate-in slide-in-from-bottom-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                  selectedSupermarket.name === 'Mercadona'
                    ? 'bg-green-600'
                    : selectedSupermarket.name === 'Consum'
                    ? 'bg-orange-500'
                    : selectedSupermarket.name === 'Carrefour'
                    ? 'bg-blue-600'
                    : selectedSupermarket.name === 'DIA'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              >
                {selectedSupermarket.name[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {selectedSupermarket.name}
                </h3>
                <p className="text-gray-600">{selectedSupermarket.address}</p>
                {selectedSupermarket.distance !== undefined && (
                  <p className="text-sm text-green-600 mt-1">
                    A {selectedSupermarket.distance.toFixed(1)} km de tu
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/shopping-list?supermarket=${selectedSupermarket.id}`}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Comparar preus</span>
              </Link>
              <button
                onClick={() => {
                  // Obrir en Google Maps
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${selectedSupermarket.lat},${selectedSupermarket.lng}`,
                    '_blank'
                  );
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>Com arribar</span>
              </button>
            </div>
          </div>
        )}

        {/* Consell */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <List className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-900">Consell</h3>
              <p className="text-sm text-green-700 mt-1">
                Selecciona un supermercat per veure els preus de la teva llista
                de la compra en temps real.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
