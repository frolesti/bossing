import { calculateDistance } from '@bossing/shared';

export interface AreaLocation {
  lat: number;
  lng: number;
  source: 'device' | 'manual';
}

export interface NearbyStore {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  chain: string;
  distance: number;
}

export const COMPARABLE_CHAINS = [
  'mercadona', 'consum', 'carrefour', 'dia', 'bonpreu', 'ametller',
  'caprabo', 'lasirena', 'plusfresc', 'condis', 'eroski',
  'bonarea', 'sorli', 'veritas',
];

export function detectChain(name: string): string {
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(aparcament|aparcamiento|parking|gasolinera)\b/.test(normalized)) return 'local';
  const aliases: [RegExp, string][] = [
    [/mercadona/, 'mercadona'], [/consum/, 'consum'], [/carrefour/, 'carrefour'],
    [/\bdia\b/, 'dia'], [/bonpreu|bon preu|esclat/, 'bonpreu'],
    [/ametller/, 'ametller'], [/caprabo/, 'caprabo'], [/la sirena/, 'lasirena'],
    [/plusfresc|plus fresc/, 'plusfresc'], [/condis/, 'condis'], [/eroski/, 'eroski'],
    [/bon\s*area/, 'bonarea'], [/sorli/, 'sorli'],
    [/\bveritas\b/, 'veritas'],
    [/lidl/, 'lidl'], [/aldi/, 'aldi'],
  ];
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] || 'local';
}

export function storesInRadius(center: AreaLocation, stores: NearbyStore[], radiusMeters: number): NearbyStore[] {
  return [...new Map(stores.map(store => [store.id, {
    ...store, distance: calculateDistance(center, store),
  }])).values()].filter(store => store.id && store.distance * 1000 <= radiusMeters)
    .sort((first, second) => first.distance - second.distance);
}

export function selectedStores(stores: NearbyStore[], excludedIds: string[]): NearbyStore[] {
  return stores.filter(store => COMPARABLE_CHAINS.includes(store.chain) && !excludedIds.includes(store.id));
}