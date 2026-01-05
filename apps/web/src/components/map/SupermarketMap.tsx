'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, Loader2, RefreshCw } from 'lucide-react';

// Tipus per a la ubicació
interface Location {
  lat: number;
  lng: number;
}

// Tipus per a supermercats
interface Supermarket {
  id: string;
  name: string;
  chain?: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number; // en km
  phone?: string;
}

// Props del component
interface SupermarketMapProps {
  onSupermarketSelect?: (supermarket: Supermarket) => void;
  selectedSupermarket?: Supermarket | null;
}

// Importar Leaflet dinàmicament per evitar errors SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

// URL de l'API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SupermarketMap({
  onSupermarketSelect,
  selectedSupermarket,
}: SupermarketMapProps) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingSupers, setIsLoadingSupers] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Ubicació per defecte: València
  const defaultLocation: Location = { lat: 39.4699, lng: -0.3763 };

  // Carregar supermercats des de l'API
  const fetchSupermarkets = useCallback(async (location: Location) => {
    setIsLoadingSupers(true);
    try {
      const response = await fetch(
        `${API_URL}/api/supermarkets/nearby?lat=${location.lat}&lng=${location.lng}&radius=5`
      );
      if (response.ok) {
        const result = await response.json();
        setSupermarkets(result.data || []);
      } else {
        console.error('Error fetching supermarkets:', response.status);
      }
    } catch (error) {
      console.error('Error fetching supermarkets:', error);
    } finally {
      setIsLoadingSupers(false);
    }
  }, []);

  // Obtenir ubicació de l'usuari
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalització no està disponible');
      fetchSupermarkets(defaultLocation);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setIsLocating(false);
        
        // Carregar supermercats propers
        fetchSupermarkets(location);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permís de ubicació denegat');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Ubicació no disponible');
            break;
          case error.TIMEOUT:
            setLocationError('Temps d\'espera esgotat');
            break;
          default:
            setLocationError('Error desconegut');
        }
        // Usar ubicació per defecte
        fetchSupermarkets(defaultLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minuts
      }
    );
  }, [fetchSupermarkets]);

  // Obtenir ubicació al carregar
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Importar CSS de Leaflet
  useEffect(() => {
    import('leaflet/dist/leaflet.css');
    setMapReady(true);
  }, []);

  const center = userLocation || defaultLocation;

  if (!mapReady) {
    return (
      <div className="h-[400px] bg-gray-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botó de localització */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Supermercats propers</h2>
          {isLoadingSupers && (
            <RefreshCw className="w-4 h-4 animate-spin text-green-600" />
          )}
        </div>
        <button
          onClick={getUserLocation}
          disabled={isLocating || isLoadingSupers}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span className="text-sm">
            {isLocating ? 'Localitzant...' : 'Localitzar-me'}
          </span>
        </button>
      </div>

      {/* Error de localització */}
      {locationError && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          ⚠️ {locationError}. Mostrant ubicació per defecte.
        </div>
      )}

      {/* Mapa */}
      <div className="h-[400px] rounded-xl overflow-hidden shadow-lg">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Cercle de radi al voltant de l'usuari */}
          {userLocation && (
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={1000}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 0.1,
              }}
            />
          )}

          {/* Marcadors de supermercats */}
          {supermarkets.map((supermarket) => (
            <Marker
              key={supermarket.id}
              position={[supermarket.lat, supermarket.lng]}
              eventHandlers={{
                click: () => onSupermarketSelect?.(supermarket),
              }}
            >
              <Popup>
                <div className="p-1">
                  <h3 className="font-semibold">{supermarket.name}</h3>
                  <p className="text-sm text-gray-600">{supermarket.address}</p>
                  {supermarket.distance !== undefined && (
                    <p className="text-sm text-green-600 mt-1">
                      📍 {supermarket.distance.toFixed(2)} km
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Llista de supermercats propers */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-500">
          {supermarkets.length} supermercats trobats
        </h3>
        <div className="grid gap-2 max-h-[200px] overflow-y-auto">
          {supermarkets.slice(0, 5).map((supermarket) => (
            <button
              key={supermarket.id}
              onClick={() => onSupermarketSelect?.(supermarket)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                selectedSupermarket?.id === supermarket.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  supermarket.name === 'Mercadona'
                    ? 'bg-green-600'
                    : supermarket.name === 'Consum'
                    ? 'bg-orange-500'
                    : supermarket.name === 'Carrefour'
                    ? 'bg-blue-600'
                    : supermarket.name === 'DIA'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              >
                {supermarket.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{supermarket.name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {supermarket.address}
                </p>
              </div>
              {supermarket.distance !== undefined && (
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    {supermarket.distance.toFixed(1)} km
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
