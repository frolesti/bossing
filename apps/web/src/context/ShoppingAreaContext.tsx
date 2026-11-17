'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { selectedStores, storesInRadius, detectChain, type AreaLocation, type NearbyStore } from '@/lib/shopping-area';

const libraries: 'places'[] = ['places'];
const ShoppingAreaContext = createContext<{
  location: AreaLocation | null;
  address: string;
  postalCode?: string;
  radiusMeters: number;
  setRadiusMeters: (radius: number) => void;
  stores: NearbyStore[];
  includedStores: NearbyStore[];
  excludedIds: string[];
  toggleStore: (id: string) => void;
  locate: () => void;
  useAddress: (address: string) => Promise<void>;
  isLocating: boolean;
  isSearching: boolean;
  isResolvingAddress: boolean;
  error: string | null;
  mapsReady: boolean;
} | null>(null);

function GoogleServices({ apiKey, onReady, onError }: {
  apiKey: string; onReady: (ready: boolean) => void; onError: (message: string) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries });
  useEffect(() => { onReady(isLoaded); }, [isLoaded, onReady]);
  useEffect(() => {
    if (loadError) onError('No es pot carregar el servei de mapes.');
  }, [loadError, onError]);
  return null;
}

function searchPlaces(center: { lat: number; lng: number }, radius: number): Promise<google.maps.places.PlaceResult[]> {
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  return new Promise((resolve, reject) => {
    const places: google.maps.places.PlaceResult[] = [];
    service.nearbySearch({ location: center, radius, type: 'supermarket' }, (results, status, pagination) => {
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) return resolve(places);
      if (status !== google.maps.places.PlacesServiceStatus.OK) {
        reject(new Error('No es poden consultar els supermercats propers.'));
        return;
      }
      places.push(...(results || []));
      if (pagination?.hasNextPage) {
        setTimeout(() => {
          try { pagination.nextPage(); } catch (error) { reject(error); }
        }, 2000);
      } else resolve(places);
    });
  });
}

