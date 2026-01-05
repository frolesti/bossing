// Types
export * from './types.js';

// Utils
export * from './utils/geo.js';
export * from './utils/products.js';

// Constants
export const SUPPORTED_SUPERMARKETS = [
  { id: 'mercadona', name: 'Mercadona', color: '#00a650' },
  { id: 'lidl', name: 'Lidl', color: '#0050aa' },
  { id: 'carrefour', name: 'Carrefour', color: '#004e9f' },
  { id: 'aldi', name: 'Aldi', color: '#00005f' },
  { id: 'bonpreu', name: 'Bonpreu', color: '#e30613' },
  { id: 'consum', name: 'Consum', color: '#e2001a' },
  { id: 'dia', name: 'Dia', color: '#e30613' },
  { id: 'eroski', name: 'Eroski', color: '#e30613' },
  { id: 'alcampo', name: 'Alcampo', color: '#00a651' },
] as const;

export const PRODUCT_CATEGORIES = [
  'Lactis',
  'Carnisseria',
  'Peixateria',
  'Fruita i Verdura',
  'Pa i Pastisseria',
  'Begudes',
  'Conserves',
  'Congelats',
  'Neteja',
  'Higiene',
  'Mascotes',
  'Altres',
] as const;
