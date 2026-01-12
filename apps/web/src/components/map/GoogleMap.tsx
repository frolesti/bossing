'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Circle,
} from '@react-google-maps/api';
import { Navigation, Loader2, RefreshCw, Star, Target, Map as MapIcon, Filter } from 'lucide-react';

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
  mercat: '#9333ea', // Morat per mercats municipals
  local: '#6b7280',  // Gris per botigues locals
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
  if (nameLower.includes('mercat') || nameLower.includes('mercado')) return 'mercat';
  return 'local';
}

// Libraries per carregar
const libraries: ('places')[] = ['places'];

if (typeof window !== 'undefined') {
  // Silenciar warnings de Google Maps globalment
  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldSuppress = (args: any[]) => {
    const msg = args[0];
    if (typeof msg !== 'string') return false;
    return (
      msg.includes('google.maps.places.PlacesService') || 
      msg.includes('As of March 1st') ||
      msg.includes('google.maps.Marker') ||
      msg.includes('As of February 21st') ||
      msg.includes('Geocoding Service')
    );
  };

  console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
  };
}

export default function SupermarketGoogleMap({
  onSupermarketSelect,
  selectedSupermarket,
  apiKey,
}: SupermarketMapProps) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [radius, setRadius] = useState(2000); // Radi de cerca en metres
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const userCircleRef = useRef<google.maps.Circle | null>(null);

  // Ubicació per defecte: Passeig Lluís Companys 10, Barcelona
  const defaultLocation: Location = { lat: 41.3916, lng: 2.1812 };

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

  // Funció auxiliar per obtenir coordenades desplaçades (aprox)
  const getOffsetCoordinate = (lat: number, lng: number, officeLat: number, offsetLng: number) => {
    return {
      lat: lat + (officeLat / 111111),
      lng: lng + (offsetLng / (111111 * Math.cos(lat * (Math.PI / 180))))
    };
  };

  // Funció auxiliar per fer una cerca amb paginació (promisificada)
  const fetchPlaces = useCallback((loc: Location, rad: number): Promise<google.maps.places.PlaceResult[]> => {
      return new Promise((resolve) => {
          if (!placesServiceRef.current) return resolve([]);

          const request: google.maps.places.PlaceSearchRequest = {
            location: new google.maps.LatLng(loc.lat, loc.lng),
            radius: rad,
            type: 'grocery_or_supermarket'
          };
          
          let allResults: google.maps.places.PlaceResult[] = [];
          
          placesServiceRef.current.nearbySearch(request, (results, status, pagination) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                  allResults = [...allResults, ...results];
                  
                  // Si hi ha més pagines i encara volem més resultats
                  if (pagination && pagination.hasNextPage) {
                      // Google força un delay de 2s entre pagines
                      setTimeout(() => {
                          try {
                              pagination.nextPage();
                          } catch(e) {
                              resolve(allResults);
                          }
                      }, 2000);
                  } else {
                      resolve(allResults);
                  }
              } else {
                  resolve(allResults);
              }
          });
      });
  }, []);

  // Cercar supermercats propers amb estratègia Multi-Scan
  const searchNearbySupermarkets = useCallback(
    async (location: Location, searchRadius: number = 2000) => {
      if (!placesServiceRef.current) return;

      setIsSearching(true);
      setSupermarkets([]); // Netejar visualment per donar feedback de "nova cerca"

      const searchPoints: { loc: Location; rad: number }[] = [];

      // 1. Punt central (sempre)
      searchPoints.push({ loc: location, rad: searchRadius });

      // 2. Si el radi és gran (>1km), afegim punts satèl·lit per trencar el límit de 60
      if (searchRadius > 1000) {
          const offsetDist = searchRadius * 0.5; // Ens movem a la meitat del radi
          
          // Nord, Sud, Est, Oest
          searchPoints.push({ loc: getOffsetCoordinate(location.lat, location.lng, offsetDist, 0), rad: searchRadius * 0.6 });
          searchPoints.push({ loc: getOffsetCoordinate(location.lat, location.lng, -offsetDist, 0), rad: searchRadius * 0.6 });
          searchPoints.push({ loc: getOffsetCoordinate(location.lat, location.lng, 0, offsetDist), rad: searchRadius * 0.6 });
          searchPoints.push({ loc: getOffsetCoordinate(location.lat, location.lng, 0, -offsetDist), rad: searchRadius * 0.6 });
      }

      // Executar totes les cerques en paral·lel
      const promises = searchPoints.map(p => fetchPlaces(p.loc, p.rad));
      const resultsArrays = await Promise.all(promises);
      
      // Aplanar resultats
      const rawResults = resultsArrays.flat();

      // Processar, deduplicar i filtrar
      const processedParams = rawResults.map((place) => {
            const lat = place.geometry?.location?.lat() || 0;
            const lng = place.geometry?.location?.lng() || 0;
            const chain = detectChain(place.name || '');
            const distance = calculateDistance(location.lat, location.lng, lat, lng);

            return {
              id: place.place_id || '',
              placeId: place.place_id || '',
              name: place.name || 'Supermercat',
              address: place.vicinity || '',
              lat,
              lng,
              distance,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              openNow: place.opening_hours?.isOpen?.(),
              chain,
              photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 100 }),
            } as Supermarket;
      });

      // Map per deduplicar per ID
      const uniqueMap = new Map();
      processedParams.forEach(item => {
          // Filtre estricte de distància respecte al CENTRE REAL (no el punt de cerca)
          if ((item.distance || 0) * 1000 <= searchRadius) {
            uniqueMap.set(item.placeId, item);
          }
      });

      const finalResults = Array.from(uniqueMap.values())
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

      setSupermarkets(finalResults);
      setIsSearching(false);
    },
    [calculateDistance, fetchPlaces]
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

  useEffect(() => {
    // Els warnings ja són silenciats a nivell global fora del component
  }, []);

  // Geocodificació inversa per obtenir l'adreça
  const getReverseAddress = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps) return;
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results) {
        let foundCity = '';
        
        // Iterar sobre tots els resultats (de més precís a menys) per trobar la ciutat
        // Google de vegades no posa la localitat al primer resultat (adreça de carrer)
        for (const result of results) {
            const getComponent = (type: string) => result.address_components.find(c => c.types.includes(type))?.long_name;
            const city = getComponent('locality') || getComponent('postal_town') || getComponent('administrative_area_level_3');
            
            if (city) {
                foundCity = city;
                break;
            }
        }

        // Segon intent: Sublocalitat o barri si no hem trobat ciutat
        if (!foundCity) {
            for (const result of results) {
                 const sub = result.address_components.find(c => c.types.includes('sublocality') || c.types.includes('neighborhood'))?.long_name;
                 if (sub) {
                     foundCity = sub;
                     break;
                 }
            }
        }

        if (foundCity) {
          setCurrentCity(foundCity);
        } else {
            // Si falla tot, extraiem de l'adreça formatada del segon nivell (sol ser "Ciutat, Província")
            const fallback = results[1]?.formatted_address?.split(',')[0] || results[0]?.formatted_address?.split(',')[1]?.trim();
            if (fallback) setCurrentCity(fallback);
        }

        // Actualitzar adreça completa també
        if (results[0]) {
             setUserAddress(results[0].formatted_address);
        }
      }
    });
  }, []);

  // Obtenir ubicació de l'usuari
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalització no està disponible');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setUserAddress(null);
    setCurrentCity(null);

    const successCallback = (position: GeolocationPosition) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setIsLocating(false);

        // Obtenir adreça llegible
        getReverseAddress(location.lat, location.lng);

        // Centrar mapa i cercar supermercats
        if (mapRef.current) {
          mapRef.current.panTo(location);
          mapRef.current.setZoom(15);
        }
        searchNearbySupermarkets(location, radius);
    };

    const errorCallback = (error: GeolocationPositionError) => {
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
        searchNearbySupermarkets(defaultLocation, radius);
    };

    const options = {
        enableHighAccuracy: true, // Provem primer amb alta precisió
        timeout: 10000,
        maximumAge: 0, 
    };

    navigator.geolocation.getCurrentPosition(
      successCallback,
      (error) => {
         // Intentar amb baixa precisió si ha fallat
        if (options.enableHighAccuracy) {
           console.log('High accuracy failed, retrying with low accuracy...');
           navigator.geolocation.getCurrentPosition(
             successCallback, 
             errorCallback, 
             { ...options, enableHighAccuracy: false, timeout: 15000 }
           );
           return;
        }
        errorCallback(error);
      },
      options
    );
  }, [searchNearbySupermarkets, getReverseAddress, radius]);

  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(15);
    }
  };

  // Assegurar que obtenim l'adreça quan tenim ubicació (reactivitat)
  useEffect(() => {
    if (userLocation) {
        getReverseAddress(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, getReverseAddress]);

  // Fallback Intel·ligent: Si el Geocoder falla (per permisos d'API), deduïm la ciutat del supermercat més proper
  useEffect(() => {
      if (!currentCity && supermarkets.length > 0) {
          const closest = supermarkets[0];
          // L'adreça de Places sol ser: "Carrer, Num, Ciutat" o "Carrer, Num, CP Ciutat"
          if (closest && closest.address) {
              const parts = closest.address.split(',');
              // Agafem l'última part (sol ser la ciutat)
              let candidate = parts[parts.length - 1]?.trim();
              
              // Si té Codi Postal (5 digits), el netegem per deixar només el nom
              candidate = candidate.replace(/\b\d{5}\b/g, '').trim();
              
              // Si després de netejar queda buit (només era CP), agafem l'anterior
              if (!candidate && parts.length >= 2) {
                  candidate = parts[parts.length - 2]?.trim();
                  candidate = candidate.replace(/\b\d{5}\b/g, '').trim();
              }

              if (candidate && candidate.length > 2) {
                  setCurrentCity(candidate);
              }
          }
      }
  }, [supermarkets, currentCity]);

  // Gestió manual del cercle per evitar duplicats i error de React
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Netejar cercle anterior si la ubicació es perd
    if (!userLocation) {
        if (userCircleRef.current) {
            userCircleRef.current.setMap(null);
            userCircleRef.current = null;
        }
        return;
    }

    // Crear o actualitzar cercle
    if (!userCircleRef.current) {
        userCircleRef.current = new google.maps.Circle({
            strokeColor: '#22c55e',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#22c55e',
            fillOpacity: 0.1,
            clickable: false,
            map: mapRef.current,
            center: userLocation,
            radius: radius,
            zIndex: 1, // Sota dels marcadors
        });
    } else {
        userCircleRef.current.setCenter(userLocation);
        userCircleRef.current.setRadius(radius);
        // Assegurar que està al mapa
        if (userCircleRef.current.getMap() !== mapRef.current) {
            userCircleRef.current.setMap(mapRef.current);
        }
    }

    // Cleanup al desmuntar component
    return () => {
        if (userCircleRef.current) {
            userCircleRef.current.setMap(null);
            // No el fem null aquí per si React fa el "remount" ràpid, però millor assegurar
            userCircleRef.current = null; 
        }
    };
  }, [userLocation, radius, mapRef.current]);

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
      <div className="space-y-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Supermercats propers</h2>
              {isSearching && (
                <RefreshCw className="w-4 h-4 animate-spin text-green-600" />
              )}
            </div>
            
            {/* City Badge - Header Position */}
            <div className="mt-2 text-left">
                {currentCity ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 border border-green-100 transition-all">
                        <MapIcon className="w-3.5 h-3.5" />
                        <span className="text-sm font-bold">{currentCity}</span>
                    </div>
                ) : userLocation ? (
                     <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 h-7">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Detectant ciutat...
                     </p>
                ) : (
                    <p className="text-xs text-gray-400 mt-1 h-7 flex items-center">
                        Localitza't per veure la teva ciutat
                    </p>
                )}
                
                {userAddress && (
                    <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]" title={userAddress}>
                        {userAddress}
                    </p>
                )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={getUserLocation}
              disabled={isLocating || isSearching}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              <span className="text-sm hidden sm:inline">
                {isLocating ? 'Localitzant...' : 'Localitzar'}
              </span>
            </button>
          </div>
        </div>

        {/* Slider de distància */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="flex items-center gap-1.5 text-gray-600">
               <Filter className="w-4 h-4" />
               Radi: <span className="font-semibold text-green-700">{(radius / 1000).toFixed(1)} km</span>
            </span>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
               {supermarkets.length} resultats
            </span>
          </div>
          <input
            type="range"
            min="500"
            max="5000"
            step="100"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            onMouseUp={() => {
                const loc = userLocation || defaultLocation;
                searchNearbySupermarkets(loc, radius);
            }}
            onTouchEnd={() => {
                const loc = userLocation || defaultLocation;
                searchNearbySupermarkets(loc, radius);
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
           <div className="flex justify-between text-xs text-gray-400 mt-1">
             <span>500m</span>
             <span>5km</span>
           </div>
        </div>
      </div>

      {/* Error de localització */}
      {locationError && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          ⚠️ {locationError}. Mostrant ubicació per defecte (Barcelona).
        </div>
      )}

      {/* Mapa */}
      <div className="h-[400px] rounded-xl overflow-hidden shadow-lg relative group">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={14}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {/* Marcador de l'usuari */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 2,
                anchor: new google.maps.Point(12, 22),
              }}
              title="La teva ubicació"
              zIndex={999}
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

        {/* Botó flotant per recentrar */}
        {userLocation && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-6 right-14 bg-white p-2.5 rounded shadow-md text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-all z-10 border border-gray-100"
            title="Centrar a la meva ubicació"
            style={{ right: '60px', bottom: '24px' }} // Ajustar posició manualment per no trepitjar controls de Google
          >
            <Target className="w-5 h-5" />
          </button>
        )}
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