export function ShoppingAreaProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const [location, setLocation] = useState<AreaLocation | null>(null);
  const [radiusMeters, updateRadius] = useState(2000);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ key: string; address: string; postalCode?: string } | null>(null);
  const [discovery, setDiscovery] = useState<{ key: string; radius: number; stores: NearbyStore[] } | null>(null);
  const initialLocationRequested = useRef(false);
  const locationRequest = useRef(0);
  const locationKey = location ? `${location.lat}:${location.lng}` : '';

  const locate = () => {
    if (!navigator.geolocation) { setError('La ubicacio del dispositiu no esta disponible.'); return; }
    const request = ++locationRequest.current;
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, source: 'device' });
      setIsLocating(false);
    }, reason => {
      if (request !== locationRequest.current) return;
      setError(reason.code === 1 ? 'Permis de ubicacio denegat.' : 'No es pot obtenir la ubicacio.');
      setIsLocating(false);
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('shopping-area') || 'null');
      if (saved && Number.isFinite(saved.radiusMeters)) updateRadius(Math.min(2000, Math.max(50, saved.radiusMeters)));
      if (Array.isArray(saved?.excludedIds)) setExcludedIds(saved.excludedIds.filter((id: unknown) => typeof id === 'string'));
      if (saved?.location?.source === 'manual' && Number.isFinite(saved.location.lat) && Number.isFinite(saved.location.lng) &&
        Math.abs(saved.location.lat) <= 90 && Math.abs(saved.location.lng) <= 180) {
        setLocation(saved.location);
        initialLocationRequested.current = true;
      }
    } catch { setError('No es pot recuperar la seleccio anterior.'); }
    setStorageLoaded(true);
    if (!initialLocationRequested.current) { initialLocationRequested.current = true; locate(); }
  }, []);

  useEffect(() => {
    if (storageLoaded) localStorage.setItem('shopping-area', JSON.stringify({ radiusMeters, excludedIds,
      location: location?.source === 'manual' ? location : undefined }));
  }, [storageLoaded, radiusMeters, excludedIds, location]);

  useEffect(() => {
    if (!location) return;
    if (resolved?.key === locationKey) { setIsResolvingAddress(false); return; }
    let cancelled = false;
    const key = locationKey;
    setGeocodeError(null);
    setIsResolvingAddress(true);
    const parameters = new URLSearchParams({ lat: String(location.lat), lng: String(location.lng) });
    fetch(`http://localhost:3001/api/location?${parameters}`).then(async response => {
      if (!response.ok) throw new Error('Location source failed');
      return response.json();
    }).then(result => {
        if (cancelled) return;
        setResolved({ key, address: result.address, postalCode: result.postalCode });
        if (!result.postalCode) setGeocodeError('No es pot confirmar la zona de preus d’aquesta ubicacio.');
      }).catch(() => {
        if (!cancelled) setGeocodeError('No es pot resoldre l’adreca de la ubicacio.');
      }).finally(() => { if (!cancelled) setIsResolvingAddress(false); });
    return () => { cancelled = true; };
  }, [locationKey]);

  useEffect(() => {
    if (!mapsReady || !location) return;
    if (discovery?.key === locationKey && discovery.radius >= radiusMeters) { setSearching(false); return; }
    let cancelled = false;
    setPlacesError(null);
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const points = [{ lat: location.lat, lng: location.lng, radius: radiusMeters }];
        if (radiusMeters > 1000) {
          const offset = radiusMeters * 0.5;
          for (const [north, east] of [[offset, 0], [-offset, 0], [0, offset], [0, -offset]]) {
            points.push({ lat: location.lat + north / 111111,
              lng: location.lng + east / (111111 * Math.cos(location.lat * Math.PI / 180)), radius: radiusMeters * 0.6 });
          }
        }
        const results = (await Promise.all(points.map(point => searchPlaces(point, point.radius)))).flat();
        const stores = results.filter(place => place.place_id && place.geometry?.location).map(place => ({
          id: place.place_id!, name: place.name || 'Supermercat', address: place.vicinity || '',
          lat: place.geometry!.location!.lat(), lng: place.geometry!.location!.lng(),
          chain: detectChain(place.name || ''), distance: 0,
        }));
        if (!cancelled) setDiscovery({ key: locationKey, radius: radiusMeters,
          stores: storesInRadius(location, stores, radiusMeters) });
      } catch (reason) {
        if (!cancelled) { setPlacesError(reason instanceof Error ? reason.message : 'Error cercant supermercats.'); setDiscovery(null); }
      } finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mapsReady, locationKey, radiusMeters]);

  const useAddress = async (address: string) => {
    if (!address.trim()) return;
    const request = ++locationRequest.current;
    setIsLocating(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3001/api/location/search?${new URLSearchParams({ q: address })}`);
      if (!response.ok) throw new Error('Location source failed');
      const result = await response.json();
      if (request === locationRequest.current) {
        setResolved({ key: `${result.lat}:${result.lng}`, address: result.address, postalCode: result.postalCode });
        setGeocodeError(result.postalCode ? null : 'No es pot confirmar la zona de preus d’aquesta ubicacio.');
        setLocation({ lat: result.lat, lng: result.lng, source: 'manual' });
      }
    } catch {
      if (request === locationRequest.current) setError('No s’ha trobat aquesta adreca.');
    } finally { if (request === locationRequest.current) setIsLocating(false); }
  };

  const currentDiscovery = discovery?.key === locationKey && discovery.radius >= radiusMeters;
  const stores = location && currentDiscovery ? storesInRadius(location, discovery.stores, radiusMeters) : [];
  const currentAddress = resolved?.key === locationKey ? resolved : null;
  return (
    <ShoppingAreaContext.Provider value={{
      location, address: currentAddress?.address || '', postalCode: currentAddress?.postalCode,
      radiusMeters, setRadiusMeters: radius => updateRadius(Math.min(2000, Math.max(50, radius))),
      stores, includedStores: selectedStores(stores, excludedIds), excludedIds,
      toggleStore: id => setExcludedIds(ids => ids.includes(id) ? ids.filter(existing => existing !== id) : [...ids, id]),
      locate, useAddress, isLocating, isSearching: searching || (!!location && mapsReady && !currentDiscovery && !placesError),
      isResolvingAddress, mapsReady,
      error: !apiKey ? 'El servei de mapes no esta configurat.' : error || placesError || geocodeError,
    }}>
      {apiKey && <GoogleServices apiKey={apiKey} onReady={setMapsReady} onError={setError} />}
      {children}
    </ShoppingAreaContext.Provider>
  );
}

export function useShoppingArea() {
  const area = useContext(ShoppingAreaContext);
  if (!area) throw new Error('ShoppingAreaProvider is required');
  return area;
}