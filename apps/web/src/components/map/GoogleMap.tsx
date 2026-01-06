'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Circle,
} from '@react-google-maps/api';
import { Navigation, Loader2, RefreshCw, Star, Clock, Phone } from 'lucide-react';

// Tipus per a la ubicació
interface Location {
  lat: number;
  lng: number;
}

// Tipus per a supermercats (de Google Places)
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

// Props del component
interface SupermarketMapProps {
  onSupermarketSelect?: (supermarket: Supermarket) => void;
  selectedSupermarket?: Supermarket | null;
  apiKey: string;
}

// Estil del mapa
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Opcions del mapa
const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

// Colors per cada cadena de supermercats
const chainColors: Record<string, string> = {
  mercadona: '#16a34a',
  consum: '#f97316',
  carrefour: '#2563eb',
  dia: '#dc2626',
  lidl: '#facc15',
  aldi: '#0ea5e9',
  default: '#6b7280',
};

// Detectar la cadena del nom
function detectChain(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('mercadona')) return 'mercadona';
  if (nameLower.includes('consum')) return 'consum';
  if (nameLower.includes('carrefour')) return 'carrefour';
  if (nameLower.includes('dia') || nameLower.includes('día')) return 'dia';
  if (nameLower.includes('lidl')) return 'lidl';
  if (nameLower.includes('aldi')) return 'aldi';
  if (nameLower.includes('alcampo')) return 'alcampo';
  if (nameLower.includes('eroski')) return 'eroski';
  if (nameLower.includes('hipercor') || nameLower.includes('el corte')) return 'elcorteingles';
  return 'default';
}

// Libraries per carregar
const libraries: ('places')[] = ['places'];

