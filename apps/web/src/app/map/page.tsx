'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, MapPin, ExternalLink, Phone, Clock, Star, List } from 'lucide-react';

// Importar el mapa dinàmicament per evitar errors SSR
const SupermarketGoogleMap = dynamic(
  () => import('@/components/map/GoogleMap'),
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
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number;
  rating?: number;
  userRatingsTotal?: number;
  openNow?: boolean;
  openingHours?: string[];
  phone?: string;
  chain?: string;
  photoUrl?: string;
}

export default function MapPage() {
  const [selectedSupermarket, setSelectedSupermarket] =
    useState<Supermarket | null>(null);
  const [mounted, setMounted] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSupermarketSelect = (supermarket: Supermarket) => {
    setSelectedSupermarket(supermarket);
  };

  const getSupermarketColor = (chain?: string) => {
    switch (chain) {
      case 'mercadona':
        return 'bg-green-600';
      case 'consum':
        return 'bg-orange-500';
      case 'carrefour':
        return 'bg-blue-600';
      case 'dia':
        return 'bg-red-500';
      case 'lidl':
        return 'bg-yellow-500';
      case 'aldi':
        return 'bg-sky-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  // Si no hi ha API key, mostrar instruccions
  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
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

        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-yellow-900">
                  Configura Google Maps API
                </h2>
                <p className="text-sm text-yellow-700 mt-1">
                  Per utilitzar el mapa, necessites configurar una clau d'API de Google Maps.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Passos:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>
                  Ves a{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Crea un projecte nou o selecciona un existent</li>
                <li>Activa les APIs: Maps JavaScript API i Places API</li>
                <li>Crea una clau d'API</li>
                <li>
                  Afegeix la clau al fitxer <code className="bg-gray-100 px-1 rounded">.env.local</code>:
                </li>
              </ol>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=la_teva_clau_aqui
              </pre>
              <p className="text-xs text-gray-500">
                💡 Google ofereix $200/mes gratis, suficient per a desenvolupament.
              </p>
            </div>
          </div>
        </main>
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
        <SupermarketGoogleMap
          apiKey={apiKey}
          onSupermarketSelect={handleSupermarketSelect}
          selectedSupermarket={selectedSupermarket}
        />

        {/* Detalls del supermercat seleccionat */}
        {selectedSupermarket && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Foto del supermercat */}
            {selectedSupermarket.photoUrl && (
              <div className="h-32 bg-gray-200">
                <img
                  src={selectedSupermarket.photoUrl}
                  alt={selectedSupermarket.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 ${getSupermarketColor(
                    selectedSupermarket.chain
                  )}`}
                >
                  {selectedSupermarket.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">
                      {selectedSupermarket.name}
                    </h3>
                    {selectedSupermarket.openNow !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedSupermarket.openNow
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {selectedSupermarket.openNow ? 'Obert' : 'Tancat'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    {selectedSupermarket.address}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {selectedSupermarket.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">
                          {selectedSupermarket.rating}
                        </span>
                        {selectedSupermarket.userRatingsTotal && (
                          <span className="text-sm text-gray-500">
                            ({selectedSupermarket.userRatingsTotal})
                          </span>
                        )}
                      </div>
                    )}
                    {selectedSupermarket.distance !== undefined && (
                      <span className="text-sm text-green-600">
                        📍 {selectedSupermarket.distance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Horaris */}
              {selectedSupermarket.openingHours && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Horaris d'obertura</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedSupermarket.openingHours.map((hour, idx) => (
                      <p key={idx} className="text-xs text-gray-500">
                        {hour}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Telèfon */}
              {selectedSupermarket.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <a
                    href={`tel:${selectedSupermarket.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {selectedSupermarket.phone}
                  </a>
                </div>
              )}

              {/* Accions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/list?supermarket=${selectedSupermarket.placeId}`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Comparar preus</span>
                </Link>
                <button
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${selectedSupermarket.lat},${selectedSupermarket.lng}&destination_place_id=${selectedSupermarket.placeId}`,
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
          </div>
        )}

        {/* Consell */}
        {!selectedSupermarket && (
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
        )}
      </main>
    </div>
  );
}
