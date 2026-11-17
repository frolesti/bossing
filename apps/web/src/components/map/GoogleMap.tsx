'use client';

import { useEffect, useState } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { useShoppingArea } from '@/context/ShoppingAreaContext';
import { COMPARABLE_CHAINS } from '@/lib/shopping-area';

const options: google.maps.MapOptions = {
  disableDefaultUI: true, zoomControl: true,
  styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
};

export default function SupermarketGoogleMap() {
  const area = useShoppingArea();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeStore = area.stores.find(store => store.id === activeId);
  useEffect(() => {
    if (!map || !area.location) return;
    const circle = new google.maps.Circle({ map, center: area.location, radius: area.radiusMeters,
      strokeColor: '#198465', fillColor: '#198465', fillOpacity: 0.08, strokeWeight: 1, clickable: false });
    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds, 30);
    return () => circle.setMap(null);
  }, [map, area.location?.lat, area.location?.lng, area.radiusMeters]);

  if (!area.mapsReady || !area.location) {
    return <div className="h-[360px] sm:h-[440px] bg-surface-200 flex items-center justify-center text-sm text-ink-secondary">
      {area.isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Mapa pendent de la ubicacio'}
    </div>;
  }

  return (
    <div className="h-[360px] sm:h-[440px] w-full overflow-hidden" aria-label="Mapa dels supermercats dins del radi">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={area.location} zoom={15}
        options={options} onLoad={setMap} onUnmount={() => setMap(null)}>
        <Marker position={area.location} title="La teva ubicacio"
          icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb',
            fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }} />
        {area.stores.map(store => (
          <Marker key={store.id} position={store} title={`${store.name}, ${store.address}`}
            opacity={area.includedStores.some(included => included.id === store.id) ? 1 : 0.4}
            onClick={() => setActiveId(store.id)} />
        ))}
        {activeStore && <InfoWindow position={activeStore} onCloseClick={() => setActiveId(null)}>
          <div className="max-w-[220px] space-y-2 text-sm text-ink">
            <p className="font-semibold">{activeStore.name}</p>
            <p>{activeStore.address}</p>
            {COMPARABLE_CHAINS.includes(activeStore.chain) ? <label className="flex items-center gap-2">
              <input type="checkbox" checked={!area.excludedIds.includes(activeStore.id)}
                onChange={() => area.toggleStore(activeStore.id)} />
              Incloure a la comparacio
            </label> : <p>Sense comparador de preus</p>}
            <a className="block text-brand-600 underline" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${activeStore.lat},${activeStore.lng}&destination_place_id=${encodeURIComponent(activeStore.id)}`}>
              Com arribar
            </a>
          </div>
        </InfoWindow>}
      </GoogleMap>
    </div>
  );
}