export default function SupermarketGoogleMap({
  onSupermarketSelect,
  selectedSupermarket,
  apiKey,
}: SupermarketMapProps) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Ubicació per defecte: València
  const defaultLocation: Location = { lat: 39.4699, lng: -0.3763 };

  // Carregar Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

  // Calcular distància (Haversine)
  const calculateDistance = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    []
  );

  // Cercar supermercats propers amb Places API
  const searchNearbySupermarkets = useCallback(
    async (location: Location) => {
      if (!placesServiceRef.current) return;

      setIsSearching(true);

      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: 2000, // 2km
        type: 'supermarket',
        keyword: 'supermercat supermercado mercadona consum carrefour dia lidl',
      };

      placesServiceRef.current.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const supermarketsList: Supermarket[] = results.map((place) => {
            const lat = place.geometry?.location?.lat() || 0;
            const lng = place.geometry?.location?.lng() || 0;
            const chain = detectChain(place.name || '');

            return {
              id: place.place_id || '',
              placeId: place.place_id || '',
              name: place.name || 'Supermercat',
              address: place.vicinity || '',
              lat,
              lng,
              distance: calculateDistance(location.lat, location.lng, lat, lng),
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              openNow: place.opening_hours?.isOpen?.(),
              chain,
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 100 }),
            };
          });

          // Ordenar per distància
          supermarketsList.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          setSupermarkets(supermarketsList);
        }
        setIsSearching(false);
      });
    },
    [calculateDistance]
  );

  // Obtenir detalls d'un lloc
  const getPlaceDetails = useCallback(
    (placeId: string): Promise<Supermarket | null> => {
      return new Promise((resolve) => {
        if (!placesServiceRef.current) {
          resolve(null);
          return;
        }

        const request: google.maps.places.PlaceDetailsRequest = {
          placeId,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'formatted_phone_number',
            'opening_hours',
            'rating',
            'user_ratings_total',
            'geometry',
            'photos',
          ],
        };

        placesServiceRef.current.getDetails(request, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const lat = place.geometry?.location?.lat() || 0;
            const lng = place.geometry?.location?.lng() || 0;

            resolve({
              id: place.place_id || '',
              placeId: place.place_id || '',
              name: place.name || '',
              address: place.formatted_address || '',
              lat,
              lng,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              openNow: place.opening_hours?.isOpen?.(),
              openingHours: place.opening_hours?.weekday_text,
              phone: place.formatted_phone_number,
              chain: detectChain(place.name || ''),
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }),
            });
          } else {
            resolve(null);
          }
        });
      });
    },
    []
  );

  // Obtenir ubicació de l'usuari
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalització no està disponible');
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

        // Centrar mapa i cercar supermercats
        if (mapRef.current) {
          mapRef.current.panTo(location);
          mapRef.current.setZoom(15);
        }
        searchNearbySupermarkets(location);
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
            setLocationError("Temps d'espera esgotat");
            break;
          default:
            setLocationError('Error desconegut');
        }
        // Usar ubicació per defecte
        searchNearbySupermarkets(defaultLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, [searchNearbySupermarkets]);

  // Quan el mapa es carrega
  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      placesServiceRef.current = new google.maps.places.PlacesService(map);
      getUserLocation();
    },
    [getUserLocation]
  );

  // Clicar en un marcador
  const handleMarkerClick = async (supermarket: Supermarket) => {
    setActiveMarker(supermarket.id);
    
    // Obtenir detalls complets
    const details = await getPlaceDetails(supermarket.placeId);
    if (details) {
      onSupermarketSelect?.(details);
    } else {
      onSupermarketSelect?.(supermarket);
    }
  };

  if (loadError) {
    return (
      <div className="h-[400px] bg-red-50 rounded-xl flex items-center justify-center text-red-600">
        Error carregant Google Maps
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[400px] bg-gray-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const center = userLocation || defaultLocation;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Supermercats propers</h2>
          {isSearching && (
            <RefreshCw className="w-4 h-4 animate-spin text-green-600" />
          )}
        </div>
        <button
          onClick={getUserLocation}
          disabled={isLocating || isSearching}
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
          ⚠️ {locationError}. Mostrant ubicació per defecte (València).
        </div>
      )}

      {/* Mapa */}
      <div className="h-[400px] rounded-xl overflow-hidden shadow-lg">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={14}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {/* Cercle al voltant de l'usuari */}
          {userLocation && (
            <Circle
              center={userLocation}
              radius={2000}
              options={{
                strokeColor: '#22c55e',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#22c55e',
                fillOpacity: 0.1,
              }}
            />
          )}

          {/* Marcador de l'usuari */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
              title="La teva ubicació"
            />
          )}

          {/* Marcadors de supermercats */}
          {supermarkets.map((supermarket) => (
            <Marker
              key={supermarket.id}
              position={{ lat: supermarket.lat, lng: supermarket.lng }}
              onClick={() => handleMarkerClick(supermarket)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: chainColors[supermarket.chain || 'default'],
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            >
              {activeMarker === supermarket.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-1 min-w-[150px]">
                    <h3 className="font-semibold text-sm">{supermarket.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {supermarket.address}
                    </p>
                    {supermarket.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs">
                          {supermarket.rating} ({supermarket.userRatingsTotal})
                        </span>
                      </div>
                    )}
                    {supermarket.distance && (
                      <p className="text-xs text-green-600 mt-1">
                        📍 {supermarket.distance.toFixed(2)} km
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}
        </GoogleMap>
      </div>

      {/* Llista de supermercats */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-500">
          {supermarkets.length} supermercats trobats
        </h3>
        <div className="grid gap-2 max-h-[250px] overflow-y-auto">
          {supermarkets.map((supermarket) => (
            <button
              key={supermarket.id}
              onClick={() => handleMarkerClick(supermarket)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                selectedSupermarket?.id === supermarket.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{
                  backgroundColor:
                    chainColors[supermarket.chain || 'default'],
                }}
              >
                {supermarket.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{supermarket.name}</p>
                  {supermarket.openNow !== undefined && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        supermarket.openNow
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {supermarket.openNow ? 'Obert' : 'Tancat'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {supermarket.address}
                </p>
                {supermarket.rating && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-gray-600">
                      {supermarket.rating}
                    </span>
                  </div>
                )}
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
