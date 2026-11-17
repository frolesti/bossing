'use client';

import { useState } from 'react';
import { LocateFixed, MapPin, Search, Loader2 } from 'lucide-react';
import { useShoppingArea } from '@/context/ShoppingAreaContext';
import { useProgressState } from '@/context/ShoppingProgressContext';
import { COMPARABLE_CHAINS } from '@/lib/shopping-area';

export function ShoppingAreaControls() {
  const area = useShoppingArea();
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState('');
  return (
    <section aria-label="Zona de compra" className="space-y-3 border-b border-surface-300 pb-4">
      <div className="flex items-start gap-2">
        <MapPin className="w-5 h-5 mt-1 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">Zona de compra</h2>
          <p className="text-sm text-ink-secondary break-words" aria-live="polite">
            {area.isLocating ? 'Localitzant...' : area.address || (area.location
              ? `${area.location.lat.toFixed(5)}, ${area.location.lng.toFixed(5)}` : 'Ubicacio pendent')}
          </p>
        </div>
        <button type="button" title="Canviar ubicacio" aria-label="Canviar ubicacio"
          onClick={() => setEditingAddress(value => !value)} className="p-2 rounded-md hover:bg-surface-200">
          <Search className="w-5 h-5" />
        </button>
        <button type="button" title="Utilitzar la ubicacio del dispositiu" aria-label="Utilitzar la ubicacio del dispositiu"
          onClick={area.locate} disabled={area.isLocating} className="p-2 rounded-md hover:bg-surface-200 disabled:opacity-40">
          {area.isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
        </button>
      </div>
      {(editingAddress || !area.location) && (
        <form className="flex items-end gap-2" onSubmit={async event => {
          event.preventDefault();
          await area.useAddress(address);
        }}>
          <label className="flex-1 min-w-0 text-xs text-ink-secondary">Adreca o municipi
            <input value={address} onChange={event => setAddress(event.target.value)} autoComplete="street-address"
              className="block w-full mt-1 rounded-md border border-surface-300 px-3 py-2 text-sm text-ink bg-white" />
          </label>
          <button type="submit" aria-label="Cercar ubicacio" title="Cercar ubicacio"
            disabled={address.trim().length < 3}
            className="p-2.5 bg-brand-600 text-white rounded-md disabled:opacity-40">
            <Search className="w-5 h-5" />
          </button>
        </form>
      )}
      {area.error && <p role="status" className="text-sm text-danger-500">{area.error}</p>}
      {area.address && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
        className="block text-xs text-ink-muted underline">Adreces: OpenStreetMap contributors</a>}
      <label className="block text-sm text-ink">
        <span className="flex justify-between gap-3"><span>Radi de cerca</span>
          <output>{area.radiusMeters < 1000 ? `${area.radiusMeters} m` : `${area.radiusMeters / 1000} km`}</output>
        </span>
        <input type="range" aria-label="Radi de cerca" min={50} max={2000} step={50}
          value={area.radiusMeters} onChange={event => area.setRadiusMeters(Number(event.target.value))}
          className="w-full mt-2 accent-brand-600" />
      </label>
    </section>
  );
}

export function StoreSelection({ compact = false }: { compact?: boolean }) {
  const area = useShoppingArea();
  const [showUnsupported, setShowUnsupported] = useProgressState('showUnsupportedStores');
  const [showAll, setShowAll] = useProgressState('showAllStores');
  const comparableStores = area.stores.filter(store => COMPARABLE_CHAINS.includes(store.chain));
  const unsupportedStores = area.stores.filter(store => !COMPARABLE_CHAINS.includes(store.chain));
  const visibleStores = compact && !showAll ? comparableStores.slice(0, 6) : comparableStores;
  return (
    <section aria-label="Establiments dins del radi" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Supermercats propers</h2>
        <span className="text-xs text-ink-secondary" aria-live="polite">
          {area.isSearching ? 'Cercant...' : `${area.includedStores.length} seleccionats · ${area.stores.filter(store => COMPARABLE_CHAINS.includes(store.chain)).length} amb comparador · ${area.stores.length} propers`}
        </span>
      </div>
      {area.isSearching && <Loader2 aria-label="Cercant supermercats" className="w-5 h-5 animate-spin text-brand-600" />}
      {!area.isSearching && area.location && !area.stores.length && !area.error && (
        <p className="text-sm text-ink-secondary">Cap supermercat dins d’aquest radi.</p>
      )}
      <div className="divide-y divide-surface-200">
        {[...visibleStores, ...(showUnsupported ? unsupportedStores : [])].map(store => {
          const supported = COMPARABLE_CHAINS.includes(store.chain);
          return (
            <label key={store.id} className={`flex items-start gap-3 py-3 ${supported ? 'cursor-pointer' : 'opacity-60'}`}>
              <input type="checkbox" checked={supported && !area.excludedIds.includes(store.id)}
                disabled={!supported} onChange={() => area.toggleStore(store.id)}
                aria-label={`Incloure ${store.name}, ${store.address}`}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink break-words">{store.name}</span>
                <span className="block text-xs text-ink-secondary break-words">{store.address}</span>
                {['bonarea', 'ametller'].includes(store.chain) && <span className="block text-xs text-ink-muted">Cerca de productes i marques</span>}
                {!supported && <span className="block text-xs text-ink-muted">Sense comparador de preus</span>}
              </span>
              <span className="shrink-0 text-xs text-ink-secondary pt-1">
                {store.distance < 1 ? `${Math.round(store.distance * 1000)} m` : `${store.distance.toFixed(1)} km`}
              </span>
            </label>
          );
        })}
      </div>
      {compact && comparableStores.length > 6 && <button type="button" aria-expanded={showAll}
        onClick={() => setShowAll(value => !value)} className="min-h-[44px] text-sm text-brand-600 underline">
        {showAll ? 'Mostra menys supermercats' : `Mostra tots els supermercats (${comparableStores.length})`}
      </button>}
      {unsupportedStores.length > 0 && <button type="button" aria-expanded={showUnsupported}
        onClick={() => setShowUnsupported(value => !value)} className="min-h-[44px] text-sm text-ink-secondary underline">
        {showUnsupported ? 'Amaga' : 'Mostra'} altres establiments ({unsupportedStores.length})
      </button>}
    </section>
  );
}